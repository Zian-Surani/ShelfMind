from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import Base, Decision, Inventory, Product, PurchaseOrder, ShelfObservation, SystemSetting
from app.schemas import ImageReviewRequest
from app.services import image_review
from app.services.history_import import import_history
from app.services.retail import approve_decision, modify_decision, reject_decision
from app.services.vision_detector import measure_image

ROOT = Path(__file__).resolve().parents[2]
NOW = datetime(2026, 9, 17, 12, tzinfo=timezone.utc)


@pytest.fixture
def db(monkeypatch):
    monkeypatch.setattr(image_review, "utcnow", lambda: NOW)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def fks(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False, autoflush=False) as session:
        import_history(session, (ROOT / "shelfmind_retail_history.csv").read_bytes(), "history.csv", generated=True)
        store_id = session.scalar(select(Inventory.store_id))
        for index in range(2):
            session.add(ShelfObservation(id=f"photo-{index}", store_id=store_id, observed_at=NOW,
                source="ShelfMind vision", source_image_path=f"uploaded:{index}.png", visible_quantity=24,
                detection_confidence=0.8, detection_payload={"quality": {"status": "CLEAR"}}))
        session.commit()
        yield session
    engine.dispose()


def request(quantity=3, **changes):
    return ImageReviewRequest(**{"request_id": uuid4(), "product_id": "SKU001", "image_ids": ["photo-0", "photo-1"],
                                 "confirmed_quantity": quantity, "quantity_verified": True, **changes})


def test_quantity_changes_actual_mdp_action(db):
    product = db.get(Product, "SKU001")
    history = image_review.product_history(db, product.inventories[0].store_id, product.id)
    low = image_review.evaluate_count(product, 0, history)
    high = image_review.evaluate_count(product, 95, history)
    assert low["orderQuantity"] > 0
    assert high["orderQuantity"] == 0
    assert high["direction"] == "LESS"
    assert low["actions"] != high["actions"]
    assert low["converged"]
    assert all(row["quantity"] % product.minimum_order_quantity == 0 for row in low["actions"])
    assert low["historySamples"] > 14


def test_evidence_idempotency_and_no_inventory_overwrite(db):
    original = [(row.id, row.shelf_quantity, row.backroom_quantity, row.incoming_quantity) for row in db.scalars(select(Inventory))]
    payload = request(image_ids=["photo-0", "photo-1", "photo-0"])
    result = image_review.review_decision(db, payload)
    again = image_review.review_decision(db, payload)
    assert again["id"] == result["id"]
    assert db.query(Decision).count() == 1
    assert result["currentStock"] == 3  # Not 24 + 24 raw detections.
    assert result["imageReview"]["imageIds"] == ["photo-0", "photo-1"]
    assert original == [(row.id, row.shelf_quantity, row.backroom_quantity, row.incoming_quantity) for row in db.scalars(select(Inventory))]
    with pytest.raises(ValueError, match="already used"):
        image_review.review_decision(db, request(4, request_id=payload.request_id))


def test_reviews_are_product_specific_and_supersede_old_counts(db):
    first = image_review.review_decision(db, request())
    image_review.review_decision(db, request(20, product_id="SKU002"))
    newest = image_review.review_decision(db, request(10))
    assert db.get(Decision, first["id"]).status == "SUPERSEDED"
    history = image_review.product_review_history(db, "SKU001")
    assert {row["productId"] for row in history["reviews"]} == {"SKU001"}
    assert history["reviews"][0]["id"] == newest["id"]
    assert history["historyGenerated"] is True
    with pytest.raises(ValueError, match="Only pending"):
        approve_decision(db, first["id"])


def enable_auto(db):
    store_id = db.scalar(select(Inventory.store_id))
    db.add(SystemSetting(key=f"store:{store_id}", value={"autonomyMode": "AUTO_UNDER_THRESHOLD", "maxAutoQuantity": 100, "maxAutoSpend": 10000}))
    db.commit()


def test_auto_approval_is_gated_and_does_not_dispatch(db):
    enable_auto(db)
    result = image_review.review_decision(db, request())
    assert result["status"] == "AUTO_EXECUTED", result["imageReview"]["autoChecks"]
    assert db.query(PurchaseOrder).count() == 0
    assert all(row["passed"] for row in result["imageReview"]["autoChecks"])
    assert result["imageReview"]["historyGenerated"] is True


def test_blurry_or_unmeasured_photo_forces_manual_review(db):
    enable_auto(db)
    db.get(ShelfObservation, "photo-1").detection_payload = {"quality": {"status": "REVIEW_REQUIRED", "reasons": ["Possible blur"]}}
    db.commit()
    result = image_review.review_decision(db, request())
    assert result["status"] == "APPROVAL_REQUIRED"
    assert not result["imageReview"]["imageQualityPassed"]
    approved = approve_decision(db, result["id"])
    assert approved.status == "APPROVED"
    assert approved.human_approval.decided_by == "Zian"
    assert db.query(PurchaseOrder).count() == 0


def test_modify_and_reject_are_saved_without_supplier_order(db):
    first = image_review.review_decision(db, request())
    with pytest.raises(ValueError, match="minimum order"):
        modify_decision(db, first["id"], 3, "Budget")
    adjusted = modify_decision(db, first["id"], 5, "Budget")
    assert adjusted.status == "MODIFIED"
    assert adjusted.human_approval.reason == "Budget"
    assert db.query(PurchaseOrder).count() == 0
    second = image_review.review_decision(db, request(7))
    assert reject_decision(db, second["id"], "Count needs another check").status == "REJECTED"


@pytest.mark.parametrize("changes", [{"product_id": "UNKNOWN"}, {"image_ids": ["missing"]}, {"confirmed_quantity": 101}])
def test_invalid_review_has_no_side_effects(db, changes):
    with pytest.raises(ValueError):
        image_review.review_decision(db, request(**changes))
    db.rollback()
    assert db.query(Decision).count() == 0


def test_api_requires_explicit_count_confirmation(db):
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            payload = request().model_dump(mode="json")
            payload["quantity_verified"] = False
            assert client.post("/api/shelfwatch/review", json=payload).status_code == 422
            payload["quantity_verified"] = True
            response = client.post("/api/shelfwatch/review", json=payload)
            assert response.status_code == 200, response.text
            assert response.json()["currentStock"] == 3
    finally:
        app.dependency_overrides.clear()


def test_blur_measurement_and_overlapping_box_coverage():
    rng = np.random.default_rng(1)
    sharp = rng.integers(40, 215, size=(320, 320, 3), dtype=np.uint8)
    blurry = cv2.GaussianBlur(sharp, (31, 31), 8)
    detections = [{"bbox": [0, 0, 160, 320], "confidence": 0.9}] * 2
    measured = measure_image(sharp, detections, 60)
    blurred = measure_image(blurry, detections, 60)
    assert measured["image_coverage_percent"] == 50  # Union, not summed overlapping areas.
    assert measured["status"] == "CLEAR"
    assert blurred["sharpness"] < measured["sharpness"]
    assert "Possible blur" in blurred["reasons"]

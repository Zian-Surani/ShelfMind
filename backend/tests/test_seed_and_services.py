from __future__ import annotations

from pathlib import Path
import pytest

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.models import (
    Base,
    Decision,
    HumanApproval,
    Inventory,
    InventorySnapshot,
    Product,
    SalesRecord,
)
from app.seed import seed_database
from app.services.retail import modify_decision, reject_decision
from app.services.rl import RetailState, ValueIterationEngine


def make_session(tmp_path: Path) -> Session:
    engine = create_engine(f"sqlite:///{tmp_path / 'shelfmind.db'}", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    return SessionLocal()


def test_seed_produces_consistent_inventory_history(tmp_path: Path) -> None:
    db = make_session(tmp_path)
    result = seed_database(db, reset=False, history_days=45, run_dqn=False)
    assert result["status"] == "seeded"
    assert db.query(Product).count() >= 6
    assert db.query(SalesRecord).count() >= 45 * 6
    assert db.query(Decision).count() >= 6

    for inventory in db.scalars(select(Inventory)):
        assert inventory.shelf_quantity >= 0
        assert inventory.backroom_quantity >= 0
        assert inventory.incoming_quantity >= 0

    for snapshot in db.scalars(select(InventorySnapshot)):
        opening = snapshot.opening_shelf_quantity + snapshot.opening_backroom_quantity + snapshot.received_quantity
        assert snapshot.units_sold <= opening + snapshot.lost_sales_quantity
        assert snapshot.closing_shelf_quantity >= 0
        assert snapshot.closing_backroom_quantity >= 0


def test_value_iteration_evaluates_real_actions() -> None:
    engine = ValueIterationEngine(max_iterations=40)
    result = engine.run_training(seed=20260914)
    state = RetailState("LOW", "HIGH", 2, "LOW", "HIGH")
    actions = engine.evaluate_actions(state)
    assert result.number_of_states > 100
    assert actions[0]["isOptimal"] is True
    assert actions[0]["value"] >= actions[-1]["value"]


def test_human_modification_preserves_original_recommendation(tmp_path: Path) -> None:
    db = make_session(tmp_path)
    seed_database(db, reset=False, history_days=45, run_dqn=False)
    decision = db.scalar(select(Decision).where(Decision.status == "APPROVAL_REQUIRED"))
    assert decision is not None
    original = decision.recommendation_payload["original_quantity"]
    modified = modify_decision(db, decision.id, 10, "Budget constraint")
    approval = db.scalar(select(HumanApproval).where(HumanApproval.decision_id == decision.id))
    assert modified.quantity == 10
    assert modified.recommendation_payload["original_quantity"] == original
    assert approval is not None
    assert approval.original_quantity == original
    assert approval.human_quantity == 10
    with pytest.raises(ValueError, match="Only pending"):
        reject_decision(db, decision.id, "Already executed")

from __future__ import annotations

from decimal import Decimal
from io import BytesIO

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, Query
from starlette.concurrency import run_in_threadpool
from PIL import Image, UnidentifiedImageError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.db import get_db
from app.models import (
    AuditEvent,
    Decision,
    Inventory,
    Product,
    PurchaseOrder,
    RLExperiment,
    SalesRecord,
    ShelfObservation,
    ShelfAllocation,
    Store,
    Supplier,
    SystemSetting,
    utcnow,
    new_id,
)
from app.schemas import (
    AgentQueryRequest,
    DecisionModifyRequest,
    DecisionRejectRequest,
    RLRunRequest,
    SaleRequest,
    ShelfReallocationRequest,
    ShelfRestockRequest,
    SimulationRunRequest,
    SimulationStepRequest,
    StoreSettingsRequest,
    ImageReviewRequest,
)
from app.services.retail import (
    agent_briefing,
    answer_agent_query,
    approve_decision,
    latest_store,
    modify_decision,
    record_sale,
    reallocate_shelf,
    reject_decision,
    reset_simulation,
    restock_shelf_from_backroom,
    run_rl_experiment,
    simulation_step,
    make_decision_for_product,
)
from app.services.serializers import (
    analytics_payload,
    audit_to_frontend,
    dashboard_payload,
    decision_to_frontend,
    experiment_to_dict,
    product_to_frontend,
    purchase_orders_payload,
    shelfwatch_to_frontend,
    suppliers_payload,
)
from app.services.shelfwatch_adapter import ShelfWatchAdapter, get_shelfwatch_adapter
from app.services.history_import import import_history
from app.services.preferences import store_preferences
from app.services.image_review import review_decision, product_review_history


app = FastAPI(title="ShelfMind Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, object]:
    db.execute(text("select 1"))
    inspector = inspect(db.bind)
    tables = set(inspector.get_table_names())
    products = db.query(Product).count() if "products" in tables else 0
    sales = db.query(SalesRecord).count() if "sales_records" in tables else 0
    return {
        "status": "ok",
        "database": "connected",
        "schemaAvailable": "products" in tables and "decisions" in tables,
        "supabaseProjectId": settings.supabase_project_id,
        "productsCount": products,
        "salesRecordsCount": sales,
        "shelfwatch": ShelfWatchAdapter().summarize(),
    }


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "ShelfMind API is running", "docs": "/docs", "health": "/health"}


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)) -> dict[str, object]:
    return dashboard_payload(db)


@app.put("/api/settings")
def save_settings(payload: StoreSettingsRequest, db: Session = Depends(get_db)):
    store = latest_store(db)
    store.name = payload.storeName.strip()
    store.manager_name = payload.managerName.strip()
    if not store.name or not store.manager_name:
        raise HTTPException(status_code=422, detail="Store and manager names cannot be blank")
    key = f"store:{store.id}"
    record = db.get(SystemSetting, key)
    if not record:
        record = SystemSetting(key=key, value={})
        db.add(record)
    record.value = payload.model_dump()
    db.commit()
    return store_preferences(db, store)


@app.get("/api/products")
def products(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    store = latest_store(db)
    rows = db.scalars(select(Product).options(selectinload(Product.category), selectinload(Product.supplier)).order_by(Product.name)).all()
    return [product_to_frontend(db, product, store) for product in rows]


@app.get("/api/products/{product_id}")
def product_detail(product_id: str, db: Session = Depends(get_db)) -> dict[str, object]:
    store = latest_store(db)
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_frontend(db, product, store)


@app.get("/api/inventory")
def inventory(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    return products(db)


@app.get("/api/inventory/{product_id}")
def inventory_detail(product_id: str, db: Session = Depends(get_db)) -> dict[str, object]:
    return product_detail(product_id, db)


@app.post("/api/inventory/simulate-sale")
def simulate_sale(payload: SaleRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        sale = record_sale(db, payload.product_id, payload.quantity, payload.promotion_flag, payload.demand_regime)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"id": sale.id, "unitsSold": sale.units_sold, "lostSalesQuantity": sale.lost_sales_quantity}


@app.post("/api/inventory/reallocate-shelf")
def reallocate(payload: ShelfReallocationRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        allocation = reallocate_shelf(db, payload.product_id, payload.delta_positions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"productId": allocation.product_id, "facings": allocation.facings}


@app.post("/api/shelfwatch/restock")
def shelf_restock(payload: ShelfRestockRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        return restock_shelf_from_backroom(db, payload.product_name, payload.count)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/decisions")
def decisions(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    rows = db.scalars(
        select(Decision)
        .options(
            selectinload(Decision.product).selectinload(Product.category),
            selectinload(Decision.evaluations),
            selectinload(Decision.human_approval),
        )
        .order_by(Decision.recommended_at.desc())
    ).all()
    return [decision_to_frontend(row) for row in rows]


@app.post("/api/decisions/generate")
def generate_decisions(db: Session = Depends(get_db)):
    store = latest_store(db)
    db.execute(select(Store).where(Store.id == store.id).with_for_update())
    for product in db.scalars(select(Product).join(Inventory).where(Inventory.store_id == store.id)):
        pending = db.scalar(select(Decision).where(Decision.store_id == store.id, Decision.product_id == product.id,
                                                   Decision.status == "APPROVAL_REQUIRED").limit(1))
        if not pending:
            make_decision_for_product(db, store, product)
    db.commit()
    return decisions(db)


@app.get("/api/decisions/{decision_id}")
def decision_detail(decision_id: str, db: Session = Depends(get_db)) -> dict[str, object]:
    decision = db.scalar(
        select(Decision)
        .options(
            selectinload(Decision.product).selectinload(Product.category),
            selectinload(Decision.evaluations),
            selectinload(Decision.human_approval),
        )
        .where(Decision.id == decision_id)
    )
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision_to_frontend(decision)


@app.post("/api/decisions/{decision_id}/approve")
def approve(decision_id: str, db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        return decision_to_frontend(approve_decision(db, decision_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/decisions/{decision_id}/modify")
def modify(decision_id: str, payload: DecisionModifyRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        return decision_to_frontend(modify_decision(db, decision_id, payload.quantity, payload.reason))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/decisions/{decision_id}/reject")
def reject(decision_id: str, payload: DecisionRejectRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        return decision_to_frontend(reject_decision(db, decision_id, payload.reason))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/approvals")
def approvals(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    return [row for row in decisions(db) if row["status"] == "APPROVAL_REQUIRED"]


@app.get("/api/shelfwatch")
def shelfwatch(db: Session = Depends(get_db)) -> dict[str, object]:
    return shelfwatch_to_frontend(db, latest_store(db))


@app.post("/api/shelfwatch/analyze")
async def shelfwatch_analyze(file: UploadFile = File(...), db: Session = Depends(get_db)) -> dict[str, object]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    image_bytes = await file.read(10 * 1024 * 1024 + 1)
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be at most 10 MB")
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            if img.width * img.height > 25_000_000:
                raise ValueError("Image must be at most 25 megapixels")
            img.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=422, detail="Invalid image or image exceeds 25 megapixels") from exc
    adapter = get_shelfwatch_adapter()
    try:
        result = await run_in_threadpool(adapter.analyze_image_bytes, image_bytes, file.filename or "uploaded-image")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    store = latest_store(db)
    db.execute(select(Store).where(Store.id == store.id).with_for_update())
    duplicate = db.scalar(select(ShelfObservation).where(ShelfObservation.store_id == store.id,
        ShelfObservation.detection_payload["image_sha256"].as_string() == result["image_sha256"]).limit(1))
    if duplicate:
        return {**duplicate.detection_payload, "observation_id": duplicate.id}
    result["observation_id"] = new_id("shelfobs")
    persisted_payload = dict(result)
    avg_confidence = Decimal(str(result.get("average_confidence", 0)))
    db.add(
        ShelfObservation(
            id=result["observation_id"],
            store_id=store.id,
            product_id=None,
            observed_at=utcnow(),
            source=str(result["source"]),
            source_image_path=str(result["source_image_path"]),
            visible_quantity=int(result["product_count"]),
            shelf_occupancy_percent=None,
            detection_confidence=avg_confidence,
            detection_payload=persisted_payload,
        )
    )
    db.add(
        AuditEvent(
            store_id=store.id,
            event_type="AI_OBSERVATION",
            category="AI",
            message="ShelfMind image analysis recorded from uploaded shelf image.",
            state_summary="Uploaded image processed by the bundled ONNX detector.",
            action_summary="Mapped detection count into ShelfMind observation stream.",
            execution_summary="SHELFWATCH_ANALYZE",
            outcome_status="NEEDS_REVIEW" if result["needs_reinspection"] else "SUCCESS",
            outcome_label=f"{result['product_count']} generic product facings observed.",
            details={key: value for key, value in result.items() if key not in {"annotated_image", "original_image"}},
        )
    )
    db.commit()
    return result


@app.get("/api/shelfwatch/images")
def shelf_images(limit: int = Query(default=12, ge=1, le=24), db: Session = Depends(get_db)):
    store = latest_store(db)
    rows = db.scalars(select(ShelfObservation).where(ShelfObservation.store_id == store.id,
        ShelfObservation.source.in_(["ShelfWatch local detector", "ShelfMind vision"]))
        .order_by(ShelfObservation.observed_at.desc()).limit(limit))
    return [{**row.detection_payload, "observation_id": row.id} for row in rows]


@app.post("/api/shelfwatch/review")
def evaluate_image_review(payload: ImageReviewRequest, db: Session = Depends(get_db)):
    try:
        return review_decision(db, payload)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/products/{product_id}/review-history")
def image_review_history(product_id: str, db: Session = Depends(get_db)):
    try:
        return product_review_history(db, product_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/history/import")
async def upload_history(file: UploadFile = File(...), provenance: str = Form(...), db: Session = Depends(get_db)):
    if provenance not in {"simulated", "operational"}:
        raise HTTPException(status_code=422, detail="Provenance must be simulated or operational")
    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="CSV must be at most 10 MB")
    try:
        result = await run_in_threadpool(import_history, db, content, file.filename or "history.csv", generated=provenance == "simulated")
        db.commit()
        return result
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/audit")
def audit_events(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(100)).all()
    return [audit_to_frontend(row) for row in rows]


@app.get("/api/audit/{decision_id}")
def audit_for_decision(decision_id: str, db: Session = Depends(get_db)) -> list[dict[str, object]]:
    rows = db.scalars(select(AuditEvent).where(AuditEvent.decision_id == decision_id).order_by(AuditEvent.occurred_at.asc())).all()
    return [audit_to_frontend(row) for row in rows]


@app.get("/api/analytics")
def analytics(days: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)) -> dict[str, object]:
    return analytics_payload(db, days=days)


@app.get("/api/rl/metrics")
def rl_metrics(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    rows = db.scalars(select(RLExperiment).options(selectinload(RLExperiment.metrics)).order_by(RLExperiment.created_at.desc())).all()
    return [experiment_to_dict(row) for row in rows]


@app.get("/api/rl/experiments")
def rl_experiments(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    return rl_metrics(db)


@app.post("/api/rl/value-iteration/run")
def run_value_iteration(payload: RLRunRequest | None = None, db: Session = Depends(get_db)) -> dict[str, object]:
    payload = payload or RLRunRequest(algorithm="VALUE_ITERATION")
    return experiment_to_dict(run_rl_experiment(db, "VALUE_ITERATION", iterations=payload.iterations, seed=payload.seed))


@app.post("/api/rl/q-learning/train")
def run_q_learning(payload: RLRunRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    return experiment_to_dict(run_rl_experiment(db, "Q_LEARNING", episodes=payload.episodes, seed=payload.seed))


@app.post("/api/rl/dqn/train")
def run_dqn(payload: RLRunRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    return experiment_to_dict(run_rl_experiment(db, "DQN", episodes=payload.episodes, seed=payload.seed))


@app.post("/api/simulation/step")
def step_simulation(payload: SimulationStepRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        return simulation_step(db, days=payload.days, algorithm=payload.algorithm)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/simulation/reset")
def reset_sim(db: Session = Depends(get_db)) -> dict[str, object]:
    return reset_simulation(db)


@app.post("/api/simulation/run")
def run_sim(payload: SimulationRunRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        return simulation_step(db, days=payload.days, algorithm=payload.algorithm)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/agent/briefing")
def briefing(db: Session = Depends(get_db)) -> dict[str, object]:
    return agent_briefing(db)


@app.post("/api/agent/query")
def agent_query(payload: AgentQueryRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    return answer_agent_query(db, payload.query)


@app.get("/api/purchase-orders")
def purchase_orders(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    return purchase_orders_payload(db)


@app.get("/api/suppliers")
def suppliers(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    return suppliers_payload(db)

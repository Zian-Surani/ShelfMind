from __future__ import annotations

import itertools
import random
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import Select, delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AgentEvent,
    AuditEvent,
    Decision,
    DecisionEvaluation,
    DecisionOutcome,
    DemandObservation,
    HumanApproval,
    Inventory,
    InventorySnapshot,
    Product,
    ProductCategory,
    PurchaseOrder,
    PurchaseOrderItem,
    RLExperiment,
    RLMetric,
    SalesRecord,
    ShelfAllocation,
    ShelfObservation,
    SimulationState,
    Store,
    Supplier,
    SupplierPerformance,
    new_id,
    utcnow,
)
from app.services.rl import (
    build_state,
    engine_for,
    estimate_stockout_risk,
    expected_demand_units,
    reward_for,
)
from app.services.preferences import store_preferences


SIMULATION_STATE_ID = "sim-current"


def current_business_date() -> date:
    return datetime.now(timezone.utc).date()


def money(value: float | Decimal) -> Decimal:
    return Decimal(str(round(float(value), 2)))


def latest_store(db: Session) -> Store:
    store = db.scalar(select(Store).order_by(Store.created_at.asc()))
    if not store:
        raise ValueError("No store found. Run python -m app.seed first.")
    return store


def product_profile(product: Product) -> dict[str, float]:
    return {
        "selling_price": float(product.selling_price),
        "purchase_cost": float(product.purchase_cost),
        "base_daily_demand": float(product.base_daily_demand),
        "storage_capacity": float(product.storage_capacity),
        "holding_cost": 0.45,
        "stockout_penalty": max(8.0, float(product.selling_price) * 0.75),
        "order_setup_cost": 18.0,
        "shelf_penalty": 2.5,
    }


def latest_demand(db: Session, store_id: str, product_id: str) -> DemandObservation | None:
    return db.scalar(
        select(DemandObservation)
        .where(DemandObservation.store_id == store_id, DemandObservation.product_id == product_id)
        .order_by(DemandObservation.observed_on.desc())
    )


def current_allocation(db: Session, store_id: str, product_id: str) -> ShelfAllocation | None:
    return db.scalar(select(ShelfAllocation).where(ShelfAllocation.store_id == store_id, ShelfAllocation.product_id == product_id))


def inventory_for(db: Session, store_id: str, product_id: str) -> Inventory:
    inventory = db.scalar(select(Inventory).where(Inventory.store_id == store_id, Inventory.product_id == product_id))
    if not inventory:
        raise ValueError(f"Inventory not found for {product_id}")
    return inventory


def audit(
    db: Session,
    store_id: str,
    event_type: str,
    category: str,
    message: str,
    decision_id: str | None = None,
    state_summary: str = "",
    action_summary: str = "",
    execution_summary: str = "",
    outcome_status: str = "IN_PROGRESS",
    outcome_label: str = "",
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        store_id=store_id,
        decision_id=decision_id,
        event_type=event_type,
        category=category,
        message=message,
        state_summary=state_summary,
        action_summary=action_summary,
        execution_summary=execution_summary,
        outcome_status=outcome_status,
        outcome_label=outcome_label,
        details=details or {},
        occurred_at=utcnow(),
    )
    db.add(event)
    return event


def make_decision_for_product(
    db: Session,
    store: Store,
    product: Product,
    algorithm: str = "VALUE_ITERATION",
    decision_id: str | None = None,
    commit: bool = False,
) -> Decision:
    inventory = inventory_for(db, store.id, product.id)
    demand = latest_demand(db, store.id, product.id)
    allocation = current_allocation(db, store.id, product.id)
    demand_regime = demand.regime if demand else "NORMAL"
    expected_demand = float(demand.expected_demand) if demand else float(product.base_daily_demand)
    competitor_pressure = demand.competitor_pressure if demand else "NORMAL"
    shelf_capacity = product.shelf_capacity
    state = build_state(
        current_stock=inventory.inventory_position,
        demand_regime=demand_regime,
        lead_time_days=product.supplier.default_lead_time_days,
        shelf_stock=inventory.shelf_quantity,
        shelf_capacity=shelf_capacity,
        competitor_pressure=competitor_pressure,
        storage_capacity=product.storage_capacity,
    )
    engine = engine_for(algorithm)
    if algorithm.upper() == "Q_LEARNING":
        engine.run_training(episodes=80, product_profile=product_profile(product))
    elif algorithm.upper() == "DQN":
        engine.run_training(episodes=8, product_profile=product_profile(product))
    else:
        engine.run_training(max_iterations=35, product_profile=product_profile(product))
    evaluations = engine.evaluate_actions(state, product_profile(product))[:5]
    best = evaluations[0]
    quantity = int(best["quantity"])
    action = "BUY" if quantity > 0 else "HOLD"
    risk = estimate_stockout_risk(inventory.available_inventory, expected_demand, product.supplier.default_lead_time_days)
    risk_score = min(0.99, risk + (0.10 if demand_regime in {"HIGH", "SPIKE"} else 0.0))
    confidence = max(0.60, min(0.96, 1.0 - risk_score / 2))
    estimated_spend = quantity * float(product.purchase_cost)
    preferences = store_preferences(db, store)
    status = "AUTO_EXECUTED" if (preferences["autonomyMode"] == "AUTO_UNDER_THRESHOLD" and action == "BUY"
        and quantity <= preferences["maxAutoQuantity"] and estimated_spend <= preferences["maxAutoSpend"]
        and risk_score < 0.45) else "APPROVAL_REQUIRED"
    if action == "HOLD":
        status = "HOLD"

    state_payload = {
        "inventory": inventory.available_inventory,
        "inventory_position": inventory.inventory_position,
        "demand": demand_regime,
        "leadTimeDays": product.supplier.default_lead_time_days,
        "shelfCapacity": shelf_capacity,
        "shelfStock": inventory.shelf_quantity,
        "backroomStock": inventory.backroom_quantity,
        "shelfFacings": allocation.facings if allocation else 0,
        "competitorPressure": competitor_pressure,
        "mdpState": state.__dict__,
    }
    optimal_label = f"{action} {quantity}" if quantity > 0 else "HOLD"
    reason = build_reason(product, inventory, demand_regime, expected_demand, product.supplier.default_lead_time_days, best)
    decision = Decision(
        id=decision_id or new_id("dec"),
        store_id=store.id,
        product_id=product.id,
        engine=engine.algorithm,
        action=action,
        quantity=quantity,
        shelf_action="INCREASE" if int(best["shelf_delta"]) > 0 else "REDUCE" if int(best["shelf_delta"]) < 0 else "MAINTAIN",
        status=status,
        recommended_at=utcnow(),
        current_stock=inventory.available_inventory,
        expected_demand=Decimal(str(round(expected_demand, 2))),
        supplier_lead_time_days=product.supplier.default_lead_time_days,
        stockout_risk=Decimal(str(risk)),
        risk_score=Decimal(str(round(risk_score, 4))),
        confidence=Decimal(str(round(confidence, 4))),
        reason=reason,
        state_payload=state_payload,
        recommendation_payload={
            "original_action": action,
            "original_quantity": quantity,
            "original_shelf_action": "MAINTAIN",
            "algorithm": engine.algorithm,
            "expected_reward": best["value"],
            "risk_score": risk_score,
            "confidence": confidence,
        },
        execution_note="",
    )
    db.add(decision)
    db.flush()
    for row in evaluations:
        db.add(
            DecisionEvaluation(
                decision_id=decision.id,
                action_label=str(row["action"]),
                order_quantity=int(row["quantity"]),
                shelf_delta=int(row["shelf_delta"]),
                action_value=Decimal(str(row["value"])),
                is_optimal=bool(row["isOptimal"]),
                reward_components=row["reward_components"],
            )
        )

    audit(
        db,
        store.id,
        "RL_DECISION",
        "RL",
        f"{engine.algorithm} evaluated {product.name} and selected {optimal_label}.",
        decision_id=decision.id,
        state_summary=f"I={inventory.available_inventory}, d={demand_regime}, L={product.supplier.default_lead_time_days}d, shelf={inventory.shelf_quantity}/{shelf_capacity}",
        action_summary=f"{optimal_label}; shelf action {decision.shelf_action}",
        execution_summary=status,
        outcome_status="IN_PROGRESS" if status == "APPROVAL_REQUIRED" else "SUCCESS",
        outcome_label=reason,
        details={"evaluations": evaluations, "state": state_payload},
    )
    if status == "AUTO_EXECUTED" and quantity > 0:
        create_purchase_order_from_decision(db, decision, commit=False)
    if commit:
        db.commit()
    return decision


def build_reason(
    product: Product,
    inventory: Inventory,
    demand_regime: str,
    expected_demand: float,
    lead_time_days: int,
    best: dict[str, Any],
) -> str:
    coverage = inventory.inventory_position / max(1.0, expected_demand * max(1, lead_time_days))
    if best["quantity"] <= 0:
        return (
            f"Inventory position covers projected {demand_regime.lower()} demand over the {lead_time_days}-day lead time, "
            "and the reward model penalizes extra holding cost more than the marginal stockout reduction."
        )
    return (
        f"{product.name} has {inventory.available_inventory} available units against about {expected_demand:.1f}/day in "
        f"{demand_regime.lower()} demand. Ordering {best['quantity']} units produced the highest calculated long-term value "
        f"because lead-time coverage is {coverage:.2f}x and stockout penalties dominate the order cost."
    )


def create_purchase_order_from_decision(db: Session, decision: Decision, commit: bool = True) -> PurchaseOrder:
    product = decision.product
    supplier = product.supplier
    today = current_business_date()
    expected = today + timedelta(days=supplier.default_lead_time_days)
    po = PurchaseOrder(
        id=f"PO-{utcnow().strftime('%y%m%d')}-{decision.id[-6:].upper()}",
        store_id=decision.store_id,
        supplier_id=supplier.id,
        decision_id=decision.id,
        order_date=today,
        expected_delivery_date=expected,
        actual_delivery_date=None,
        status="ORDERED",
        total_cost=money(decision.quantity * float(product.purchase_cost)),
        delay_reason="",
    )
    db.add(po)
    db.flush()
    db.add(
        PurchaseOrderItem(
            purchase_order_id=po.id,
            product_id=product.id,
            quantity=decision.quantity,
            unit_cost=product.purchase_cost,
            received_quantity=0,
        )
    )
    inventory = inventory_for(db, decision.store_id, decision.product_id)
    inventory.incoming_quantity += decision.quantity
    decision.execution_note = f"Purchase order {po.id} recorded locally. Supplier dispatch is not connected."
    audit(
        db,
        decision.store_id,
        "PURCHASE_CREATED",
        "SYSTEM",
        f"Purchase order {po.id} created for {product.name}.",
        decision_id=decision.id,
        action_summary=f"Order {decision.quantity} units",
        execution_summary=po.status,
        outcome_status="IN_PROGRESS",
        outcome_label=f"Expected delivery {po.expected_delivery_date.isoformat()}",
        details={"purchase_order_id": po.id},
    )
    if commit:
        db.commit()
    return po


def approve_decision(db: Session, decision_id: str) -> Decision:
    decision = db.scalar(select(Decision).where(Decision.id == decision_id).with_for_update())
    if not decision:
        raise ValueError("Decision not found")
    if decision.status == "APPROVED":
        return decision
    if decision.status != "APPROVAL_REQUIRED":
        raise ValueError("Only pending recommendations can be approved")
    decision.status = "APPROVED"
    decision.execution_note = f"Approved by {decision.store.manager_name}"
    db.add(
        HumanApproval(
            decision_id=decision.id,
            original_quantity=int(decision.recommendation_payload.get("original_quantity", decision.quantity)),
            human_quantity=decision.quantity,
            action="APPROVE",
            reason="Manager approved RL recommendation",
            decided_by=decision.store.manager_name,
        )
    )
    if decision.state_payload.get("imageReview"):
        decision.execution_note = f"Recommendation approved by {decision.store.manager_name}; no supplier order sent."
    elif decision.quantity > 0 and not decision.purchase_order:
        create_purchase_order_from_decision(db, decision, commit=False)
    audit(
        db,
        decision.store_id,
        "HUMAN_APPROVAL",
        "HUMAN",
        f"{decision.store.manager_name} approved {decision.product.name}.",
        decision_id=decision.id,
        action_summary=f"Approved {decision.quantity} units",
        execution_summary="MANUAL_APPROVAL",
        outcome_status="SUCCESS",
        outcome_label="Original RL recommendation preserved.",
    )
    db.commit()
    db.refresh(decision)
    return decision


def modify_decision(db: Session, decision_id: str, quantity: int, reason: str) -> Decision:
    decision = db.scalar(select(Decision).where(Decision.id == decision_id).with_for_update())
    if not decision:
        raise ValueError("Decision not found")
    if decision.status != "APPROVAL_REQUIRED":
        raise ValueError("Only pending recommendations can be modified")
    if quantity < 0 or not reason.strip():
        raise ValueError("Nonnegative quantity and a reason are required")
    if decision.state_payload.get("imageReview") and quantity:
        if quantity % decision.product.minimum_order_quantity or decision.current_stock + quantity > decision.product.storage_capacity:
            raise ValueError("Modified order must respect the item's minimum order multiple and available capacity")
    original_quantity = int(decision.recommendation_payload.get("original_quantity", decision.quantity))
    decision.quantity = quantity
    decision.action = "BUY" if quantity > 0 else "HOLD"
    decision.status = "MODIFIED"
    decision.execution_note = f"Modified to {quantity} units by {decision.store.manager_name}: {reason}"
    db.add(
        HumanApproval(
            decision_id=decision.id,
            original_quantity=original_quantity,
            human_quantity=quantity,
            action="MODIFY",
            reason=reason,
            decided_by=decision.store.manager_name,
        )
    )
    if decision.state_payload.get("imageReview"):
        decision.execution_note += "; recommendation only, no supplier order sent."
    elif quantity > 0 and not decision.purchase_order:
        create_purchase_order_from_decision(db, decision, commit=False)
    audit(
        db,
        decision.store_id,
        "HUMAN_MODIFICATION",
        "HUMAN",
        f"{decision.store.manager_name} modified {decision.product.name} from {original_quantity} to {quantity} units.",
        decision_id=decision.id,
        action_summary=f"Modified order quantity to {quantity}",
        execution_summary="HUMAN_MODIFIED",
        outcome_status="SUCCESS",
        outcome_label=reason,
        details={"original_quantity": original_quantity, "human_quantity": quantity},
    )
    db.commit()
    db.refresh(decision)
    return decision


def reject_decision(db: Session, decision_id: str, reason: str) -> Decision:
    decision = db.scalar(select(Decision).where(Decision.id == decision_id).with_for_update())
    if not decision:
        raise ValueError("Decision not found")
    if decision.status != "APPROVAL_REQUIRED":
        raise ValueError("Only pending recommendations can be rejected")
    original_quantity = int(decision.recommendation_payload.get("original_quantity", decision.quantity))
    decision.status = "REJECTED"
    decision.execution_note = f"Rejected by {decision.store.manager_name}: {reason}"
    db.add(
        HumanApproval(
            decision_id=decision.id,
            original_quantity=original_quantity,
            human_quantity=None,
            action="REJECT",
            reason=reason,
            decided_by=decision.store.manager_name,
        )
    )
    audit(
        db,
        decision.store_id,
        "HUMAN_REJECTION",
        "HUMAN",
        f"{decision.store.manager_name} rejected {decision.product.name}.",
        decision_id=decision.id,
        action_summary="Rejected RL recommendation",
        execution_summary="NO_PURCHASE_CREATED",
        outcome_status="SUCCESS",
        outcome_label=reason,
    )
    db.commit()
    db.refresh(decision)
    return decision


def record_sale(db: Session, product_id: str, quantity: int, promotion_flag: bool = False, demand_regime: str = "NORMAL") -> SalesRecord:
    store = latest_store(db)
    product = db.get(Product, product_id)
    if not product:
        raise ValueError("Product not found")
    inventory = inventory_for(db, store.id, product.id)
    available = inventory.available_inventory
    units_sold = min(quantity, available)
    lost = max(0, quantity - units_sold)
    shelf_take = min(units_sold, inventory.shelf_quantity)
    inventory.shelf_quantity -= shelf_take
    back_take = units_sold - shelf_take
    inventory.backroom_quantity = max(0, inventory.backroom_quantity - back_take)
    inventory.last_counted_at = utcnow()
    sale = SalesRecord(
        store_id=store.id,
        product_id=product.id,
        sold_at=utcnow(),
        units_sold=units_sold,
        unit_price=product.selling_price,
        promotion_flag=promotion_flag,
        demand_regime=demand_regime,
        lost_sales_quantity=lost,
    )
    db.add(sale)
    audit(
        db,
        store.id,
        "OUTCOME_RECORDED",
        "SYSTEM",
        f"Recorded sale for {product.name}: {units_sold} sold, {lost} lost.",
        outcome_status="SUCCESS" if lost == 0 else "NEEDS_REVIEW",
        details={"product_id": product.id, "requested_quantity": quantity, "units_sold": units_sold, "lost_sales": lost},
    )
    db.commit()
    db.refresh(sale)
    return sale


def restock_shelf_from_backroom(db: Session, product_name: str, count: int) -> dict[str, Any]:
    store = latest_store(db)
    product = db.scalar(select(Product).where(func.lower(Product.name).contains(product_name.lower())))
    if not product:
        raise ValueError("Product not found")
    inventory = inventory_for(db, store.id, product.id)
    move_qty = min(count, inventory.backroom_quantity, max(0, product.shelf_capacity - inventory.shelf_quantity))
    inventory.backroom_quantity -= move_qty
    inventory.shelf_quantity += move_qty
    inventory.last_counted_at = utcnow()
    audit(
        db,
        store.id,
        "AI_OBSERVATION",
        "AI",
        f"Shelf restocked from backroom for {product.name}.",
        action_summary=f"Moved {move_qty} units to shelf",
        outcome_status="SUCCESS",
    )
    db.commit()
    return {"product_id": product.id, "moved": move_qty, "shelf_quantity": inventory.shelf_quantity, "backroom_quantity": inventory.backroom_quantity}


def reallocate_shelf(db: Session, product_id: str, delta_positions: int) -> ShelfAllocation:
    store = latest_store(db)
    allocation = current_allocation(db, store.id, product_id)
    if not allocation:
        raise ValueError("Allocation not found")
    category = allocation.category
    allocations = list(db.scalars(select(ShelfAllocation).where(ShelfAllocation.store_id == store.id, ShelfAllocation.category_id == category.id)))
    current_total = sum(row.facings for row in allocations)
    next_facings = max(allocation.min_facings, min(allocation.max_facings, allocation.facings + delta_positions))
    next_total = current_total - allocation.facings + next_facings
    if next_total > category.shelf_capacity_facings:
        raise ValueError("Category shelf capacity exceeded")
    allocation.facings = next_facings
    audit(
        db,
        store.id,
        "MDP_EVALUATION",
        "MDP",
        f"Shelf allocation changed for {allocation.product.name}.",
        action_summary=f"Facings now {allocation.facings}",
        outcome_status="SUCCESS",
    )
    db.commit()
    db.refresh(allocation)
    return allocation


def persist_experiment(db: Session, result: Any) -> RLExperiment:
    today = current_business_date()
    experiment = RLExperiment(
        id=new_id("exp"),
        algorithm=result.algorithm,
        seed=result.seed,
        environment_config=result.environment_config,
        hyperparameters=result.hyperparameters,
        training_period_start=None,
        training_period_end=None,
        number_of_states=result.number_of_states,
        number_of_actions=result.number_of_actions,
        iterations=result.iterations,
        converged=result.converged,
        runtime_ms=result.runtime_ms,
        status="COMPLETED",
        artifact_path="database:rl_metrics",
    )
    db.add(experiment)
    db.flush()
    for name, value in result.metrics.items():
        db.add(RLMetric(experiment_id=experiment.id, metric_name=name, metric_value=Decimal(str(round(float(value), 4)))))
    db.commit()
    db.refresh(experiment)
    return experiment


def run_rl_experiment(db: Session, algorithm: str, episodes: int = 400, iterations: int = 100, seed: int = 20260914) -> RLExperiment:
    engine = engine_for(algorithm)
    products = list(db.scalars(select(Product)))
    profiles = [product_profile(product) for product in products]
    profile = {key: sum(p[key] for p in profiles) / len(profiles) for key in profiles[0]} if profiles else None
    if algorithm.upper() == "Q_LEARNING":
        result = engine.run_training(episodes=episodes, seed=seed, product_profile=profile)
    elif algorithm.upper() == "DQN":
        result = engine.run_training(episodes=min(episodes, 120), seed=seed, product_profile=profile)
    else:
        result = engine.run_training(seed=seed, max_iterations=iterations, product_profile=profile)
    result.environment_config["evaluationSource"] = "Model-generated episodes parameterized from the imported product catalog; not observed business outcomes"
    return persist_experiment(db, result)


def process_due_purchase_orders(db: Session, current_day: date) -> int:
    completed = 0
    orders = list(
        db.scalars(
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.items))
            .where(PurchaseOrder.status.in_(["ORDERED", "DELAYED"]), PurchaseOrder.expected_delivery_date <= current_day)
        )
    )
    for po in orders:
        delivery_day = po.expected_delivery_date + timedelta(days=1 if po.status == "DELAYED" else 0)
        if delivery_day > current_day:
            continue
        po.status = "DELIVERED"
        po.actual_delivery_date = delivery_day
        for item in po.items:
            inventory = inventory_for(db, po.store_id, item.product_id)
            item.received_quantity = item.quantity
            inventory.incoming_quantity = max(0, inventory.incoming_quantity - item.quantity)
            inventory.backroom_quantity += item.quantity
        audit(
            db,
            po.store_id,
            "DELIVERY_RECEIVED",
            "SYSTEM",
            f"Purchase order {po.id} received.",
            decision_id=po.decision_id,
            execution_summary="DELIVERED",
            outcome_status="SUCCESS",
            details={"purchase_order_id": po.id},
        )
        completed += 1
    return completed


def simulation_step(db: Session, days: int = 1, algorithm: str = "VALUE_ITERATION") -> dict[str, Any]:
    from app.models import RetailHistoryRow
    if db.scalar(select(RetailHistoryRow.id).limit(1)):
        raise ValueError("Imported history is read-only for simulation. Run RL experiments without changing inventory.")
    store = latest_store(db)
    state = db.get(SimulationState, SIMULATION_STATE_ID)
    if not state:
        state = SimulationState(id=SIMULATION_STATE_ID, store_id=store.id, current_day=current_business_date(), seed=20260914, step_index=0, config={})
        db.add(state)
        db.flush()
    rng = random.Random(state.seed + state.step_index)
    products = list(db.scalars(select(Product).options(selectinload(Product.supplier))))
    summary = {"days": days, "sales": 0, "lost_sales": 0, "deliveries": 0, "decisions": 0}
    for _ in range(days):
        current_day = state.current_day
        summary["deliveries"] += process_due_purchase_orders(db, current_day)
        for product in products:
            inventory = inventory_for(db, store.id, product.id)
            opening_shelf = inventory.shelf_quantity
            opening_back = inventory.backroom_quantity
            opening_incoming = inventory.incoming_quantity
            demand = latest_demand(db, store.id, product.id)
            regime = demand.regime if demand else "NORMAL"
            expected = float(demand.expected_demand) if demand else float(product.base_daily_demand)
            realized = max(0, int(rng.gauss(expected, max(1.0, expected * 0.12))))
            sale_qty = min(realized, inventory.available_inventory)
            lost = max(0, realized - sale_qty)
            shelf_take = min(sale_qty, inventory.shelf_quantity)
            inventory.shelf_quantity -= shelf_take
            inventory.backroom_quantity = max(0, inventory.backroom_quantity - (sale_qty - shelf_take))
            restock = min(inventory.backroom_quantity, max(0, product.shelf_capacity - inventory.shelf_quantity))
            inventory.backroom_quantity -= restock
            inventory.shelf_quantity += restock
            db.add(
                SalesRecord(
                    store_id=store.id,
                    product_id=product.id,
                    sold_at=datetime.combine(current_day, time(17, 0), tzinfo=timezone.utc),
                    units_sold=sale_qty,
                    unit_price=product.selling_price,
                    promotion_flag=regime == "PROMOTION",
                    demand_regime=regime,
                    lost_sales_quantity=lost,
                )
            )
            db.add(
                InventorySnapshot(
                    store_id=store.id,
                    product_id=product.id,
                    snapshot_date=current_day,
                    opening_shelf_quantity=opening_shelf,
                    opening_backroom_quantity=opening_back,
                    opening_incoming_quantity=opening_incoming,
                    received_quantity=0,
                    units_sold=sale_qty,
                    lost_sales_quantity=lost,
                    waste_quantity=0,
                    closing_shelf_quantity=inventory.shelf_quantity,
                    closing_backroom_quantity=inventory.backroom_quantity,
                    closing_incoming_quantity=inventory.incoming_quantity,
                )
            )
            summary["sales"] += sale_qty
            summary["lost_sales"] += lost
            if inventory.inventory_position < expected * product.supplier.default_lead_time_days:
                make_decision_for_product(db, store, product, algorithm=algorithm, commit=False)
                summary["decisions"] += 1
        state.current_day += timedelta(days=1)
        state.step_index += 1
    audit(
        db,
        store.id,
        "OUTCOME_RECORDED",
        "SYSTEM",
        f"Simulation advanced by {days} day(s).",
        outcome_status="SUCCESS",
        details=summary,
    )
    db.commit()
    return summary


def reset_simulation(db: Session) -> dict[str, Any]:
    db.execute(delete(SimulationState))
    today = current_business_date()
    db.add(SimulationState(id=SIMULATION_STATE_ID, store_id=latest_store(db).id, current_day=today, seed=20260914, step_index=0, status="READY", config={}))
    db.commit()
    return {"status": "READY", "current_day": today.isoformat()}


def agent_briefing(db: Session) -> dict[str, Any]:
    store = latest_store(db)
    approvals = db.scalar(select(func.count()).select_from(Decision).where(Decision.status == "APPROVAL_REQUIRED")) or 0
    auto = db.scalar(select(func.count()).select_from(Decision).where(Decision.status == "AUTO_EXECUTED")) or 0
    delayed = db.scalar(select(func.count()).select_from(PurchaseOrder).where(PurchaseOrder.status == "DELAYED")) or 0
    low_inventory = db.scalar(
        select(func.count())
        .select_from(Inventory)
        .join(Product)
        .where(Inventory.shelf_quantity + Inventory.backroom_quantity < Product.base_daily_demand * 2)
    ) or 0
    recent_events = list(
        db.scalars(select(AuditEvent).where(AuditEvent.store_id == store.id).order_by(AuditEvent.occurred_at.desc()).limit(5))
    )
    items = [
        f"{auto} replenishment decisions completed automatically",
        f"{approvals} decision(s) require approval",
        f"{low_inventory} product(s) are below lead-time coverage",
        f"{delayed} supplier delivery/deliveries delayed",
    ]
    return {
        "store": store.name,
        "manager": store.manager_name,
        "summary": f"{approvals + low_inventory + delayed} things need attention.",
        "items": items,
        "recentEvents": [event.message for event in recent_events],
    }


def answer_agent_query(db: Session, query: str) -> dict[str, Any]:
    briefing = agent_briefing(db)
    q = query.lower()
    answer = briefing["summary"] + " " + " ".join(briefing["items"])
    if "why" in q or "buy" in q or "order" in q:
        decision = db.scalar(select(Decision).options(selectinload(Decision.product)).order_by(Decision.recommended_at.desc()))
        if decision:
            answer = (
                f"{decision.product.name}: {decision.reason} The original recommendation was "
                f"{decision.recommendation_payload.get('original_action')} {decision.recommendation_payload.get('original_quantity')} "
                f"with expected reward {decision.recommendation_payload.get('expected_reward')}."
            )
    elif "risk" in q or "attention" in q:
        risky = list(
            db.scalars(
                select(Decision)
                .options(selectinload(Decision.product))
                .where(Decision.status == "APPROVAL_REQUIRED")
                .order_by(Decision.risk_score.desc())
                .limit(3)
            )
        )
        if risky:
            answer = "Products needing attention: " + "; ".join(f"{d.product.name} risk {float(d.stockout_risk) * 100:.0f}%" for d in risky)
    store = latest_store(db)
    db.add(AgentEvent(store_id=store.id, user_query=query, response=answer, source_payload=briefing))
    db.commit()
    return {"answer": answer, "sources": briefing}

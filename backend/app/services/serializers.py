from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AuditEvent,
    Decision,
    DemandObservation,
    Inventory,
    Product,
    PurchaseOrder,
    RLExperiment,
    SalesRecord,
    ShelfAllocation,
    ShelfObservation,
    Store,
    Supplier,
    RetailHistoryRow,
    DataSource,
    InventorySnapshot,
)
from app.services.time_utils import time_ago
from app.services.preferences import store_preferences


IMAGE_MAP = {
    "lays": "/src/assets/lays.png",
    "pringles": "/src/assets/pringles.png",
    "bingo": "/src/assets/bingo.png",
}


def as_float(value: Decimal | float | int | None) -> float:
    return float(value or 0)


def product_status(inventory: Inventory, product: Product, demand: DemandObservation | None) -> str:
    expected = as_float(demand.expected_demand if demand else product.base_daily_demand)
    available = inventory.available_inventory
    if available < expected:
        return "critical"
    if available < expected * product.supplier.default_lead_time_days:
        return "low"
    if available > product.storage_capacity * 0.85:
        return "overstock"
    return "healthy"


def product_to_frontend(db: Session, product: Product, store: Store) -> dict[str, Any]:
    inventory = db.scalar(select(Inventory).where(Inventory.store_id == store.id, Inventory.product_id == product.id))
    demand = db.scalar(
        select(DemandObservation)
        .where(DemandObservation.store_id == store.id, DemandObservation.product_id == product.id)
        .order_by(DemandObservation.observed_on.desc())
    )
    previous = db.scalars(
        select(DemandObservation)
        .where(DemandObservation.store_id == store.id, DemandObservation.product_id == product.id)
        .order_by(DemandObservation.observed_on.desc())
        .limit(8)
    ).all()
    allocation = db.scalar(select(ShelfAllocation).where(ShelfAllocation.store_id == store.id, ShelfAllocation.product_id == product.id))
    decision = db.scalar(
        select(Decision)
        .where(Decision.store_id == store.id, Decision.product_id == product.id)
        .order_by(Decision.recommended_at.desc())
    )
    current_demand = as_float(demand.expected_demand if demand else product.base_daily_demand)
    old_demand = as_float(previous[-1].expected_demand) if len(previous) > 1 else current_demand
    trend_pct = round(((current_demand - old_demand) / max(1.0, old_demand)) * 100)
    trend = "up" if trend_pct > 2 else "down" if trend_pct < -2 else "stable"
    inventory = inventory or Inventory(store_id=store.id, product_id=product.id)
    recommendation = "HOLD" if not decision or decision.quantity == 0 else f"BUY {decision.quantity}"
    return {
        "id": product.id,
        "name": product.name,
        "variant": product.variant,
        "category": product.category.name,
        "currentStock": inventory.available_inventory,
        "shelfStock": inventory.shelf_quantity,
        "backroomStock": inventory.backroom_quantity,
        "shelfCapacity": product.shelf_capacity,
        "shelfPositions": allocation.facings if allocation else 0,
        "demandRate": round(current_demand),
        "demandTrend": trend,
        "demandTrendPercent": trend_pct,
        "status": product_status(inventory, product, demand),
        "recommendation": recommendation,
        "supplierLeadTime": product.supplier.default_lead_time_days,
        "unitPrice": as_float(product.selling_price),
        "image": IMAGE_MAP.get(product.image_key, IMAGE_MAP["lays"]),
    }


def decision_to_frontend(decision: Decision) -> dict[str, Any]:
    evaluations = sorted(decision.evaluations, key=lambda row: as_float(row.action_value), reverse=True)
    today = datetime.now(timezone.utc).date()
    recommended_on = decision.recommended_at.date()
    date_group = "TODAY" if recommended_on == today else "YESTERDAY" if recommended_on == today - timedelta(days=1) else "THIS_WEEK"
    return {
        "id": decision.id,
        "productId": decision.product_id,
        "productName": decision.product.name,
        "productVariant": decision.product.variant,
        "productCategory": decision.product.category.name,
        "productImage": IMAGE_MAP.get(decision.product.image_key, IMAGE_MAP["lays"]),
        "action": decision.action,
        "quantity": decision.quantity,
        "status": decision.status,
        "engine": "MDP" if decision.engine == "MDP_VALUE_EVALUATION" else decision.engine,
        "timestamp": decision.recommended_at.isoformat(),
        "timeAgo": time_ago(decision.recommended_at),
        "currentStock": decision.current_stock,
        "expectedDemand": round(as_float(decision.expected_demand)),
        "supplierLeadTime": decision.supplier_lead_time_days,
        "stockoutRisk": round(as_float(decision.stockout_risk) * 100),
        "reason": decision.reason,
        "technicalReasoning": {
            "state": {
                "inventory": decision.state_payload.get("inventory", 0),
                "demand": decision.state_payload.get("demand", "NORMAL"),
                "leadTimeDays": decision.state_payload.get("leadTimeDays", 0),
                "shelfCapacity": decision.state_payload.get("shelfCapacity", 0),
            },
            "actionsEvaluated": [
                {
                    "action": row.action_label,
                    "quantity": row.order_quantity,
                    "value": round(as_float(row.action_value), 2),
                    "isOptimal": row.is_optimal,
                }
                for row in evaluations
            ],
            "optimalAction": f"{decision.action} {decision.quantity}" if decision.quantity else "HOLD",
            "algorithm": decision.engine,
            "bellmanDetails": "V*(s) = max_a [R(s,a) + gamma sum P(s'|s,a)V*(s')] persisted from engine evaluation.",
            "expectedReward": as_float(decision.recommendation_payload.get("expected_reward")),
            "stockoutProbability": as_float(decision.stockout_risk),
        },
        "humanModifiedQuantity": decision.human_approval.human_quantity if decision.human_approval else None,
        "humanReason": decision.human_approval.reason if decision.human_approval else None,
        "executionNote": decision.execution_note,
        "imageReview": decision.state_payload.get("imageReview"),
        "dateGroup": date_group,
    }


def shelfwatch_to_frontend(db: Session, store: Store) -> dict[str, Any]:
    observation = db.scalar(select(ShelfObservation).where(
        ShelfObservation.store_id == store.id, ShelfObservation.source.in_(["ShelfWatch local detector", "ShelfMind vision"])
    ).order_by(ShelfObservation.observed_at.desc()).limit(1))
    payload = {**observation.detection_payload, "observation_id": observation.id} if observation else None
    detected = [{"id": f"{observation.id}-{index}", "name": item["name"],
                 "confidence": item["confidence"], "shelfQuantity": 1, "box": item["box"], "status": "unknown"}
                for index, item in enumerate(payload.get("detections", []))] if payload else []
    return {
        "liveStatus": bool(observation),
        "shelfCompliance": None,
        "itemsLowOnShelf": None,
        "lastUpdated": time_ago(observation.observed_at) if observation else "No image analyzed",
        "cameraName": "Uploaded shelf image",
        "detectedItems": detected,
        "latestAnalysis": payload,
    }


def audit_to_frontend(event: AuditEvent) -> dict[str, Any]:
    outcome = event.outcome_status if event.outcome_status in {"SUCCESS", "NEEDS_REVIEW", "IN_PROGRESS"} else "IN_PROGRESS"
    return {
        "id": event.id,
        "timestamp": event.occurred_at.strftime("%Y-%m-%d %H:%M:%S"),
        "timeAgo": time_ago(event.occurred_at),
        "category": event.category if event.category in {"AI", "MDP", "RL", "HUMAN", "SYSTEM"} else "SYSTEM",
        "observation": event.message,
        "state": event.state_summary,
        "action": event.action_summary,
        "execution": event.execution_summary,
        "outcome": outcome,
        "outcomeLabel": event.outcome_label,
        "details": event.details.get("details", "") if isinstance(event.details, dict) else "",
    }


def activity_from_audit(event: AuditEvent) -> dict[str, Any]:
    event_map = {
        "PURCHASE_CREATED": ("auto_order", "Auto order placed"),
        "AI_OBSERVATION": ("shelfwatch", "ShelfWatch update"),
        "HUMAN_APPROVAL": ("human_action", "Order approved by manager"),
        "HUMAN_MODIFICATION": ("human_action", "Order modified by manager"),
        "DELIVERY_RECEIVED": ("delivery", "Delivery received"),
        "RL_DECISION": ("approval_pending", "Policy decision recorded"),
    }
    type_id, title = event_map.get(event.event_type, ("human_action", event.event_type.replace("_", " ").title()))
    colors = {
        "auto_order": ("bg-[#D2E8D4]", "text-[#267343]"),
        "shelfwatch": ("bg-[#E3E8FD]", "text-[#3E5C76]"),
        "approval_pending": ("bg-[#FEE8D6]", "text-[#B86A1B]"),
        "delivery": ("bg-[#F1E8DF]", "text-[#826E58]"),
        "human_action": ("bg-[#FEE8D6]", "text-[#B86A1B]"),
    }
    icon_bg, icon_color = colors[type_id]
    return {
        "id": event.id,
        "type": type_id,
        "title": title,
        "subtitle": event.message,
        "timestamp": time_ago(event.occurred_at),
        "iconBg": icon_bg,
        "iconColor": icon_color,
    }


def system_metrics(db: Session, store: Store) -> dict[str, Any]:
    decisions = db.scalar(select(func.count()).select_from(Decision).where(Decision.store_id == store.id)) or 0
    auto = db.scalar(select(func.count()).select_from(Decision).where(Decision.store_id == store.id, Decision.status == "AUTO_EXECUTED")) or 0
    approvals = db.scalar(select(func.count()).select_from(Decision).where(Decision.store_id == store.id, Decision.status == "APPROVAL_REQUIRED")) or 0
    low_count = (
        db.scalar(
            select(func.count())
            .select_from(Inventory)
            .join(Product)
            .where(Inventory.store_id == store.id, Inventory.shelf_quantity + Inventory.backroom_quantity < Product.base_daily_demand * 2)
        )
        or 0
    )
    sales = db.scalar(select(func.sum(SalesRecord.units_sold)).where(SalesRecord.store_id == store.id)) or 0
    lost = db.scalar(select(func.sum(SalesRecord.lost_sales_quantity)).where(SalesRecord.store_id == store.id)) or 0
    service_level = round((float(sales) / max(1.0, float(sales) + float(lost))) * 100)
    inventory_rows = list(db.scalars(select(Inventory).where(Inventory.store_id == store.id)))
    status_counts = {"healthy": 0, "low": 0, "overstock": 0, "critical": 0}
    for inventory in inventory_rows:
        demand = db.scalar(
            select(DemandObservation)
            .where(DemandObservation.store_id == store.id, DemandObservation.product_id == inventory.product_id)
            .order_by(DemandObservation.observed_on.desc())
        )
        status_counts[product_status(inventory, inventory.product, demand)] += 1
    total_inventory = sum(row.inventory_position for row in inventory_rows)
    total_capacity = sum(row.product.storage_capacity for row in inventory_rows)
    over_capacity_units = sum(max(0, row.inventory_position - row.product.storage_capacity) for row in inventory_rows)
    turnover_rate = round((float(sales) / max(1.0, float(total_inventory))) * 10)
    holding_pressure = round((float(over_capacity_units) / max(1.0, float(total_capacity))) * 100)
    stockout_rate = round((float(lost) / max(1.0, float(sales) + float(lost))) * 100)
    return {
        "serviceLevel": service_level,
        "unitsSold": int(sales),
        "lostSales": int(lost),
        "wasteUnits": db.scalar(select(func.sum(InventorySnapshot.waste_quantity)).where(InventorySnapshot.store_id == store.id)) or 0,
        "serviceLevelTrend": 0,
        "stockoutRate": stockout_rate,
        "autoExecutedCount": int(auto),
        "attentionCount": status_counts["low"] + status_counts["critical"],
        "approvalRequiredCount": int(approvals),
        "healthyCount": status_counts["healthy"],
        "lowStockCount": status_counts["low"],
        "overstockCount": status_counts["overstock"],
        "criticalCount": status_counts["critical"],
    }


def history_status(db: Session, store: Store) -> dict[str, Any]:
    first, last, count = db.execute(select(func.min(RetailHistoryRow.observed_on), func.max(RetailHistoryRow.observed_on),
                                         func.count(RetailHistoryRow.id)).where(RetailHistoryRow.store_id == store.id)).one()
    sources = list(db.scalars(select(DataSource).join(RetailHistoryRow, RetailHistoryRow.source_id == DataSource.id)
                             .where(RetailHistoryRow.store_id == store.id).distinct()))
    return {"rows": count, "firstDate": first.isoformat() if first else None, "lastDate": last.isoformat() if last else None,
            "generated": any(s.generated for s in sources), "sources": [s.source_name for s in sources],
            "daysSinceLastRecord": (datetime.now(timezone.utc).date() - last).days if last else None}


def notifications_from_state(db: Session, store: Store) -> list[dict[str, Any]]:
    rows = list(
        db.scalars(
            select(AuditEvent)
            .where(AuditEvent.store_id == store.id, AuditEvent.event_type.in_(["PURCHASE_CREATED", "RL_DECISION", "AI_OBSERVATION", "HUMAN_APPROVAL"]))
            .order_by(AuditEvent.occurred_at.desc())
            .limit(8)
        )
    )
    type_map = {
        "PURCHASE_CREATED": "order",
        "RL_DECISION": "approval",
        "AI_OBSERVATION": "alert",
        "HUMAN_APPROVAL": "approval",
    }
    return [
        {
            "id": event.id,
            "title": event.event_type.replace("_", " ").title(),
            "message": event.message,
            "time": time_ago(event.occurred_at),
            "read": event.outcome_status == "SUCCESS",
            "type": type_map.get(event.event_type, "alert"),
        }
        for event in rows
    ]


def dashboard_payload(db: Session) -> dict[str, Any]:
    store = db.scalar(select(Store).order_by(Store.created_at.asc()))
    if not store:
        return {"products": [], "decisions": [], "shelfWatch": None, "activity": [], "metrics": {}, "auditLogs": []}
    products = list(db.scalars(select(Product).options(selectinload(Product.category), selectinload(Product.supplier)).order_by(Product.name)))
    decisions = list(
        db.scalars(
            select(Decision)
            .options(
                selectinload(Decision.product).selectinload(Product.category),
                selectinload(Decision.evaluations),
                selectinload(Decision.human_approval),
            )
            .where(Decision.store_id == store.id)
            .order_by(Decision.recommended_at.desc())
            .limit(20)
        )
    )
    audit_events = list(
        db.scalars(select(AuditEvent).where(AuditEvent.store_id == store.id).order_by(AuditEvent.occurred_at.desc()).limit(20))
    )
    return {
        "store": {"id": store.id, "name": store.name, "managerName": store.manager_name},
        "settings": store_preferences(db, store),
        "products": [product_to_frontend(db, product, store) for product in products],
        "decisions": [decision_to_frontend(decision) for decision in decisions],
        "shelfWatch": shelfwatch_to_frontend(db, store),
        "activity": [activity_from_audit(event) for event in audit_events[:8]],
        "metrics": system_metrics(db, store),
        "auditLogs": [audit_to_frontend(event) for event in audit_events],
        "notifications": notifications_from_state(db, store),
        "demandSeries": demand_series(db, store),
        "serverTime": datetime.now(timezone.utc).isoformat(),
        "dataSource": history_status(db, store),
    }


def demand_series(db: Session, store: Store) -> list[dict[str, Any]]:
    product_keys = {
        "prod-lays-classic": "lays",
        "prod-pringles-original": "pringles",
        "prod-bingo-masala": "bingo",
        "prod-too-yumm": "tooYumm",
        "SKU001": "lays", "SKU002": "pringles", "SKU003": "bingo", "SKU004": "tooYumm",
    }
    last_observed = db.scalar(select(func.max(DemandObservation.observed_on)).where(DemandObservation.store_id == store.id)) or datetime.now(timezone.utc).date()
    observations = list(db.scalars(select(DemandObservation).where(DemandObservation.store_id == store.id,
        DemandObservation.observed_on >= last_observed - timedelta(days=6), DemandObservation.observed_on <= last_observed)))
    lookup = {(obs.observed_on, obs.product_id): obs.realized_demand for obs in observations}
    present_products = {obs.product_id for obs in observations}
    rows = []
    for day_offset in range(6, -1, -1):
        day = last_observed - timedelta(days=day_offset)
        row: dict[str, Any] = {"day": day.strftime("%d %b"), "lays": 0, "pringles": 0, "bingo": 0, "tooYumm": 0}
        for product_id in present_products:
            if product_id in product_keys:
                row[product_keys[product_id]] = lookup.get((day, product_id))
        rows.append(row)
    return rows


def analytics_payload(db: Session, days: int = 30) -> dict[str, Any]:
    store = db.scalar(select(Store).order_by(Store.created_at.asc()))
    if not store:
        return {"metrics": {}, "demandSeries": [], "totals": {}, "experiments": []}
    sales = db.scalar(select(func.sum(SalesRecord.units_sold)).where(SalesRecord.store_id == store.id)) or 0
    lost = db.scalar(select(func.sum(SalesRecord.lost_sales_quantity)).where(SalesRecord.store_id == store.id)) or 0
    orders = db.scalar(select(func.count()).select_from(PurchaseOrder).where(PurchaseOrder.store_id == store.id)) or 0
    experiments = list(db.scalars(select(RLExperiment).order_by(RLExperiment.created_at.desc()).limit(6)))
    last = db.scalar(select(func.max(RetailHistoryRow.observed_on)).where(RetailHistoryRow.store_id == store.id))
    first = last - timedelta(days=days - 1) if last else None
    history = list(db.scalars(select(RetailHistoryRow).where(RetailHistoryRow.store_id == store.id,
        RetailHistoryRow.observed_on >= first, RetailHistoryRow.observed_on <= last))) if first else []
    sku_totals = {}
    for record in history:
        raw = record.raw_values
        sku = sku_totals.setdefault(record.product_id, {"productId": record.product_id, "name": raw["product_name"],
            "unitsSold": 0, "demand": 0, "lostSales": 0, "wasteUnits": 0, "revenue": Decimal(0), "costOfGoods": Decimal(0)})
        sku["unitsSold"] += int(raw["units_sold"])
        sku["demand"] += int(raw["demand"])
        sku["lostSales"] += int(raw["lost_sales_units"])
        sku["wasteUnits"] += int(raw["waste_units"])
        sku["revenue"] += int(raw["units_sold"]) * Decimal(raw["selling_price_inr"])
        sku["costOfGoods"] += int(raw["units_sold"]) * Decimal(raw["purchase_cost_inr"])
    totals = {key: sum(sku[key] for sku in sku_totals.values()) for key in ["unitsSold", "demand", "lostSales", "wasteUnits", "revenue", "costOfGoods"]}
    totals["grossMargin"] = totals["revenue"] - totals["costOfGoods"]
    totals["serviceLevel"] = round(100 * totals["unitsSold"] / totals["demand"], 2) if totals["demand"] else None
    for item in [totals, *sku_totals.values()]:
        for key, value in item.items():
            if isinstance(value, Decimal):
                item[key] = float(value)
    return {
        "metrics": system_metrics(db, store),
        "demandSeries": demand_series(db, store),
        "totals": totals,
        "period": {"firstDate": first.isoformat() if first else None, "lastDate": last.isoformat() if last else None, "days": days},
        "byProduct": list(sku_totals.values()),
        "dataSource": history_status(db, store),
        "experiments": [experiment_to_dict(exp) for exp in experiments],
    }


def experiment_to_dict(experiment: RLExperiment) -> dict[str, Any]:
    return {
        "id": experiment.id,
        "algorithm": experiment.algorithm,
        "seed": experiment.seed,
        "numberOfStates": experiment.number_of_states,
        "numberOfActions": experiment.number_of_actions,
        "iterations": experiment.iterations,
        "converged": experiment.converged,
        "runtimeMs": experiment.runtime_ms,
        "status": experiment.status,
        "hyperparameters": experiment.hyperparameters,
        "environmentConfig": experiment.environment_config,
        "metrics": {metric.metric_name: as_float(metric.metric_value) for metric in experiment.metrics},
    }


def suppliers_payload(db: Session) -> list[dict[str, Any]]:
    suppliers = list(db.scalars(select(Supplier).order_by(Supplier.name)))
    return [
        {
            "id": supplier.id,
            "name": supplier.name,
            "defaultLeadTimeDays": supplier.default_lead_time_days,
            "reliability": as_float(supplier.reliability) if supplier.reliability is not None else None,
            "delayProbability": as_float(supplier.delay_probability) if supplier.delay_probability is not None else None,
        }
        for supplier in suppliers
    ]


def purchase_orders_payload(db: Session) -> list[dict[str, Any]]:
    orders = list(
        db.scalars(
            select(PurchaseOrder)
            .options(selectinload(PurchaseOrder.supplier), selectinload(PurchaseOrder.items))
            .order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc())
            .limit(100)
        )
    )
    return [
        {
            "id": order.id,
            "supplier": order.supplier.name,
            "orderDate": order.order_date.isoformat(),
            "expectedDeliveryDate": order.expected_delivery_date.isoformat(),
            "actualDeliveryDate": order.actual_delivery_date.isoformat() if order.actual_delivery_date else None,
            "status": order.status,
            "totalCost": as_float(order.total_cost),
            "items": [{"productId": item.product_id, "quantity": item.quantity, "receivedQuantity": item.received_quantity} for item in order.items],
        }
        for order in orders
    ]

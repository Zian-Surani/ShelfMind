from __future__ import annotations

import argparse
import random
from pathlib import Path
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import SessionLocal
from app.models import (
    AgentEvent,
    AuditEvent,
    Base,
    DataSource,
    Decision,
    DecisionEvaluation,
    DecisionOutcome,
    DemandObservation,
    DemandSubstitution,
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
)
from app.services.retail import SIMULATION_STATE_ID, audit, current_business_date, make_decision_for_product, money, persist_experiment
from app.services.rl import DQNEngine, QLearningEngine, ValueIterationEngine


PRODUCTS = [
    {
        "id": "prod-lays-classic",
        "sku": "SNK-LAYS-CLASSIC-52G",
        "name": "Lay's Classic",
        "variant": "Salted Crisps (52g)",
        "brand": "Lay's",
        "supplier_id": "sup-pepsico",
        "selling_price": 45,
        "purchase_cost": 25,
        "shelf_capacity": 30,
        "storage_capacity": 96,
        "moq": 8,
        "shelf_life_days": 120,
        "base_daily_demand": 16.5,
        "image_key": "lays",
    },
    {
        "id": "prod-pringles-original",
        "sku": "SNK-PRINGLES-ORIGINAL-110G",
        "name": "Pringles Original",
        "variant": "Stacked Potato Crisps (110g)",
        "brand": "Pringles",
        "supplier_id": "sup-kellanova",
        "selling_price": 99,
        "purchase_cost": 63,
        "shelf_capacity": 20,
        "storage_capacity": 70,
        "moq": 6,
        "shelf_life_days": 180,
        "base_daily_demand": 8.5,
        "image_key": "pringles",
    },
    {
        "id": "prod-bingo-masala",
        "sku": "SNK-BINGO-MADANGLES-75G",
        "name": "Bingo Masala",
        "variant": "Mad Angles Spicy Masala (75g)",
        "brand": "Bingo",
        "supplier_id": "sup-itc",
        "selling_price": 35,
        "purchase_cost": 19,
        "shelf_capacity": 20,
        "storage_capacity": 80,
        "moq": 8,
        "shelf_life_days": 120,
        "base_daily_demand": 12.0,
        "image_key": "bingo",
    },
    {
        "id": "prod-too-yumm",
        "sku": "SNK-TOOYUMM-STIX-60G",
        "name": "Too Yumm! Veggie Stix",
        "variant": "Spanish Tomato (60g)",
        "brand": "Too Yumm!",
        "supplier_id": "sup-rpsg",
        "selling_price": 30,
        "purchase_cost": 16,
        "shelf_capacity": 25,
        "storage_capacity": 78,
        "moq": 8,
        "shelf_life_days": 120,
        "base_daily_demand": 7.5,
        "image_key": "lays",
    },
    {
        "id": "prod-doritos-nacho",
        "sku": "SNK-DORITOS-NACHO-150G",
        "name": "Doritos Nacho Cheese",
        "variant": "Tortilla Chips (150g)",
        "brand": "Doritos",
        "supplier_id": "sup-pepsico",
        "selling_price": 85,
        "purchase_cost": 52,
        "shelf_capacity": 35,
        "storage_capacity": 110,
        "moq": 10,
        "shelf_life_days": 150,
        "base_daily_demand": 10.5,
        "image_key": "bingo",
    },
    {
        "id": "prod-kurkure-chilli",
        "sku": "SNK-KURKURE-MASALA-85G",
        "name": "Kurkure Masala Munch",
        "variant": "Puffed Corn Crunch (85g)",
        "brand": "Kurkure",
        "supplier_id": "sup-pepsico",
        "selling_price": 25,
        "purchase_cost": 13,
        "shelf_capacity": 28,
        "storage_capacity": 92,
        "moq": 10,
        "shelf_life_days": 120,
        "base_daily_demand": 13.0,
        "image_key": "lays",
    },
]


def clear_database(db: Session) -> None:
    for model in [
        AgentEvent,
        AuditEvent,
        DecisionOutcome,
        HumanApproval,
        DecisionEvaluation,
        PurchaseOrderItem,
        PurchaseOrder,
        Decision,
        RLMetric,
        RLExperiment,
        ShelfObservation,
        ShelfAllocation,
        DemandSubstitution,
        SupplierPerformance,
        InventorySnapshot,
        SalesRecord,
        DemandObservation,
        Inventory,
        Product,
        ProductCategory,
        Supplier,
        DataSource,
        SimulationState,
        Store,
    ]:
        db.execute(delete(model))
    db.commit()


def seed_database(
    db: Session,
    reset: bool = False,
    history_days: int = 210,
    run_dqn: bool = True,
) -> dict[str, Any]:
    Base.metadata.create_all(bind=db.get_bind())
    if reset:
        clear_database(db)
    if db.scalar(select(Store)):
        return {"status": "already_seeded"}

    rng = random.Random(settings.scenario_seed)
    seed_sources(db)
    store = Store(
        id="STR-104-METRO",
        name="Downtown Flagship #104",
        manager_name="Zian",
        location="Bengaluru Metro - Snacks Aisle",
    )
    db.add(store)
    category = ProductCategory(
        id="cat-packaged-snacks",
        name="Packaged Snacks",
        shelf_capacity_facings=72,
        description="Competing salty snack products used for RL replenishment and shelf allocation.",
    )
    db.add(category)
    suppliers = {
        "sup-pepsico": Supplier(
            id="sup-pepsico",
            name="PepsiCo Metro Distribution",
            default_lead_time_days=2,
            reliability=Decimal("0.9300"),
            delay_probability=Decimal("0.1400"),
            contact_email="ops.metro@pepsico.example",
        ),
        "sup-kellanova": Supplier(
            id="sup-kellanova",
            name="Kellanova Snacks Depot",
            default_lead_time_days=3,
            reliability=Decimal("0.8900"),
            delay_probability=Decimal("0.2100"),
            contact_email="dispatch@kellanova.example",
        ),
        "sup-itc": Supplier(
            id="sup-itc",
            name="ITC Foods Regional DC",
            default_lead_time_days=2,
            reliability=Decimal("0.9100"),
            delay_probability=Decimal("0.1800"),
            contact_email="regional.dc@itc.example",
        ),
        "sup-rpsg": Supplier(
            id="sup-rpsg",
            name="RPSG Healthy Snacks Supply",
            default_lead_time_days=1,
            reliability=Decimal("0.9500"),
            delay_probability=Decimal("0.0900"),
            contact_email="supply@rpsg.example",
        ),
    }
    db.add_all(suppliers.values())
    db.flush()

    products: list[Product] = []
    for item in PRODUCTS:
        product = Product(
            id=item["id"],
            sku=item["sku"],
            name=item["name"],
            variant=item["variant"],
            brand=item["brand"],
            category_id=category.id,
            supplier_id=item["supplier_id"],
            selling_price=Decimal(str(item["selling_price"])),
            purchase_cost=Decimal(str(item["purchase_cost"])),
            shelf_capacity=item["shelf_capacity"],
            storage_capacity=item["storage_capacity"],
            minimum_order_quantity=item["moq"],
            shelf_life_days=item["shelf_life_days"],
            base_daily_demand=Decimal(str(item["base_daily_demand"])),
            image_key=item["image_key"],
        )
        products.append(product)
        db.add(product)
    db.flush()

    facings = {
        "prod-lays-classic": 18,
        "prod-pringles-original": 8,
        "prod-bingo-masala": 11,
        "prod-too-yumm": 9,
        "prod-doritos-nacho": 14,
        "prod-kurkure-chilli": 12,
    }
    for product in products:
        db.add(
            ShelfAllocation(
                store_id=store.id,
                category_id=category.id,
                product_id=product.id,
                facings=facings[product.id],
                min_facings=3,
                max_facings=min(product.shelf_capacity, 24),
            )
        )

    seed_substitution_matrix(db, products)
    seed_history(db, store, products, rng, history_days=history_days)
    db.flush()
    seed_current_conditions(db, store)
    db.flush()
    seed_decisions_and_experiments(db, store, products, run_dqn=run_dqn)
    validate_seed(db, store.id)
    db.add(SimulationState(id=SIMULATION_STATE_ID, store_id=store.id, current_day=current_business_date(), seed=settings.scenario_seed, step_index=0, status="READY", config={"mode": "connected"}))
    db.commit()
    return {
        "status": "seeded",
        "products": len(products),
        "history_days": history_days,
        "sales_records": db.scalar(select(SalesRecord).count()) if False else db.query(SalesRecord).count(),
        "decisions": db.query(Decision).count(),
    }


def seed_sources(db: Session) -> None:
    db.add_all(
        [
            DataSource(
                id="source-synthetic-retail-ops",
                source_type="generated",
                source_name="Deterministic packaged-snacks retail operations",
                source_path="app.seed",
                license="Generated for ShelfMind scenario reproducibility.",
                provenance_notes="Sales, demand, supplier performance, purchase orders, and outcomes are generated with a fixed seed and validated consistency rules until a live POS/ERP feed is connected.",
                generated=True,
                imported=False,
            ),
        ]
    )


def seed_substitution_matrix(db: Session, products: list[Product]) -> None:
    strengths = {
        ("prod-lays-classic", "prod-pringles-original"): 0.13,
        ("prod-lays-classic", "prod-bingo-masala"): 0.11,
        ("prod-pringles-original", "prod-lays-classic"): 0.07,
        ("prod-bingo-masala", "prod-kurkure-chilli"): 0.16,
        ("prod-kurkure-chilli", "prod-bingo-masala"): 0.14,
        ("prod-doritos-nacho", "prod-lays-classic"): 0.06,
        ("prod-too-yumm", "prod-lays-classic"): 0.04,
    }
    product_ids = {product.id for product in products}
    for (source, target), strength in strengths.items():
        if source in product_ids and target in product_ids:
            db.add(DemandSubstitution(source_product_id=source, target_product_id=target, substitution_strength=Decimal(str(strength))))


def demand_regime_for(day: date, product: Product, rng: random.Random) -> tuple[str, bool, str]:
    weekend = day.weekday() >= 5
    promotion_windows = {
        "prod-lays-classic": (day.toordinal() % 41 in range(0, 5)),
        "prod-bingo-masala": (day.toordinal() % 37 in range(10, 14)),
        "prod-doritos-nacho": (day.toordinal() % 53 in range(5, 8)),
    }
    promotion = promotion_windows.get(product.id, False)
    spike = product.id in {"prod-lays-classic", "prod-kurkure-chilli"} and day.toordinal() % 67 == 0
    if spike:
        return "SPIKE", promotion, "HIGH"
    if promotion:
        return "HIGH", promotion, "HIGH"
    if weekend:
        return "HIGH", promotion, "NORMAL"
    if rng.random() < 0.05:
        return "LOW", promotion, "LOW"
    return "NORMAL", promotion, "NORMAL"


def expected_for(product: Product, day: date, regime: str, promotion: bool, pressure: str) -> float:
    base = float(product.base_daily_demand)
    weekday_factor = 1.18 if day.weekday() >= 5 else 1.0
    seasonal = 1.0 + 0.08 * __import__("math").sin((day.timetuple().tm_yday / 365) * 6.283)
    regime_factor = {"LOW": 0.68, "NORMAL": 1.0, "HIGH": 1.32, "SPIKE": 1.85}[regime]
    promo_factor = 1.22 if promotion else 1.0
    pressure_factor = {"LOW": 0.92, "NORMAL": 1.0, "HIGH": 1.1}[pressure]
    return round(base * weekday_factor * seasonal * regime_factor * promo_factor * pressure_factor, 2)


def seed_history(db: Session, store: Store, products: list[Product], rng: random.Random, history_days: int) -> None:
    today = current_business_date()
    start = today - timedelta(days=history_days)
    current: dict[str, dict[str, int]] = {}
    pending: list[dict[str, Any]] = []
    po_counter = 8100
    for product in products:
        current[product.id] = {
            "shelf": min(product.shelf_capacity, int(float(product.base_daily_demand) * 1.4)),
            "back": int(product.storage_capacity * 0.45),
            "incoming": 0,
        }

    for offset in range(history_days):
        day = start + timedelta(days=offset)
        due = [row for row in pending if row["actual_delivery_date"] == day]
        for row in due:
            stock = current[row["product_id"]]
            stock["incoming"] = max(0, stock["incoming"] - row["quantity"])
            stock["back"] += row["quantity"]
            row["po"].status = "DELIVERED"
            row["po"].actual_delivery_date = day
            row["item"].received_quantity = row["quantity"]
            supplier = db.get(Supplier, row["supplier_id"])
            db.add(
                SupplierPerformance(
                    supplier_id=row["supplier_id"],
                    observed_on=day,
                    expected_lead_time_days=supplier.default_lead_time_days,
                    actual_lead_time_days=(day - row["po"].order_date).days,
                    on_time=day <= row["po"].expected_delivery_date,
                    fill_rate=Decimal("1.0000"),
                )
            )
        pending = [row for row in pending if row["actual_delivery_date"] > day]

        for product in products:
            stock = current[product.id]
            opening_shelf = stock["shelf"]
            opening_back = stock["back"]
            opening_incoming = stock["incoming"]
            received = sum(row["quantity"] for row in due if row["product_id"] == product.id)
            regime, promotion, pressure = demand_regime_for(day, product, rng)
            expected = expected_for(product, day, regime, promotion, pressure)
            realized = max(0, int(round(rng.gauss(expected, max(1.0, expected * 0.11)))))
            available = stock["shelf"] + stock["back"]
            sold = min(realized, available)
            lost = max(0, realized - sold)
            shelf_take = min(sold, stock["shelf"])
            stock["shelf"] -= shelf_take
            stock["back"] = max(0, stock["back"] - (sold - shelf_take))
            waste = 0
            if stock["back"] + stock["shelf"] > product.storage_capacity and rng.random() < 0.45:
                waste = min(stock["back"], stock["back"] + stock["shelf"] - product.storage_capacity)
                stock["back"] -= waste
            restock_target = min(product.shelf_capacity, max(4, int(float(product.base_daily_demand) * 1.25)))
            restock = min(stock["back"], max(0, restock_target - stock["shelf"]))
            stock["back"] -= restock
            stock["shelf"] += restock
            db.add(
                SalesRecord(
                    store_id=store.id,
                    product_id=product.id,
                    sold_at=datetime.combine(day, time(18, 30), tzinfo=timezone.utc),
                    units_sold=sold,
                    unit_price=product.selling_price,
                    promotion_flag=promotion,
                    demand_regime=regime,
                    lost_sales_quantity=lost,
                )
            )
            db.add(
                DemandObservation(
                    store_id=store.id,
                    product_id=product.id,
                    observed_on=day,
                    regime=regime,
                    expected_demand=Decimal(str(expected)),
                    realized_demand=realized,
                    promotion_flag=promotion,
                    competitor_pressure=pressure,
                    confidence=Decimal("0.8700") if regime != "SPIKE" else Decimal("0.7800"),
                )
            )
            db.add(
                InventorySnapshot(
                    store_id=store.id,
                    product_id=product.id,
                    snapshot_date=day,
                    opening_shelf_quantity=opening_shelf,
                    opening_backroom_quantity=opening_back,
                    opening_incoming_quantity=opening_incoming,
                    received_quantity=received,
                    units_sold=sold,
                    lost_sales_quantity=lost,
                    waste_quantity=waste,
                    closing_shelf_quantity=stock["shelf"],
                    closing_backroom_quantity=stock["back"],
                    closing_incoming_quantity=stock["incoming"],
                )
            )
            reorder_threshold = expected * (product.supplier.default_lead_time_days + 1.0)
            has_pending = any(row["product_id"] == product.id for row in pending)
            if stock["shelf"] + stock["back"] + stock["incoming"] < reorder_threshold and not has_pending:
                quantity = max(product.minimum_order_quantity, int(round(expected * (product.supplier.default_lead_time_days + 2) / product.minimum_order_quantity)) * product.minimum_order_quantity)
                expected_delivery = day + timedelta(days=product.supplier.default_lead_time_days)
                delayed = rng.random() < float(product.supplier.delay_probability)
                actual_delivery = expected_delivery + timedelta(days=1 if delayed else 0)
                po_counter += 1
                po = PurchaseOrder(
                    id=f"PO-{po_counter}",
                    store_id=store.id,
                    supplier_id=product.supplier_id,
                    decision_id=None,
                    order_date=day,
                    expected_delivery_date=expected_delivery,
                    actual_delivery_date=None,
                    status="DELAYED" if delayed else "ORDERED",
                    total_cost=money(quantity * float(product.purchase_cost)),
                    delay_reason="Regional DC queue delay" if delayed else "",
                )
                db.add(po)
                db.flush()
                item = PurchaseOrderItem(
                    purchase_order_id=po.id,
                    product_id=product.id,
                    quantity=quantity,
                    unit_cost=product.purchase_cost,
                    received_quantity=0,
                )
                db.add(item)
                stock["incoming"] += quantity
                pending.append(
                    {
                        "product_id": product.id,
                        "supplier_id": product.supplier_id,
                        "quantity": quantity,
                        "actual_delivery_date": actual_delivery,
                        "po": po,
                        "item": item,
                    }
                )

    for product in products:
        stock = current[product.id]
        db.add(
            Inventory(
                store_id=store.id,
                product_id=product.id,
                shelf_quantity=max(0, stock["shelf"]),
                backroom_quantity=max(0, stock["back"]),
                incoming_quantity=max(0, stock["incoming"]),
                reserved_quantity=0,
                last_counted_at=datetime.combine(today, time(8, 0), tzinfo=timezone.utc),
            )
        )


def seed_current_conditions(db: Session, store: Store) -> None:
    overrides = {
        "prod-lays-classic": (5, 3, 24),
        "prod-pringles-original": (12, 6, 0),
        "prod-bingo-masala": (3, 9, 0),
        "prod-too-yumm": (22, 12, 0),
        "prod-doritos-nacho": (25, 17, 0),
        "prod-kurkure-chilli": (18, 8, 0),
    }
    for product_id, (shelf, back, incoming) in overrides.items():
        inv = db.scalar(select(Inventory).where(Inventory.store_id == store.id, Inventory.product_id == product_id))
        if inv:
            inv.shelf_quantity = shelf
            inv.backroom_quantity = back
            inv.incoming_quantity = incoming


def seed_decisions_and_experiments(db: Session, store: Store, products: list[Product], run_dqn: bool) -> None:
    algorithm_by_product = {
        "prod-lays-classic": "VALUE_ITERATION",
        "prod-pringles-original": "VALUE_ITERATION",
        "prod-bingo-masala": "Q_LEARNING",
        "prod-too-yumm": "VALUE_ITERATION",
        "prod-doritos-nacho": "VALUE_ITERATION",
        "prod-kurkure-chilli": "DQN" if run_dqn else "VALUE_ITERATION",
    }
    for product in products:
        make_decision_for_product(db, store, product, algorithm=algorithm_by_product[product.id], commit=False)

    vi_result = ValueIterationEngine(max_iterations=45).run_training(seed=settings.scenario_seed, max_iterations=45)
    persist_experiment(db, vi_result)
    q_result = QLearningEngine().run_training(seed=settings.scenario_seed, episodes=120)
    persist_experiment(db, q_result)
    if run_dqn:
        dqn_result = DQNEngine().run_training(seed=settings.scenario_seed, episodes=12)
        persist_experiment(db, dqn_result)

    audit(
        db,
        store.id,
        "MDP_EVALUATION",
        "MDP",
        "Seeded baseline MDP, Value Iteration, Q-learning, and DQN comparison metrics.",
        outcome_status="SUCCESS",
    )


def validate_seed(db: Session, store_id: str) -> None:
    products = list(db.scalars(select(Product)))
    if not products:
        raise RuntimeError("Seed validation failed: no products")
    for inventory in db.scalars(select(Inventory).where(Inventory.store_id == store_id)):
        if min(inventory.shelf_quantity, inventory.backroom_quantity, inventory.incoming_quantity, inventory.reserved_quantity) < 0:
            raise RuntimeError(f"Seed validation failed: negative inventory for {inventory.product_id}")
    for snapshot in db.scalars(select(InventorySnapshot).where(InventorySnapshot.store_id == store_id)):
        opening = snapshot.opening_shelf_quantity + snapshot.opening_backroom_quantity + snapshot.received_quantity
        if snapshot.units_sold > opening + snapshot.lost_sales_quantity:
            raise RuntimeError(f"Seed validation failed: impossible sale on {snapshot.snapshot_date}")
        if snapshot.closing_shelf_quantity < 0 or snapshot.closing_backroom_quantity < 0:
            raise RuntimeError("Seed validation failed: negative closing inventory")
    category = db.get(ProductCategory, "cat-packaged-snacks")
    total_facings = sum(row.facings for row in db.scalars(select(ShelfAllocation).where(ShelfAllocation.store_id == store_id)))
    if category and total_facings > category.shelf_capacity_facings:
        raise RuntimeError("Seed validation failed: shelf facings exceed category capacity")
    for po in db.scalars(select(PurchaseOrder)):
        if po.expected_delivery_date < po.order_date:
            raise RuntimeError("Seed validation failed: purchase order delivery before order date")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import the supplied CSV, or explicitly create a research scenario.")
    parser.add_argument("--scenario", action="store_true", help="Generate the legacy research scenario (test databases only)")
    parser.add_argument("--csv", type=Path, default=Path(__file__).resolve().parents[2] / "shelfmind_retail_history.csv")
    parser.add_argument("--reset", action="store_true", help="Clear ShelfMind tables before seeding.")
    parser.add_argument("--history-days", type=int, default=210)
    parser.add_argument("--skip-dqn", action="store_true", help="Skip DQN training for faster local smoke runs.")
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.scenario:
            if not settings.is_sqlite:
                parser.error("Generated scenarios must use a separate SQLite research database")
            result = seed_database(db, reset=args.reset, history_days=args.history_days, run_dqn=not args.skip_dqn)
        else:
            from app.services.history_import import import_history
            result = import_history(db, args.csv.read_bytes(), args.csv.name, generated=True, replace_generated=args.reset)
            db.commit()
    print(result)


if __name__ == "__main__":
    main()

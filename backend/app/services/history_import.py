from __future__ import annotations

import csv
import hashlib
import io
from collections import defaultdict
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app import models as m

INTEGER_FIELDS = (
    "opening_inventory shelf_quantity_before backroom_quantity_before demand units_sold "
    "lost_sales_units waste_units closing_shelf_quantity closing_backroom_quantity incoming_quantity "
    "shelf_capacity storage_capacity shelf_allocation supplier_lead_time_days minimum_order_quantity "
    "is_weekend is_promotion is_demand_spike order_quantity"
).split()
TEXT_FIELDS = "store_id product_id product_name brand category supplier_id demand_regime replenishment_policy".split()
REQUIRED_FIELDS = set(INTEGER_FIELDS + TEXT_FIELDS + ["date", "selling_price_inr", "purchase_cost_inr"])


def row_id(store: str, product: str, day: date) -> str:
    return hashlib.sha256(f"{store}|{product}|{day.isoformat()}".encode()).hexdigest()[:32]


def parse_history(content: bytes) -> list[dict]:
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    except UnicodeDecodeError as exc:
        raise ValueError("CSV must be UTF-8 encoded.") from exc
    missing = REQUIRED_FIELDS - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"Missing CSV columns: {', '.join(sorted(missing))}")
    rows, seen = [], set()
    for line, raw in enumerate(reader, start=2):
        try:
            if None in raw or any(raw.get(key) is None for key in REQUIRED_FIELDS):
                raise ValueError("Wrong number of fields")
            row = {key: value.strip() for key, value in raw.items()}
            original = dict(row)
            row["date"] = date.fromisoformat(row["date"])
            for key in INTEGER_FIELDS:
                row[key] = int(row[key])
                if row[key] < 0:
                    raise ValueError(f"{key} cannot be negative")
            for key in ("selling_price_inr", "purchase_cost_inr"):
                row[key] = Decimal(row[key])
                if not row[key].is_finite() or row[key] < 0:
                    raise ValueError(f"Invalid {key}")
            if any(not row[key] for key in TEXT_FIELDS):
                raise ValueError("Required text fields cannot be blank")
            if any(len(row[key]) > 64 for key in ("store_id", "product_id", "supplier_id")):
                raise ValueError("IDs must be at most 64 characters")
            if row["opening_inventory"] != row["shelf_quantity_before"] + row["backroom_quantity_before"]:
                raise ValueError("Opening inventory does not balance")
            if row["demand"] != row["units_sold"] + row["lost_sales_units"]:
                raise ValueError("Demand must equal sales plus lost sales")
            if row["opening_inventory"] - row["units_sold"] - row["waste_units"] != row["closing_shelf_quantity"] + row["closing_backroom_quantity"]:
                raise ValueError("Closing inventory does not balance")
            if row["shelf_capacity"] < 1 or row["minimum_order_quantity"] < 1:
                raise ValueError("Shelf capacity and minimum order quantity must be positive")
            if row["storage_capacity"] < row["shelf_capacity"] or max(row["shelf_quantity_before"], row["closing_shelf_quantity"], row["shelf_allocation"]) > row["shelf_capacity"]:
                raise ValueError("Inventory or allocation exceeds capacity")
            if any(row[key] not in (0, 1) for key in ("is_weekend", "is_promotion", "is_demand_spike")):
                raise ValueError("Flags must be 0 or 1")
            if bool(row["is_weekend"]) != (row["date"].weekday() >= 5):
                raise ValueError("Weekend flag does not match date")
            key = (row["store_id"], row["product_id"], row["date"])
            if key in seen:
                raise ValueError("Duplicate store/product/date")
            seen.add(key)
            row["raw"] = original
            rows.append(row)
        except (ValueError, InvalidOperation, TypeError) as exc:
            raise ValueError(f"CSV line {line}: {exc}") from exc
    if not rows:
        raise ValueError("CSV contains no records")
    if len({row["store_id"] for row in rows}) != 1:
        raise ValueError("Import one store per CSV")
    return sorted(rows, key=lambda r: (r["date"], r["product_id"]))


def remove_legacy_generated_data(db: Session) -> None:
    """Remove only the identifiable, untouched scenario installed by the old seeder."""
    source = db.get(m.DataSource, "source-synthetic-retail-ops")
    if not source or not source.generated:
        return
    if set(db.scalars(select(m.Store.id))) != {"STR-104-METRO"}:
        raise ValueError("Legacy cleanup requires a database containing only the original scenario store")
    if db.scalar(select(m.AgentEvent.id).limit(1)) or db.scalar(select(m.HumanApproval.id).limit(1)):
        raise ValueError("Legacy scenario has user activity; automatic cleanup stopped")
    if db.scalar(select(m.ShelfObservation.id).where(m.ShelfObservation.source != "ShelfWatch local sample").limit(1)):
        raise ValueError("Legacy store contains uploaded observations; preserve them before cleanup")
    allowed_events = {"AI_OBSERVATION", "RL_DECISION", "PURCHASE_CREATED", "MDP_EVALUATION"}
    if set(db.scalars(select(m.AuditEvent.event_type))) - allowed_events:
        raise ValueError("Legacy store contains additional activity; automatic cleanup stopped")
    for model in [m.AgentEvent, m.AuditEvent, m.DecisionOutcome, m.HumanApproval,
                  m.DecisionEvaluation, m.PurchaseOrderItem, m.PurchaseOrder, m.Decision,
                  m.RLMetric, m.RLExperiment, m.ShelfObservation, m.ShelfAllocation,
                  m.DemandSubstitution, m.SupplierPerformance, m.RetailHistoryRow,
                  m.InventorySnapshot, m.SalesRecord, m.DemandObservation, m.Inventory,
                  m.SimulationState, m.Product, m.ProductCategory, m.Supplier, m.Store, m.DataSource]:
        db.execute(delete(model))


def import_history(db: Session, content: bytes, filename: str, *, generated: bool,
                   replace_generated: bool = False) -> dict:
    rows = parse_history(content)
    digest = hashlib.sha256(content).hexdigest()
    source_id = f"csv-{digest[:40]}"
    if replace_generated:
        remove_legacy_generated_data(db)
    existing = {row.id: row for row in db.scalars(select(m.RetailHistoryRow))}
    pending = []
    for row in rows:
        key = row_id(row["store_id"], row["product_id"], row["date"])
        if key in existing:
            if existing[key].raw_values != row["raw"]:
                raise ValueError(f"Conflicting history for {row['product_id']} on {row['date']}; existing records were preserved")
        else:
            pending.append(row)
    result = {"status": "imported" if pending else "already_imported", "sourceId": source_id,
              "sha256": digest, "rows": len(rows), "inserted": len(pending), "skipped": len(rows) - len(pending),
              "products": len({r['product_id'] for r in rows}), "storeId": rows[0]["store_id"],
              "firstDate": rows[0]["date"].isoformat(), "lastDate": rows[-1]["date"].isoformat(),
              "generated": generated, "unitsSold": sum(r["units_sold"] for r in rows),
              "lostSales": sum(r["lost_sales_units"] for r in rows)}
    if not pending:
        return result
    source = db.get(m.DataSource, source_id)
    if not source:
        db.add(m.DataSource(id=source_id, source_type="simulated_csv" if generated else "retail_csv",
                           source_name=Path(filename).name[:160], source_path=Path(filename).name,
                           license="User supplied; redistribution rights not specified", generated=generated, imported=True,
                           provenance_notes=f"SHA256 {digest}. {'User confirmed generated/simulated history.' if generated else 'User declared operational history.'} "
                           "Original dates and all CSV columns retained. Forecast: trailing 28 prior records; first day uses observed demand as warm start. "
                           "No delivery receipts, supplier reliability, expiry dates or SKU image identities supplied."))
    store_id = rows[0]["store_id"]
    store = db.get(m.Store, store_id)
    if not store:
        store = m.Store(id=store_id, name=store_id, manager_name="Zian", location="", timezone="Asia/Calcutta", currency="INR")
        db.add(store)
    store.manager_name = "Zian"
    latest = {row["product_id"]: row for row in rows}
    for category_name in {r["category"] for r in rows}:
        category = db.scalar(select(m.ProductCategory).where(m.ProductCategory.name == category_name))
        if not category:
            category = m.ProductCategory(id="cat-" + hashlib.sha256(category_name.encode()).hexdigest()[:20], name=category_name,
                                        shelf_capacity_facings=sum(r["shelf_capacity"] for r in latest.values() if r["category"] == category_name))
            db.add(category)
            db.flush()
    for supplier_id in {r["supplier_id"] for r in rows}:
        row = next(r for r in reversed(rows) if r["supplier_id"] == supplier_id)
        if not db.get(m.Supplier, supplier_id):
            db.add(m.Supplier(id=supplier_id, name=supplier_id, default_lead_time_days=row["supplier_lead_time_days"], reliability=None, delay_probability=None))
    db.flush()
    categories = {c.name: c.id for c in db.scalars(select(m.ProductCategory))}
    for product_id, row in latest.items():
        product = db.get(m.Product, product_id)
        if product and product.name != row["product_name"]:
            raise ValueError(f"Product ID {product_id} belongs to a different product")
        if not product:
            history = [r["demand"] for r in rows if r["product_id"] == product_id][-28:]
            product = m.Product(id=product_id, sku=product_id, name=row["product_name"], variant="", brand=row["brand"],
                                category_id=categories[row["category"]], supplier_id=row["supplier_id"],
                                selling_price=row["selling_price_inr"], purchase_cost=row["purchase_cost_inr"],
                                shelf_capacity=row["shelf_capacity"], storage_capacity=row["storage_capacity"],
                                minimum_order_quantity=row["minimum_order_quantity"], shelf_life_days=None,
                                base_daily_demand=Decimal(str(sum(history) / len(history))).quantize(Decimal("0.01")),
                                image_key=next((key for brand, key in [("Lay's", "lays"), ("Pringles", "pringles"), ("Bingo", "bingo")] if row["brand"] == brand), ""))
            db.add(product)
    db.flush()
    history = defaultdict(list)
    for old in sorted(existing.values(), key=lambda r: r.observed_on):
        history[(old.store_id, old.product_id)].append((old.observed_on, int(old.raw_values["demand"])))
    batches = {m.RetailHistoryRow: [], m.SalesRecord: [], m.DemandObservation: [], m.InventorySnapshot: []}
    for row in pending:
        day, pid = row["date"], row["product_id"]
        key = row_id(store_id, pid, day)
        prior = [value for observed, value in history[(store_id, pid)] if observed < day][-28:]
        expected = Decimal(str(sum(prior) / len(prior) if prior else row["demand"])).quantize(Decimal("0.01"))
        history[(store_id, pid)].append((day, row["demand"]))
        batches[m.RetailHistoryRow].append(dict(id=key, source_id=source_id, store_id=store_id, product_id=pid, observed_on=day, raw_values=row["raw"]))
        batches[m.SalesRecord].append(dict(id=f"csv-sale-{key}", store_id=store_id, product_id=pid,
            sold_at=datetime.combine(day, time.min, tzinfo=ZoneInfo(store.timezone)), units_sold=row["units_sold"],
            unit_price=row["selling_price_inr"], promotion_flag=bool(row["is_promotion"]), demand_regime=row["demand_regime"], lost_sales_quantity=row["lost_sales_units"]))
        batches[m.DemandObservation].append(dict(id=f"csv-demand-{key}", store_id=store_id, product_id=pid, observed_on=day,
            regime=row["demand_regime"], expected_demand=expected, realized_demand=row["demand"], promotion_flag=bool(row["is_promotion"]), confidence=None))
        batches[m.InventorySnapshot].append(dict(id=f"csv-snapshot-{key}", store_id=store_id, product_id=pid, snapshot_date=day,
            opening_shelf_quantity=row["shelf_quantity_before"], opening_backroom_quantity=row["backroom_quantity_before"],
            opening_incoming_quantity=None, received_quantity=None, units_sold=row["units_sold"], lost_sales_quantity=row["lost_sales_units"],
            waste_quantity=row["waste_units"], closing_shelf_quantity=row["closing_shelf_quantity"],
            closing_backroom_quantity=row["closing_backroom_quantity"], closing_incoming_quantity=row["incoming_quantity"]))
    for model, records in batches.items():
        for offset in range(0, len(records), 250):
            db.execute(insert(model), records[offset:offset + 250])
    for pid, row in latest.items():
        inventory = db.scalar(select(m.Inventory).where(m.Inventory.store_id == store_id, m.Inventory.product_id == pid))
        # Re-importing older history must never rewind a later operational count.
        if not inventory or inventory.last_counted_at.date() < row["date"]:
            if not inventory:
                inventory = m.Inventory(store_id=store_id, product_id=pid, reserved_quantity=0)
                db.add(inventory)
            inventory.shelf_quantity = row["closing_shelf_quantity"]
            inventory.backroom_quantity = row["closing_backroom_quantity"]
            inventory.incoming_quantity = row["incoming_quantity"]
            inventory.last_counted_at = datetime.combine(row["date"], time(23, 59, 59), tzinfo=ZoneInfo(store.timezone))
        allocation = db.scalar(select(m.ShelfAllocation).where(m.ShelfAllocation.store_id == store_id, m.ShelfAllocation.product_id == pid))
        if not allocation:
            db.add(m.ShelfAllocation(store_id=store_id, product_id=pid, category_id=categories[row["category"]],
                                    facings=row["shelf_allocation"], min_facings=0, max_facings=row["shelf_capacity"]))
    db.add(m.AuditEvent(store_id=store_id, event_type="HISTORY_IMPORTED", category="SYSTEM",
                       message=f"Imported {len(pending)} {'simulated' if generated else 'retail'} daily history rows from {Path(filename).name}.",
                       outcome_status="SUCCESS", details=result))
    db.flush()
    return result

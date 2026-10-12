import csv
import io
from datetime import date, datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session

from app.models import Base, DataSource, Inventory, RetailHistoryRow, SalesRecord, ShelfObservation, Supplier
from app.services.history_import import import_history, parse_history
from app.services.serializers import dashboard_payload, analytics_payload
from app.services.retail import simulation_step, reset_simulation

CSV_PATH = Path(__file__).resolve().parents[2] / "shelfmind_retail_history.csv"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    @event.listens_for(engine, "connect")
    def enforce_fks(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    with Session(engine, autoflush=False, expire_on_commit=False) as session:
        yield session
    engine.dispose()


def test_supplied_history_totals_dates_and_dashboard(db):
    result = import_history(db, CSV_PATH.read_bytes(), CSV_PATH.name, generated=True)
    db.commit()
    assert result["rows"] == 1460
    assert result["unitsSold"] == 10814
    assert result["lostSales"] == 965
    assert db.scalar(select(func.sum(SalesRecord.units_sold))) == 10814
    assert db.scalar(select(func.count()).select_from(RetailHistoryRow)) == 1460
    assert db.scalar(select(DataSource)).generated is True
    assert db.scalar(select(Supplier)).reliability is None
    assert db.scalar(select(func.count()).select_from(ShelfObservation)) == 0
    inventory = db.scalar(select(Inventory).where(Inventory.product_id == "SKU001"))
    assert (inventory.shelf_quantity, inventory.backroom_quantity, inventory.incoming_quantity) == (3, 0, 35)
    assert inventory.last_counted_at.date() == date(2026, 9, 14)
    payload = dashboard_payload(db)
    assert payload["store"]["managerName"] == "Zian"
    assert payload["dataSource"]["lastDate"] == "2026-09-14"
    assert payload["dataSource"]["generated"] is True
    assert payload["demandSeries"][-1]["lays"] == 8
    assert payload["shelfWatch"]["shelfCompliance"] is None
    assert payload["shelfWatch"]["detectedItems"] == []


def test_repeat_import_does_not_duplicate_or_rewind_inventory(db):
    content = CSV_PATH.read_bytes()
    import_history(db, content, CSV_PATH.name, generated=True)
    db.commit()
    inventory = db.scalar(select(Inventory).where(Inventory.product_id == "SKU001"))
    inventory.shelf_quantity = 12
    inventory.last_counted_at = datetime.now(timezone.utc)
    db.commit()
    result = import_history(db, content, CSV_PATH.name, generated=True)
    assert result["inserted"] == 0
    assert db.scalar(select(func.count()).select_from(SalesRecord)) == 1460
    assert inventory.shelf_quantity == 12


def test_analytics_periods_use_csv_values_and_simulation_does_not_overwrite_them(db):
    import_history(db, CSV_PATH.read_bytes(), CSV_PATH.name, generated=True)
    db.commit()
    full = analytics_payload(db, days=365)
    week = analytics_payload(db, days=7)
    assert full["totals"]["revenue"] == 294030
    assert full["totals"]["costOfGoods"] == 175739
    assert week["period"]["firstDate"] == "2026-09-08"
    assert week["totals"]["unitsSold"] < full["totals"]["unitsSold"]
    with pytest.raises(ValueError, match="read-only"):
        simulation_step(db)
    reset_simulation(db)
    assert db.scalar(select(func.count()).select_from(RetailHistoryRow)) == 1460


def changed_csv(field, value):
    rows = list(csv.DictReader(io.StringIO(CSV_PATH.read_text())))
    rows[0][field] = value
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode()


def test_conflicting_rows_are_rejected_without_overwrite(db):
    import_history(db, CSV_PATH.read_bytes(), CSV_PATH.name, generated=True)
    db.commit()
    with pytest.raises(ValueError, match="Conflicting history"):
        import_history(db, changed_csv("selling_price_inr", "22"), "changed.csv", generated=True)
    db.rollback()
    first = db.scalar(select(RetailHistoryRow).where(RetailHistoryRow.product_id == "SKU001").order_by(RetailHistoryRow.observed_on))
    assert first.raw_values["selling_price_inr"] == "20"


@pytest.mark.parametrize("field,value", [("demand", "99"), ("waste_units", "-1"), ("selling_price_inr", "NaN"), ("is_weekend", "1")])
def test_bad_rows_rejected_with_line_number(field, value):
    with pytest.raises(ValueError, match="CSV line 2"):
        parse_history(changed_csv(field, value))

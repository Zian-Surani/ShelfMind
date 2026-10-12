from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[dict[str, Any]]: JSON, Decimal: Numeric(12, 2)}


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class Store(TimestampMixin, Base):
    __tablename__ = "stores"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    manager_name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(160), nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), default="Asia/Calcutta", nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="INR", nullable=False)

    inventories: Mapped[list[Inventory]] = relationship(back_populates="store")
    shelf_observations: Mapped[list[ShelfObservation]] = relationship(back_populates="store")
    decisions: Mapped[list[Decision]] = relationship(back_populates="store")


class ProductCategory(TimestampMixin, Base):
    __tablename__ = "product_categories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    shelf_capacity_facings: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)

    products: Mapped[list[Product]] = relationship(back_populates="category")
    allocations: Mapped[list[ShelfAllocation]] = relationship(back_populates="category")

    __table_args__ = (CheckConstraint("shelf_capacity_facings > 0", name="ck_category_capacity_positive"),)


class Supplier(TimestampMixin, Base):
    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    default_lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    reliability: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    delay_probability: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    contact_email: Mapped[str] = mapped_column(String(160), default="", nullable=False)

    products: Mapped[list[Product]] = relationship(back_populates="supplier")
    purchase_orders: Mapped[list[PurchaseOrder]] = relationship(back_populates="supplier")
    performance_records: Mapped[list[SupplierPerformance]] = relationship(back_populates="supplier")

    __table_args__ = (
        CheckConstraint("default_lead_time_days >= 0", name="ck_supplier_lead_time_nonnegative"),
        CheckConstraint("reliability >= 0 and reliability <= 1", name="ck_supplier_reliability_range"),
        CheckConstraint("delay_probability >= 0 and delay_probability <= 1", name="ck_supplier_delay_range"),
    )


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    sku: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    variant: Mapped[str] = mapped_column(String(160), nullable=False)
    brand: Mapped[str] = mapped_column(String(120), nullable=False)
    category_id: Mapped[str] = mapped_column(ForeignKey("product_categories.id"), nullable=False)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    purchase_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    shelf_capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    minimum_order_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    shelf_life_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    base_daily_demand: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    image_key: Mapped[str] = mapped_column(String(80), default="lays", nullable=False)

    category: Mapped[ProductCategory] = relationship(back_populates="products")
    supplier: Mapped[Supplier] = relationship(back_populates="products")
    inventories: Mapped[list[Inventory]] = relationship(back_populates="product")
    sales_records: Mapped[list[SalesRecord]] = relationship(back_populates="product")
    demand_observations: Mapped[list[DemandObservation]] = relationship(back_populates="product")
    shelf_observations: Mapped[list[ShelfObservation]] = relationship(back_populates="product")
    allocations: Mapped[list[ShelfAllocation]] = relationship(back_populates="product")
    decisions: Mapped[list[Decision]] = relationship(back_populates="product")

    __table_args__ = (
        CheckConstraint("selling_price >= 0", name="ck_product_selling_price_nonnegative"),
        CheckConstraint("purchase_cost >= 0", name="ck_product_purchase_cost_nonnegative"),
        CheckConstraint("shelf_capacity > 0", name="ck_product_shelf_capacity_positive"),
        CheckConstraint("storage_capacity >= shelf_capacity", name="ck_product_storage_capacity"),
        CheckConstraint("minimum_order_quantity > 0", name="ck_product_moq_positive"),
    )


class Inventory(TimestampMixin, Base):
    __tablename__ = "inventories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("inv"))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    shelf_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    backroom_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    incoming_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reserved_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_counted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    store: Mapped[Store] = relationship(back_populates="inventories")
    product: Mapped[Product] = relationship(back_populates="inventories")

    @property
    def available_inventory(self) -> int:
        return max(0, self.shelf_quantity + self.backroom_quantity - self.reserved_quantity)

    @property
    def inventory_position(self) -> int:
        return self.available_inventory + self.incoming_quantity

    __table_args__ = (
        UniqueConstraint("store_id", "product_id", name="uq_inventory_store_product"),
        CheckConstraint("shelf_quantity >= 0", name="ck_inventory_shelf_nonnegative"),
        CheckConstraint("backroom_quantity >= 0", name="ck_inventory_backroom_nonnegative"),
        CheckConstraint("incoming_quantity >= 0", name="ck_inventory_incoming_nonnegative"),
        CheckConstraint("reserved_quantity >= 0", name="ck_inventory_reserved_nonnegative"),
        Index("ix_inventory_store_product", "store_id", "product_id"),
    )


class InventorySnapshot(TimestampMixin, Base):
    __tablename__ = "inventory_snapshots"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("snap"))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    opening_shelf_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    opening_backroom_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    opening_incoming_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    received_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    units_sold: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lost_sales_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    waste_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    closing_shelf_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    closing_backroom_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    closing_incoming_quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("store_id", "product_id", "snapshot_date", name="uq_snapshot_store_product_date"),
        CheckConstraint("opening_shelf_quantity >= 0", name="ck_snapshot_open_shelf"),
        CheckConstraint("opening_backroom_quantity >= 0", name="ck_snapshot_open_back"),
        CheckConstraint("closing_shelf_quantity >= 0", name="ck_snapshot_close_shelf"),
        CheckConstraint("closing_backroom_quantity >= 0", name="ck_snapshot_close_back"),
        Index("ix_snapshot_product_date", "product_id", "snapshot_date"),
    )


class SalesRecord(TimestampMixin, Base):
    __tablename__ = "sales_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("sale"))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    units_sold: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    promotion_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    demand_regime: Mapped[str] = mapped_column(String(32), nullable=False)
    lost_sales_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped[Product] = relationship(back_populates="sales_records")

    __table_args__ = (
        CheckConstraint("units_sold >= 0", name="ck_sales_units_nonnegative"),
        CheckConstraint("lost_sales_quantity >= 0", name="ck_sales_lost_nonnegative"),
        Index("ix_sales_product_sold_at", "product_id", "sold_at"),
    )


class DemandObservation(TimestampMixin, Base):
    __tablename__ = "demand_observations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("demand"))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    observed_on: Mapped[date] = mapped_column(Date, nullable=False)
    regime: Mapped[str] = mapped_column(String(32), nullable=False)
    expected_demand: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    realized_demand: Mapped[int] = mapped_column(Integer, nullable=False)
    promotion_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    competitor_pressure: Mapped[str] = mapped_column(String(32), default="NORMAL", nullable=False)
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)

    product: Mapped[Product] = relationship(back_populates="demand_observations")

    __table_args__ = (
        UniqueConstraint("store_id", "product_id", "observed_on", name="uq_demand_store_product_date"),
        CheckConstraint("expected_demand >= 0", name="ck_demand_expected_nonnegative"),
        CheckConstraint("realized_demand >= 0", name="ck_demand_realized_nonnegative"),
        Index("ix_demand_product_date", "product_id", "observed_on"),
    )


class ShelfObservation(TimestampMixin, Base):
    __tablename__ = "shelf_observations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("shelfobs"))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(80), nullable=False)
    source_image_path: Mapped[str] = mapped_column(Text, default="", nullable=False)
    visible_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    shelf_occupancy_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    detection_confidence: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    detection_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    store: Mapped[Store] = relationship(back_populates="shelf_observations")
    product: Mapped[Product | None] = relationship(back_populates="shelf_observations")

    __table_args__ = (
        CheckConstraint("visible_quantity >= 0", name="ck_shelfobs_visible_nonnegative"),
        CheckConstraint("shelf_occupancy_percent >= 0", name="ck_shelfobs_occupancy_nonnegative"),
        Index("ix_shelf_observation_store_time", "store_id", "observed_at"),
    )


class ShelfAllocation(TimestampMixin, Base):
    __tablename__ = "shelf_allocations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("alloc"))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    category_id: Mapped[str] = mapped_column(ForeignKey("product_categories.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    facings: Mapped[int] = mapped_column(Integer, nullable=False)
    min_facings: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    max_facings: Mapped[int] = mapped_column(Integer, nullable=False)

    category: Mapped[ProductCategory] = relationship(back_populates="allocations")
    product: Mapped[Product] = relationship(back_populates="allocations")

    __table_args__ = (
        UniqueConstraint("store_id", "product_id", name="uq_allocation_store_product"),
        CheckConstraint("facings >= 0", name="ck_allocation_facings_nonnegative"),
        CheckConstraint("max_facings >= min_facings", name="ck_allocation_max_min"),
    )


class SupplierPerformance(TimestampMixin, Base):
    __tablename__ = "supplier_performance"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("supperf"))
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    observed_on: Mapped[date] = mapped_column(Date, nullable=False)
    expected_lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    on_time: Mapped[bool] = mapped_column(Boolean, nullable=False)
    fill_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)

    supplier: Mapped[Supplier] = relationship(back_populates="performance_records")

    __table_args__ = (Index("ix_supplier_performance_supplier_date", "supplier_id", "observed_on"),)


class PurchaseOrder(TimestampMixin, Base):
    __tablename__ = "purchase_orders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    decision_id: Mapped[str | None] = mapped_column(ForeignKey("decisions.id"), nullable=True)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_delivery_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    delay_reason: Mapped[str] = mapped_column(String(180), default="", nullable=False)

    supplier: Mapped[Supplier] = relationship(back_populates="purchase_orders")
    decision: Mapped[Decision | None] = relationship(back_populates="purchase_order")
    items: Mapped[list[PurchaseOrderItem]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("total_cost >= 0", name="ck_purchase_order_total_nonnegative"),
        Index("ix_purchase_order_status_delivery", "status", "expected_delivery_date"),
    )


class PurchaseOrderItem(TimestampMixin, Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("poitem"))
    purchase_order_id: Mapped[str] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    received_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="items")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_po_item_quantity_positive"),
        CheckConstraint("received_quantity >= 0", name="ck_po_item_received_nonnegative"),
    )


class Decision(TimestampMixin, Base):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    engine: Mapped[str] = mapped_column(String(48), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    shelf_action: Mapped[str] = mapped_column(String(32), default="MAINTAIN", nullable=False)
    status: Mapped[str] = mapped_column(String(48), nullable=False)
    recommended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    current_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_demand: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    supplier_lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    stockout_risk: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    risk_score: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    state_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    recommendation_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    execution_note: Mapped[str] = mapped_column(Text, default="", nullable=False)

    store: Mapped[Store] = relationship(back_populates="decisions")
    product: Mapped[Product] = relationship(back_populates="decisions")
    evaluations: Mapped[list[DecisionEvaluation]] = relationship(back_populates="decision", cascade="all, delete-orphan")
    outcome: Mapped[DecisionOutcome | None] = relationship(back_populates="decision", cascade="all, delete-orphan")
    human_approval: Mapped[HumanApproval | None] = relationship(back_populates="decision", cascade="all, delete-orphan")
    purchase_order: Mapped[PurchaseOrder | None] = relationship(back_populates="decision", uselist=False)

    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_decision_quantity_nonnegative"),
        Index("ix_decision_status_time", "status", "recommended_at"),
    )


class DecisionEvaluation(TimestampMixin, Base):
    __tablename__ = "decision_evaluations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("eval"))
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), nullable=False)
    action_label: Mapped[str] = mapped_column(String(80), nullable=False)
    order_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    shelf_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    action_value: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    is_optimal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reward_components: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    decision: Mapped[Decision] = relationship(back_populates="evaluations")


class DecisionOutcome(TimestampMixin, Base):
    __tablename__ = "decision_outcomes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("outcome"))
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), nullable=False, unique=True)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    actual_demand: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_sales: Mapped[int] = mapped_column(Integer, nullable=False)
    stockout_occurred: Mapped[bool] = mapped_column(Boolean, nullable=False)
    lost_sales_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    holding_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    ordering_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reward: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    success_label: Mapped[str] = mapped_column(String(64), nullable=False)

    decision: Mapped[Decision] = relationship(back_populates="outcome")


class HumanApproval(TimestampMixin, Base):
    __tablename__ = "human_approvals"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("approval"))
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), nullable=False, unique=True)
    original_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    human_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
    decided_by: Mapped[str] = mapped_column(String(120), default="Zian", nullable=False)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    decision: Mapped[Decision] = relationship(back_populates="human_approval")


class AuditEvent(TimestampMixin, Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("audit"))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    decision_id: Mapped[str | None] = mapped_column(ForeignKey("decisions.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    state_summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    action_summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    execution_summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    outcome_status: Mapped[str] = mapped_column(String(32), default="IN_PROGRESS", nullable=False)
    outcome_label: Mapped[str] = mapped_column(Text, default="", nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (Index("ix_audit_store_time", "store_id", "occurred_at"),)


class AgentEvent(TimestampMixin, Base):
    __tablename__ = "agent_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("agent"))
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    user_query: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    source_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class RLExperiment(TimestampMixin, Base):
    __tablename__ = "rl_experiments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    algorithm: Mapped[str] = mapped_column(String(64), nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    environment_config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    hyperparameters: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    training_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    training_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    number_of_states: Mapped[int] = mapped_column(Integer, nullable=False)
    number_of_actions: Mapped[int] = mapped_column(Integer, nullable=False)
    iterations: Mapped[int] = mapped_column(Integer, nullable=False)
    converged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    runtime_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="COMPLETED", nullable=False)
    artifact_path: Mapped[str] = mapped_column(Text, default="", nullable=False)

    metrics: Mapped[list[RLMetric]] = relationship(back_populates="experiment", cascade="all, delete-orphan")


class RLMetric(TimestampMixin, Base):
    __tablename__ = "rl_metrics"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("rlmetric"))
    experiment_id: Mapped[str] = mapped_column(ForeignKey("rl_experiments.id"), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(120), nullable=False)
    metric_value: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    step: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    metric_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    experiment: Mapped[RLExperiment] = relationship(back_populates="metrics")

    __table_args__ = (Index("ix_rl_metric_experiment_name", "experiment_id", "metric_name"),)


class SystemSetting(TimestampMixin, Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)


class DataSource(TimestampMixin, Base):
    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_name: Mapped[str] = mapped_column(String(160), nullable=False)
    source_path: Mapped[str] = mapped_column(Text, default="", nullable=False)
    license: Mapped[str] = mapped_column(Text, default="", nullable=False)
    provenance_notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    imported: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class RetailHistoryRow(TimestampMixin, Base):
    __tablename__ = "retail_history_rows"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id"), nullable=False)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    observed_on: Mapped[date] = mapped_column(Date, nullable=False)
    raw_values: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    __table_args__ = (
        UniqueConstraint("store_id", "product_id", "observed_on", name="uq_retail_history_day"),
    )


class DemandSubstitution(TimestampMixin, Base):
    __tablename__ = "demand_substitutions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("sub"))
    source_product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    target_product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    substitution_strength: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)

    __table_args__ = (
        UniqueConstraint("source_product_id", "target_product_id", name="uq_demand_substitution_pair"),
        CheckConstraint("substitution_strength >= 0 and substitution_strength <= 1", name="ck_substitution_strength"),
    )


class SimulationState(TimestampMixin, Base):
    __tablename__ = "simulation_states"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    store_id: Mapped[str] = mapped_column(ForeignKey("stores.id"), nullable=False)
    current_day: Mapped[date] = mapped_column(Date, nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="READY", nullable=False)
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

"""Preserve imported rows and represent unreported measurements as null."""

from alembic import op
import sqlalchemy as sa

revision = "20260917_0002"
down_revision = "20260914_0001"
branch_labels = None
depends_on = None


def upgrade():
    from app.models import RetailHistoryRow

    RetailHistoryRow.__table__.create(op.get_bind(), checkfirst=True)
    for table, columns in {
        "suppliers": ["reliability", "delay_probability"],
        "products": ["shelf_life_days"],
        "inventory_snapshots": ["opening_incoming_quantity", "received_quantity"],
        "demand_observations": ["confidence"],
        "shelf_observations": ["shelf_occupancy_percent"],
    }.items():
        with op.batch_alter_table(table) as batch:
            for column in columns:
                batch.alter_column(column, nullable=True)
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text("ALTER TABLE retail_history_rows ENABLE ROW LEVEL SECURITY"))


def downgrade():
    # Missing measurements cannot be converted to non-null without inventing data.
    op.drop_table("retail_history_rows")

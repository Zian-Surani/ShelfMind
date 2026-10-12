"""initial ShelfMind schema

Revision ID: 20260914_0001
Revises:
Create Date: 2026-09-14
"""

from __future__ import annotations

from alembic import op


revision = "20260914_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.models import Base

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from app.models import Base

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)


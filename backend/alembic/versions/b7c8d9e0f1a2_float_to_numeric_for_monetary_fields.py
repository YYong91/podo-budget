"""Float to Numeric for monetary fields

금액 필드(expenses.amount, budgets.amount)를 Float에서 Numeric(12,2)으로 변경합니다.
budgets.alert_threshold는 비율값(0.0~1.0)이므로 Float 유지합니다.

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2026-02-15
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1a2"  # pragma: allowlist secret
down_revision = "a1b2c3d4e5f6"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # expenses.amount: Float → Numeric(12, 2)
    op.alter_column(
        "expenses",
        "amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=12, scale=2),
        existing_nullable=False,
    )

    # budgets.amount: Float → Numeric(12, 2)
    op.alter_column(
        "budgets",
        "amount",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=12, scale=2),
        existing_nullable=False,
    )


def downgrade() -> None:
    # budgets.amount: Numeric(12, 2) → Float
    op.alter_column(
        "budgets",
        "amount",
        existing_type=sa.Numeric(precision=12, scale=2),
        type_=sa.Float(),
        existing_nullable=False,
    )

    # expenses.amount: Numeric(12, 2) → Float
    op.alter_column(
        "expenses",
        "amount",
        existing_type=sa.Numeric(precision=12, scale=2),
        type_=sa.Float(),
        existing_nullable=False,
    )

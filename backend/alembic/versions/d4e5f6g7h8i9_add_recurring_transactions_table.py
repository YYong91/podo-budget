"""정기 거래 테이블 생성

recurring_transactions 테이블을 생성합니다.
정기적으로 반복되는 지출/수입을 관리하기 위한 테이블입니다.

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-02-16
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "d4e5f6g7h8i9"  # pragma: allowlist secret
down_revision = "c3d4e5f6g7h8"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recurring_transactions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "household_id",
            sa.Integer(),
            sa.ForeignKey("households.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column(
            "category_id",
            sa.Integer(),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("frequency", sa.String(10), nullable=False),
        sa.Column("interval", sa.Integer(), nullable=True),
        sa.Column("day_of_month", sa.Integer(), nullable=True),
        sa.Column("day_of_week", sa.Integer(), nullable=True),
        sa.Column("month_of_year", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("next_due_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # 인덱스 생성
    op.create_index("ix_recurring_transactions_id", "recurring_transactions", ["id"])
    op.create_index("ix_recurring_transactions_user_id", "recurring_transactions", ["user_id"])
    op.create_index("ix_recurring_user_active", "recurring_transactions", ["user_id", "is_active"])
    op.create_index("ix_recurring_next_due_active", "recurring_transactions", ["next_due_date", "is_active"])
    op.create_index("ix_recurring_household_active", "recurring_transactions", ["household_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_recurring_household_active", table_name="recurring_transactions")
    op.drop_index("ix_recurring_next_due_active", table_name="recurring_transactions")
    op.drop_index("ix_recurring_user_active", table_name="recurring_transactions")
    op.drop_index("ix_recurring_transactions_user_id", table_name="recurring_transactions")
    op.drop_index("ix_recurring_transactions_id", table_name="recurring_transactions")
    op.drop_table("recurring_transactions")

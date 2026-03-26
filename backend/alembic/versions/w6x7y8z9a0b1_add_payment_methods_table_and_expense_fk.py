"""add payment_methods table and expense fk

Revision ID: w6x7y8z9a0b1
Revises: v5w6x7y8z9a0
Create Date: 2026-03-26
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "w6x7y8z9a0b1"
down_revision = "v5w6x7y8z9a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # payment_methods 테이블 생성
    op.create_table(
        "payment_methods",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("monthly_target", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("billing_day", sa.Integer(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_methods_id", "payment_methods", ["id"])
    op.create_index("ix_payment_methods_household_user", "payment_methods", ["household_id", "created_by"])

    # expenses 테이블에 payment_method_id FK 추가 (batch: SQLite 호환)
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.add_column(sa.Column("payment_method_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_expenses_payment_method_id",
            "payment_methods",
            ["payment_method_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.drop_constraint("fk_expenses_payment_method_id", type_="foreignkey")
        batch_op.drop_column("payment_method_id")
    op.drop_index("ix_payment_methods_household_user", table_name="payment_methods")
    op.drop_index("ix_payment_methods_id", table_name="payment_methods")
    op.drop_table("payment_methods")

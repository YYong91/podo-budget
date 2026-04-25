"""recurring_transactions에 payment_method_id 추가

Revision ID: 9e4524bd33ae
Revises: z9a0b1c2d3e4
Create Date: 2026-04-26
"""

import sqlalchemy as sa

from alembic import op

revision = "9e4524bd33ae"  # pragma: allowlist secret
down_revision = "z9a0b1c2d3e4"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("recurring_transactions") as batch_op:
        batch_op.add_column(sa.Column("payment_method_id", sa.Integer(), nullable=True))
        # SQLite는 FK constraint 이름 지원이 제한적이므로 조건부 처리
        if op.get_bind().dialect.name != "sqlite":
            batch_op.create_foreign_key(
                "fk_recurring_payment_method",
                "payment_methods",
                ["payment_method_id"],
                ["id"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    with op.batch_alter_table("recurring_transactions") as batch_op:
        if op.get_bind().dialect.name != "sqlite":
            batch_op.drop_constraint("fk_recurring_payment_method", type_="foreignkey")
        batch_op.drop_column("payment_method_id")

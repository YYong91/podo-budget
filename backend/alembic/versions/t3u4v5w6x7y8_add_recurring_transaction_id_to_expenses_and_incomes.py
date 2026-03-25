"""지출/수입 테이블에 recurring_transaction_id FK 추가

반복 거래(RecurringTransaction)에서 생성된 지출/수입을 원본과 연결합니다.

Revision ID: t3u4v5w6x7y8
Revises: s2t3u4v5w6x7
Create Date: 2026-03-25
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "t3u4v5w6x7y8"  # pragma: allowlist secret
down_revision = "s2t3u4v5w6x7"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # expenses 테이블에 recurring_transaction_id 컬럼 추가
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.add_column(sa.Column("recurring_transaction_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_expenses_recurring_transaction_id",
            "recurring_transactions",
            ["recurring_transaction_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # incomes 테이블에 recurring_transaction_id 컬럼 추가
    with op.batch_alter_table("incomes") as batch_op:
        batch_op.add_column(sa.Column("recurring_transaction_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_incomes_recurring_transaction_id",
            "recurring_transactions",
            ["recurring_transaction_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.drop_constraint("fk_expenses_recurring_transaction_id", type_="foreignkey")
        batch_op.drop_column("recurring_transaction_id")

    with op.batch_alter_table("incomes") as batch_op:
        batch_op.drop_constraint("fk_incomes_recurring_transaction_id", type_="foreignkey")
        batch_op.drop_column("recurring_transaction_id")

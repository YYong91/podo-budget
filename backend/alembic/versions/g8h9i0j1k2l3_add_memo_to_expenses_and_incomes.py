"""지출/수입 테이블에 선택적 메모 필드 추가

Revision ID: g8h9i0j1k2l3
Revises: f7g8h9i0j1k2
Create Date: 2026-02-25
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "g8h9i0j1k2l3"  # pragma: allowlist secret
down_revision = "f7g8h9i0j1k2"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # expenses 테이블에 memo 컬럼 추가
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.add_column(sa.Column("memo", sa.Text(), nullable=True))

    # incomes 테이블에 memo 컬럼 추가
    with op.batch_alter_table("incomes") as batch_op:
        batch_op.add_column(sa.Column("memo", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.drop_column("memo")

    with op.batch_alter_table("incomes") as batch_op:
        batch_op.drop_column("memo")

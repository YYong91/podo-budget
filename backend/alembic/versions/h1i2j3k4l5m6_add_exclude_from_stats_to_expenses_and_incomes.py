"""지출/수입 테이블에 통계 제외 플래그 추가

Revision ID: h1i2j3k4l5m6
Revises: g8h9i0j1k2l3
Create Date: 2026-02-26
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "h1i2j3k4l5m6"  # pragma: allowlist secret
down_revision = "g8h9i0j1k2l3"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # expenses 테이블에 exclude_from_stats 컬럼 추가
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.add_column(sa.Column("exclude_from_stats", sa.Boolean(), nullable=False, server_default=sa.false()))

    # incomes 테이블에 exclude_from_stats 컬럼 추가
    with op.batch_alter_table("incomes") as batch_op:
        batch_op.add_column(sa.Column("exclude_from_stats", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("expenses") as batch_op:
        batch_op.drop_column("exclude_from_stats")

    with op.batch_alter_table("incomes") as batch_op:
        batch_op.drop_column("exclude_from_stats")

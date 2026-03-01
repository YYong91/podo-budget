"""사용자 테이블에 월 총 예산 컬럼 추가

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-03-02
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "j3k4l5m6n7o8"  # pragma: allowlist secret
down_revision = "i2j3k4l5m6n7"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("total_monthly_budget", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("total_monthly_budget")

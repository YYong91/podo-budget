"""카테고리 사용 빈도 기반 sort_order 필드 추가

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-02-27
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "i2j3k4l5m6n7"  # pragma: allowlist secret
down_revision = "h1i2j3k4l5m6"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # sort_order 컬럼 추가 (기본값 0)
    with op.batch_alter_table("categories") as batch_op:
        batch_op.add_column(sa.Column("sort_order", sa.BigInteger(), nullable=False, server_default="0"))

    # 기존 데이터: 지출 + 수입 사용 횟수를 집계해 sort_order로 초기화
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            UPDATE categories
            SET sort_order = (
                SELECT COUNT(*) FROM expenses WHERE expenses.category_id = categories.id
            ) + (
                SELECT COUNT(*) FROM incomes WHERE incomes.category_id = categories.id
            )
        """)
    )


def downgrade() -> None:
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_column("sort_order")

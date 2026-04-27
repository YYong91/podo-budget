"""커스텀 카테고리 sort_order 기준값 조정 (100 이상)

시스템 카테고리는 sort_order 1~18로 고정되어 있음.
기존 커스텀 카테고리 중 sort_order < 100인 항목을 100으로 올려
sort_order DESC 정렬 시 커스텀이 시스템보다 항상 앞에 오도록 보장.

Revision ID: a0b1c2d3e4f5
Revises: z9a0b1c2d3e4
Create Date: 2026-04-27
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a0b1c2d3e4f5"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = "z9a0b1c2d3e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    # 시스템 카테고리(user_id=NULL, household_id=NULL)를 제외한 커스텀 카테고리만 업데이트
    conn.execute(
        sa.text("""
            UPDATE categories
            SET sort_order = 100
            WHERE sort_order < 100
              AND NOT (user_id IS NULL AND household_id IS NULL)
        """)
    )


def downgrade() -> None:
    pass

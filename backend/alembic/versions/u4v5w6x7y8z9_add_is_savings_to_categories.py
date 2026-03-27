"""카테고리에 is_savings 컬럼 추가

저축성 지출 카테고리를 구분하기 위한 boolean 플래그.
적금, 투자, 보험료 등 실제 저축 목적 지출만 집계하여 저축률을 계산한다.

Revision ID: u4v5w6x7y8z9
Revises: t3u4v5w6x7y8
Create Date: 2026-03-26
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "u4v5w6x7y8z9"  # pragma: allowlist secret
down_revision = "t3u4v5w6x7y8"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("is_savings", sa.Boolean(), nullable=False, server_default="0"))

    # 시스템 카테고리 "저축/투자"를 기본 저축성으로 설정
    op.execute("UPDATE categories SET is_savings = true WHERE name = '저축/투자'")


def downgrade() -> None:
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.drop_column("is_savings")

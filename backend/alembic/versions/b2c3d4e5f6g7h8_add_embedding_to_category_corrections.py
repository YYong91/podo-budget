"""category_corrections에 embedding 컬럼 추가

RAG 기반 카테고리 자동 분류 개선을 위한 임베딩 컬럼.
Phase 2에서 정정 저장 시 자동으로 채워집니다.

Revision ID: b2c3d4e5f6g7h8
Revises: a1b2c3d4e5f6g7
Create Date: 2026-04-26
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6g7h8"  # pragma: allowlist secret
down_revision = "a1b2c3d4e5f6g7"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # list[float] 임베딩 벡터를 JSON으로 저장 (Phase 2에서 채워짐)
    op.add_column(
        "category_corrections",
        sa.Column("embedding", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("category_corrections", "embedding")

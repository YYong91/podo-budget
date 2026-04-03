"""assets 테이블에 original_amount 컬럼 추가 (대출 원금, 상환 진척도용)

Revision ID: a0b1c2d3e4f5
Revises: z9a0b1c2d3e4
Create Date: 2026-04-02
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "a0b1c2d3e4f5"  # pragma: allowlist secret
down_revision = "z9a0b1c2d3e4"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "assets",
        sa.Column("original_amount", sa.Numeric(18, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("assets", "original_amount")

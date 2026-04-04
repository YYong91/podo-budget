"""seed emoji for allowance and savings categories

Revision ID: 5a3056695ef9
Revises: 0c3098390fcd
Create Date: 2026-04-05 02:09:56.717489

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5a3056695ef9"
down_revision: str | Sequence[str] | None = "0c3098390fcd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """용돈/저축투자 시스템 카테고리 이모지 시딩 (이전 마이그레이션에서 누락)"""
    EMOJI_MAP = {
        "용돈": "🤑",
        "저축/투자": "🌱",
    }
    conn = op.get_bind()
    for name, emoji in EMOJI_MAP.items():
        conn.execute(
            sa.text("UPDATE categories SET emoji = :emoji WHERE name = :name AND user_id IS NULL AND household_id IS NULL"),
            {"emoji": emoji, "name": name},
        )


def downgrade() -> None:
    """Downgrade schema."""
    pass

"""add emoji to categories

Revision ID: 0c3098390fcd
Revises: a0b1c2d3e4f5
Create Date: 2026-04-05 01:28:41.300679

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0c3098390fcd"
down_revision: str | Sequence[str] | None = "a0b1c2d3e4f5"  # pragma: allowlist secret
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.add_column(sa.Column("emoji", sa.String(length=10), server_default="📌", nullable=True))

    # 시스템 카테고리 이모지 시딩
    EMOJI_MAP = {
        # 지출 (18종)
        "식비": "🍚",
        "카페/음료": "☕",
        "교통": "🚗",
        "주거/관리비": "🏠",
        "통신": "📱",
        "생활용품": "🛒",
        "의류/미용": "✨",
        "의료/건강": "🏥",
        "교육/자기계발": "📚",
        "문화/여가": "🎬",
        "경조사": "🎁",
        "자녀/육아": "👶",
        "반려동물": "🐾",
        "보험": "☂️",
        "대출/이자": "💸",
        "세금/공과금": "📋",
        "구독": "📺",
        "기타": "📌",
        # 수입 (7종)
        "급여": "💰",
        "부수입": "💵",
        "사업소득": "🏢",
        "투자/배당": "📈",
        "용돈/지원": "🎉",
        "중고판매": "🥕",
        "기타수입": "📌",
    }

    conn = op.get_bind()
    for name, emoji in EMOJI_MAP.items():
        conn.execute(
            sa.text("UPDATE categories SET emoji = :emoji WHERE name = :name AND user_id IS NULL AND household_id IS NULL"),
            {"emoji": emoji, "name": name},
        )


def downgrade() -> None:
    """Downgrade schema."""
    # No need to revert emoji data — column drop handles it
    with op.batch_alter_table("categories", schema=None) as batch_op:
        batch_op.drop_column("emoji")

"""add allowance and savings system categories

Revision ID: e4f5g6h7i8j9
Revises: d367e7848291
Create Date: 2026-03-23

시스템 카테고리 2개 추가: 용돈(expense), 저축/투자(expense)
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e4f5g6h7i8j9"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = "d367e7848291"  # pragma: allowlist secret
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_CATEGORIES = [
    {"name": "용돈", "type": "expense", "description": "개인 소비, 자유 지출", "sort_order": 19},
    {"name": "저축/투자", "type": "expense", "description": "적금, 연금, 투자", "sort_order": 20},
]


def upgrade() -> None:
    conn = op.get_bind()
    for cat in NEW_CATEGORIES:
        existing = conn.execute(
            sa.text("SELECT id FROM categories WHERE name = :name AND user_id IS NULL AND household_id IS NULL"),
            {"name": cat["name"]},
        ).fetchone()
        if existing is None:
            conn.execute(
                sa.text(
                    "INSERT INTO categories (user_id, household_id, name, type, description, sort_order, created_at) "
                    "VALUES (NULL, NULL, :name, :type, :desc, :sort, CURRENT_TIMESTAMP)"
                ),
                {"name": cat["name"], "type": cat["type"], "desc": cat["description"], "sort": cat["sort_order"]},
            )


def downgrade() -> None:
    conn = op.get_bind()
    for cat in NEW_CATEGORIES:
        conn.execute(
            sa.text("DELETE FROM categories WHERE name = :name AND user_id IS NULL AND household_id IS NULL"),
            {"name": cat["name"]},
        )

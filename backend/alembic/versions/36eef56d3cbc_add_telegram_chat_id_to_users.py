"""add_telegram_chat_id_to_users

Revision ID: 36eef56d3cbc
Revises: 479bf8d6b8b4
Create Date: 2026-03-24 06:27:09.277951

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "36eef56d3cbc"
down_revision: str | Sequence[str] | None = "479bf8d6b8b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """users 테이블에 telegram_chat_id 컬럼 추가 (마이그레이션 누락 보정)."""
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("users")]

    if "telegram_chat_id" not in columns:
        op.add_column("users", sa.Column("telegram_chat_id", sa.String(), nullable=True))
        op.create_index("ix_users_telegram_chat_id", "users", ["telegram_chat_id"], unique=True)


def downgrade() -> None:
    """telegram_chat_id 컬럼 제거."""
    op.drop_index("ix_users_telegram_chat_id", table_name="users")
    op.drop_column("users", "telegram_chat_id")

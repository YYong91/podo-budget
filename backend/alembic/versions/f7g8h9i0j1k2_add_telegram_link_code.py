"""텔레그램 코드 기반 계정 연동을 위한 link_code 컬럼 추가

Revision ID: f7g8h9i0j1k2
Revises: e5f6g7h8i9j0
Create Date: 2026-02-22
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "f7g8h9i0j1k2"  # pragma: allowlist secret
down_revision = "e5f6g7h8i9j0"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 텔레그램 단기 연동 코드 컬럼 추가
    op.add_column(
        "users",
        sa.Column("telegram_link_code", sa.String(length=8), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("telegram_link_code_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint("uq_users_telegram_link_code", "users", ["telegram_link_code"])
    op.create_index("ix_users_telegram_link_code", "users", ["telegram_link_code"])


def downgrade() -> None:
    op.drop_index("ix_users_telegram_link_code", table_name="users")
    op.drop_constraint("uq_users_telegram_link_code", "users", type_="unique")
    op.drop_column("users", "telegram_link_code_expires_at")
    op.drop_column("users", "telegram_link_code")

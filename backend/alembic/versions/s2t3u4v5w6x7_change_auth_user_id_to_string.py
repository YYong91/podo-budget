"""auth_user_id 컬럼 타입 BigInteger → String 변경

Supabase Auth 전환으로 auth_user_id가 TSID(BigInteger)에서
Supabase UUID(문자열)로 변경됨.

Revision ID: s2t3u4v5w6x7
Revises: 36eef56d3cbc
Create Date: 2026-03-24
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "s2t3u4v5w6x7"  # pragma: allowlist secret
down_revision = "36eef56d3cbc"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # BigInteger → String (UUID) 변환
    # PostgreSQL: ALTER COLUMN TYPE으로 직접 변환 (기존 정수값은 문자열로 캐스팅됨)
    op.alter_column(
        "users",
        "auth_user_id",
        type_=sa.String(),
        existing_type=sa.BigInteger(),
        existing_nullable=True,
        postgresql_using="auth_user_id::text",
    )


def downgrade() -> None:
    # String → BigInteger 복원 (UUID는 정수로 변환 불가 — 데이터 손실 주의)
    op.alter_column(
        "users",
        "auth_user_id",
        type_=sa.BigInteger(),
        existing_type=sa.String(),
        existing_nullable=True,
        postgresql_using="auth_user_id::bigint",
    )

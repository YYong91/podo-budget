"""SSO 통합을 위한 auth_user_id 컬럼 추가 및 hashed_password nullable 변경

podo-auth SSO 연동을 위한 Shadow User 패턴 구현.
- auth_user_id: podo-auth의 user ID (BigInteger TSID) 저장
- hashed_password: SSO 유저는 패스워드 불필요하므로 nullable 허용

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-02-21
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "e5f6g7h8i9j0"  # pragma: allowlist secret
down_revision = "d4e5f6g7h8i9"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # auth_user_id 컬럼 추가 (podo-auth의 TSID BigInteger)
    op.add_column(
        "users",
        sa.Column("auth_user_id", sa.BigInteger(), nullable=True),
    )
    op.create_unique_constraint("uq_users_auth_user_id", "users", ["auth_user_id"])
    op.create_index("ix_users_auth_user_id", "users", ["auth_user_id"])

    # hashed_password를 nullable로 변경 (SSO 유저는 로컬 패스워드 없음, SQLite batch mode 필요)
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("hashed_password", nullable=True)


def downgrade() -> None:
    # hashed_password를 다시 not null로 변경
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("hashed_password", nullable=False)
        batch_op.drop_constraint("uq_users_auth_user_id", type_="unique")

    op.drop_index("ix_users_auth_user_id", table_name="users")
    op.drop_column("users", "auth_user_id")

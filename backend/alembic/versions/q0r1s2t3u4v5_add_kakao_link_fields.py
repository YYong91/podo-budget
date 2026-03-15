"""카카오톡 코드 기반 계정 연동을 위한 kakao_user_id, link_code 컬럼 추가

Revision ID: q0r1s2t3u4v5
Revises: p9q0r1s2t3u4
Create Date: 2026-03-14
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "q0r1s2t3u4v5"  # pragma: allowlist secret
down_revision = "p9q0r1s2t3u4"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 카카오 사용자 ID 컬럼 추가
    op.add_column(
        "users",
        sa.Column("kakao_user_id", sa.String(), nullable=True),
    )
    op.create_index("ix_users_kakao_user_id", "users", ["kakao_user_id"])
    with op.batch_alter_table("users") as batch_op:
        batch_op.create_unique_constraint("uq_users_kakao_user_id", ["kakao_user_id"])

    # 카카오 단기 연동 코드 컬럼 추가
    op.add_column(
        "users",
        sa.Column("kakao_link_code", sa.String(length=8), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("kakao_link_code_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_kakao_link_code", "users", ["kakao_link_code"])
    with op.batch_alter_table("users") as batch_op:
        batch_op.create_unique_constraint("uq_users_kakao_link_code", ["kakao_link_code"])


def downgrade() -> None:
    op.drop_index("ix_users_kakao_link_code", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("uq_users_kakao_link_code", type_="unique")
    op.drop_column("users", "kakao_link_code_expires_at")
    op.drop_column("users", "kakao_link_code")

    op.drop_index("ix_users_kakao_user_id", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("uq_users_kakao_user_id", type_="unique")
    op.drop_column("users", "kakao_user_id")

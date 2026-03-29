"""총예산을 users에서 households로 이동 (#501)

가구 멤버 간 총예산 공유를 위해 total_monthly_budget 컬럼을
users 테이블에서 households 테이블로 이동합니다.
기존 사용자의 총예산 값은 소속 가구로 복사됩니다.

Revision ID: z9a0b1c2d3e4
Revises: y8z9a0b1c2d3
Create Date: 2026-03-29
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "z9a0b1c2d3e4"  # pragma: allowlist secret
down_revision = "y8z9a0b1c2d3"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. households 테이블에 total_monthly_budget 컬럼 추가
    with op.batch_alter_table("households") as batch_op:
        batch_op.add_column(sa.Column("total_monthly_budget", sa.Numeric(12, 2), nullable=True))

    # 2. 기존 사용자의 총예산을 소속 가구로 복사 (owner 기준)
    # 데이터 마이그레이션: users.total_monthly_budget → households.total_monthly_budget
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            UPDATE households
            SET total_monthly_budget = (
                SELECT u.total_monthly_budget
                FROM users u
                JOIN household_members hm ON hm.user_id = u.id
                WHERE hm.household_id = households.id
                  AND hm.role = 'owner'
                  AND u.total_monthly_budget IS NOT NULL
                LIMIT 1
            )
        """)
    )


def downgrade() -> None:
    # households에서 users로 복구
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            UPDATE users
            SET total_monthly_budget = (
                SELECT h.total_monthly_budget
                FROM households h
                JOIN household_members hm ON hm.household_id = h.id
                WHERE hm.user_id = users.id
                  AND hm.role = 'owner'
                  AND h.total_monthly_budget IS NOT NULL
                LIMIT 1
            )
        """)
    )

    with op.batch_alter_table("households") as batch_op:
        batch_op.drop_column("total_monthly_budget")

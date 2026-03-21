"""인덱스 추가: Budget/HouseholdMember/Category 성능 개선 (#238)

자주 쿼리되는 컬럼 조합에 복합 인덱스를 추가합니다:
- budgets(household_id, period): 예산 페이지 로드 시 매번 실행
- budgets(start_date, end_date): 날짜 범위 유효성 체크
- household_members(user_id, left_at): get_household_member() — 모든 인증 요청마다 실행
- categories(household_id, type): 카테고리 조회 전반

Revision ID: r1s2t3u4v5w6
Revises: cfab575efb50
Create Date: 2026-03-20
"""

from collections.abc import Sequence

from alembic import op

revision: str = "r1s2t3u4v5w6"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = "cfab575efb50"  # pragma: allowlist secret
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("budgets") as batch_op:
        batch_op.create_index("ix_budgets_household_period", ["household_id", "period"], unique=False)
        batch_op.create_index("ix_budgets_start_end_date", ["start_date", "end_date"], unique=False)

    with op.batch_alter_table("household_members") as batch_op:
        batch_op.create_index("ix_household_members_user_left_at", ["user_id", "left_at"], unique=False)

    with op.batch_alter_table("categories") as batch_op:
        batch_op.create_index("ix_categories_household_type", ["household_id", "type"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_index("ix_categories_household_type")

    with op.batch_alter_table("household_members") as batch_op:
        batch_op.drop_index("ix_household_members_user_left_at")

    with op.batch_alter_table("budgets") as batch_op:
        batch_op.drop_index("ix_budgets_start_end_date")
        batch_op.drop_index("ix_budgets_household_period")

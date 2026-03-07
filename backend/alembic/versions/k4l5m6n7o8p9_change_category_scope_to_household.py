"""개인 카테고리 스코프를 가계 카테고리로 변경

기존 unique constraint (name, user_id) → (name, household_id, user_id) 로 변경.
활성 가구가 있는 유저의 개인 카테고리를 가계 카테고리로 마이그레이션.

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-03-06
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "k4l5m6n7o8p9"  # pragma: allowlist secret
down_revision = "j3k4l5m6n7o8"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # UniqueConstraint 변경: (name, user_id) → (name, household_id, user_id)
    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_constraint("uq_category_name_user", type_="unique")
        batch_op.create_unique_constraint(
            "uq_category_name_scope",
            ["name", "household_id", "user_id"],
        )

    # 데이터 마이그레이션: 활성 가구가 있는 유저의 개인 카테고리 → 가계 카테고리로 전환
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            UPDATE categories
            SET household_id = (
                SELECT hm.household_id
                FROM household_members hm
                JOIN households h ON h.id = hm.household_id
                WHERE hm.user_id = categories.user_id
                  AND hm.left_at IS NULL
                  AND h.deleted_at IS NULL
                ORDER BY hm.joined_at ASC
                LIMIT 1
            ),
            user_id = NULL
            WHERE categories.user_id IS NOT NULL
              AND (
                  SELECT COUNT(*)
                  FROM household_members hm
                  JOIN households h ON h.id = hm.household_id
                  WHERE hm.user_id = categories.user_id
                    AND hm.left_at IS NULL
                    AND h.deleted_at IS NULL
              ) > 0
        """)
    )


def downgrade() -> None:
    # 가계 카테고리 → 개인 카테고리 복원 (소유자 확인 불가하므로 household_id=NULL로만 변경)
    # 데이터 마이그레이션 되돌리기: household_id가 있는 카테고리를 개인으로 전환 (근사값)
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            UPDATE categories
            SET user_id = (
                SELECT hm.user_id
                FROM household_members hm
                WHERE hm.household_id = categories.household_id
                  AND hm.left_at IS NULL
                ORDER BY hm.joined_at ASC
                LIMIT 1
            ),
            household_id = NULL
            WHERE categories.household_id IS NOT NULL
              AND categories.user_id IS NULL
        """)
    )

    with op.batch_alter_table("categories") as batch_op:
        batch_op.drop_constraint("uq_category_name_scope", type_="unique")
        batch_op.create_unique_constraint(
            "uq_category_name_user",
            ["name", "user_id"],
        )

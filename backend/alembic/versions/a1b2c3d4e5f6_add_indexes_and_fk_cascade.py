"""인덱스 추가 + FK CASCADE 정비

- expenses 테이블: date, category_id 단일 인덱스 + 복합 인덱스 추가
- expenses, categories, budgets FK: ondelete SET NULL 추가

Revision ID: a1b2c3d4e5f6
Revises: ef6a56f45278
Create Date: 2026-02-14
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"  # pragma: allowlist secret
down_revision = "ef6a56f45278"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 인덱스 추가 (expenses 테이블 조회 성능)
    op.create_index("ix_expenses_date", "expenses", ["date"])
    op.create_index("ix_expenses_category_id", "expenses", ["category_id"])
    op.create_index("ix_expenses_household_date", "expenses", ["household_id", "date"])
    op.create_index("ix_expenses_user_date", "expenses", ["user_id", "date"])

    # FK CASCADE 정비: SQLite는 named FK constraint 미지원 → PostgreSQL만 실행
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.drop_constraint("expenses_household_id_fkey", "expenses", type_="foreignkey")
        op.create_foreign_key(
            "expenses_household_id_fkey",
            "expenses",
            "households",
            ["household_id"],
            ["id"],
            ondelete="SET NULL",
        )

        op.drop_constraint("categories_household_id_fkey", "categories", type_="foreignkey")
        op.create_foreign_key(
            "categories_household_id_fkey",
            "categories",
            "households",
            ["household_id"],
            ["id"],
            ondelete="SET NULL",
        )

        op.drop_constraint("budgets_household_id_fkey", "budgets", type_="foreignkey")
        op.create_foreign_key(
            "budgets_household_id_fkey",
            "budgets",
            "households",
            ["household_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    # 인덱스 롤백
    op.drop_index("ix_expenses_user_date", "expenses")
    op.drop_index("ix_expenses_household_date", "expenses")
    op.drop_index("ix_expenses_category_id", "expenses")
    op.drop_index("ix_expenses_date", "expenses")

    # FK CASCADE 롤백: SQLite는 named FK constraint 미지원 → PostgreSQL만 실행
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.drop_constraint("budgets_household_id_fkey", "budgets", type_="foreignkey")
        op.create_foreign_key(
            "budgets_household_id_fkey",
            "budgets",
            "households",
            ["household_id"],
            ["id"],
        )

        op.drop_constraint("categories_household_id_fkey", "categories", type_="foreignkey")
        op.create_foreign_key(
            "categories_household_id_fkey",
            "categories",
            "households",
            ["household_id"],
            ["id"],
        )

        op.drop_constraint("expenses_household_id_fkey", "expenses", type_="foreignkey")
        op.create_foreign_key(
            "expenses_household_id_fkey",
            "expenses",
            "households",
            ["household_id"],
            ["id"],
        )

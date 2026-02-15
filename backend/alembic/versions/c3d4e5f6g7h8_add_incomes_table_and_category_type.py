"""수입 테이블 추가 및 카테고리 type 필드 추가

incomes 테이블을 생성하고 categories 테이블에 type 컬럼을 추가합니다.
기존 카테고리의 type은 'expense'로 설정됩니다.

Revision ID: c3d4e5f6g7h8
Revises: b7c8d9e0f1a2
Create Date: 2026-02-15
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "c3d4e5f6g7h8"  # pragma: allowlist secret
down_revision = "b7c8d9e0f1a2"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    # incomes 테이블 생성
    op.create_table(
        "incomes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("raw_input", sa.Text(), nullable=True),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_incomes_id"), "incomes", ["id"], unique=False)
    op.create_index(op.f("ix_incomes_user_id"), "incomes", ["user_id"], unique=False)
    op.create_index(op.f("ix_incomes_household_id"), "incomes", ["household_id"], unique=False)
    op.create_index("ix_incomes_date", "incomes", ["date"], unique=False)
    op.create_index("ix_incomes_category_id", "incomes", ["category_id"], unique=False)
    op.create_index("ix_incomes_household_date", "incomes", ["household_id", "date"], unique=False)
    op.create_index("ix_incomes_user_date", "incomes", ["user_id", "date"], unique=False)

    # categories 테이블에 type 컬럼 추가
    op.add_column(
        "categories",
        sa.Column("type", sa.String(length=10), nullable=False, server_default="expense"),
    )


def downgrade() -> None:
    # categories.type 컬럼 삭제
    op.drop_column("categories", "type")

    # incomes 테이블 인덱스 삭제
    op.drop_index("ix_incomes_user_date", table_name="incomes")
    op.drop_index("ix_incomes_household_date", table_name="incomes")
    op.drop_index("ix_incomes_category_id", table_name="incomes")
    op.drop_index("ix_incomes_date", table_name="incomes")
    op.drop_index(op.f("ix_incomes_household_id"), table_name="incomes")
    op.drop_index(op.f("ix_incomes_user_id"), table_name="incomes")
    op.drop_index(op.f("ix_incomes_id"), table_name="incomes")

    # incomes 테이블 삭제
    op.drop_table("incomes")

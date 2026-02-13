"""initial schema

Revision ID: ef6a56f45278
Revises:
Create Date: 2026-02-11 23:20:10.485412

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ef6a56f45278"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema.

    HomeNRich 초기 스키마 생성:
    - users: 사용자 테이블
    - households: 가구 테이블 (공유 가계부)
    - household_members: 가구-사용자 연결 테이블
    - household_invitations: 가구 초대 테이블
    - categories: 카테고리 테이블 (개인/가구/시스템)
    - expenses: 지출 기록 테이블
    - budgets: 예산 테이블
    """
    # 1. users 테이블 생성
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # 2. households 테이블 생성
    op.create_table(
        "households",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=200), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="KRW"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_households_id"), "households", ["id"], unique=False)

    # 3. household_members 테이블 생성 (가구-사용자 연결)
    op.create_table(
        "household_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("left_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("household_id", "user_id", name="uq_household_user"),
    )
    op.create_index(op.f("ix_household_members_id"), "household_members", ["id"], unique=False)
    op.create_index(op.f("ix_household_members_household_id"), "household_members", ["household_id"], unique=False)
    op.create_index(op.f("ix_household_members_user_id"), "household_members", ["user_id"], unique=False)

    # 4. household_invitations 테이블 생성
    op.create_table(
        "household_invitations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("inviter_id", sa.Integer(), nullable=False),
        sa.Column("invitee_email", sa.String(length=255), nullable=False),
        sa.Column("invitee_user_id", sa.Integer(), nullable=True),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("responded_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["inviter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["invitee_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_household_invitations_id"), "household_invitations", ["id"], unique=False)
    op.create_index(op.f("ix_household_invitations_household_id"), "household_invitations", ["household_id"], unique=False)
    op.create_index(op.f("ix_household_invitations_invitee_email"), "household_invitations", ["invitee_email"], unique=False)
    op.create_index(op.f("ix_household_invitations_token"), "household_invitations", ["token"], unique=True)

    # 5. categories 테이블 생성
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),  # None이면 시스템 카테고리
        sa.Column("household_id", sa.Integer(), nullable=True),  # None이면 개인/시스템 카테고리
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "user_id", name="uq_category_name_user"),
    )
    op.create_index(op.f("ix_categories_id"), "categories", ["id"], unique=False)
    op.create_index(op.f("ix_categories_user_id"), "categories", ["user_id"], unique=False)
    op.create_index(op.f("ix_categories_household_id"), "categories", ["household_id"], unique=False)

    # 6. expenses 테이블 생성
    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),  # 점진적 마이그레이션을 위해 nullable
        sa.Column("household_id", sa.Integer(), nullable=True),  # None이면 개인 지출
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("raw_input", sa.Text(), nullable=True),
        sa.Column("date", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_expenses_id"), "expenses", ["id"], unique=False)
    op.create_index(op.f("ix_expenses_user_id"), "expenses", ["user_id"], unique=False)
    op.create_index(op.f("ix_expenses_household_id"), "expenses", ["household_id"], unique=False)

    # 7. budgets 테이블 생성
    op.create_table(
        "budgets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),  # 점진적 마이그레이션을 위해 nullable
        sa.Column("household_id", sa.Integer(), nullable=True),  # None이면 개인 예산
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("period", sa.String(), nullable=False),  # monthly, weekly, daily
        sa.Column("start_date", sa.DateTime(), nullable=False),
        sa.Column("end_date", sa.DateTime(), nullable=True),
        sa.Column("alert_threshold", sa.Float(), nullable=False, server_default=sa.text("0.8")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_budgets_id"), "budgets", ["id"], unique=False)
    op.create_index(op.f("ix_budgets_user_id"), "budgets", ["user_id"], unique=False)
    op.create_index(op.f("ix_budgets_household_id"), "budgets", ["household_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema.

    모든 테이블을 역순으로 삭제합니다.
    외래 키 의존성 때문에 자식 테이블부터 삭제해야 합니다.
    """
    # 7. budgets 삭제
    op.drop_index(op.f("ix_budgets_household_id"), table_name="budgets")
    op.drop_index(op.f("ix_budgets_user_id"), table_name="budgets")
    op.drop_index(op.f("ix_budgets_id"), table_name="budgets")
    op.drop_table("budgets")

    # 6. expenses 삭제
    op.drop_index(op.f("ix_expenses_household_id"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_user_id"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_id"), table_name="expenses")
    op.drop_table("expenses")

    # 5. categories 삭제
    op.drop_index(op.f("ix_categories_household_id"), table_name="categories")
    op.drop_index(op.f("ix_categories_user_id"), table_name="categories")
    op.drop_index(op.f("ix_categories_id"), table_name="categories")
    op.drop_table("categories")

    # 4. household_invitations 삭제
    op.drop_index(op.f("ix_household_invitations_token"), table_name="household_invitations")
    op.drop_index(op.f("ix_household_invitations_invitee_email"), table_name="household_invitations")
    op.drop_index(op.f("ix_household_invitations_household_id"), table_name="household_invitations")
    op.drop_index(op.f("ix_household_invitations_id"), table_name="household_invitations")
    op.drop_table("household_invitations")

    # 3. household_members 삭제
    op.drop_index(op.f("ix_household_members_user_id"), table_name="household_members")
    op.drop_index(op.f("ix_household_members_household_id"), table_name="household_members")
    op.drop_index(op.f("ix_household_members_id"), table_name="household_members")
    op.drop_table("household_members")

    # 2. households 삭제
    op.drop_index(op.f("ix_households_id"), table_name="households")
    op.drop_table("households")

    # 1. users 삭제
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")

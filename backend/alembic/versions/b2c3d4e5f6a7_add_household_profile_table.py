"""household_profile 테이블 추가

가구 프로필 정보(가구 유형, 주거 형태, 수입 유형, 연령대, 재무 목표 등)를
저장하는 테이블입니다. 인사이트 AI 개인화에 사용됩니다.

Revision ID: b2c3d4e5f6a7
Revises: 5a3056695ef9
Create Date: 2026-04-14
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"  # pragma: allowlist secret
down_revision = "5a3056695ef9"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "household_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column(
            "household_type",
            sa.String(30),
            nullable=False,
            comment="single | dual_income | single_income | retired",
        ),
        sa.Column(
            "housing_type",
            sa.String(30),
            nullable=False,
            comment="own_no_loan | own_with_loan | jeonse | monthly_rent | with_parents",
        ),
        sa.Column(
            "income_types",
            sa.JSON(),
            nullable=False,
            comment='["salary", "freelance", "business", "pension"] 등 복수 선택',
        ),
        sa.Column(
            "age_range",
            sa.String(10),
            nullable=False,
            comment="20s | 30s | 40s | 50s_plus",
        ),
        sa.Column(
            "financial_goal",
            sa.String(50),
            nullable=True,
            comment="emergency_fund | debt_payoff | home_purchase | investment | retirement | travel | none",
        ),
        sa.Column("goal_amount", sa.Integer(), nullable=True),
        sa.Column("goal_deadline", sa.Date(), nullable=True),
        sa.Column(
            "primary_concern",
            sa.String(50),
            nullable=True,
            comment="overspending | no_savings | too_much_debt | irregular_income | none",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("household_id"),
    )


def downgrade() -> None:
    op.drop_table("household_profiles")

"""category_corrections 테이블 추가

카테고리 정정 신호 저장 테이블.
사용자가 거래 카테고리를 수정할 때 자동 기록되며,
향후 RAG 기반 카테고리 자동 분류 개선에 사용됩니다.

Revision ID: a1b2c3d4e5f6g7
Revises: b2c3d4e5f6a7
Create Date: 2026-04-26
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6g7"  # pragma: allowlist secret
down_revision = "b2c3d4e5f6a7"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "category_corrections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("input_text", sa.String(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(), nullable=False, server_default="edit"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # 조회 성능을 위한 인덱스: household 스코프 필터링 + 카테고리 집계에 사용
    op.create_index(
        op.f("ix_category_corrections_id"),
        "category_corrections",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_category_corrections_household_id"),
        "category_corrections",
        ["household_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_category_corrections_category_id"),
        "category_corrections",
        ["category_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_category_corrections_category_id"),
        table_name="category_corrections",
    )
    op.drop_index(
        op.f("ix_category_corrections_household_id"),
        table_name="category_corrections",
    )
    op.drop_index(
        op.f("ix_category_corrections_id"),
        table_name="category_corrections",
    )
    op.drop_table("category_corrections")

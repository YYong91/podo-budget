"""카테고리 매핑(CategoryMapping) 테이블 추가

LLM이 제안한 카테고리를 사용자 기존 카테고리로 매핑 (예: "식비" → "외식비")

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-03-12
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "o8p9q0r1s2t3"  # pragma: allowlist secret
down_revision = "n7o8p9q0r1s2"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "category_mappings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column(
            "household_id",
            sa.Integer(),
            sa.ForeignKey("households.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("source_name", sa.String(), nullable=False),
        sa.Column(
            "target_category_id",
            sa.Integer(),
            sa.ForeignKey("categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("source_name", "household_id", "user_id", name="uq_category_mapping_scope"),
    )


def downgrade() -> None:
    op.drop_table("category_mappings")

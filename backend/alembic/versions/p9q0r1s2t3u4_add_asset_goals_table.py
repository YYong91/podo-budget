"""순자산 목표(AssetGoal) 테이블 추가

사용자/가구별 순자산 목표를 관리하는 테이블

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3
Create Date: 2026-03-14
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "p9q0r1s2t3u4"  # pragma: allowlist secret
down_revision = "o8p9q0r1s2t3"  # pragma: allowlist secret
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "asset_goals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "household_id",
            sa.Integer(),
            sa.ForeignKey("households.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("target_net_worth", sa.Numeric(18, 2), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_asset_goals_id", "asset_goals", ["id"])


def downgrade() -> None:
    op.drop_index("ix_asset_goals_id", table_name="asset_goals")
    op.drop_table("asset_goals")

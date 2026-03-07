"""자산/부채 및 순자산 스냅샷 테이블 추가

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
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("is_liability", sa.Boolean(), nullable=False),
        sa.Column("ticker", sa.String(), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 8), nullable=True),
        sa.Column("avg_buy_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("manual_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column("maturity_date", sa.Date(), nullable=True),
        sa.Column("repayment_type", sa.String(), nullable=True),
        sa.Column("monthly_payment", sa.Numeric(18, 2), nullable=True),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assets_household_id", "assets", ["household_id"])
    op.create_index("ix_assets_id", "assets", ["id"])
    op.create_index("ix_assets_user_type", "assets", ["created_by", "type"])

    op.create_table(
        "asset_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("total_assets", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_liabilities", sa.Numeric(18, 2), nullable=False),
        sa.Column("net_worth", sa.Numeric(18, 2), nullable=False),
        sa.Column("breakdown", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_asset_snapshots_household_date", "asset_snapshots", ["household_id", "snapshot_date"])
    op.create_index("ix_asset_snapshots_id", "asset_snapshots", ["id"])


def downgrade() -> None:
    op.drop_index("ix_asset_snapshots_id", table_name="asset_snapshots")
    op.drop_index("ix_asset_snapshots_household_date", table_name="asset_snapshots")
    op.drop_table("asset_snapshots")

    op.drop_index("ix_assets_user_type", table_name="assets")
    op.drop_index("ix_assets_id", table_name="assets")
    op.drop_index("ix_assets_household_id", table_name="assets")
    op.drop_table("assets")

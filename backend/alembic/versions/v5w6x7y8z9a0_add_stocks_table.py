"""stocks 테이블 추가

한국 주식/ETF 종목 마스터. KRX에서 일일 갱신.
가격 조회 시 market(KOSPI/KOSDAQ) → Yahoo Finance 서픽스(.KS/.KQ) 변환에 사용.
글로벌 마스터 — household_id 없음.

Revision ID: v5w6x7y8z9a0
Revises: u4v5w6x7y8z9
Create Date: 2026-03-26
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "v5w6x7y8z9a0"
down_revision = "u4v5w6x7y8z9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stocks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticker", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("market", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ticker"),
    )
    op.create_index(op.f("ix_stocks_id"), "stocks", ["id"], unique=False)
    op.create_index(op.f("ix_stocks_ticker"), "stocks", ["ticker"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_stocks_ticker"), table_name="stocks")
    op.drop_index(op.f("ix_stocks_id"), table_name="stocks")
    op.drop_table("stocks")

"""add display_order and exclude_auto_payment

결제수단에 display_order(표시 순서), 카테고리에 exclude_auto_payment(기본 결제수단 자동 적용 제외) 컬럼 추가.
시스템 카테고리 중 저축/투자, 세금/공과금, 보험, 대출/이자는 자동 적용 제외로 시드.

Revision ID: x7y8z9a0b1c2
Revises: w6x7y8z9a0b1
Create Date: 2026-03-27
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "x7y8z9a0b1c2"
down_revision = "w6x7y8z9a0b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 결제수단 표시 순서
    op.add_column("payment_methods", sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"))

    # 카테고리 기본 결제수단 자동 적용 제외
    op.add_column("categories", sa.Column("exclude_auto_payment", sa.Boolean(), nullable=False, server_default="0"))

    # 시스템 카테고리 시드: 저축/투자 성격 카테고리는 기본 결제수단 자동 적용 제외
    op.execute(
        "UPDATE categories SET exclude_auto_payment = true "
        "WHERE name IN ('저축/투자', '세금/공과금', '보험', '대출/이자') "
        "AND user_id IS NULL AND household_id IS NULL"
    )


def downgrade() -> None:
    op.drop_column("categories", "exclude_auto_payment")
    op.drop_column("payment_methods", "display_order")

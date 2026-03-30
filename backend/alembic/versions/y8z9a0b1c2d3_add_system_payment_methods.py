"""add is_system to payment_methods and seed system defaults

결제수단에 is_system 컬럼 추가, household_id/created_by nullable로 변경.
시스템 기본 결제수단(현금, 계좌이체) 시드.

Revision ID: y8z9a0b1c2d3
Revises: x7y8z9a0b1c2
Create Date: 2026-03-29
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "y8z9a0b1c2d3"
down_revision: str | Sequence[str] | None = "x7y8z9a0b1c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 시스템 기본 결제수단
SYSTEM_PAYMENT_METHODS = [
    {"name": "현금", "type": "cash"},
    {"name": "계좌이체", "type": "transfer"},
]


def upgrade() -> None:
    # 1. is_system 컬럼 추가
    with op.batch_alter_table("payment_methods") as batch_op:
        batch_op.add_column(sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        # household_id, created_by를 nullable로 변경 (시스템 결제수단은 NULL)
        batch_op.alter_column("household_id", existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column("created_by", existing_type=sa.Integer(), nullable=True)

    # 2. 시스템 기본 결제수단 시드
    conn = op.get_bind()
    for pm in SYSTEM_PAYMENT_METHODS:
        existing = conn.execute(
            sa.text("SELECT id FROM payment_methods WHERE name = :name AND is_system = true"),
            {"name": pm["name"]},
        ).fetchone()
        if existing is None:
            conn.execute(
                sa.text(
                    "INSERT INTO payment_methods (household_id, created_by, name, type, is_default, is_system, is_active, display_order, created_at, updated_at) "
                    "VALUES (NULL, NULL, :name, :type, false, true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ),
                {"name": pm["name"], "type": pm["type"]},
            )


def downgrade() -> None:
    conn = op.get_bind()
    # 시스템 결제수단 삭제
    for pm in SYSTEM_PAYMENT_METHODS:
        conn.execute(
            sa.text("DELETE FROM payment_methods WHERE name = :name AND is_system = true"),
            {"name": pm["name"]},
        )

    # is_system 컬럼 제거, nullable 복원
    with op.batch_alter_table("payment_methods") as batch_op:
        batch_op.drop_column("is_system")
        batch_op.alter_column("household_id", existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column("created_by", existing_type=sa.Integer(), nullable=False)

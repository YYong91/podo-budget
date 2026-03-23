"""타임스탬프 server_default 추가 및 nullable=False 일관 적용

Revision ID: 479bf8d6b8b4
Revises: e0127bcbd625
Create Date: 2026-03-23 16:26:33.676518

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '479bf8d6b8b4'
down_revision: Union[str, Sequence[str], None] = 'e0127bcbd625'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """타임스탬프 컬럼에 server_default=NOW() 추가 및 nullable=False 일관 적용.

    기존 NULL 데이터를 먼저 채운 후 NOT NULL 제약을 적용합니다.
    """
    bind = op.get_bind()
    now_func = "datetime('now')" if bind.dialect.name == "sqlite" else "NOW()"

    # Pattern A: created_at + updated_at 모두 NULL 가능성이 있는 테이블
    tables_with_both = [
        "expenses", "incomes", "budgets", "recurring_transactions",
        "assets", "asset_goals", "accounts",
    ]
    # Pattern B: created_at만 NULL 가능성이 있는 테이블
    tables_created_only = ["categories", "category_mappings", "asset_snapshots"]

    for table in tables_with_both:
        op.execute(sa.text(f"UPDATE {table} SET created_at = {now_func} WHERE created_at IS NULL"))
        op.execute(sa.text(f"UPDATE {table} SET updated_at = {now_func} WHERE updated_at IS NULL"))
    for table in tables_created_only:
        op.execute(sa.text(f"UPDATE {table} SET created_at = {now_func} WHERE created_at IS NULL"))

    # Pattern A: created_at + updated_at — server_default 추가 + nullable=False
    with op.batch_alter_table('accounts', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    with op.batch_alter_table('asset_goals', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    with op.batch_alter_table('budgets', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    with op.batch_alter_table('incomes', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    with op.batch_alter_table('recurring_transactions', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    # Pattern B: created_at만 — server_default 추가 + nullable=False
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    with op.batch_alter_table('category_mappings', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    with op.batch_alter_table('asset_snapshots', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               nullable=False)

    # Pattern C: 이미 nullable=False — server_default만 추가
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               existing_nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               existing_nullable=False)

    with op.batch_alter_table('households', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               existing_nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               existing_nullable=False)

    with op.batch_alter_table('feedbacks', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               existing_nullable=False)
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               existing_nullable=False)

    with op.batch_alter_table('household_members', schema=None) as batch_op:
        batch_op.alter_column('joined_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               existing_nullable=False)

    with op.batch_alter_table('household_invitations', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=sa.text('(CURRENT_TIMESTAMP)'),
               existing_nullable=False)


def downgrade() -> None:
    """server_default 제거 및 nullable 복원."""
    # Pattern A: nullable=True로 복원, server_default 제거
    with op.batch_alter_table('accounts', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    with op.batch_alter_table('asset_goals', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    with op.batch_alter_table('budgets', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    with op.batch_alter_table('expenses', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    with op.batch_alter_table('incomes', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    with op.batch_alter_table('recurring_transactions', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    # Pattern B: nullable=True로 복원, server_default 제거
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    with op.batch_alter_table('category_mappings', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    with op.batch_alter_table('asset_snapshots', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               nullable=True)

    # Pattern C: server_default만 제거 (nullable 유지)
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               existing_nullable=False)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               existing_nullable=False)

    with op.batch_alter_table('households', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               existing_nullable=False)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               existing_nullable=False)

    with op.batch_alter_table('feedbacks', schema=None) as batch_op:
        batch_op.alter_column('updated_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               existing_nullable=False)
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               existing_nullable=False)

    with op.batch_alter_table('household_members', schema=None) as batch_op:
        batch_op.alter_column('joined_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               existing_nullable=False)

    with op.batch_alter_table('household_invitations', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=sa.DATETIME(),
               server_default=None,
               existing_nullable=False)

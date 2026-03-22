"""add source field to feedback

Revision ID: 278be8f83e1d
Revises: d367e7848291
Create Date: 2026-03-23 00:14:01.328102

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "278be8f83e1d"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = "d367e7848291"  # pragma: allowlist secret
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """피드백 테이블에 source 필드 추가 (web/telegram/kakao)"""
    with op.batch_alter_table("feedbacks", schema=None) as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(), nullable=False, server_default="web"))


def downgrade() -> None:
    """source 필드 제거"""
    with op.batch_alter_table("feedbacks", schema=None) as batch_op:
        batch_op.drop_column("source")

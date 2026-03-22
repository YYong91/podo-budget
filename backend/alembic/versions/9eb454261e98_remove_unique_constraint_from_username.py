"""remove unique constraint from username

Revision ID: 9eb454261e98
Revises: 278be8f83e1d
Create Date: 2026-03-23 03:19:14.871475

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9eb454261e98"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = "278be8f83e1d"  # pragma: allowlist secret
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """username unique 제약 제거 — SSO 체제에서 닉네임 중복 허용."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index("ix_users_username")
        batch_op.create_index(batch_op.f("ix_users_username"), ["username"], unique=False)


def downgrade() -> None:
    """username unique 제약 복원."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_users_username"))
        batch_op.create_index("ix_users_username", ["username"], unique=1)

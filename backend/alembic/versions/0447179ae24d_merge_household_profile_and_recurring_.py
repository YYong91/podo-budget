"""merge_household_profile_and_recurring_payment_method

Revision ID: 0447179ae24d
Revises: 9e4524bd33ae, b2c3d4e5f6a7
Create Date: 2026-04-26 13:35:06.761028

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "0447179ae24d"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = ("9e4524bd33ae", "b2c3d4e5f6a7")  # pragma: allowlist secret
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

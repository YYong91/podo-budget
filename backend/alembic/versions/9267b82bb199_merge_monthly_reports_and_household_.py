"""merge monthly_reports and household_profile heads

Revision ID: 9267b82bb199
Revises: a0b1c2d3e4f6, b2c3d4e5f6a7
Create Date: 2026-04-26 08:25:17.433213

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "9267b82bb199"  # pragma: allowlist secret
down_revision: str | Sequence[str] | None = ("a0b1c2d3e4f6", "b2c3d4e5f6a7")  # pragma: allowlist secret
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

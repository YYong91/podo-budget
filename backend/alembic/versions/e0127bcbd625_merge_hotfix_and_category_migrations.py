"""merge hotfix and category migrations

Revision ID: e0127bcbd625
Revises: 9eb454261e98, f5g6h7i8j9k0
Create Date: 2026-03-23 13:38:55.801336

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e0127bcbd625'
down_revision: Union[str, Sequence[str], None] = ('9eb454261e98', 'f5g6h7i8j9k0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

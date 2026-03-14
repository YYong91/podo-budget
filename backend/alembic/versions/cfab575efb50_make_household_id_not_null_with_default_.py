"""make household_id not null with default household

기존에 household_id가 NULL인 레코드를 위해:
1. 가구 미소속 사용자마다 기본 가구를 자동 생성
2. NULL household_id를 해당 사용자의 가구로 업데이트
3. household_id에 NOT NULL 제약 추가

Revision ID: cfab575efb50
Revises: q0r1s2t3u4v5
Create Date: 2026-03-15 05:02:25.534597
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cfab575efb50"
down_revision: str | Sequence[str] | None = "q0r1s2t3u4v5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# household_id가 있는 테이블과 해당 user 컬럼 매핑
TABLES_USER_COL = [
    ("expenses", "user_id"),
    ("incomes", "user_id"),
    ("budgets", "user_id"),
    ("assets", "created_by"),
    ("asset_snapshots", "user_id"),
    ("asset_goals", "user_id"),
    ("recurring_transactions", "user_id"),
    ("categories", "user_id"),
    ("category_mappings", "user_id"),
    ("accounts", "created_by"),
]

# NOT NULL 제약을 적용할 테이블 (categories 제외: 시스템 카테고리는 household_id=NULL)
TABLES_NOT_NULL = [t for t, _ in TABLES_USER_COL if t != "categories"]


def upgrade() -> None:
    """household_id NOT NULL 마이그레이션: 기본 가구 자동 생성 후 제약 추가."""
    conn = op.get_bind()

    # 1. 활성 가구 멤버가 없는 사용자 찾기
    orphan_users = conn.execute(
        sa.text(
            """
            SELECT u.id, u.username
            FROM users u
            WHERE u.id NOT IN (
                SELECT hm.user_id FROM household_members hm
                WHERE hm.left_at IS NULL
            )
            """
        )
    ).fetchall()

    # 2. 각 미소속 사용자에 대해 기본 가구 생성 + owner 멤버십 추가
    for user_id, username in orphan_users:
        household_name = f"{username}님의 가계부"

        # 가구 생성
        conn.execute(
            sa.text(
                """
                INSERT INTO households (name, currency, created_at, updated_at)
                VALUES (:name, 'KRW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            ),
            {"name": household_name},
        )
        # SQLite에서 last_inserted_rowid()로 가구 ID 조회
        household_id = conn.execute(sa.text("SELECT last_insert_rowid()")).scalar()

        # owner 멤버십 추가
        conn.execute(
            sa.text(
                """
                INSERT INTO household_members (household_id, user_id, role, joined_at)
                VALUES (:household_id, :user_id, 'owner', CURRENT_TIMESTAMP)
                """
            ),
            {"household_id": household_id, "user_id": user_id},
        )

    # 3. 각 테이블에서 household_id IS NULL인 행을 사용자의 첫 번째 활성 가구로 업데이트
    for table_name, user_col in TABLES_USER_COL:
        conn.execute(
            sa.text(
                f"""
                UPDATE {table_name}
                SET household_id = (
                    SELECT hm.household_id
                    FROM household_members hm
                    WHERE hm.user_id = {table_name}.{user_col}
                      AND hm.left_at IS NULL
                    ORDER BY hm.joined_at ASC
                    LIMIT 1
                )
                WHERE household_id IS NULL
                  AND {user_col} IS NOT NULL
                """
            )
        )

    # 4. user_col도 NULL이고 household_id도 NULL인 고아 행 삭제
    for table_name, user_col in TABLES_USER_COL:
        conn.execute(
            sa.text(
                f"""
                DELETE FROM {table_name}
                WHERE household_id IS NULL AND {user_col} IS NULL
                """
            )
        )

    # 5. NOT NULL 제약 추가 (SQLite는 batch_alter_table 필요)
    # categories는 시스템 카테고리(household_id=NULL)가 있으므로 제외
    for table_name in TABLES_NOT_NULL:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.alter_column("household_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    """household_id를 다시 nullable로 변경."""
    for table_name in TABLES_NOT_NULL:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.alter_column("household_id", existing_type=sa.Integer(), nullable=True)

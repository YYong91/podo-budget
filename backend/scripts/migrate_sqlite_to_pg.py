"""운영 SQLite → Supabase PostgreSQL 데이터 마이그레이션 스크립트

사용법:
    DATABASE_URL=postgresql+asyncpg://...@...pooler.supabase.com:5432/postgres \
    PYTHONPATH=. uv run python scripts/migrate_sqlite_to_pg.py /tmp/podo-prod.sqlite3

주의: Session pooler(port 5432)를 사용해야 합니다. Transaction pooler(6543)는 prepared statement 제약으로 실패합니다.
"""

import asyncio
import sqlite3
import sys
from datetime import UTC, date, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def parse_datetime(value: str) -> datetime:
    """SQLite datetime 문자열 → Python datetime"""
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    # date-only 형식
    return datetime.strptime(value, "%Y-%m-%d")


def parse_date(value: str) -> date:
    """SQLite date 문자열 → Python date"""
    return datetime.strptime(value[:10], "%Y-%m-%d").date()

# FK 의존성 순서대로 마이그레이션 (부모 테이블 먼저)
TABLE_ORDER = [
    "users",
    "households",
    "household_members",
    "household_invitations",
    "categories",
    "category_mappings",
    "expenses",
    "incomes",
    "budgets",
    "recurring_transactions",
    "accounts",  # assets.account_id FK → accounts보다 먼저 삽입
    "assets",
    "asset_snapshots",
    "asset_goals",
    "feedbacks",
]

# SQLite boolean(0/1) → Python bool 변환이 필요한 컬럼
BOOL_COLUMNS = {"is_active", "is_liability", "exclude_from_stats"}


async def migrate(sqlite_path: str) -> None:
    # SQLite 연결
    src = sqlite3.connect(sqlite_path)
    src.row_factory = sqlite3.Row

    # PostgreSQL 연결 (Session pooler 권장)
    engine = create_async_engine(
        settings.DATABASE_URL,
        connect_args={"prepared_statement_cache_size": 0},
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession)

    print(f"소스: {sqlite_path}")
    print(f"대상: {settings.DATABASE_URL[:50]}...")
    print()

    async with session_factory() as session:
        # PostgreSQL 테이블의 실제 컬럼 목록 + 타입 조회
        pg_columns: dict[str, set[str]] = {}
        pg_types: dict[str, dict[str, str]] = {}  # table -> {column -> data_type}
        for table in TABLE_ORDER:
            result = await session.execute(
                text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :t AND table_schema = 'public'"),
                {"t": table},
            )
            rows_info = result.fetchall()
            pg_columns[table] = {r[0] for r in rows_info}
            pg_types[table] = {r[0]: r[1] for r in rows_info}

        for table in TABLE_ORDER:
            rows = src.execute(f"SELECT * FROM {table}").fetchall()  # noqa: S608
            if not rows:
                print(f"  {table}: 0건 (스킵)")
                continue

            # SQLite 컬럼 중 PostgreSQL에도 존재하는 컬럼만 사용
            sqlite_columns = rows[0].keys()
            columns = [c for c in sqlite_columns if c in pg_columns[table]]
            skipped_cols = set(sqlite_columns) - set(columns)
            if skipped_cols:
                print(f"  {table}: 스킵된 컬럼 (SQLite에만 존재): {skipped_cols}")

            col_str = ", ".join(columns)
            param_str = ", ".join(f":{c}" for c in columns)

            inserted = 0
            for row in rows:
                row_dict = {k: v for k, v in dict(row).items() if k in pg_columns[table]}
                for key in list(row_dict.keys()):
                    val = row_dict[key]
                    col_type = pg_types.get(table, {}).get(key, "")

                    # NULL datetime → 현재 시각
                    if key in ("created_at", "updated_at", "joined_at") and val is None:
                        row_dict[key] = datetime.now(UTC)
                        continue

                    if val is None:
                        continue

                    # SQLite int(0/1) → Python bool
                    if key in BOOL_COLUMNS and isinstance(val, int):
                        row_dict[key] = bool(val)
                    # SQLite 문자열 → Python datetime (timestamp without time zone)
                    elif col_type == "timestamp without time zone" and isinstance(val, str):
                        row_dict[key] = parse_datetime(val)
                    # SQLite 문자열 → Python date
                    elif col_type == "date" and isinstance(val, str):
                        row_dict[key] = parse_date(val)
                try:
                    await session.execute(
                        text(f"INSERT INTO {table} ({col_str}) VALUES ({param_str})"),  # noqa: S608
                        row_dict,
                    )
                    inserted += 1
                except Exception as e:
                    await session.rollback()
                    print(f"    ⚠️ {table} row id={row_dict.get('id', '?')} 실패: {e!r}")

            await session.commit()
            print(f"  {table}: {inserted}/{len(rows)}건 이관 완료")

        # SEQUENCE 재설정 (auto-increment 충돌 방지)
        print("\nSEQUENCE 재설정 중...")
        for table in TABLE_ORDER:
            seq_result = await session.execute(
                text(f"SELECT pg_get_serial_sequence('{table}', 'id')")  # noqa: S608
            )
            seq_name = seq_result.scalar()
            if seq_name:
                await session.execute(
                    text(f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM {table}), 1))")  # noqa: S608
                )
                print(f"  {table}: sequence 재설정 완료")
            else:
                print(f"  {table}: sequence 없음 (스킵)")
        await session.commit()
        print("SEQUENCE 재설정 완료")

    await engine.dispose()
    src.close()
    print("\n데이터 마이그레이션 완료!")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("사용법: PYTHONPATH=. uv run python scripts/migrate_sqlite_to_pg.py <sqlite_path>")
        sys.exit(1)
    asyncio.run(migrate(sys.argv[1]))

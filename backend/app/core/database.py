import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

_is_postgresql = "postgresql" in settings.DATABASE_URL


def _build_connect_args() -> dict:
    """PostgreSQL(Transaction pooler) vs SQLite(테스트) connect_args 분기"""
    if not _is_postgresql:
        return {}

    # asyncpg 연결을 직접 생성하여 statement_cache_size=0 확실히 전달
    # SQLAlchemy connect_args만으로는 asyncpg에 statement_cache_size가 전달되지 않는 문제 해결
    dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    async def _pgbouncer_connect(*_args, **_kwargs):
        return await asyncpg.connect(dsn, statement_cache_size=0)

    return {
        "prepared_statement_cache_size": 0,  # SQLAlchemy 어댑터 레벨 캐시 비활성화
        "async_creator_fn": _pgbouncer_connect,  # asyncpg 레벨 캐시 비활성화
    }


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    connect_args=_build_connect_args(),
    # Fly.io 하이버네이션 후 stale 커넥션 자동 감지 + 30분마다 커넥션 재생성 (#241)
    pool_pre_ping=True,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

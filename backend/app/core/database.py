from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    # PostgreSQL: Supabase Transaction pooler (PgBouncer) 호환 — prepared statement 비활성화
    # SQLite (테스트): connect_args 불필요
    connect_args=({"prepared_statement_cache_size": 0} if "postgresql" in settings.DATABASE_URL else {}),
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

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# asyncpg 사용 시 SSL 비활성화 (Fly.io 내부 네트워크 등)
# URL에서 asyncpg가 이해하지 못하는 쿼리 파라미터 정리
db_url = settings.DATABASE_URL.split("?")[0]  # 쿼리 파라미터 제거

connect_args: dict = {}
if "asyncpg" in settings.DATABASE_URL:
    connect_args["ssl"] = False  # Fly.io 내부 네트워크에서는 SSL 불필요

engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    future=True,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

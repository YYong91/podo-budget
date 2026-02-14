import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# URL에서 asyncpg가 이해하지 못하는 쿼리 파라미터 정리
db_url = settings.DATABASE_URL.split("?")[0]

# SSL 설정: 외부 DB(Supabase 등)는 SSL 필요, Fly.io 내부는 불필요
connect_args: dict = {}
if settings.DATABASE_SSL:
    ssl_ctx = ssl.create_default_context()
    connect_args["ssl"] = ssl_ctx
else:
    connect_args["ssl"] = False

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

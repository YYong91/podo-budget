from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# DATABASE_URL에서 asyncpg가 이해하지 못하는 쿼리 파라미터 제거 후 connect_args로 전달
db_url = settings.DATABASE_URL
connect_args: dict = {}

if "ssl=disable" in db_url or "sslmode=disable" in db_url:
    db_url = db_url.replace("?ssl=disable", "").replace("&ssl=disable", "")
    db_url = db_url.replace("?sslmode=disable", "").replace("&sslmode=disable", "")
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

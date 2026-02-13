"""Alembic 환경 설정 - async PostgreSQL 지원

이 파일은 Alembic 마이그레이션 실행 시 사용되는 환경 설정입니다.
- 비동기(asyncpg) URL을 동기(psycopg2) URL로 변환하여 Alembic이 실행 가능하도록 합니다
- app.models의 모든 모델을 import하여 Base.metadata에 등록합니다
- 온라인/오프라인 모드를 모두 지원합니다
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.models  # noqa: F401 - 모델 메타데이터 로드
from alembic import context
from app.core.config import settings
from app.core.database import Base

# Alembic Config 객체 - alembic.ini 파일의 설정을 담고 있음
config = context.config

# 로깅 설정 초기화
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 마이그레이션 대상 메타데이터 - 모든 SQLAlchemy 모델 정보를 포함
target_metadata = Base.metadata


def get_url() -> str:
    """
    데이터베이스 URL을 가져와서 Alembic 실행용으로 변환합니다.

    Alembic은 sync driver만 지원하므로, asyncpg URL을 psycopg2 URL로 변환합니다.
    예: postgresql+asyncpg://... -> postgresql://...

    주의: 프로덕션 환경에서는 psycopg2-binary가 설치되어 있어야 합니다.
    """
    url = settings.DATABASE_URL
    # asyncpg를 제거하여 기본 psycopg2 드라이버 사용
    return url.replace("postgresql+asyncpg://", "postgresql://")


def run_migrations_offline() -> None:
    """
    오프라인 모드로 마이그레이션을 실행합니다.

    실제 데이터베이스에 연결하지 않고 SQL 스크립트만 생성합니다.
    주로 SQL 파일을 직접 실행하고 싶을 때 사용합니다.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """
    실제 마이그레이션을 실행하는 핵심 함수입니다.

    connection.run_sync() 내부에서 호출되며, 동기 컨텍스트에서 실행됩니다.
    """
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    비동기 엔진을 생성하고 마이그레이션을 실행합니다.

    asyncpg가 아닌 psycopg2를 사용하도록 URL을 변환한 상태에서
    async 엔진을 생성하여 마이그레이션을 실행합니다.
    """
    # alembic.ini의 [alembic] 섹션 설정을 가져옴
    configuration = config.get_section(config.config_ini_section, {})
    # 동적으로 DATABASE_URL 설정 (asyncpg → psycopg2 변환된 URL)
    configuration["sqlalchemy.url"] = get_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # 마이그레이션 시에는 커넥션 풀 사용 안 함
    )

    async with connectable.connect() as connection:
        # 비동기 연결을 동기 컨텍스트로 변환하여 마이그레이션 실행
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """
    온라인 모드로 마이그레이션을 실행합니다.

    실제 데이터베이스에 연결하여 마이그레이션을 적용합니다.
    """
    asyncio.run(run_async_migrations())


# 마이그레이션 실행 모드 결정
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

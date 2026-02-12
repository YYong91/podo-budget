"""
테스트용 공통 fixture 모듈

- 테스트 DB: SQLite + aiosqlite (PostgreSQL 의존성 제거)
- LLM 서비스: Mock으로 대체
- AsyncClient: 통합/E2E 테스트용 HTTP 클라이언트
"""

import asyncio
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app

# 테스트용 SQLite 데이터베이스 URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# 테스트용 비동기 엔진 및 세션
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop():
    """
    세션 스코프의 이벤트 루프 생성
    pytest-asyncio가 세션 스코프 fixture를 지원하도록 설정
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    각 테스트마다 새로운 DB 세션 및 트랜잭션 제공
    테스트 종료 후 테이블 DROP하여 격리성 보장
    """
    # 테이블 생성
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 세션 생성 및 제공
    async with TestSessionLocal() as session:
        yield session

    # 테스트 종료 후 테이블 삭제 (격리성 보장)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    테스트용 HTTP 클라이언트 (FastAPI 앱과 연동)
    DB 의존성을 테스트용 세션으로 오버라이드
    """

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),  # type: ignore
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def mock_llm_parse_expense():
    """
    LLM parse_expense 메서드를 Mock으로 대체하는 fixture
    테스트에서 원하는 반환값을 설정할 수 있음

    사용 예:
        mock_llm_parse_expense.return_value = {"amount": 8000, "category": "식비", ...}
    """
    with patch("app.services.llm_service.AnthropicProvider.parse_expense", new_callable=AsyncMock) as mock:
        mock.return_value = {
            "amount": 8000,
            "category": "식비",
            "description": "김치찌개",
            "date": "2026-02-11",
            "memo": "",
        }
        yield mock


@pytest.fixture
def mock_llm_generate_insights():
    """
    LLM generate_insights 메서드를 Mock으로 대체하는 fixture

    사용 예:
        mock_llm_generate_insights.return_value = "# 2월 지출 분석\\n총 50,000원..."
    """
    with patch("app.services.llm_service.AnthropicProvider.generate_insights", new_callable=AsyncMock) as mock:
        mock.return_value = "# 테스트 인사이트\n\n이번 달 총 지출: ₩50,000"
        yield mock


@pytest.fixture
def mock_telegram_send():
    """
    Telegram 메시지 전송을 Mock으로 대체하는 fixture
    실제 Telegram API 호출을 방지
    """
    with patch("app.api.telegram.send_telegram_message", new_callable=AsyncMock) as mock:
        yield mock

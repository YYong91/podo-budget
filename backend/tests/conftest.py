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

from app.core.auth import create_access_token, hash_password
from app.core.database import Base, get_db
from app.core.rate_limit import limiter
from app.main import app
from app.models.user import User

# 테스트용 SQLite 데이터베이스 URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# 테스트용 비동기 엔진 및 세션
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(autouse=True)
def _disable_rate_limit():
    """테스트 환경에서 rate limit 비활성화"""
    limiter.enabled = False
    yield
    limiter.enabled = True


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
async def test_user(db_session: AsyncSession) -> User:
    """테스트용 사용자 생성

    기본 테스트 사용자를 생성하고 반환합니다.
    username: testuser, password: testpass123  # pragma: allowlist secret

    Returns:
        생성된 User 객체
    """
    user = User(
        username="testuser",
        hashed_password=hash_password("testpass123"),  # pragma: allowlist secret
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user2(db_session: AsyncSession) -> User:
    """두 번째 테스트용 사용자 생성 (데이터 격리 테스트용)

    데이터 격리 테스트를 위한 두 번째 사용자를 생성합니다.
    username: testuser2, password: testpass456  # pragma: allowlist secret

    Returns:
        생성된 User 객체
    """
    user = User(
        username="testuser2",
        hashed_password=hash_password("testpass456"),  # pragma: allowlist secret
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_token(test_user: User) -> str:
    """테스트용 JWT 토큰 생성

    test_user를 위한 유효한 JWT 토큰을 생성합니다.

    Args:
        test_user: 테스트용 사용자

    Returns:
        JWT 액세스 토큰
    """
    return create_access_token(data={"sub": test_user.username})


@pytest_asyncio.fixture
async def auth_token2(test_user2: User) -> str:
    """두 번째 사용자용 JWT 토큰 생성

    test_user2를 위한 유효한 JWT 토큰을 생성합니다.

    Args:
        test_user2: 두 번째 테스트용 사용자

    Returns:
        JWT 액세스 토큰
    """
    return create_access_token(data={"sub": test_user2.username})


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """테스트용 HTTP 클라이언트 (FastAPI 앱과 연동)

    DB 의존성을 테스트용 세션으로 오버라이드합니다.
    인증이 필요 없는 엔드포인트 테스트에 사용합니다.

    Args:
        db_session: 테스트용 데이터베이스 세션

    Yields:
        AsyncClient 인스턴스
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


@pytest_asyncio.fixture
async def authenticated_client(db_session: AsyncSession, test_user: User, auth_token: str) -> AsyncGenerator[AsyncClient, None]:
    """인증된 테스트용 HTTP 클라이언트

    JWT 토큰을 Authorization 헤더에 자동으로 포함하는 클라이언트입니다.
    인증이 필요한 엔드포인트 테스트에 사용합니다.

    Args:
        db_session: 테스트용 데이터베이스 세션
        test_user: 테스트용 사용자
        auth_token: JWT 토큰

    Yields:
        인증 헤더가 포함된 AsyncClient 인스턴스
    """

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),  # type: ignore
        base_url="http://test",
        headers={"Authorization": f"Bearer {auth_token}"},
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def authenticated_client2(db_session: AsyncSession, test_user2: User, auth_token2: str) -> AsyncGenerator[AsyncClient, None]:
    """두 번째 사용자용 인증된 테스트용 HTTP 클라이언트

    데이터 격리 테스트를 위한 두 번째 인증된 클라이언트입니다.

    Args:
        db_session: 테스트용 데이터베이스 세션
        test_user2: 두 번째 테스트용 사용자
        auth_token2: 두 번째 사용자용 JWT 토큰

    Yields:
        인증 헤더가 포함된 AsyncClient 인스턴스
    """

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),  # type: ignore
        base_url="http://test",
        headers={"Authorization": f"Bearer {auth_token2}"},
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

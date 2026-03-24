"""온보딩 API 테스트

가구 미소속 사용자의 초기 설정 플로우를 테스트합니다:
- GET /api/onboarding/status - 온보딩 상태 조회
- POST /api/onboarding/create-household - 기본 가구 생성
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.household_member import HouseholdMember
from app.models.user import User


async def _make_fresh_client(db_session: AsyncSession) -> tuple[AsyncClient, User]:
    """가구 없는 신규 사용자 + 인증 클라이언트 생성"""
    from datetime import timedelta

    from jose import jwt as pyjwt

    from app.core.database import get_db
    from app.main import app

    fresh_user = User(
        auth_user_id=9999999,
        username="fresh_user",
        email="fresh@example.com",
        is_active=True,
    )
    db_session.add(fresh_user)
    await db_session.flush()
    await db_session.refresh(fresh_user)

    from datetime import UTC, datetime

    payload = {
        "sub": str(fresh_user.auth_user_id),
        "email": fresh_user.email,
        "name": fresh_user.username,
        "role": "authenticated",
        "iss": "https://test.supabase.co/auth/v1",
        "exp": datetime.now(UTC) + timedelta(hours=1),
    }
    token = pyjwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    app.dependency_overrides[get_db] = lambda: db_session
    client = AsyncClient(app=app, base_url="http://test", headers={"Authorization": f"Bearer {token}"})
    return client, fresh_user


@pytest.mark.asyncio
async def test_onboarding_status_has_household(authenticated_client, test_user: User):
    """가구가 있는 사용자의 온보딩 상태 조회

    conftest에서 test_user에 기본 가구가 이미 생성되어 있습니다.
    """
    response = await authenticated_client.get("/api/onboarding/status")

    assert response.status_code == 200
    data = response.json()
    assert data["has_household"] is True
    assert data["household_count"] >= 1


@pytest.mark.asyncio
async def test_create_household_with_name(db_session: AsyncSession):
    """이름을 지정하여 가구 생성 (가구 없는 신규 사용자)"""
    client, fresh_user = await _make_fresh_client(db_session)
    async with client:
        response = await client.post(
            "/api/onboarding/create-household",
            json={"name": "우리 가족 가계부"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "우리 가족 가계부"
    assert "id" in data

    # DB에서 가구 및 멤버십 확인
    household_id = data["id"]
    result = await db_session.execute(
        select(HouseholdMember).where(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == fresh_user.id,
        )
    )
    member = result.scalar_one()
    assert member.role == "owner"


@pytest.mark.asyncio
async def test_create_household_without_name(db_session: AsyncSession):
    """이름 미지정 시 기본 이름으로 가구 생성 (가구 없는 신규 사용자)"""
    client, _ = await _make_fresh_client(db_session)
    async with client:
        response = await client.post(
            "/api/onboarding/create-household",
            json={},
        )

    assert response.status_code == 201
    data = response.json()
    # "{username}님의 가계부" 형식
    assert "님의 가계부" in data["name"]


@pytest.mark.asyncio
async def test_create_household_duplicate_blocked(authenticated_client, test_user: User):
    """이미 가구가 있는 사용자의 중복 생성 시도 → 409 (#152)"""
    response = await authenticated_client.post(
        "/api/onboarding/create-household",
        json={"name": "중복 가계부"},
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_onboarding_status_after_create(db_session: AsyncSession):
    """가구 생성 후 온보딩 상태 변경 확인"""
    client, _ = await _make_fresh_client(db_session)
    async with client:
        # 가구 생성
        await client.post(
            "/api/onboarding/create-household",
            json={"name": "새 가계부"},
        )

        # 상태 확인
        response = await client.get("/api/onboarding/status")

    assert response.status_code == 200
    data = response.json()
    assert data["has_household"] is True
    assert data["household_count"] == 1

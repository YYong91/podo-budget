"""온보딩 API 테스트

가구 미소속 사용자의 초기 설정 플로우를 테스트합니다:
- GET /api/onboarding/status - 온보딩 상태 조회
- POST /api/onboarding/create-household - 기본 가구 생성
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household_member import HouseholdMember
from app.models.user import User


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
async def test_create_household_with_name(authenticated_client, test_user: User, db_session: AsyncSession):
    """이름을 지정하여 가구 생성"""
    response = await authenticated_client.post(
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
            HouseholdMember.user_id == test_user.id,
        )
    )
    member = result.scalar_one()
    assert member.role == "owner"


@pytest.mark.asyncio
async def test_create_household_without_name(authenticated_client, test_user: User):
    """이름 미지정 시 기본 이름으로 가구 생성"""
    response = await authenticated_client.post(
        "/api/onboarding/create-household",
        json={},
    )

    assert response.status_code == 201
    data = response.json()
    # "{username}님의 가계부" 형식
    assert "님의 가계부" in data["name"]


@pytest.mark.asyncio
async def test_onboarding_status_after_create(authenticated_client, test_user: User):
    """가구 생성 후 온보딩 상태 변경 확인"""
    # 추가 가구 생성
    await authenticated_client.post(
        "/api/onboarding/create-household",
        json={"name": "새 가계부"},
    )

    # 상태 확인 (conftest 기본 가구 + 새 가구)
    response = await authenticated_client.get("/api/onboarding/status")
    assert response.status_code == 200
    data = response.json()
    assert data["has_household"] is True
    assert data["household_count"] >= 2

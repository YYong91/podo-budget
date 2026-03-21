"""온보딩 API 통합 테스트

- GET /api/onboarding/status — 온보딩 상태 조회
- POST /api/onboarding/create-household — 기본 가구 생성
"""

import pytest

from app.models.household import Household
from app.models.user import User
from tests.conftest import create_test_token

# ──────────────────────────────────────────────
# GET /api/onboarding/status
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_onboarding_status_has_household(authenticated_client, test_user: User, test_household: Household):
    """가구 소속 사용자 — has_household=True"""
    response = await authenticated_client.get("/api/onboarding/status")
    assert response.status_code == 200

    data = response.json()
    assert data["has_household"] is True
    assert data["household_count"] == 1


@pytest.mark.asyncio
async def test_onboarding_status_no_household(client, db_session):
    """가구 미소속 사용자 — has_household=False"""
    # 가구 없는 새 사용자 생성
    new_auth_id = 6000000000001
    user = User(
        auth_user_id=new_auth_id,
        username="no_household_user",
        email="nohousehold@example.com",
        hashed_password=None,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_test_token(auth_user_id=new_auth_id, email="nohousehold@example.com", name="가구없는유저")
    response = await client.get("/api/onboarding/status", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    data = response.json()
    assert data["has_household"] is False
    assert data["household_count"] == 0


@pytest.mark.asyncio
async def test_onboarding_status_unauthenticated(client):
    """미인증 접근 → 401"""
    response = await client.get("/api/onboarding/status")
    assert response.status_code == 401


# ──────────────────────────────────────────────
# POST /api/onboarding/create-household
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_household_success(client, db_session):
    """가구 없는 사용자가 기본 가구 생성"""
    new_auth_id = 6000000000002
    user = User(
        auth_user_id=new_auth_id,
        username="new_onboard_user",
        email="newonboard@example.com",
        hashed_password=None,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_test_token(auth_user_id=new_auth_id, email="newonboard@example.com", name="신규유저")

    response = await client.post(
        "/api/onboarding/create-household",
        json={"name": "우리집 가계부"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "우리집 가계부"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_household_default_name(client, db_session):
    """이름 미지정 시 기본 이름 생성 ({username}님의 가계부)"""
    new_auth_id = 6000000000003
    user = User(
        auth_user_id=new_auth_id,
        username="autoname_user",
        email="autoname@example.com",
        hashed_password=None,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_test_token(auth_user_id=new_auth_id, email="autoname@example.com", name="autoname_user")

    response = await client.post(
        "/api/onboarding/create-household",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201

    data = response.json()
    assert "autoname_user" in data["name"]
    assert "가계부" in data["name"]


@pytest.mark.asyncio
async def test_create_household_already_has_one(authenticated_client, test_user: User, test_household: Household):
    """이미 가구 소속인 사용자가 가구 생성 시도 → 409 Conflict"""
    response = await authenticated_client.post(
        "/api/onboarding/create-household",
        json={"name": "중복 가구"},
    )
    assert response.status_code == 409
    assert "이미 가구에 소속" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_household_unauthenticated(client):
    """미인증 접근 → 401"""
    response = await client.post("/api/onboarding/create-household", json={"name": "테스트 가구"})
    assert response.status_code == 401

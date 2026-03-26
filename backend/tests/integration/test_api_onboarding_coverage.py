"""온보딩 API 커버리지 테스트

api/onboarding.py 미커버 라인: 37, 50, 66-88
"""

import pytest

from app.models.user import User
from tests.conftest import create_test_token


@pytest.mark.asyncio
async def test_onboarding_status_has_household(authenticated_client, test_user, test_household, db_session):
    """온보딩 상태: 가구 소속"""
    resp = await authenticated_client.get("/api/onboarding/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_household"] is True
    assert data["household_count"] >= 1


@pytest.mark.asyncio
async def test_onboarding_status_no_household(client, db_session):
    """온보딩 상태: 가구 미소속"""
    # 가구 없는 유저 생성
    user = User(
        auth_user_id="no-household-user",
        username="homeless",
        email="homeless@test.com",
    )
    db_session.add(user)
    await db_session.commit()

    token = create_test_token(auth_user_id="no-household-user", email="homeless@test.com")
    resp = await client.get(
        "/api/onboarding/status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_household"] is False


@pytest.mark.asyncio
async def test_create_default_household(client, db_session):
    """기본 가구 생성"""
    user = User(
        auth_user_id="fresh-user",
        username="신규유저",
        email="fresh@test.com",
    )
    db_session.add(user)
    await db_session.commit()

    token = create_test_token(auth_user_id="fresh-user", email="fresh@test.com")
    resp = await client.post(
        "/api/onboarding/create-household",
        json={"name": "내 가계부"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "내 가계부"


@pytest.mark.asyncio
async def test_create_default_household_duplicate(authenticated_client, test_user, test_household, db_session):
    """이미 가구 소속인 유저가 다시 생성 → 409"""
    resp = await authenticated_client.post(
        "/api/onboarding/create-household",
        json={"name": "중복 가구"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_create_default_household_auto_name(client, db_session):
    """이름 미지정 시 자동 이름"""
    user = User(
        auth_user_id="auto-name-user",
        username="자동이름유저",
        email="auto@test.com",
    )
    db_session.add(user)
    await db_session.commit()

    token = create_test_token(auth_user_id="auto-name-user", email="auto@test.com")
    resp = await client.post(
        "/api/onboarding/create-household",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert "자동이름유저님의 가계부" in resp.json()["name"]

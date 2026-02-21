"""인증 API 통합 테스트

podo-auth SSO 연동 후 GET /me 엔드포인트를 테스트합니다.
Shadow User 패턴으로 auth_user_id를 통해 로컬 유저를 조회합니다.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from tests.conftest import TEST_AUTH_USER_ID_1, create_test_token


@pytest.mark.asyncio
async def test_get_me_success(authenticated_client: AsyncClient, test_user: User):
    """인증된 사용자 정보 조회 성공 테스트"""
    response = await authenticated_client.get("/api/auth/me")

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == test_user.username
    assert data["email"] == test_user.email
    assert data["is_active"] is True
    assert "id" in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_get_me_no_token(client: AsyncClient):
    """토큰 없이 /me 접근 시 401 반환"""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    """유효하지 않은 토큰으로 /me 접근 시 401 반환"""
    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_wrong_iss(client: AsyncClient, db_session: AsyncSession, test_user: User):
    """iss가 podo-auth가 아닌 토큰으로 접근 시 401 반환"""
    from datetime import UTC, datetime, timedelta

    from jose import jwt

    from app.core.config import settings

    # iss가 없는 토큰 (podo-auth 발급 아님)
    payload = {
        "sub": str(TEST_AUTH_USER_ID_1),
        "email": "test@example.com",
        "name": "테스터",
        "exp": datetime.now(UTC) + timedelta(days=7),
    }
    bad_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_shadow_user_auto_created(client: AsyncClient, db_session: AsyncSession):
    """처음 로그인하는 podo-auth 유저의 Shadow User가 자동 생성되는지 테스트"""
    new_auth_id = 9999999999999
    token = create_test_token(
        auth_user_id=new_auth_id,
        email="newuser@example.com",
        name="신규유저",
    )

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert "id" in data


@pytest.mark.asyncio
async def test_shadow_user_email_matching(client: AsyncClient, db_session: AsyncSession):
    """email 매칭으로 기존 유저와 podo-auth 계정이 연결되는지 테스트"""
    # 기존 유저 생성 (auth_user_id 없는 상태)
    existing_user = User(
        username="existing_user",
        email="existing@example.com",
        hashed_password=None,
        is_active=True,
    )
    db_session.add(existing_user)
    await db_session.commit()
    await db_session.refresh(existing_user)

    existing_id = existing_user.id
    new_auth_id = 8888888888888

    # 같은 이메일로 podo-auth SSO 로그인
    token = create_test_token(
        auth_user_id=new_auth_id,
        email="existing@example.com",
        name="기존유저",
    )

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    # 새 유저가 아닌 기존 유저 ID를 반환해야 함
    assert data["id"] == existing_id


@pytest.mark.asyncio
async def test_removed_endpoints_return_404(client: AsyncClient):
    """삭제된 인증 엔드포인트가 404를 반환하는지 확인"""
    # 자체 로그인/회원가입 엔드포인트는 삭제됨
    for endpoint in ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password"]:
        response = await client.post(endpoint, json={})
        assert response.status_code == 404, f"{endpoint} should return 404"

"""인증 API 통합 테스트

회원가입, 로그인, 사용자 정보 조회 엔드포인트를 테스트합니다.
"""

import pytest
from httpx import AsyncClient

from app.models.user import User

TEST_PASSWORD = "password123"  # pragma: allowlist secret
TEST_PASSWORD_SHORT = "short"  # pragma: allowlist secret


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """회원가입 성공 테스트"""
    response = await client.post(
        "/api/auth/register",
        json={"username": "testuser", "password": TEST_PASSWORD},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "testuser"
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient, db_session):
    """중복 사용자명으로 회원가입 시도 테스트"""
    from app.core.auth import hash_password

    existing_user = User(username="existing", hashed_password=hash_password("pass123"))  # pragma: allowlist secret
    db_session.add(existing_user)
    await db_session.commit()

    response = await client.post(
        "/api/auth/register",
        json={"username": "existing", "password": "newpass123"},  # pragma: allowlist secret
    )

    assert response.status_code == 400
    assert "이미 존재하는 사용자명" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_invalid_password_too_short(client: AsyncClient):
    """비밀번호가 너무 짧은 경우 테스트"""
    response = await client.post(
        "/api/auth/register",
        json={"username": "testuser", "password": TEST_PASSWORD_SHORT},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, db_session):
    """로그인 성공 테스트"""
    from app.core.auth import hash_password

    user = User(username="logintest", hashed_password=hash_password(TEST_PASSWORD))
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/api/auth/login",
        json={"username": "logintest", "password": TEST_PASSWORD},
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert isinstance(data["access_token"], str)
    assert len(data["access_token"]) > 0


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, db_session):
    """잘못된 비밀번호로 로그인 시도 테스트"""
    from app.core.auth import hash_password

    user = User(username="wrongpass", hashed_password=hash_password("correct123"))  # pragma: allowlist secret
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/api/auth/login",
        json={"username": "wrongpass", "password": "wrong123"},  # pragma: allowlist secret
    )

    assert response.status_code == 401
    assert "사용자명 또는 비밀번호가 올바르지 않습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """존재하지 않는 사용자로 로그인 시도 테스트"""
    response = await client.post(
        "/api/auth/login",
        json={"username": "nonexistent", "password": TEST_PASSWORD},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, db_session):
    """비활성 사용자 로그인 시도 테스트"""
    from app.core.auth import hash_password

    user = User(
        username="inactive",
        hashed_password=hash_password(TEST_PASSWORD),
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/api/auth/login",
        json={"username": "inactive", "password": TEST_PASSWORD},
    )

    assert response.status_code == 403
    assert "비활성화된 계정" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_me_success(client: AsyncClient, db_session):
    """현재 사용자 정보 조회 성공 테스트"""
    from app.core.auth import create_access_token, hash_password

    user = User(username="metest", hashed_password=hash_password(TEST_PASSWORD))
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(data={"sub": "metest"})

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "metest"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_get_me_without_token(client: AsyncClient):
    """토큰 없이 /me 요청 테스트"""
    response = await client.get("/api/auth/me")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    """유효하지 않은 토큰으로 /me 요청 테스트"""
    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid_token_here"},
    )

    assert response.status_code == 401
    assert "인증 정보가 유효하지 않습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_me_nonexistent_user(client: AsyncClient):
    """존재하지 않는 사용자의 토큰으로 /me 요청 테스트"""
    from app.core.auth import create_access_token

    token = create_access_token(data={"sub": "nonexistent_user"})

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401

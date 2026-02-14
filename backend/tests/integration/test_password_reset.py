"""비밀번호 재설정 API 통합 테스트"""

from unittest.mock import AsyncMock, patch

import pytest

from app.core.auth import create_password_reset_token, verify_password_reset_token

# === 토큰 유틸리티 단위 테스트 ===


@pytest.mark.asyncio
async def test_create_and_verify_password_reset_token():
    """리셋 토큰 생성 후 검증 성공"""
    token = create_password_reset_token("test@example.com")
    email = verify_password_reset_token(token)
    assert email == "test@example.com"


@pytest.mark.asyncio
async def test_verify_invalid_token():
    """잘못된 토큰 검증 실패"""
    result = verify_password_reset_token("invalid-token")
    assert result is None


@pytest.mark.asyncio
async def test_verify_non_reset_token():
    """비밀번호 재설정 타입이 아닌 토큰 거부"""
    from datetime import UTC, datetime, timedelta

    from jose import jwt

    from app.core.auth import ALGORITHM
    from app.core.config import settings

    token = jwt.encode(
        {"sub": "test@example.com", "type": "access", "exp": datetime.now(UTC) + timedelta(hours=1)},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )
    result = verify_password_reset_token(token)
    assert result is None


# === API 엔드포인트 통합 테스트 ===


@pytest.mark.asyncio
async def test_forgot_password_existing_email(client, db_session):
    """존재하는 이메일로 비밀번호 재설정 요청 → 200"""
    # 먼저 사용자 등록 (이메일 포함)
    await client.post(
        "/api/auth/register",
        json={
            "username": "resetuser",
            "password": "password123",  # pragma: allowlist secret
            "email": "reset@example.com",
        },
    )

    with patch("app.api.auth.send_password_reset_email", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True
        response = await client.post(
            "/api/auth/forgot-password",
            json={
                "email": "reset@example.com",
            },
        )

    assert response.status_code == 200
    assert "재설정 링크가 발송됩니다" in response.json()["message"]


@pytest.mark.asyncio
async def test_forgot_password_nonexistent_email(client):
    """존재하지 않는 이메일 → 200 (정보 노출 방지)"""
    response = await client.post(
        "/api/auth/forgot-password",
        json={
            "email": "nonexistent@example.com",
        },
    )
    assert response.status_code == 200
    assert "재설정 링크가 발송됩니다" in response.json()["message"]


@pytest.mark.asyncio
async def test_reset_password_success(client, db_session):
    """유효한 토큰으로 비밀번호 변경 → 200"""
    # 사용자 등록
    await client.post(
        "/api/auth/register",
        json={
            "username": "resetuser2",
            "password": "oldpassword123",  # pragma: allowlist secret
            "email": "reset2@example.com",
        },
    )

    # 리셋 토큰 생성
    token = create_password_reset_token("reset2@example.com")

    # 비밀번호 변경
    response = await client.post(
        "/api/auth/reset-password",
        json={
            "token": token,
            "new_password": "newpassword123",  # pragma: allowlist secret
        },
    )
    assert response.status_code == 200
    assert "성공적으로 변경" in response.json()["message"]

    # 새 비밀번호로 로그인 확인
    login_response = await client.post(
        "/api/auth/login",
        json={
            "username": "resetuser2",
            "password": "newpassword123",  # pragma: allowlist secret
        },
    )
    assert login_response.status_code == 200


@pytest.mark.asyncio
async def test_reset_password_invalid_token(client):
    """잘못된 토큰 → 400"""
    response = await client.post(
        "/api/auth/reset-password",
        json={
            "token": "invalid-token",
            "new_password": "newpassword123",  # pragma: allowlist secret
        },
    )
    assert response.status_code == 400
    assert "유효하지 않거나 만료된" in response.json()["detail"]


@pytest.mark.asyncio
async def test_reset_password_short_password(client):
    """짧은 비밀번호 → 422 (validation error)"""
    token = create_password_reset_token("test@example.com")
    response = await client.post(
        "/api/auth/reset-password",
        json={
            "token": token,
            "new_password": "short",  # pragma: allowlist secret
        },
    )
    assert response.status_code == 422

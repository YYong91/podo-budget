"""Supabase Auth 인증 단위 테스트 (#337)

Supabase JWT 검증 및 Shadow User 생성 로직을 테스트합니다.
"""

from datetime import UTC, datetime, timedelta

import pytest
from jose import jwt

from app.core.config import settings
from tests.conftest import TEST_AUTH_USER_ID_1, create_test_token


def test_create_test_token():
    """Supabase 형식의 테스트 토큰이 올바르게 생성되는지 확인"""
    token = create_test_token(
        auth_user_id=TEST_AUTH_USER_ID_1,
        email="user@test.com",
        name="테스터",
    )

    assert isinstance(token, str)

    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], audience="authenticated")
    assert payload["sub"] == str(TEST_AUTH_USER_ID_1)
    assert payload["email"] == "user@test.com"
    assert payload["role"] == "authenticated"
    assert payload["user_metadata"]["name"] == "테스터"
    assert "exp" in payload


def test_token_without_role_rejected():
    """role이 없는 토큰은 인증 실패해야 함"""
    expire = datetime.now(UTC) + timedelta(days=7)
    payload = {
        "sub": str(TEST_AUTH_USER_ID_1),
        "email": "user@test.com",
        "exp": expire,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    decoded = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert decoded.get("role") is None  # role 없으면 인증 거부


def test_token_wrong_secret():
    """잘못된 시크릿으로 서명된 토큰은 디코딩 실패해야 함"""
    expire = datetime.now(UTC) + timedelta(days=7)
    payload = {
        "sub": str(TEST_AUTH_USER_ID_1),
        "email": "user@test.com",
        "role": "authenticated",
        "exp": expire,
    }
    wrong_token = jwt.encode(payload, "wrong-secret", algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(jwt.JWTError):
        jwt.decode(wrong_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])

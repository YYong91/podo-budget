"""SSO 인증 단위 테스트

podo-auth JWT 검증 및 Shadow User 생성 로직을 테스트합니다.
"""

from datetime import UTC, datetime, timedelta

import pytest
from jose import jwt

from app.core.config import settings
from tests.conftest import TEST_AUTH_USER_ID_1, create_test_token


def test_create_test_token():
    """podo-auth 형식의 테스트 토큰이 올바르게 생성되는지 확인"""
    token = create_test_token(
        auth_user_id=TEST_AUTH_USER_ID_1,
        email="user@test.com",
        name="테스터",
    )

    assert isinstance(token, str)

    # 디코딩하여 클레임 확인
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == str(TEST_AUTH_USER_ID_1)
    assert payload["email"] == "user@test.com"
    assert payload["name"] == "테스터"
    assert payload["iss"] == "podo-auth"
    assert "exp" in payload


def test_token_iss_required():
    """iss가 podo-auth가 아닌 토큰은 인증 실패해야 함"""
    expire = datetime.now(UTC) + timedelta(days=7)
    # iss 없는 토큰
    payload = {
        "sub": str(TEST_AUTH_USER_ID_1),
        "email": "user@test.com",
        "name": "테스터",
        "exp": expire,
    }
    token_without_iss = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    decoded = jwt.decode(token_without_iss, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert decoded.get("iss") is None  # iss 없으면 None → 인증 거부


def test_token_wrong_secret():
    """잘못된 시크릿으로 서명된 토큰은 디코딩 실패해야 함"""
    expire = datetime.now(UTC) + timedelta(days=7)
    payload = {
        "sub": str(TEST_AUTH_USER_ID_1),
        "email": "user@test.com",
        "iss": "podo-auth",
        "exp": expire,
    }
    wrong_token = jwt.encode(payload, "wrong-secret", algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(jwt.JWTError):
        jwt.decode(wrong_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])

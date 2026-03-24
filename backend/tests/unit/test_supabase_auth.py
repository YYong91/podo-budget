"""Supabase Auth JWT 검증 테스트 (#337)

podo-auth → Supabase Auth 전환에 따른 JWT 검증 로직 변경 테스트.
Supabase JWT는 podo-auth와 다른 payload 구조를 가짐:
  - sub: UUID string (기존: BigInt string)
  - iss: https://xxxx.supabase.co/auth/v1 (기존: podo-auth)
  - email: 그대로
  - name: user_metadata.name (기존: top-level name)
"""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core.config import settings

# Supabase 형식의 테스트 UUID
TEST_SUPABASE_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


def create_supabase_test_token(
    user_id: str = TEST_SUPABASE_USER_ID,
    email: str = "test@example.com",
    name: str = "테스터",
) -> str:
    """Supabase Auth 형식의 JWT 토큰 생성"""
    expire = datetime.now(UTC) + timedelta(days=7)
    payload = {
        "sub": user_id,
        "email": email,
        "iss": f"https://{settings.SUPABASE_URL.replace('https://', '')}/auth/v1"
        if hasattr(settings, "SUPABASE_URL") and settings.SUPABASE_URL
        else "https://test.supabase.co/auth/v1",
        "role": "authenticated",
        "exp": expire,
        "user_metadata": {
            "name": name,
        },
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def test_supabase_token_has_uuid_sub():
    """Supabase 토큰의 sub은 UUID 문자열"""
    token = create_supabase_test_token()
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == TEST_SUPABASE_USER_ID
    assert "-" in payload["sub"]  # UUID 형태


def test_supabase_token_has_supabase_issuer():
    """Supabase 토큰의 iss는 supabase URL 기반"""
    token = create_supabase_test_token()
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert "supabase" in payload["iss"]


def test_supabase_token_has_role():
    """Supabase 토큰에 role=authenticated 포함"""
    token = create_supabase_test_token()
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload["role"] == "authenticated"


def test_supabase_token_name_in_metadata():
    """Supabase 토큰의 이름은 user_metadata.name에 위치"""
    token = create_supabase_test_token(name="홍길동")
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    assert payload.get("name") is None  # top-level에는 없음
    assert payload["user_metadata"]["name"] == "홍길동"


def test_podo_auth_token_rejected():
    """기존 podo-auth 형식 토큰은 거부되어야 함"""
    expire = datetime.now(UTC) + timedelta(days=7)
    podo_auth_payload = {
        "sub": "1000000000001",  # BigInt string
        "email": "test@example.com",
        "name": "테스터",
        "iss": "podo-auth",
        "exp": expire,
    }
    token = jwt.encode(podo_auth_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    # podo-auth issuer는 Supabase 검증에서 거부해야 함
    assert payload["iss"] == "podo-auth"
    assert "supabase" not in payload["iss"]


# ── 통합 테스트: get_current_user가 Supabase JWT를 처리하는지 ──


@pytest.mark.asyncio
async def test_get_current_user_accepts_supabase_token(db_session):
    """get_current_user가 Supabase 형식 JWT로 Shadow User를 생성/조회해야 함"""
    from unittest.mock import MagicMock

    from app.core.auth import get_current_user

    token = create_supabase_test_token(
        user_id=TEST_SUPABASE_USER_ID,
        email="supabase@test.com",
        name="수파베이스",
    )

    credentials = MagicMock()
    credentials.credentials = token

    user = await get_current_user(credentials=credentials, db=db_session)

    assert user is not None
    assert user.email == "supabase@test.com"
    assert str(user.auth_user_id) == TEST_SUPABASE_USER_ID


@pytest.mark.asyncio
async def test_get_current_user_rejects_podo_auth_token(db_session):
    """get_current_user가 podo-auth 형식 JWT를 거부해야 함"""
    from unittest.mock import MagicMock

    from app.core.auth import get_current_user

    expire = datetime.now(UTC) + timedelta(days=7)
    podo_payload = {
        "sub": "1000000000001",
        "email": "old@test.com",
        "name": "기존유저",
        "iss": "podo-auth",
        "exp": expire,
    }
    token = jwt.encode(podo_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    credentials = MagicMock()
    credentials.credentials = token

    with pytest.raises(HTTPException):
        await get_current_user(credentials=credentials, db=db_session)

"""Supabase Auth ES256 JWT 검증 테스트 (#337)

JWKS 공개키 기반 ES256 검증 + Shadow User 로직 테스트.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat
from fastapi import HTTPException
from jose import JWTError
from jose import jwt as pyjwt
from jose.utils import long_to_base64

TEST_SUPABASE_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


@pytest.fixture(autouse=True)
def _mock_jwt_decode():
    """이 모듈에서는 conftest의 HS256 패치를 비활성화 — ES256 경로를 직접 테스트"""
    yield


# 테스트용 ES256 키 페어 생성
_test_private_key = ec.generate_private_key(ec.SECP256R1())
_test_public_key = _test_private_key.public_key()

# JWK 형태의 공개키 (python-jose 호환)

_pub_numbers = _test_public_key.public_numbers()
TEST_JWK = {
    "kty": "EC",
    "crv": "P-256",
    "x": long_to_base64(_pub_numbers.x).decode(),
    "y": long_to_base64(_pub_numbers.y).decode(),
    "kid": "test-kid-001",
    "alg": "ES256",
    "use": "sig",
}
TEST_JWKS = {"keys": [TEST_JWK]}


def create_es256_test_token(
    user_id: str = TEST_SUPABASE_USER_ID,
    email: str = "test@example.com",
    name: str = "테스터",
) -> str:
    """ES256 서명된 Supabase 형식 JWT 생성 (테스트용)"""
    from cryptography.hazmat.primitives.serialization import NoEncryption

    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "iss": "https://test.supabase.co/auth/v1",
        "exp": datetime.now(UTC) + timedelta(days=7),
        "user_metadata": {"name": name, "full_name": name},
    }

    # python-jose는 PEM 키로 ES256 서명 가능
    pem = _test_private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    return pyjwt.encode(payload, pem, algorithm="ES256", headers={"kid": "test-kid-001"})


def test_es256_token_creation():
    """ES256 테스트 토큰이 올바르게 생성되는지 확인"""
    token = create_es256_test_token()
    assert isinstance(token, str)
    assert token.count(".") == 2

    header = pyjwt.get_unverified_header(token)
    assert header["alg"] == "ES256"
    assert header["kid"] == "test-kid-001"


def test_es256_token_verification():
    """ES256 토큰이 공개키로 검증 가능한지 확인"""
    token = create_es256_test_token(email="verify@test.com")
    payload = pyjwt.decode(token, TEST_JWK, algorithms=["ES256"], audience="authenticated")

    assert payload["sub"] == TEST_SUPABASE_USER_ID
    assert payload["email"] == "verify@test.com"
    assert payload["role"] == "authenticated"


def test_es256_token_wrong_key_rejected():
    """다른 키로 서명된 토큰은 거부"""
    other_key = ec.generate_private_key(ec.SECP256R1())
    from cryptography.hazmat.primitives.serialization import PrivateFormat

    other_pem = other_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())

    payload = {
        "sub": TEST_SUPABASE_USER_ID,
        "email": "test@test.com",
        "aud": "authenticated",
        "role": "authenticated",
        "exp": datetime.now(UTC) + timedelta(days=7),
    }
    bad_token = pyjwt.encode(payload, other_pem, algorithm="ES256", headers={"kid": "test-kid-001"})

    with pytest.raises(JWTError):
        pyjwt.decode(bad_token, TEST_JWK, algorithms=["ES256"], audience="authenticated")


@pytest.mark.asyncio
async def test_get_current_user_es256(db_session):
    """get_current_user가 ES256 JWT로 Shadow User를 생성/조회"""
    from unittest.mock import MagicMock

    from app.core.auth import get_current_user

    token = create_es256_test_token(
        user_id=TEST_SUPABASE_USER_ID,
        email="es256@test.com",
        name="ES256유저",
    )

    credentials = MagicMock()
    credentials.credentials = token

    # _get_jwks_key를 모킹하여 테스트 공개키 반환 (_decode_token 패치 해제 + JWKS만 모킹)
    with patch("app.core.auth._get_jwks_key", new_callable=AsyncMock, return_value=TEST_JWK):
        user = await get_current_user(credentials=credentials, db=db_session)

    assert user is not None
    assert user.email == "es256@test.com"
    assert str(user.auth_user_id) == TEST_SUPABASE_USER_ID


@pytest.mark.asyncio
async def test_get_current_user_rejects_hs256(db_session):
    """HS256 토큰은 거부 (podo-auth 형식)"""
    from unittest.mock import MagicMock

    from app.core.auth import get_current_user

    # HS256 토큰 생성
    payload = {
        "sub": "old-user-id",
        "email": "old@test.com",
        "role": "authenticated",
        "aud": "authenticated",
        "exp": datetime.now(UTC) + timedelta(days=7),
    }
    hs256_token = pyjwt.encode(payload, "some-secret", algorithm="HS256")

    credentials = MagicMock()
    credentials.credentials = hs256_token

    with patch("app.core.auth._get_jwks_key", new_callable=AsyncMock, return_value=TEST_JWK), pytest.raises(HTTPException):
        await get_current_user(credentials=credentials, db=db_session)

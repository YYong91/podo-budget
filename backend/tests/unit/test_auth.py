"""인증 관련 단위 테스트

JWT 토큰 생성/검증, 비밀번호 해싱 기능을 테스트합니다.
"""

from datetime import timedelta

from jose import jwt

from app.core.auth import (
    ALGORITHM,
    create_access_token,
    hash_password,
    verify_password,
)
from app.core.config import settings


def test_hash_password():
    """비밀번호 해싱이 정상 동작하는지 테스트"""
    password = "test_password_123"  # pragma: allowlist secret
    hashed = hash_password(password)

    # 해시값이 원본과 다른지 확인
    assert hashed != password

    # 해시값이 문자열인지 확인
    assert isinstance(hashed, str)

    # bcrypt 해시 형식인지 확인 (bcrypt는 $2b$로 시작)
    assert hashed.startswith("$2b$")


def test_verify_password_correct():
    """올바른 비밀번호 검증 테스트"""
    password = "correct_password"  # pragma: allowlist secret
    hashed = hash_password(password)

    # 같은 비밀번호는 검증 성공
    assert verify_password(password, hashed) is True


def test_verify_password_incorrect():
    """잘못된 비밀번호 검증 테스트"""
    password = "correct_password"  # pragma: allowlist secret
    wrong_password = "wrong_password"  # pragma: allowlist secret
    hashed = hash_password(password)

    # 다른 비밀번호는 검증 실패
    assert verify_password(wrong_password, hashed) is False


def test_create_access_token():
    """JWT 액세스 토큰 생성 테스트"""
    data = {"sub": "testuser"}
    token = create_access_token(data)

    # 토큰이 문자열인지 확인
    assert isinstance(token, str)

    # JWT 디코딩하여 페이로드 확인
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "testuser"

    # exp 클레임이 존재하는지 확인 (만료 시간)
    assert "exp" in payload


def test_create_access_token_with_expires():
    """만료 시간이 지정된 JWT 토큰 생성 테스트"""
    data = {"sub": "testuser"}
    expires_delta = timedelta(minutes=15)
    token = create_access_token(data, expires_delta=expires_delta)

    # 토큰 디코딩
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "testuser"
    assert "exp" in payload


def test_hash_password_different_for_same_input():
    """같은 비밀번호라도 해시는 매번 다르게 생성되는지 테스트 (salt 사용 확인)"""
    password = "same_password"  # pragma: allowlist secret
    hash1 = hash_password(password)
    hash2 = hash_password(password)

    # 해시값은 다르지만
    assert hash1 != hash2

    # 둘 다 원본 비밀번호로 검증 가능
    assert verify_password(password, hash1) is True
    assert verify_password(password, hash2) is True

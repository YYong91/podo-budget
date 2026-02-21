"""Rate Limit 유틸리티 단위 테스트

get_user_identifier 함수의 다양한 시나리오를 테스트합니다:
- 유효한 podo-auth JWT 토큰 → auth_user_id 반환
- 유효하지 않은 토큰 → IP 폴백
- 토큰 없음 → IP 폴백
- X-Forwarded-For 헤더 → 첫 번째 IP 사용
"""

from unittest.mock import MagicMock

from app.core.rate_limit import get_user_identifier
from tests.conftest import TEST_AUTH_USER_ID_1, create_test_token


def _make_request(
    auth_header: str | None = None,
    forwarded_for: str | None = None,
    client_host: str = "127.0.0.1",
) -> MagicMock:
    """테스트용 Request 객체 생성"""
    request = MagicMock()
    headers = {}
    if auth_header:
        headers["Authorization"] = auth_header
    if forwarded_for:
        headers["X-Forwarded-For"] = forwarded_for
    request.headers = headers
    request.client = MagicMock()
    request.client.host = client_host
    return request


def test_valid_jwt_returns_user_id():
    """유효한 podo-auth JWT 토큰이 있으면 user:{auth_user_id} 반환"""
    token = create_test_token(auth_user_id=TEST_AUTH_USER_ID_1, email="test@example.com")
    request = _make_request(auth_header=f"Bearer {token}")

    result = get_user_identifier(request)
    assert result == f"user:{TEST_AUTH_USER_ID_1}"


def test_invalid_jwt_falls_back_to_ip():
    """유효하지 않은 JWT 토큰이면 IP로 폴백"""
    request = _make_request(auth_header="Bearer invalid_token_here")

    result = get_user_identifier(request)
    assert result == "ip:127.0.0.1"


def test_no_auth_header_falls_back_to_ip():
    """Authorization 헤더가 없으면 IP로 폴백"""
    request = _make_request()

    result = get_user_identifier(request)
    assert result == "ip:127.0.0.1"


def test_non_bearer_auth_header():
    """Bearer가 아닌 Authorization 헤더는 IP로 폴백"""
    request = _make_request(auth_header="Basic dXNlcjpwYXNz")

    result = get_user_identifier(request)
    assert result == "ip:127.0.0.1"


def test_x_forwarded_for_uses_first_ip():
    """X-Forwarded-For 헤더가 있으면 첫 번째 IP 사용"""
    request = _make_request(forwarded_for="10.0.0.1, 10.0.0.2, 10.0.0.3")

    result = get_user_identifier(request)
    assert result == "ip:10.0.0.1"


def test_no_client_returns_unknown():
    """client 정보가 없으면 unknown 반환"""
    request = MagicMock()
    request.headers = {}
    request.client = None

    result = get_user_identifier(request)
    assert result == "ip:unknown"


def test_non_podo_auth_token_falls_back_to_ip():
    """iss가 podo-auth가 아닌 토큰은 IP로 폴백"""
    from datetime import UTC, datetime, timedelta

    from jose import jwt

    from app.core.config import settings

    # iss 없는 토큰
    payload = {
        "sub": str(TEST_AUTH_USER_ID_1),
        "email": "test@example.com",
        "exp": datetime.now(UTC) + timedelta(days=7),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    request = _make_request(auth_header=f"Bearer {token}")

    result = get_user_identifier(request)
    assert result == "ip:127.0.0.1"

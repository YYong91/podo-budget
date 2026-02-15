"""Rate Limit 유틸리티 단위 테스트

get_user_identifier 함수의 다양한 시나리오를 테스트합니다:
- 유효한 JWT 토큰 → username 반환
- 유효하지 않은 토큰 → IP 폴백
- 토큰 없음 → IP 폴백
- X-Forwarded-For 헤더 → 첫 번째 IP 사용
"""

from unittest.mock import MagicMock

from app.core.auth import create_access_token
from app.core.rate_limit import get_user_identifier


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


def test_valid_jwt_returns_username():
    """유효한 JWT 토큰이 있으면 user:{username} 반환"""
    token = create_access_token(data={"sub": "testuser"})
    request = _make_request(auth_header=f"Bearer {token}")

    result = get_user_identifier(request)
    assert result == "user:testuser"


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


def test_jwt_without_sub_claim():
    """JWT에 sub 클레임이 없으면 IP로 폴백"""
    token = create_access_token(data={})  # sub 없는 토큰
    request = _make_request(auth_header=f"Bearer {token}")

    result = get_user_identifier(request)
    assert result == "ip:127.0.0.1"

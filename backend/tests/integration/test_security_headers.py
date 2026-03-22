"""
보안 헤더 미들웨어 통합 테스트 (#235)

모든 API 응답에 필수 보안 헤더가 포함되는지 검증한다.
"""

import pytest


@pytest.mark.asyncio
async def test_security_headers_x_content_type_options(client):
    """X-Content-Type-Options: nosniff 헤더 포함"""
    response = await client.get("/health")
    assert response.headers.get("x-content-type-options") == "nosniff"


@pytest.mark.asyncio
async def test_security_headers_x_frame_options(client):
    """X-Frame-Options: SAMEORIGIN 헤더 포함"""
    response = await client.get("/health")
    assert response.headers.get("x-frame-options") == "SAMEORIGIN"


@pytest.mark.asyncio
async def test_security_headers_referrer_policy(client):
    """Referrer-Policy: same-origin 헤더 포함"""
    response = await client.get("/health")
    assert response.headers.get("referrer-policy") == "same-origin"


@pytest.mark.asyncio
async def test_security_headers_permissions_policy(client):
    """Permissions-Policy: 카메라/마이크/위치 비활성화 헤더 포함"""
    response = await client.get("/health")
    assert "camera=()" in response.headers.get("permissions-policy", "")
    assert "microphone=()" in response.headers.get("permissions-policy", "")
    assert "geolocation=()" in response.headers.get("permissions-policy", "")


@pytest.mark.asyncio
async def test_security_headers_on_api_endpoint(authenticated_client):
    """API 엔드포인트에도 보안 헤더 포함 — 인증된 엔드포인트도 동일하게 적용"""
    response = await authenticated_client.get("/api/expenses")
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "SAMEORIGIN"


@pytest.mark.asyncio
async def test_security_headers_hsts_present_in_production(client):
    """프로덕션 환경(DEBUG=False)에서는 HSTS 헤더 포함"""
    from app.core.config import settings

    original_debug = settings.DEBUG
    settings.DEBUG = False
    try:
        response = await client.get("/health")
        assert "strict-transport-security" in response.headers
        assert "max-age=31536000" in response.headers.get("strict-transport-security", "")
    finally:
        settings.DEBUG = original_debug

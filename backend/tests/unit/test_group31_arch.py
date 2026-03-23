"""Group 31 코드리뷰 수정 사항 아키텍처 테스트 (#242, #243, #244)"""

import logging
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.llm_service import _extract_json_text

# ── #242: health_db 503 ──


@pytest.mark.asyncio
async def test_health_db_returns_503_when_db_unavailable():
    """DB 연결 실패 시 /health/db가 503을 반환해야 한다"""
    with patch("app.core.database.AsyncSessionLocal") as mock_session:
        mock_session.return_value.__aenter__ = AsyncMock(side_effect=Exception("Connection refused"))
        mock_session.return_value.__aexit__ = AsyncMock(return_value=False)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health/db")
    assert response.status_code == 503
    assert response.json()["status"] == "unhealthy"


# ── #242: Settings 검증 ──


def test_settings_warns_when_openai_key_missing(caplog):
    """LLM_PROVIDER=openai이지만 OPENAI_API_KEY가 없으면 warning이 기록되어야 한다"""
    from app.core.config import Settings

    with caplog.at_level(logging.WARNING):
        Settings(LLM_PROVIDER="openai", OPENAI_API_KEY="", DATABASE_URL="postgresql+asyncpg://localhost/test")
    assert any("OPENAI_API_KEY" in r.message for r in caplog.records)


def test_settings_warns_when_anthropic_key_missing(caplog):
    """LLM_PROVIDER=anthropic이지만 ANTHROPIC_API_KEY가 없으면 warning이 기록되어야 한다"""
    from app.core.config import Settings

    with caplog.at_level(logging.WARNING):
        Settings(LLM_PROVIDER="anthropic", ANTHROPIC_API_KEY="", DATABASE_URL="postgresql+asyncpg://localhost/test")
    assert any("ANTHROPIC_API_KEY" in r.message for r in caplog.records)


def test_settings_warns_cors_wildcard(caplog):
    """CORS_ORIGINS='*'이면 warning이 기록되어야 한다"""
    from app.core.config import Settings

    with caplog.at_level(logging.WARNING):
        Settings(CORS_ORIGINS="*", DATABASE_URL="postgresql+asyncpg://localhost/test")
    assert any("CORS_ORIGINS" in r.message for r in caplog.records)


# ── #243: _extract_json_text ──


def test_extract_json_text_removes_json_fence():
    """`json 블록에서 JSON만 추출해야 한다"""
    text = '```json\n{"amount": 8000}\n```'
    assert _extract_json_text(text) == '{"amount": 8000}'


def test_extract_json_text_removes_plain_fence():
    """``` 블록에서 내용만 추출해야 한다"""
    text = '```\n{"amount": 8000}\n```'
    assert _extract_json_text(text) == '{"amount": 8000}'


def test_extract_json_text_plain_json():
    """마크다운 블록이 없으면 그대로 반환해야 한다"""
    text = '{"amount": 8000}'
    assert _extract_json_text(text) == '{"amount": 8000}'


def test_extract_json_text_strips_whitespace():
    """앞뒤 공백을 제거해야 한다"""
    text = '  {"amount": 8000}  '
    assert _extract_json_text(text) == '{"amount": 8000}'


# ── #244: Request ID 헤더 ──


@pytest.mark.asyncio
async def test_request_id_header_added_to_response():
    """/health 엔드포인트 응답에 X-Request-ID 헤더가 포함되어야 한다"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert "x-request-id" in response.headers


@pytest.mark.asyncio
async def test_request_id_propagated_from_client():
    """클라이언트가 X-Request-ID를 보내면 응답에 그대로 반환되어야 한다"""
    custom_id = "test-id-123"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health", headers={"X-Request-ID": custom_id})
    assert response.headers.get("x-request-id") == custom_id

"""텔레그램 연동 코드 API 통합 테스트

- /api/auth/telegram-link-code POST: 코드 생성
- /api/auth/telegram/link DELETE: 연동 해제
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_generate_link_code_requires_auth(client: AsyncClient):
    """인증 없이 코드 생성 시 401"""
    response = await client.post("/api/auth/telegram-link-code")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_link_code_returns_code(authenticated_client: AsyncClient):
    """인증 사용자는 코드를 받는다"""
    response = await authenticated_client.post("/api/auth/telegram-link-code")
    assert response.status_code == 200
    data = response.json()
    assert "code" in data
    assert "expires_at" in data
    assert len(data["code"]) == 6


@pytest.mark.asyncio
async def test_generate_link_code_overwrites_previous(authenticated_client: AsyncClient):
    """재발급 시 이전 코드를 덮어쓴다"""
    r1 = await authenticated_client.post("/api/auth/telegram-link-code")
    r2 = await authenticated_client.post("/api/auth/telegram-link-code")
    assert r1.json()["code"] != r2.json()["code"]


@pytest.mark.asyncio
async def test_unlink_telegram_requires_auth(client: AsyncClient):
    """인증 없이 연동 해제 시 401"""
    response = await client.delete("/api/auth/telegram/link")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unlink_telegram(authenticated_client: AsyncClient):
    """연동 해제 요청은 200을 반환한다"""
    response = await authenticated_client.delete("/api/auth/telegram/link")
    assert response.status_code == 200

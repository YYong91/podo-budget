"""월간 결산 리포트 cron webhook 엔드포인트 테스트"""

import hashlib
import hmac
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.core.config import settings


def _make_signature(secret: str) -> str:
    """HMAC-SHA256 서명 생성 (webhook_auth.py와 동일한 방식)"""
    return hmac.new(secret.encode(), b"monthly-report-trigger", hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_webhook_rejects_missing_signature(authenticated_client: AsyncClient):
    """서명 헤더 없으면 401"""
    resp = await authenticated_client.post("/api/webhooks/monthly-reports")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_signature(authenticated_client: AsyncClient):
    """잘못된 서명이면 401"""
    with patch.object(settings, "MONTHLY_REPORT_WEBHOOK_SECRET", "test-secret"):  # pragma: allowlist secret
        resp = await authenticated_client.post(
            "/api/webhooks/monthly-reports",
            headers={"x-webhook-signature": "invalid"},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_webhook_accepts_valid_signature(authenticated_client: AsyncClient):
    """올바른 서명이면 200 + queued 수 반환"""
    secret = "test-secret"  # pragma: allowlist secret
    with (
        patch.object(settings, "MONTHLY_REPORT_WEBHOOK_SECRET", secret),
        patch.object(settings, "MONTHLY_REPORT_AUTO_ENABLED", True),
        patch("app.api.webhooks.phase1_enqueue_pending", new=AsyncMock(return_value=3)),
        patch("app.api.webhooks.phase2_process_pending", new=AsyncMock()),
    ):
        resp = await authenticated_client.post(
            "/api/webhooks/monthly-reports",
            headers={"x-webhook-signature": _make_signature(secret)},
        )
    assert resp.status_code == 200
    assert resp.json()["queued"] == 3


@pytest.mark.asyncio
async def test_webhook_skips_when_disabled(authenticated_client: AsyncClient):
    """MONTHLY_REPORT_AUTO_ENABLED=False이면 skipped=True 반환"""
    secret = "test-secret"  # pragma: allowlist secret
    with (
        patch.object(settings, "MONTHLY_REPORT_WEBHOOK_SECRET", secret),
        patch.object(settings, "MONTHLY_REPORT_AUTO_ENABLED", False),
    ):
        resp = await authenticated_client.post(
            "/api/webhooks/monthly-reports",
            headers={"x-webhook-signature": _make_signature(secret)},
        )
    assert resp.status_code == 200
    assert resp.json()["skipped"] is True

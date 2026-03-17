"""Sentry webhook → 텔레그램 알림 테스트"""

import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

SENTRY_PAYLOAD = {
    "data": {
        "event": {
            "title": "ZeroDivisionError: division by zero",
            "culprit": "app.api.expenses.update_expense",
            "web_url": "https://sentry.io/issues/12345/",
            "level": "error",
            "environment": "production",
        }
    }
}


@pytest.mark.asyncio
async def test_sentry_webhook_전송_성공(authenticated_client: AsyncClient):
    """Sentry webhook → 텔레그램 메시지 전송"""
    with (
        patch("app.api.webhooks.settings") as mock_settings,
        patch("app.api.telegram.send_telegram_message", new_callable=AsyncMock) as mock_send,
    ):
        mock_settings.TELEGRAM_BOT_TOKEN = "fake-token"
        mock_settings.SENTRY_ALERT_CHAT_ID = "12345"
        mock_settings.SENTRY_WEBHOOK_SECRET = ""
        mock_settings.SENTRY_ENVIRONMENT = "production"

        response = await authenticated_client.post(
            "/api/webhooks/sentry",
            json=SENTRY_PAYLOAD,
        )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    mock_send.assert_called_once()
    msg = mock_send.call_args[0][1]
    assert "ZeroDivisionError" in msg
    assert "production" in msg


@pytest.mark.asyncio
async def test_sentry_webhook_서명_검증(authenticated_client: AsyncClient):
    """SENTRY_WEBHOOK_SECRET 설정 시 HMAC 서명 검증"""
    secret = "test-secret"  # pragma: allowlist secret
    body = json.dumps(SENTRY_PAYLOAD).encode()
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    with (
        patch("app.api.webhooks.settings") as mock_settings,
        patch("app.api.telegram.send_telegram_message", new_callable=AsyncMock),
    ):
        mock_settings.TELEGRAM_BOT_TOKEN = "fake-token"
        mock_settings.SENTRY_ALERT_CHAT_ID = "12345"
        mock_settings.SENTRY_WEBHOOK_SECRET = secret
        mock_settings.SENTRY_ENVIRONMENT = "production"

        # 올바른 서명
        response = await authenticated_client.post(
            "/api/webhooks/sentry",
            content=body,
            headers={"content-type": "application/json", "sentry-hook-signature": signature},
        )
        assert response.status_code == 200

        # 잘못된 서명
        response = await authenticated_client.post(
            "/api/webhooks/sentry",
            json=SENTRY_PAYLOAD,
            headers={"sentry-hook-signature": "wrong"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_sentry_webhook_텔레그램_미설정(authenticated_client: AsyncClient):
    """텔레그램 미설정 시 ok=False 반환"""
    with patch("app.api.webhooks.settings") as mock_settings:
        mock_settings.TELEGRAM_BOT_TOKEN = ""
        mock_settings.SENTRY_ALERT_CHAT_ID = ""

        response = await authenticated_client.post(
            "/api/webhooks/sentry",
            json=SENTRY_PAYLOAD,
        )

    assert response.status_code == 200
    assert response.json()["ok"] is False

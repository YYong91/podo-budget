"""Sentry webhook → 텔레그램 알림 테스트"""

import hashlib
import hmac
import json
from unittest.mock import AsyncMock, MagicMock, patch

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


def _mock_httpx_client():
    """httpx.AsyncClient async context manager 모킹"""
    mock_response = MagicMock()
    mock_response.is_success = True

    mock_post = AsyncMock(return_value=mock_response)

    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    return mock_client, mock_post


@pytest.mark.asyncio
async def test_sentry_webhook_전송_성공(authenticated_client: AsyncClient):
    """Sentry webhook → 텔레그램 메시지 전송"""
    _secret = "test-sentry-secret"  # pragma: allowlist secret
    _body = json.dumps(SENTRY_PAYLOAD).encode()
    _sig = hmac.new(_secret.encode(), _body, hashlib.sha256).hexdigest()

    mock_client, mock_post = _mock_httpx_client()

    with (
        patch("app.api.webhooks.settings") as mock_settings,
        patch("app.api.webhooks.httpx.AsyncClient", return_value=mock_client),
    ):
        mock_settings.SENTRY_ALERT_BOT_TOKEN = ""
        mock_settings.TELEGRAM_BOT_TOKEN = "fake-token"
        mock_settings.SENTRY_ALERT_CHAT_ID = "12345"
        mock_settings.SENTRY_WEBHOOK_SECRET = _secret
        mock_settings.SENTRY_ENVIRONMENT = "production"

        response = await authenticated_client.post(
            "/api/webhooks/sentry",
            content=_body,
            headers={"content-type": "application/json", "sentry-hook-signature": _sig},
        )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    mock_post.assert_called_once()
    msg = mock_post.call_args.kwargs["json"]["text"]
    assert "ZeroDivisionError" in msg
    assert "production" in msg


@pytest.mark.asyncio
async def test_sentry_webhook_별도_봇_토큰_사용(authenticated_client: AsyncClient):
    """SENTRY_ALERT_BOT_TOKEN 설정 시 별도 봇으로 전송"""
    _secret = "test-sentry-secret"  # pragma: allowlist secret
    _body = json.dumps(SENTRY_PAYLOAD).encode()
    _sig = hmac.new(_secret.encode(), _body, hashlib.sha256).hexdigest()

    mock_client, mock_post = _mock_httpx_client()

    with (
        patch("app.api.webhooks.settings") as mock_settings,
        patch("app.api.webhooks.httpx.AsyncClient", return_value=mock_client),
    ):
        mock_settings.SENTRY_ALERT_BOT_TOKEN = "custom-bot-token"
        mock_settings.TELEGRAM_BOT_TOKEN = "main-bot-token"
        mock_settings.SENTRY_ALERT_CHAT_ID = "12345"
        mock_settings.SENTRY_WEBHOOK_SECRET = _secret
        mock_settings.SENTRY_ENVIRONMENT = "production"

        response = await authenticated_client.post(
            "/api/webhooks/sentry",
            content=_body,
            headers={"content-type": "application/json", "sentry-hook-signature": _sig},
        )

    assert response.status_code == 200
    url = mock_post.call_args.args[0]
    assert "custom-bot-token" in url
    assert "main-bot-token" not in url


@pytest.mark.asyncio
async def test_sentry_webhook_서명_검증(authenticated_client: AsyncClient):
    """SENTRY_WEBHOOK_SECRET 설정 시 HMAC 서명 검증"""
    secret = "test-secret"  # pragma: allowlist secret
    body = json.dumps(SENTRY_PAYLOAD).encode()
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    mock_client, _ = _mock_httpx_client()

    with (
        patch("app.api.webhooks.settings") as mock_settings,
        patch("app.api.webhooks.httpx.AsyncClient", return_value=mock_client),
    ):
        mock_settings.SENTRY_ALERT_BOT_TOKEN = ""
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
        mock_settings.SENTRY_ALERT_BOT_TOKEN = ""
        mock_settings.TELEGRAM_BOT_TOKEN = ""
        mock_settings.SENTRY_ALERT_CHAT_ID = ""

        response = await authenticated_client.post(
            "/api/webhooks/sentry",
            json=SENTRY_PAYLOAD,
        )

    assert response.status_code == 200
    assert response.json()["ok"] is False

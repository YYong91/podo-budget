"""피드백 관리자 알림 서비스 테스트"""

from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_notify_admin_feedback_sends_message():
    """관리자 chat_id 설정 시 텔레그램 메시지 전송"""
    from app.services.feedback_notify import notify_admin_feedback

    with (
        patch("app.services.feedback_notify.settings") as mock_settings,
        patch("app.services.feedback_notify._send_admin_telegram", new_callable=AsyncMock) as mock_send,
    ):
        mock_settings.ADMIN_TELEGRAM_CHAT_ID = "12345"

        await notify_admin_feedback(
            username="testuser",
            feedback_type="feature",
            title="검색 기능 요청",
            content="검색 기능이 있으면 좋겠어요",
            source="kakao",
        )

        mock_send.assert_called_once()
        text = mock_send.call_args[0][1]
        assert "검색 기능 요청" in text
        assert "카카오톡" in text


@pytest.mark.asyncio
async def test_notify_admin_feedback_skips_when_no_chat_id():
    """관리자 chat_id 미설정 시 전송하지 않음"""
    from app.services.feedback_notify import notify_admin_feedback

    with (
        patch("app.services.feedback_notify.settings") as mock_settings,
        patch("app.services.feedback_notify._send_admin_telegram", new_callable=AsyncMock) as mock_send,
    ):
        mock_settings.ADMIN_TELEGRAM_CHAT_ID = ""

        await notify_admin_feedback(
            username="testuser",
            feedback_type="bug",
            title="버그 신고",
            content="카테고리가 안 보여요",
            source="web",
        )

        mock_send.assert_not_called()


@pytest.mark.asyncio
async def test_send_admin_telegram_uses_admin_token():
    """ADMIN_TELEGRAM_BOT_TOKEN 설정 시 해당 토큰 사용"""
    from app.services.feedback_notify import _send_admin_telegram

    with (
        patch("app.services.feedback_notify.settings") as mock_settings,
        patch("app.services.feedback_notify.httpx.AsyncClient") as mock_client_cls,
    ):
        mock_settings.ADMIN_TELEGRAM_BOT_TOKEN = "admin-bot-token"
        mock_settings.TELEGRAM_BOT_TOKEN = "main-bot-token"

        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        await _send_admin_telegram("12345", "test message")

        mock_client.post.assert_called_once()
        url = mock_client.post.call_args[0][0]
        assert "admin-bot-token" in url
        assert "main-bot-token" not in url

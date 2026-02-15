"""이메일 서비스 단위 테스트"""

from unittest.mock import MagicMock, patch

import pytest

from app.services.email_service import send_invitation_email, send_password_reset_email


@pytest.mark.asyncio
async def test_send_invitation_email_skipped_without_api_key():
    """API 키 미설정 시 이메일 발송 건너뜀"""
    with patch("app.services.email_service.settings") as mock_settings:
        mock_settings.RESEND_API_KEY = ""
        result = await send_invitation_email(
            to_email="test@example.com",
            household_name="테스트 가구",
            inviter_name="홍길동",
            invite_token="test-token",
        )
        assert result is False


@pytest.mark.asyncio
async def test_send_invitation_email_success():
    """이메일 발송 성공"""
    with (
        patch("app.services.email_service.settings") as mock_settings,
        patch("app.services.email_service.resend") as mock_resend,
    ):
        mock_settings.RESEND_API_KEY = "re_test_key"  # pragma: allowlist secret  # pragma: allowlist secret
        mock_settings.RESEND_FROM_EMAIL = "Test <test@test.com>"
        mock_settings.CORS_ORIGINS = "http://localhost:5173"
        mock_resend.Emails = MagicMock()

        result = await send_invitation_email(
            to_email="test@example.com",
            household_name="테스트 가구",
            inviter_name="홍길동",
            invite_token="test-token-123",
        )
        assert result is True
        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["to"] == ["test@example.com"]
        assert "테스트 가구" in call_args["subject"]
        assert "test-token-123" in call_args["html"]


@pytest.mark.asyncio
async def test_send_invitation_email_failure():
    """이메일 발송 실패 시 False 반환"""
    with (
        patch("app.services.email_service.settings") as mock_settings,
        patch("app.services.email_service.resend") as mock_resend,
    ):
        mock_settings.RESEND_API_KEY = "re_test_key"  # pragma: allowlist secret  # pragma: allowlist secret
        mock_settings.RESEND_FROM_EMAIL = "Test <test@test.com>"
        mock_settings.CORS_ORIGINS = "http://localhost:5173"
        mock_resend.Emails.send.side_effect = Exception("API error")

        result = await send_invitation_email(
            to_email="test@example.com",
            household_name="테스트 가구",
            inviter_name="홍길동",
            invite_token="test-token",
        )
        assert result is False


@pytest.mark.asyncio
async def test_send_password_reset_email_skipped_without_api_key():
    """API 키 미설정 시 비밀번호 재설정 이메일 건너뜀"""
    with patch("app.services.email_service.settings") as mock_settings:
        mock_settings.RESEND_API_KEY = ""
        result = await send_password_reset_email(
            to_email="test@example.com",
            reset_token="reset-token",
        )
        assert result is False


@pytest.mark.asyncio
async def test_send_password_reset_email_success():
    """비밀번호 재설정 이메일 발송 성공"""
    with (
        patch("app.services.email_service.settings") as mock_settings,
        patch("app.services.email_service.resend") as mock_resend,
    ):
        mock_settings.RESEND_API_KEY = "re_test_key"  # pragma: allowlist secret
        mock_settings.RESEND_FROM_EMAIL = "Test <test@test.com>"
        mock_settings.CORS_ORIGINS = "http://localhost:5173"
        mock_resend.Emails = MagicMock()

        result = await send_password_reset_email(
            to_email="test@example.com",
            reset_token="reset-token-456",
        )
        assert result is True
        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["to"] == ["test@example.com"]
        assert "비밀번호 재설정" in call_args["subject"]
        assert "reset-token-456" in call_args["html"]


@pytest.mark.asyncio
async def test_send_password_reset_email_failure():
    """비밀번호 재설정 이메일 발송 실패 시 False 반환"""
    with (
        patch("app.services.email_service.settings") as mock_settings,
        patch("app.services.email_service.resend") as mock_resend,
    ):
        mock_settings.RESEND_API_KEY = "re_test_key"  # pragma: allowlist secret
        mock_settings.RESEND_FROM_EMAIL = "Test <test@test.com>"
        mock_settings.CORS_ORIGINS = "http://localhost:5173"
        mock_resend.Emails.send.side_effect = Exception("API error")

        result = await send_password_reset_email(
            to_email="test@example.com",
            reset_token="reset-token",
        )
        assert result is False

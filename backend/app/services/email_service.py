"""이메일 발송 서비스

Resend API를 사용한 이메일 발송을 담당합니다.
RESEND_API_KEY가 설정되지 않으면 이메일 발송을 건너뜁니다.
"""

import logging

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_invitation_email(
    to_email: str,
    household_name: str,
    inviter_name: str,
    invite_token: str,
) -> bool:
    """초대 이메일 발송

    Args:
        to_email: 수신자 이메일
        household_name: 가구 이름
        inviter_name: 초대한 사용자 이름
        invite_token: 초대 토큰

    Returns:
        True: 발송 성공, False: 발송 건너뜀 또는 실패
    """
    if not settings.RESEND_API_KEY:
        logger.info("RESEND_API_KEY 미설정 — 이메일 발송 건너뜀")
        return False

    resend.api_key = settings.RESEND_API_KEY
    frontend_url = settings.CORS_ORIGINS.split(",")[0].strip()
    accept_url = f"{frontend_url}/invitations/accept?token={invite_token}"

    try:
        resend.Emails.send(
            {
                "from": settings.RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": f"{inviter_name}님이 '{household_name}' 가구에 초대했습니다",
                "html": f"""
            <div style="font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #292524; margin-bottom: 16px;">가구 초대</h2>
                <p style="color: #57534e; font-size: 16px; line-height: 1.6;">
                    <strong>{inviter_name}</strong>님이 <strong>{household_name}</strong> 가구에 초대했습니다.
                </p>
                <div style="margin: 32px 0;">
                    <a href="{accept_url}"
                       style="background-color: #d97706; color: white; padding: 12px 32px;
                              text-decoration: none; border-radius: 12px; font-weight: 600;
                              display: inline-block;">
                        초대 수락하기
                    </a>
                </div>
                <p style="color: #a8a29e; font-size: 14px;">이 링크는 7일 후 만료됩니다.</p>
            </div>
            """,
            }
        )
        logger.info(f"초대 이메일 발송 완료: {to_email}")
        return True
    except Exception as e:
        logger.error(f"이메일 발송 실패: {e}")
        return False

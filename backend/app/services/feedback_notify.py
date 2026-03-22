"""피드백 관리자 알림 서비스"""

import logging

from app.api.telegram import send_telegram_message
from app.core.config import settings

logger = logging.getLogger(__name__)

TYPE_LABEL = {"feature": "기능 요청", "bug": "버그 신고"}
SOURCE_LABEL = {"web": "웹", "telegram": "텔레그램", "kakao": "카카오톡"}


async def notify_admin_feedback(
    username: str,
    feedback_type: str,
    title: str,
    content: str,
    source: str,
) -> None:
    """새 피드백 등록 시 관리자 텔레그램으로 알림 전송

    ADMIN_TELEGRAM_CHAT_ID가 미설정이면 무시합니다.
    """
    if not settings.ADMIN_TELEGRAM_CHAT_ID:
        return

    type_label = TYPE_LABEL.get(feedback_type, feedback_type)
    source_label = SOURCE_LABEL.get(source, source)

    text = f"📬 새 피드백 ({type_label})\n" f"From: {username} ({source_label})\n" f"───\n" f"📌 {title}\n" f"{content[:500]}"

    try:
        await send_telegram_message(int(settings.ADMIN_TELEGRAM_CHAT_ID), text)
    except Exception as e:
        logger.error(f"피드백 알림 전송 실패: {e}")

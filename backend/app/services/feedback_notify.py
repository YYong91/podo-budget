"""피드백 관리자 알림 서비스"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TYPE_LABEL = {"feature": "기능 요청", "bug": "버그 신고"}
SOURCE_LABEL = {"web": "웹", "telegram": "텔레그램", "kakao": "카카오톡"}

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


async def _send_admin_telegram(chat_id: str, text: str) -> None:
    """관리자 알림 전용 텔레그램 메시지 전송

    ADMIN_TELEGRAM_BOT_TOKEN이 설정되어 있으면 해당 봇으로,
    미설정이면 기본 TELEGRAM_BOT_TOKEN으로 전송합니다.
    """
    token = settings.ADMIN_TELEGRAM_BOT_TOKEN or settings.TELEGRAM_BOT_TOKEN
    if not token:
        logger.warning("텔레그램 봇 토큰이 설정되지 않아 알림을 보낼 수 없습니다")
        return

    url = TELEGRAM_API.format(token=token)
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(url, json={"chat_id": chat_id, "text": text})


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

    text = f"📬 새 피드백 ({type_label})\nFrom: {username} ({source_label})\n───\n📌 {title}\n{content[:500]}"

    try:
        await _send_admin_telegram(settings.ADMIN_TELEGRAM_CHAT_ID, text)
    except Exception as e:
        logger.error(f"피드백 알림 전송 실패: {e}")

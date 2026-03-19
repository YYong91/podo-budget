"""외부 서비스 webhook 수신 엔드포인트

현재: Sentry 에러 알림 → 텔레그램 전달
"""

import hashlib
import hmac
import logging

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _verify_sentry_signature(body: bytes, signature: str, secret: str) -> bool:
    """Sentry HMAC-SHA256 서명 검증

    Sentry는 'sha256=<hex>' 형식으로 서명을 전송하므로 prefix를 제거 후 비교한다.
    """
    # 'sha256=hexdigest' 형식에서 hex 값만 추출
    hex_signature = signature.removeprefix("sha256=")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, hex_signature)


def _format_sentry_alert(payload: dict) -> str:
    """Sentry webhook payload → 텔레그램 메시지 포맷"""
    # Sentry Issue Alert 형식
    data = payload.get("data", {})
    event = data.get("event", data)

    title = event.get("title", payload.get("message", "알 수 없는 에러"))
    culprit = event.get("culprit", "")
    url = event.get("web_url", payload.get("url", ""))
    level = event.get("level", "error")
    environment = event.get("environment", settings.SENTRY_ENVIRONMENT)

    # 레벨 이모지
    level_emoji = {"fatal": "💀", "error": "🚨", "warning": "⚠️", "info": "ℹ️"}.get(level, "❓")

    lines = [
        f"{level_emoji} [{environment}] Sentry Alert",
        "",
        title,
    ]
    if culprit:
        lines.append(f"📍 {culprit}")
    if url:
        lines.append(f"🔗 {url}")

    return "\n".join(lines)


@router.post("/sentry")
async def sentry_webhook(
    request: Request,
    sentry_hook_signature: str | None = Header(None, alias="sentry-hook-signature"),
):
    """Sentry webhook 수신 → 텔레그램 알림 전송

    Sentry Alert Rule에서 WebHook action으로 이 URL을 설정.
    SENTRY_WEBHOOK_SECRET 설정 시 HMAC-SHA256 서명을 검증합니다.
    """
    if not settings.TELEGRAM_BOT_TOKEN or not settings.SENTRY_ALERT_CHAT_ID:
        logger.warning("Sentry webhook 수신했으나 텔레그램 설정 미완료")
        return {"ok": False, "reason": "telegram not configured"}

    body = await request.body()

    # 서명 검증
    if settings.SENTRY_WEBHOOK_SECRET and (
        not sentry_hook_signature or not _verify_sentry_signature(body, sentry_hook_signature, settings.SENTRY_WEBHOOK_SECRET)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    try:
        payload = await request.json()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON") from e

    message = _format_sentry_alert(payload)

    # 텔레그램 전송
    from app.api.telegram import send_telegram_message

    try:
        await send_telegram_message(int(settings.SENTRY_ALERT_CHAT_ID), message)
        logger.info("Sentry 알림 텔레그램 전송 완료")
    except Exception:
        logger.exception("Sentry 알림 텔레그램 전송 실패")

    return {"ok": True}

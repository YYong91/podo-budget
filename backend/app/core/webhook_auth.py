"""HMAC-SHA256 기반 웹훅 서명 검증"""

import hashlib
import hmac

from fastapi import HTTPException, Request

from app.core.config import settings


def verify_monthly_report_webhook(request: Request) -> None:
    """Supabase pg_net이 전송한 HMAC 서명 검증

    Raises:
        HTTPException: 서명 불일치 시 401
    """
    if not settings.MONTHLY_REPORT_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Webhook secret not configured")

    received = request.headers.get("x-webhook-signature", "")
    expected = hmac.new(
        settings.MONTHLY_REPORT_WEBHOOK_SECRET.encode(),
        b"monthly-report-trigger",
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(received, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

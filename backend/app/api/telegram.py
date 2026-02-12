"""Telegram Bot Webhook 라우트

Telegram 봇을 통해 자연어로 지출을 입력받고,
LLM으로 파싱하여 DB에 저장합니다.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.expense import Expense
from app.services.bot_messages import (
    format_expense_saved,
    format_help_message,
    format_parse_error,
    format_server_error,
    format_welcome_message,
)
from app.services.category_service import get_or_create_category
from app.services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)

router = APIRouter()

# Telegram API 베이스 URL
TELEGRAM_API = "https://api.telegram.org/bot{token}"


async def send_telegram_message(chat_id: int, text: str):
    """Telegram 채팅으로 메시지 전송"""
    import httpx

    url = f"{TELEGRAM_API.format(token=settings.TELEGRAM_BOT_TOKEN)}/sendMessage"
    async with httpx.AsyncClient() as client:
        await client.post(url, json={"chat_id": chat_id, "text": text})


@router.post("/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Telegram Webhook 엔드포인트

    Telegram이 새 메시지를 이 URL로 POST합니다.
    메시지를 받으면 LLM으로 파싱 → DB 저장 → 결과 응답
    """
    data = await request.json()

    # 메시지가 없으면 무시
    message = data.get("message")
    if not message or "text" not in message:
        return {"ok": True}

    chat_id = message["chat"]["id"]
    user_text = message["text"]

    # /start 명령어 처리
    if user_text.startswith("/start"):
        await send_telegram_message(chat_id, format_welcome_message())
        return {"ok": True}

    # /help 명령어 처리
    if user_text.startswith("/help"):
        await send_telegram_message(chat_id, format_help_message())
        return {"ok": True}

    # LLM으로 지출 파싱
    try:
        llm = get_llm_provider()
        parsed = await llm.parse_expense(user_text)

        # 파싱 실패
        if "error" in parsed:
            await send_telegram_message(chat_id, format_parse_error(user_text))
            return {"ok": True}

        # 카테고리 매칭/생성
        category_name = parsed.get("category", "기타")
        category = await get_or_create_category(db, category_name)

        # Expense 생성
        expense_date = datetime.fromisoformat(parsed.get("date", datetime.now().isoformat()))
        expense = Expense(
            amount=parsed["amount"],
            description=parsed.get("description", user_text),
            category_id=category.id,
            raw_input=user_text,
            date=expense_date,
        )
        db.add(expense)
        await db.commit()

        # 성공 응답
        await send_telegram_message(
            chat_id,
            format_expense_saved(
                amount=parsed["amount"],
                category=category_name,
                description=parsed.get("description", user_text),
                date=expense_date.strftime("%Y-%m-%d"),
            ),
        )

    except Exception as e:
        logger.error(f"Telegram webhook 처리 실패: {e}")
        await send_telegram_message(chat_id, format_server_error())

    return {"ok": True}

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
        await client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"})


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
        await send_telegram_message(
            chat_id,
            "안녕하세요! HomeNRich 가계부 봇입니다.\n\n"
            "지출을 자연어로 입력해주세요.\n"
            "예: `점심 김치찌개 8000원`\n"
            "예: `택시 15000원`\n"
            "예: `넷플릭스 13500`",
        )
        return {"ok": True}

    # /help 명령어 처리
    if user_text.startswith("/help"):
        await send_telegram_message(
            chat_id,
            "*사용법*\n\n"
            "지출 내역을 자연어로 입력하면 자동으로 분류하여 저장합니다.\n\n"
            "*입력 예시:*\n"
            "• `점심 김치찌개 8000원`\n"
            "• `어제 택시 15000원 회식 후`\n"
            "• `다이소 생활용품 3만원`\n"
            "• `버스 1400원`\n"
            "• `넷플릭스 13500`",
        )
        return {"ok": True}

    # LLM으로 지출 파싱
    try:
        llm = get_llm_provider()
        parsed = await llm.parse_expense(user_text)

        # 파싱 실패
        if "error" in parsed:
            await send_telegram_message(chat_id, f"파싱 실패: {parsed['error']}\n다시 입력해주세요.")
            return {"ok": True}

        # 카테고리 매칭/생성
        category = await get_or_create_category(db, parsed.get("category", "기타"))

        # Expense 생성
        expense = Expense(
            amount=parsed["amount"],
            description=parsed.get("description", user_text),
            category_id=category.id,
            raw_input=user_text,
            date=datetime.fromisoformat(parsed.get("date", datetime.now().isoformat())),
        )
        db.add(expense)
        await db.commit()

        # 성공 응답
        amount_formatted = f"{int(parsed['amount']):,}"
        reply = (
            f"기록 완료!\n\n"
            f"금액: ₩{amount_formatted}\n"
            f"카테고리: {parsed.get('category', '기타')}\n"
            f"내용: {parsed.get('description', '-')}\n"
            f"날짜: {parsed.get('date', '오늘')}"
        )
        if parsed.get("memo"):
            reply += f"\n메모: {parsed['memo']}"

        await send_telegram_message(chat_id, reply)

    except Exception as e:
        logger.error(f"Telegram webhook 처리 실패: {e}")
        await send_telegram_message(chat_id, "처리 중 오류가 발생했습니다. 다시 시도해주세요.")

    return {"ok": True}

"""Telegram Bot Webhook 라우트

Telegram 봇을 통해 자연어로 지출을 입력받고,
LLM으로 파싱하여 DB에 저장합니다.
인라인 버튼을 통한 수정/삭제, 명령어 처리도 지원합니다.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.services.bot_messages import (
    format_budget_status,
    format_expense_saved,
    format_help_message,
    format_parse_error,
    format_report_message,
    format_server_error,
    format_welcome_message,
)
from app.services.category_service import get_or_create_category
from app.services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)

router = APIRouter()

# Telegram API 베이스 URL
TELEGRAM_API = "https://api.telegram.org/bot{token}"


async def send_telegram_message(chat_id: int, text: str, reply_markup: dict | None = None):
    """Telegram 채팅으로 메시지 전송

    Args:
        chat_id: 메시지를 보낼 채팅방 ID
        text: 메시지 본문
        reply_markup: 인라인 키보드 등의 마크업 (선택사항)
    """
    import httpx

    url = f"{TELEGRAM_API.format(token=settings.TELEGRAM_BOT_TOKEN)}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient() as client:
        await client.post(url, json=payload)


@router.post("/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Telegram Webhook 엔드포인트

    Telegram이 새 메시지 또는 callback_query를 이 URL로 POST합니다.
    - 메시지: LLM으로 파싱 → DB 저장 → 결과 응답
    - callback_query: 인라인 버튼 클릭 처리 (카테고리 변경, 삭제)
    """
    data = await request.json()

    # Callback Query 처리 (인라인 버튼 클릭)
    if "callback_query" in data:
        return await handle_callback_query(data["callback_query"], db)

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

    # /report 명령어 처리 (이번 달 지출 요약)
    if user_text.startswith("/report"):
        await handle_report_command(chat_id, db)
        return {"ok": True}

    # /budget 명령어 처리 (예산 현황)
    if user_text.startswith("/budget"):
        await handle_budget_command(chat_id, db)
        return {"ok": True}

    # LLM으로 지출 파싱
    try:
        llm = get_llm_provider()
        parsed = await llm.parse_expense(user_text)

        # 단일 지출 (dict) 처리
        if isinstance(parsed, dict):
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
            await db.refresh(expense)

            # 인라인 키보드 버튼 생성 (카테고리 변경, 삭제)
            inline_keyboard = {
                "inline_keyboard": [
                    [
                        {
                            "text": "🔄 카테고리 변경",
                            "callback_data": f"change_category:{expense.id}",
                        },
                        {"text": "🗑️ 삭제", "callback_data": f"delete_expense:{expense.id}"},
                    ]
                ]
            }

            # 성공 응답 (인라인 버튼 포함)
            await send_telegram_message(
                chat_id,
                format_expense_saved(
                    amount=parsed["amount"],
                    category=category_name,
                    description=parsed.get("description", user_text),
                    date=expense_date.strftime("%Y-%m-%d"),
                ),
                reply_markup=inline_keyboard,
            )

        # 여러 지출 (list) 처리
        elif isinstance(parsed, list):
            created_expenses = []

            for item in parsed:
                # 카테고리 매칭/생성
                category_name = item.get("category", "기타")
                category = await get_or_create_category(db, category_name)

                # Expense 생성
                expense_date = datetime.fromisoformat(item.get("date", datetime.now().isoformat()))
                expense = Expense(
                    amount=item["amount"],
                    description=item.get("description", ""),
                    category_id=category.id,
                    raw_input=user_text,
                    date=expense_date,
                )
                db.add(expense)
                created_expenses.append(expense)

            await db.commit()

            # 성공 메시지 구성
            total_amount = sum(item["amount"] for item in parsed)
            count = len(parsed)
            message_lines = [f"✅ {count}건의 지출이 기록되었어요!\n"]

            for idx, (expense, item) in enumerate(zip(created_expenses, parsed, strict=False), 1):
                await db.refresh(expense)
                message_lines.append(f"{idx}. 💰 {item['amount']:,.0f}원 - " f"📂 {item.get('category', '기타')} - {item.get('description', '')}")

            message_lines.append(f"\n💰 총 {total_amount:,.0f}원")

            await send_telegram_message(chat_id, "\n".join(message_lines))

    except Exception as e:
        logger.error(f"Telegram webhook 처리 실패: {e}")
        await send_telegram_message(chat_id, format_server_error())

    return {"ok": True}


async def handle_callback_query(callback_query: dict, db: AsyncSession):
    """인라인 버튼 클릭 처리

    callback_data 형식:
    - change_category:{expense_id} — 카테고리 변경
    - delete_expense:{expense_id} — 지출 삭제

    Args:
        callback_query: Telegram callback_query 객체
        db: 데이터베이스 세션
    """

    callback_id = callback_query["id"]
    chat_id = callback_query["message"]["chat"]["id"]
    callback_data = callback_query["data"]

    try:
        # callback_data 파싱
        action, expense_id_str = callback_data.split(":", 1)
        expense_id = int(expense_id_str)

        # 지출 조회
        result = await db.execute(select(Expense).where(Expense.id == expense_id))
        expense = result.scalar_one_or_none()

        if not expense:
            await answer_callback_query(callback_id, "지출을 찾을 수 없어요.")
            return {"ok": True}

        if action == "delete_expense":
            # 지출 삭제
            await db.delete(expense)
            await db.commit()
            await answer_callback_query(callback_id, "삭제되었습니다!")
            await send_telegram_message(chat_id, f"✅ {expense.amount:,.0f}원 지출이 삭제되었어요.")

        elif action == "change_category":
            # 카테고리 변경 안내 (실제 구현은 생략, 간단히 안내만)
            await answer_callback_query(callback_id, "카테고리 변경 기능은 추후 추가됩니다.")

    except Exception as e:
        logger.error(f"Callback query 처리 실패: {e}")
        await answer_callback_query(callback_id, "오류가 발생했습니다.")

    return {"ok": True}


async def answer_callback_query(callback_id: str, text: str):
    """Callback query 응답 (버튼 클릭 시 알림 팝업)

    Args:
        callback_id: callback_query의 ID
        text: 표시할 메시지
    """
    import httpx

    url = f"{TELEGRAM_API.format(token=settings.TELEGRAM_BOT_TOKEN)}/answerCallbackQuery"
    async with httpx.AsyncClient() as client:
        await client.post(url, json={"callback_query_id": callback_id, "text": text})


async def handle_report_command(chat_id: int, db: AsyncSession):
    """이번 달 지출 요약 리포트 전송

    카테고리별 지출 합계와 건수를 집계하여 메시지로 보냅니다.

    Args:
        chat_id: 메시지를 보낼 채팅방 ID
        db: 데이터베이스 세션
    """
    try:
        # 이번 달 1일부터 현재까지 지출 집계
        now = datetime.now()
        result = await db.execute(
            select(
                Category.name,
                func.sum(Expense.amount).label("total"),
                func.count(Expense.id).label("count"),
            )
            .join(Category, Expense.category_id == Category.id)
            .where(extract("year", Expense.date) == now.year)
            .where(extract("month", Expense.date) == now.month)
            .group_by(Category.name)
            .order_by(func.sum(Expense.amount).desc())
        )

        rows = result.all()
        report_data = [{"category": row.name, "total": row.total, "count": row.count} for row in rows]

        message = format_report_message(report_data)
        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"리포트 생성 실패: {e}")
        await send_telegram_message(chat_id, format_server_error())


async def handle_budget_command(chat_id: int, db: AsyncSession):
    """예산 현황 전송

    설정된 예산과 현재 지출을 비교하여 메시지로 보냅니다.

    Args:
        chat_id: 메시지를 보낼 채팅방 ID
        db: 데이터베이스 세션
    """
    try:
        # 모든 활성 예산 조회
        budget_result = await db.execute(select(Budget))
        budgets = budget_result.scalars().all()

        if not budgets:
            await send_telegram_message(chat_id, "💵 예산 현황\n\n아직 설정된 예산이 없어요.")
            return

        budget_data = []
        now = datetime.now()

        for budget in budgets:
            # 예산 기간 내의 지출 집계
            end_date = budget.end_date if budget.end_date else now

            if budget.start_date > now:
                continue

            # 카테고리 정보
            category_result = await db.execute(select(Category).where(Category.id == budget.category_id))
            category = category_result.scalar_one_or_none()
            if not category:
                continue

            # 지출 합계
            expense_result = await db.execute(
                select(func.sum(Expense.amount))
                .where(Expense.category_id == budget.category_id)
                .where(Expense.date >= budget.start_date)
                .where(Expense.date <= end_date)
            )
            spent_amount = expense_result.scalar() or 0.0

            usage = (spent_amount / budget.amount * 100) if budget.amount > 0 else 0
            remaining = budget.amount - spent_amount

            budget_data.append(
                {
                    "category": category.name,
                    "budget": budget.amount,
                    "spent": spent_amount,
                    "remaining": remaining,
                    "usage": usage,
                }
            )

        message = format_budget_status(budget_data)
        await send_telegram_message(chat_id, message)

    except Exception as e:
        logger.error(f"예산 현황 생성 실패: {e}")
        await send_telegram_message(chat_id, format_server_error())

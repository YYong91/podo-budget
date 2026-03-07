"""Telegram Bot Webhook 라우트

Telegram 봇을 통해 자연어로 지출을 입력받고,
LLM으로 파싱하여 DB에 저장합니다.
인라인 버튼을 통한 수정/삭제, 명령어 처리도 지원합니다.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_user_active_household_id
from app.core.config import settings
from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.services.bot_messages import (
    format_budget_status,
    format_expense_saved,
    format_help_message,
    format_link_usage_message,
    format_parse_error,
    format_report_message,
    format_server_error,
    format_welcome_message,
)
from app.services.bot_user_service import get_or_create_bot_user, link_telegram_account_by_code
from app.services.category_service import get_or_create_category
from app.services.expense_context_detector import resolve_household_id
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

    Raises:
        httpx.HTTPStatusError: 429 (Rate Limit) 등 Telegram API 에러 시
    """
    import httpx

    url = f"{TELEGRAM_API.format(token=settings.TELEGRAM_BOT_TOKEN)}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code == 429:
            retry_after = resp.json().get("parameters", {}).get("retry_after", 30)
            logger.warning(f"Telegram rate limit 초과 (chat_id={chat_id}), retry_after={retry_after}s")
        elif resp.status_code >= 400:
            logger.error(f"Telegram API 에러: {resp.status_code} - {resp.text}")


@router.post("/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Telegram Webhook 엔드포인트

    Telegram이 새 메시지 또는 callback_query를 이 URL로 POST합니다.
    - 메시지: LLM으로 파싱 → DB 저장 → 결과 응답
    - callback_query: 인라인 버튼 클릭 처리 (카테고리 변경, 삭제)

    보안: TELEGRAM_WEBHOOK_SECRET 설정 시 X-Telegram-Bot-Api-Secret-Token 헤더 검증
    """
    # Webhook 시크릿 토큰 검증 (설정된 경우에만)
    if settings.TELEGRAM_WEBHOOK_SECRET:
        token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if token != settings.TELEGRAM_WEBHOOK_SECRET:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="유효하지 않은 webhook 토큰")

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

    # 봇 사용자 생성 또는 조회 (데이터 격리를 위함)
    bot_user = await get_or_create_bot_user(db, platform="telegram", platform_user_id=str(chat_id))

    # 사용자의 활성 가구 ID 조회
    active_household_id = await get_user_active_household_id(bot_user, db)

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
        await handle_report_command(chat_id, db, user_id=bot_user.id)
        return {"ok": True}

    # /budget 명령어 처리 (예산 현황)
    if user_text.startswith("/budget"):
        await handle_budget_command(chat_id, db, user_id=bot_user.id)
        return {"ok": True}

    # /link 명령어 처리 (코드 기반 연동)
    if user_text.startswith("/link"):
        parts = user_text.split()
        if len(parts) != 2:
            await send_telegram_message(chat_id, format_link_usage_message())
            return {"ok": True}
        code = parts[1].upper()
        success, message = await link_telegram_account_by_code(db, code, str(chat_id))
        await send_telegram_message(chat_id, message)
        return {"ok": True}

    # 연동 확인: 가구에 속하지 않은 봇 사용자는 저장 불가
    if active_household_id is None and bot_user.username and bot_user.username.startswith("telegram_"):
        await send_telegram_message(
            chat_id,
            "⚠️ 포도가계부 계정 연동이 필요해요!\n\n"
            "웹 설정 페이지(budget.podonest.com)에서\n"
            "텔레그램 연동 코드를 발급받아\n"
            "`/link 코드` 형식으로 입력해주세요.\n\n"
            "연동 후 지출을 기록하면 앱에서 바로 확인할 수 있어요.",
        )
        return {"ok": True}

    # LLM으로 지출 파싱
    try:
        llm = get_llm_provider("parse")
        parsed = await llm.parse_expense(user_text)

        # 자연어 컨텍스트 기반 household_id 결정
        household_id = await resolve_household_id(user_text, None, active_household_id)

        # 단일 지출 (dict) 처리
        if isinstance(parsed, dict):
            # 파싱 실패
            if "error" in parsed:
                await send_telegram_message(chat_id, format_parse_error(user_text))
                return {"ok": True}

            # 카테고리 매칭/생성 (사용자별 카테고리 관리)
            category_name = parsed.get("category", "기타")
            category = await get_or_create_category(db, category_name, user_id=bot_user.id, household_id=household_id)

            # Expense 생성 (user_id + household_id 연결)
            expense_date = datetime.fromisoformat(parsed.get("date", datetime.now().isoformat()))
            expense = Expense(
                user_id=bot_user.id,
                amount=parsed["amount"],
                description=parsed.get("description", user_text),
                category_id=category.id,
                raw_input=user_text,
                date=expense_date,
                household_id=household_id,
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
                # 카테고리 매칭/생성 (사용자별 카테고리 관리)
                category_name = item.get("category", "기타")
                category = await get_or_create_category(db, category_name, user_id=bot_user.id, household_id=household_id)

                # Expense 생성 (user_id + household_id 연결)
                expense_date = datetime.fromisoformat(item.get("date", datetime.now().isoformat()))
                expense = Expense(
                    user_id=bot_user.id,
                    amount=item["amount"],
                    description=item.get("description", ""),
                    category_id=category.id,
                    raw_input=user_text,
                    date=expense_date,
                    household_id=household_id,
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
                message_lines.append(f"{idx}. 💰 {item['amount']:,.0f}원 - 📂 {item.get('category', '기타')} - {item.get('description', '')}")

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

    보안: chat_id로 봇 사용자를 조회하여 지출 소유권을 검증합니다.

    Args:
        callback_query: Telegram callback_query 객체
        db: 데이터베이스 세션
    """

    callback_id = callback_query["id"]
    chat_id = callback_query["message"]["chat"]["id"]
    callback_data = callback_query["data"]

    try:
        # callback_data 파싱 (형식: action:expense_id 또는 action:expense_id:extra)
        parts = callback_data.split(":", 2)
        action = parts[0]

        # set_category는 별도 처리 (3개 파트: set_category:expense_id:category_info)
        if action == "set_category":
            if len(parts) < 3:
                await answer_callback_query(callback_id, "잘못된 요청입니다.")
                return {"ok": True}
            expense_id = int(parts[1])
            category_info = parts[2]
        else:
            expense_id = int(parts[1])

        # 지출 조회
        result = await db.execute(select(Expense).where(Expense.id == expense_id))
        expense = result.scalar_one_or_none()

        if not expense:
            await answer_callback_query(callback_id, "지출을 찾을 수 없어요.")
            return {"ok": True}

        # 소유권 검증: chat_id로 봇 사용자를 조회하여 지출의 소유자인지 확인
        bot_user = await get_or_create_bot_user(db, platform="telegram", platform_user_id=str(chat_id))
        if expense.user_id != bot_user.id:
            await answer_callback_query(callback_id, "본인의 지출만 수정할 수 있어요.")
            return {"ok": True}

        if action == "delete_expense":
            # 삭제 확인 프롬프트 (2단계: 먼저 확인 → 실제 삭제)
            await answer_callback_query(callback_id, "삭제 확인이 필요합니다.")
            confirm_keyboard = {
                "inline_keyboard": [
                    [
                        {"text": "✅ 삭제 확인", "callback_data": f"confirm_delete:{expense.id}"},
                        {"text": "❌ 취소", "callback_data": f"cancel_delete:{expense.id}"},
                    ]
                ]
            }
            await send_telegram_message(
                chat_id,
                f"🗑️ 정말 삭제하시겠어요?\n\n💰 {expense.amount:,.0f}원 - {expense.description}",
                reply_markup=confirm_keyboard,
            )

        elif action == "confirm_delete":
            # 실제 삭제 수행
            amount = expense.amount
            await db.delete(expense)
            await db.commit()
            await answer_callback_query(callback_id, "삭제되었습니다!")
            await send_telegram_message(chat_id, f"✅ {amount:,.0f}원 지출이 삭제되었어요.")

        elif action == "cancel_delete":
            # 삭제 취소
            await answer_callback_query(callback_id, "삭제가 취소되었습니다.")
            await send_telegram_message(chat_id, "↩️ 삭제가 취소되었어요.")

        elif action == "change_category":
            # 카테고리 선택 인라인 키보드 표시
            await answer_callback_query(callback_id, "카테고리를 선택해주세요.")

            # 카테고리 목록 조회 (시스템 + 가계/솔로 3-scope)
            _cat_conditions = [
                and_(Category.household_id.is_(None), Category.user_id.is_(None)),
                and_(Category.user_id == expense.user_id, Category.household_id.is_(None)),
            ]
            if expense.household_id is not None:
                _cat_conditions.append(Category.household_id == expense.household_id)
            cat_result = await db.execute(select(Category).where(or_(*_cat_conditions)).order_by(Category.name).limit(8))
            categories = cat_result.scalars().all()

            if not categories:
                categories_keyboard = [[{"text": "기타", "callback_data": f"set_category:{expense_id}:기타"}]]
            else:
                # 2열 그리드로 카테고리 버튼 배치
                buttons = [{"text": cat.name, "callback_data": f"set_category:{expense_id}:{cat.id}"} for cat in categories]
                categories_keyboard = [buttons[i : i + 2] for i in range(0, len(buttons), 2)]

            await send_telegram_message(
                chat_id,
                f"📂 {expense.amount:,.0f}원 지출의 카테고리를 선택해주세요:",
                reply_markup={"inline_keyboard": categories_keyboard},
            )

        elif action == "set_category":
            # 카테고리 실제 변경 (callback_data: set_category:expense_id:category_id_or_name)
            if category_info.isdigit():
                new_category_id = int(category_info)
                cat_result = await db.execute(select(Category).where(Category.id == new_category_id))
                new_category = cat_result.scalar_one_or_none()
                if not new_category:
                    await answer_callback_query(callback_id, "카테고리를 찾을 수 없어요.")
                    return {"ok": True}
            else:
                new_category = await get_or_create_category(db, category_info, user_id=expense.user_id, household_id=expense.household_id)

            expense.category_id = new_category.id
            await db.commit()
            await answer_callback_query(callback_id, f"'{new_category.name}'으로 변경!")
            await send_telegram_message(chat_id, f"✅ 카테고리가 '{new_category.name}'으로 변경되었어요.")

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


async def handle_report_command(chat_id: int, db: AsyncSession, user_id: int):
    """이번 달 지출 요약 리포트 전송

    카테고리별 지출 합계와 건수를 집계하여 메시지로 보냅니다.
    사용자별로 데이터를 격리하여 조회합니다.

    Args:
        chat_id: 메시지를 보낼 채팅방 ID
        db: 데이터베이스 세션
        user_id: 조회할 사용자 ID
    """
    try:
        # 이번 달 1일부터 현재까지 지출 집계 (해당 사용자만)
        now = datetime.now()
        result = await db.execute(
            select(
                Category.name,
                func.sum(Expense.amount).label("total"),
                func.count(Expense.id).label("count"),
            )
            .join(Category, Expense.category_id == Category.id)
            .where(Expense.user_id == user_id)
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


async def handle_budget_command(chat_id: int, db: AsyncSession, user_id: int):
    """예산 현황 전송

    설정된 예산과 현재 지출을 비교하여 메시지로 보냅니다.
    사용자별로 데이터를 격리하여 조회합니다.

    Args:
        chat_id: 메시지를 보낼 채팅방 ID
        db: 데이터베이스 세션
        user_id: 조회할 사용자 ID
    """
    try:
        # 해당 사용자의 활성 예산 조회
        budget_result = await db.execute(select(Budget).where(Budget.user_id == user_id))
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

            # 지출 합계 (해당 사용자만)
            expense_result = await db.execute(
                select(func.sum(Expense.amount))
                .where(Expense.user_id == user_id)
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

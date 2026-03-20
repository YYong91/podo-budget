"""Telegram Bot Webhook 라우트

Telegram 봇을 통해 자연어로 지출을 입력받고,
LLM으로 파싱하여 DB에 저장합니다.
인라인 버튼을 통한 수정/삭제, 명령어 처리도 지원합니다.

카테고리 확인 플로우:
- LLM이 제안한 카테고리가 기존에 없으면 사용자에게 확인 요청
- 기존 카테고리 목록을 보여주고 선택하거나 새로 등록 가능
- 선택한 매핑을 기억하여 다음부터 자동 적용
"""

import logging
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_user_active_household_id_or_none
from app.core.config import settings
from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.income import Income
from app.services.bot_messages import (
    format_budget_status,
    format_expense_saved,
    format_help_message,
    format_income_saved,
    format_link_usage_message,
    format_parse_error,
    format_report_message,
    format_server_error,
    format_welcome_message,
)
from app.services.bot_user_service import get_or_create_bot_user, link_telegram_account_by_code
from app.services.category_hint_service import get_category_hints, get_user_categories
from app.services.category_mapping_service import get_mapped_category, save_category_mapping
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


async def _check_category_exists(
    db: AsyncSession,
    category_name: str,
    user_id: int | None,
    household_id: int | None,
) -> bool:
    """카테고리가 사용자의 기존 목록에 있는지 확인"""
    from app.services.category_service import _build_scope_filter

    scope_filter = _build_scope_filter(user_id, household_id)
    result = await db.execute(select(Category).where(Category.name == category_name, scope_filter))
    return result.scalar_one_or_none() is not None


async def _get_accessible_categories(
    db: AsyncSession,
    user_id: int,
    household_id: int | None,
) -> list[Category]:
    """사용자가 접근 가능한 카테고리 목록 (사용 빈도 순 정렬)"""
    conditions = [
        and_(Category.household_id.is_(None), Category.user_id.is_(None)),
        and_(Category.user_id == user_id, Category.household_id.is_(None)),
    ]
    if household_id is not None:
        conditions.append(Category.household_id == household_id)

    result = await db.execute(
        select(Category)
        .outerjoin(Expense, and_(Expense.category_id == Category.id, Expense.user_id == user_id))
        .where(or_(*conditions))
        .group_by(Category.id)
        .order_by(func.count(Expense.id).desc(), Category.name)
    )
    return list(result.scalars().all())


async def _resolve_category(
    db: AsyncSession,
    category_name: str,
    user_id: int,
    household_id: int | None,
) -> Category | None:
    """카테고리 매핑 → 기존 카테고리 순서로 검색. 매칭되면 Category 반환, 확인 필요 시 None"""
    # 1. 저장된 매핑이 있으면 적용 (예: "식비" → "외식비")
    mapped = await get_mapped_category(db, category_name, user_id=user_id, household_id=household_id)
    if mapped:
        return mapped

    # 2. 기존 카테고리에 있으면 그대로 사용
    exists = await _check_category_exists(db, category_name, user_id, household_id)
    if exists:
        return await get_or_create_category(db, category_name, user_id=user_id, household_id=household_id)

    # 3. 기존에도 없고 매핑도 없음 → 확인 필요
    return None


async def _save_and_respond_single(
    db: AsyncSession,
    chat_id: int,
    bot_user: Any,
    parsed: dict,
    household_id: int | None,
    category: Category,
    user_text: str,
) -> None:
    """단일 수입/지출을 저장하고 응답 메시지 전송"""
    item_type = parsed.get("type", "expense")
    record_date = datetime.fromisoformat(parsed.get("date", datetime.now().isoformat()))
    record_kwargs = {
        "user_id": bot_user.id,
        "amount": parsed["amount"],
        "description": parsed.get("description", user_text),
        "category_id": category.id,
        "raw_input": user_text,
        "date": record_date,
        "household_id": household_id,
    }

    if item_type == "income":
        record = Income(**record_kwargs)
        db.add(record)
        await db.commit()
        await db.refresh(record)
        # 수입은 카테고리 변경 대신 삭제만 제공
        inline_keyboard = {"inline_keyboard": [[{"text": "🗑️ 삭제", "callback_data": f"delete_income:{record.id}"}]]}
        await send_telegram_message(
            chat_id,
            format_income_saved(
                amount=parsed["amount"],
                category=category.name,
                description=parsed.get("description", user_text),
                date=record_date.strftime("%Y-%m-%d"),
            ),
            reply_markup=inline_keyboard,
        )
        return

    # 지출 (기본)
    record = Expense(**record_kwargs)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    inline_keyboard = {
        "inline_keyboard": [
            [
                {"text": "🔄 카테고리 변경", "callback_data": f"change_category:{record.id}"},
                {"text": "🗑️ 삭제", "callback_data": f"delete_expense:{record.id}"},
            ]
        ]
    }
    await send_telegram_message(
        chat_id,
        format_expense_saved(
            amount=parsed["amount"],
            category=category.name,
            description=parsed.get("description", user_text),
            date=record_date.strftime("%Y-%m-%d"),
        ),
        reply_markup=inline_keyboard,
    )


def _build_expense_saved_keyboard(expense_id: int) -> dict:
    """지출 저장 후 수정/삭제 인라인 키보드 생성"""
    return {
        "inline_keyboard": [
            [
                {"text": "🔄 카테고리 변경", "callback_data": f"change_category:{expense_id}"},
                {"text": "🗑️ 삭제", "callback_data": f"delete_expense:{expense_id}"},
            ]
        ]
    }


# ---------------------------------------------------------------------------
# telegram_webhook: 슬래시 명령어 디스패치
# ---------------------------------------------------------------------------


async def _handle_start_command(chat_id: int, user_text: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/start`` 명령어 처리"""
    await send_telegram_message(chat_id, format_welcome_message())
    return {"ok": True}


async def _handle_help_command(chat_id: int, user_text: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/help`` 명령어 처리"""
    await send_telegram_message(chat_id, format_help_message())
    return {"ok": True}


async def _handle_report_command(chat_id: int, user_text: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/report`` 명령어 처리"""
    await handle_report_command(chat_id, db, household_id=active_household_id)
    return {"ok": True}


async def _handle_budget_command(chat_id: int, user_text: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/budget`` 명령어 처리"""
    await handle_budget_command(chat_id, db, household_id=active_household_id)
    return {"ok": True}


async def _handle_link_command(chat_id: int, user_text: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/link`` 명령어 처리 (코드 기반 연동)"""
    parts = user_text.split()
    if len(parts) != 2:
        await send_telegram_message(chat_id, format_link_usage_message())
        return {"ok": True}
    code = parts[1].upper()
    success, message = await link_telegram_account_by_code(db, code, str(chat_id))
    await send_telegram_message(chat_id, message)
    return {"ok": True}


# 슬래시 명령어 디스패치 테이블
# 키: 명령어 prefix, 값: (핸들러 함수)
# 핸들러 시그니처: (chat_id, user_text, bot_user, db, active_household_id) -> dict
_COMMAND_HANDLERS: dict[
    str,
    Callable[[int, str, Any, AsyncSession, int | None], Awaitable[dict]],
] = {
    "/start": _handle_start_command,
    "/help": _handle_help_command,
    "/report": _handle_report_command,
    "/budget": _handle_budget_command,
    "/link": _handle_link_command,
}


async def _handle_expense_input(chat_id: int, user_text: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> None:
    """자연어 지출 입력 → LLM 파싱 → DB 저장"""
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
        return

    try:
        llm = get_llm_provider("parse")

        # 사용자 카테고리 목록 + 히스토리 힌트 + 매핑 로드 (정확도 향상)
        household_id = await resolve_household_id(user_text, None, active_household_id)
        user_categories = await get_user_categories(db, bot_user.id, household_id)
        history_hints = await get_category_hints(db, bot_user.id, household_id)

        # 카테고리 매핑 로드 (예: "식비" → "외식비")
        from app.services.category_mapping_service import get_category_mappings_for_prompt

        cat_mappings = await get_category_mappings_for_prompt(db, user_id=bot_user.id, household_id=household_id)

        parsed = await llm.parse_expense(user_text, categories=user_categories, history_hints=history_hints, category_mappings=cat_mappings)

        # 단일 지출 (dict) 처리
        if isinstance(parsed, dict):
            await _handle_single_expense_parsed(db, chat_id, bot_user, parsed, household_id, user_text)

        # 여러 지출 (list) 처리
        elif isinstance(parsed, list):
            await _handle_multiple_expenses(db, chat_id, bot_user, parsed, household_id, user_text)

    except Exception as e:
        logger.error(f"Telegram webhook 처리 실패: {e}")
        await send_telegram_message(chat_id, format_server_error())


async def _handle_single_expense_parsed(
    db: AsyncSession,
    chat_id: int,
    bot_user: Any,
    parsed: dict,
    household_id: int | None,
    user_text: str,
) -> None:
    """단일 파싱 결과 처리: 에러 / 카테고리 확인 / 바로 저장 분기"""
    if "error" in parsed:
        await send_telegram_message(chat_id, format_parse_error(user_text))
        return

    category_name = parsed.get("category", "기타")
    category = await _resolve_category(db, category_name, bot_user.id, household_id)

    if category:
        await _save_and_respond_single(db, chat_id, bot_user, parsed, household_id, category, user_text)
    else:
        await _ask_category_confirmation(db, chat_id, bot_user.id, parsed, household_id, category_name, user_text)


@router.post("/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Telegram Webhook 엔드포인트

    Telegram이 새 메시지 또는 callback_query를 이 URL로 POST합니다.
    - 메시지: LLM으로 파싱 → 카테고리 확인 → DB 저장 → 결과 응답
    - callback_query: 인라인 버튼 클릭 처리 (카테고리 변경, 삭제, 확인)

    보안: TELEGRAM_WEBHOOK_SECRET 설정 시 X-Telegram-Bot-Api-Secret-Token 헤더 검증
    """
    # 봇 토큰이 활성화된 경우 시크릿도 반드시 설정되어야 함
    # 미설정 시 누구나 webhook을 호출하여 LLM 비용 발생 및 임의 데이터 생성 가능
    if settings.TELEGRAM_BOT_TOKEN and not settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook 시크릿이 설정되지 않았습니다")
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

    # 사용자의 활성 가구 ID 조회 (봇은 미연동 사용자를 별도 처리해야 하므로 or_none 사용)
    active_household_id = await get_user_active_household_id_or_none(bot_user, db)

    # 슬래시 명령어 디스패치
    for prefix, handler in _COMMAND_HANDLERS.items():
        if user_text.startswith(prefix):
            return await handler(chat_id, user_text, bot_user, db, active_household_id)

    # 자연어 지출 입력 처리
    await _handle_expense_input(chat_id, user_text, bot_user, db, active_household_id)
    return {"ok": True}


async def _ask_category_confirmation(
    db: AsyncSession,
    chat_id: int,
    user_id: int,
    parsed: dict,
    household_id: int | None,
    suggested_category: str,
    raw_input: str,
) -> None:
    """LLM이 제안한 카테고리가 기존에 없을 때 사용자에게 확인 요청

    기존 카테고리 목록을 인라인 키보드로 보여주고,
    "새로 등록" 옵션도 함께 제공합니다.
    """
    # 기존 카테고리 목록 (사용 빈도순)
    categories = await _get_accessible_categories(db, user_id, household_id)

    # Telegram 콜백 데이터 크기 제한(64바이트) 때문에 임시 Expense를 만들어서 ID로 참조
    expense_date = datetime.fromisoformat(parsed.get("date", datetime.now().isoformat()))

    # "기타" 카테고리로 임시 저장 (확인 후 변경 예정)
    temp_category = await get_or_create_category(db, "기타", user_id=user_id, household_id=household_id)
    temp_expense = Expense(
        user_id=user_id,
        amount=parsed["amount"],
        description=parsed.get("description", raw_input),
        category_id=temp_category.id,
        raw_input=raw_input,
        date=expense_date,
        household_id=household_id,
    )
    db.add(temp_expense)
    await db.commit()
    await db.refresh(temp_expense)

    # 인라인 키보드: 기존 카테고리 + 새로 등록 버튼
    # confirm_cat:{expense_id}:{category_id}:{suggested_category} 형식
    buttons = []
    for cat in categories:
        callback_data = f"confirm_cat:{temp_expense.id}:{cat.id}:{suggested_category}"
        # Telegram 콜백 데이터 64바이트 제한 체크
        if len(callback_data.encode("utf-8")) <= 64:
            buttons.append({"text": cat.name, "callback_data": callback_data})

    # 2열 그리드 배치
    keyboard_rows = [buttons[i : i + 2] for i in range(0, len(buttons), 2)]

    # "새로 등록" 버튼 (LLM이 제안한 이름으로 새 카테고리 생성)
    new_cat_callback = f"new_cat:{temp_expense.id}:{suggested_category}"
    if len(new_cat_callback.encode("utf-8")) <= 64:
        keyboard_rows.append([{"text": f"➕ '{suggested_category}' 새로 등록", "callback_data": new_cat_callback}])

    # 메시지: 파싱 결과 + 카테고리 선택 요청
    msg = f"💰 {parsed['amount']:,.0f}원 - {parsed.get('description', raw_input)}\n\n🤔 '{suggested_category}' 카테고리가 없어요.\n어떤 카테고리에 넣을까요?"

    await send_telegram_message(
        chat_id,
        msg,
        reply_markup={"inline_keyboard": keyboard_rows},
    )


async def _handle_multiple_expenses(
    db: AsyncSession,
    chat_id: int,
    bot_user: Any,
    parsed: list,
    household_id: int | None,
    user_text: str,
) -> None:
    """여러 건 처리 — 수입/지출 혼합 지원"""
    created_records = []  # (record, item, category_name)

    for item in parsed:
        item_type = item.get("type", "expense")
        category_name = item.get("category", "기타")
        category = await _resolve_category(db, category_name, bot_user.id, household_id)

        if not category:
            category = await get_or_create_category(db, category_name, user_id=bot_user.id, household_id=household_id)

        record_date = datetime.fromisoformat(item.get("date", datetime.now().isoformat()))
        record_kwargs = {
            "user_id": bot_user.id,
            "amount": item["amount"],
            "description": item.get("description", ""),
            "category_id": category.id,
            "raw_input": user_text,
            "date": record_date,
            "household_id": household_id,
        }

        record = Income(**record_kwargs) if item_type == "income" else Expense(**record_kwargs)
        db.add(record)
        created_records.append((record, item, category.name))

    await db.commit()

    # 응답 메시지 생성
    total_amount = sum(item["amount"] for _, item, _ in created_records)
    expense_count = sum(1 for _, item, _ in created_records if item.get("type", "expense") != "income")
    income_count = sum(1 for _, item, _ in created_records if item.get("type") == "income")

    parts = []
    if expense_count > 0:
        parts.append(f"지출 {expense_count}건")
    if income_count > 0:
        parts.append(f"수입 {income_count}건")

    message_lines = [f"✅ {' + '.join(parts)}(총 ₩{total_amount:,.0f}) 기록했어요\n"]

    for idx, (_, item, cat_name) in enumerate(created_records, 1):
        type_icon = "💵" if item.get("type") == "income" else "💰"
        message_lines.append(f"{idx}. {type_icon} {item['amount']:,.0f}원 - 📂 {cat_name} - {item.get('description', '')}")

    await send_telegram_message(chat_id, "\n".join(message_lines))


# ---------------------------------------------------------------------------
# handle_callback_query: 콜백 액션 디스패치
# ---------------------------------------------------------------------------


async def _handle_confirm_cat(db: AsyncSession, chat_id: int, callback_id: str, expense: Expense, bot_user: Any, parts: list[str]) -> dict:
    """사용자가 기존 카테고리를 선택 → 카테고리 변경 + 매핑 저장"""
    category_id = int(parts[2])
    suggested_category = parts[3]

    cat_result = await db.execute(select(Category).where(Category.id == category_id))
    selected_category = cat_result.scalar_one_or_none()
    if not selected_category:
        await answer_callback_query(callback_id, "카테고리를 찾을 수 없어요.")
        return {"ok": True}

    expense.category_id = selected_category.id
    await db.flush()

    # 매핑 저장: 다음부터 같은 이름은 자동 적용
    if suggested_category != selected_category.name:
        await save_category_mapping(
            db,
            source_name=suggested_category,
            target_category_id=selected_category.id,
            user_id=bot_user.id if expense.household_id is None else None,
            household_id=expense.household_id,
        )

    await db.commit()
    await answer_callback_query(callback_id, f"'{selected_category.name}'으로 저장!")

    await send_telegram_message(
        chat_id,
        format_expense_saved(
            amount=float(expense.amount),
            category=selected_category.name,
            description=expense.description,
            date=expense.date.strftime("%Y-%m-%d"),
        ),
        reply_markup=_build_expense_saved_keyboard(expense.id),
    )
    return {"ok": True}


async def _handle_new_cat(db: AsyncSession, chat_id: int, callback_id: str, expense: Expense, bot_user: Any, parts: list[str]) -> dict:
    """새 카테고리로 등록"""
    new_category_name = parts[2]
    new_category = await get_or_create_category(db, new_category_name, user_id=bot_user.id, household_id=expense.household_id)
    expense.category_id = new_category.id
    await db.commit()
    await answer_callback_query(callback_id, f"'{new_category_name}' 카테고리 생성!")

    await send_telegram_message(
        chat_id,
        format_expense_saved(
            amount=float(expense.amount),
            category=new_category.name,
            description=expense.description,
            date=expense.date.strftime("%Y-%m-%d"),
        ),
        reply_markup=_build_expense_saved_keyboard(expense.id),
    )
    return {"ok": True}


async def _handle_delete_expense(db: AsyncSession, chat_id: int, callback_id: str, expense: Expense, bot_user: Any, parts: list[str]) -> dict:
    """삭제 확인 프롬프트 (2단계: 먼저 확인 → 실제 삭제)"""
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
    return {"ok": True}


async def _handle_confirm_delete(db: AsyncSession, chat_id: int, callback_id: str, expense: Expense, bot_user: Any, parts: list[str]) -> dict:
    """실제 삭제 수행"""
    amount = expense.amount
    await db.delete(expense)
    await db.commit()
    await answer_callback_query(callback_id, "삭제되었습니다!")
    await send_telegram_message(chat_id, f"✅ {amount:,.0f}원 지출이 삭제되었어요.")
    return {"ok": True}


async def _handle_cancel_delete(db: AsyncSession, chat_id: int, callback_id: str, expense: Expense, bot_user: Any, parts: list[str]) -> dict:
    """삭제 취소"""
    await answer_callback_query(callback_id, "삭제가 취소되었습니다.")
    await send_telegram_message(chat_id, "↩️ 삭제가 취소되었어요.")
    return {"ok": True}


async def _handle_change_category(db: AsyncSession, chat_id: int, callback_id: str, expense: Expense, bot_user: Any, parts: list[str]) -> dict:
    """카테고리 선택 인라인 키보드 표시"""
    await answer_callback_query(callback_id, "카테고리를 선택해주세요.")

    expense_id = expense.id
    categories = await _get_accessible_categories(db, expense.user_id, expense.household_id)

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
    return {"ok": True}


async def _handle_set_category(db: AsyncSession, chat_id: int, callback_id: str, expense: Expense, bot_user: Any, parts: list[str]) -> dict:
    """카테고리 실제 변경 (callback_data: set_category:expense_id:category_id_or_name)"""
    category_info = parts[2]
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
    return {"ok": True}


# 콜백 액션 디스패치 테이블
# 키: action prefix, 값: (핸들러 함수, 최소 parts 수)
_CALLBACK_HANDLERS: dict[
    str,
    tuple[
        Callable[[AsyncSession, int, str, Expense, Any, list[str]], Awaitable[dict]],
        int,
    ],
] = {
    "confirm_cat": (_handle_confirm_cat, 4),
    "new_cat": (_handle_new_cat, 3),
    "delete_expense": (_handle_delete_expense, 2),
    "confirm_delete": (_handle_confirm_delete, 2),
    "cancel_delete": (_handle_cancel_delete, 2),
    "change_category": (_handle_change_category, 2),
    "set_category": (_handle_set_category, 3),
}


async def handle_callback_query(callback_query: dict, db: AsyncSession) -> dict:
    """인라인 버튼 클릭 처리

    callback_data 형식:
    - change_category:{expense_id} -- 카테고리 변경
    - delete_expense:{expense_id} -- 지출 삭제
    - confirm_cat:{expense_id}:{category_id}:{suggested} -- 카테고리 확인 (기존 선택)
    - new_cat:{expense_id}:{category_name} -- 새 카테고리로 등록

    보안: chat_id로 봇 사용자를 조회하여 지출 소유권을 검증합니다.

    Args:
        callback_query: Telegram callback_query 객체
        db: 데이터베이스 세션
    """
    callback_id = callback_query["id"]
    chat_id = callback_query["message"]["chat"]["id"]
    callback_data = callback_query["data"]

    try:
        parts = callback_data.split(":", 3)
        action = parts[0]

        handler_entry = _CALLBACK_HANDLERS.get(action)
        if not handler_entry:
            await answer_callback_query(callback_id, "알 수 없는 요청입니다.")
            return {"ok": True}

        handler_fn, min_parts = handler_entry
        if len(parts) < min_parts:
            await answer_callback_query(callback_id, "잘못된 요청입니다.")
            return {"ok": True}

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

        return await handler_fn(db, chat_id, callback_id, expense, bot_user, parts)

    except Exception as e:
        logger.error(f"Callback query 처리 실패: {e}")
        await answer_callback_query(callback_id, "오류가 발생했습니다.")

    return {"ok": True}


async def answer_callback_query(callback_id: str, text: str) -> None:
    """Callback query 응답 (버튼 클릭 시 알림 팝업)

    Args:
        callback_id: callback_query의 ID
        text: 표시할 메시지
    """
    import httpx

    url = f"{TELEGRAM_API.format(token=settings.TELEGRAM_BOT_TOKEN)}/answerCallbackQuery"
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(url, json={"callback_query_id": callback_id, "text": text})


async def handle_report_command(chat_id: int, db: AsyncSession, household_id: int | None) -> None:
    """이번 달 지출 요약 리포트 전송

    카테고리별 지출 합계와 건수를 집계하여 메시지로 보냅니다.
    가구 단위로 데이터를 조회합니다 (웹 리포트와 동일한 스코프).

    Args:
        chat_id: 메시지를 보낼 채팅방 ID
        db: 데이터베이스 세션
        household_id: 조회할 가구 ID
    """
    if household_id is None:
        await send_telegram_message(chat_id, "🏠 가구 설정이 필요합니다.\n웹에서 계정을 연동해주세요.")
        return

    try:
        # 이번 달 1일부터 현재까지 지출 집계 (가구 단위)
        now = datetime.now()
        result = await db.execute(
            select(
                Category.name,
                func.sum(Expense.amount).label("total"),
                func.count(Expense.id).label("count"),
            )
            .join(Category, Expense.category_id == Category.id)
            .where(Expense.household_id == household_id)
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


async def handle_budget_command(chat_id: int, db: AsyncSession, household_id: int | None) -> None:
    """예산 현황 전송

    설정된 예산과 현재 지출을 비교하여 메시지로 보냅니다.
    가구 단위로 데이터를 조회합니다 (웹 리포트와 동일한 스코프).

    Args:
        chat_id: 메시지를 보낼 채팅방 ID
        db: 데이터베이스 세션
        household_id: 조회할 가구 ID
    """
    if household_id is None:
        await send_telegram_message(chat_id, "🏠 가구 설정이 필요합니다.\n웹에서 계정을 연동해주세요.")
        return

    try:
        # 해당 가구의 활성 예산 조회
        budget_result = await db.execute(select(Budget).where(Budget.household_id == household_id))
        budgets = budget_result.scalars().all()

        if not budgets:
            await send_telegram_message(chat_id, "💵 예산 현황\n\n아직 설정된 예산이 없어요.")
            return

        budget_data = []
        now = datetime.now()

        # Budget + Category JOIN으로 카테고리 개별 조회 제거 (N번 → 0번, #168)
        budget_cat_result = await db.execute(
            select(Budget, Category).join(Category, Budget.category_id == Category.id).where(Budget.household_id == household_id)
        )
        budget_cats = budget_cat_result.all()

        for budget, category in budget_cats:
            end_date = budget.end_date if budget.end_date else now

            if budget.start_date > now:
                continue

            # 지출 합계 (예산별 날짜 범위가 다르므로 개별 집계 유지)
            expense_result = await db.execute(
                select(func.sum(Expense.amount))
                .where(Expense.household_id == household_id)
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

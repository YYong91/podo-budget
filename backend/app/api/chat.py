"""채팅 API 라우트 - 자연어 지출/수입 입력 처리

사용자별로 자연어 입력을 처리하여 지출 또는 수입을 생성합니다.
LLM이 type=income을 반환하면 Income 모델에, 그 외에는 Expense 모델에 저장됩니다.

공유 가계부(Household) 연동:
- household_id가 있으면 해당 가구의 공유 데이터로 기록
- 없으면 사용자의 활성 가구를 자동 감지

Preview 모드:
- preview=True이면 LLM 파싱 결과만 반환 (DB 저장 안 함)
- 프론트엔드에서 결과 확인/수정 후 일반 모드로 최종 저장

Rate Limiting:
- 사용자당 분당 10회로 제한 (LLM API 호출 보호)
"""

import asyncio
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.api.payment_methods import get_default_payment_method_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.expense import Expense
from app.models.income import Income
from app.models.payment_method import PaymentMethod
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, ParsedExpenseItem
from app.schemas.expense import ExpenseResponse
from app.schemas.income import IncomeResponse
from app.services.category_hint_service import get_category_hints, get_user_categories
from app.services.category_service import get_or_create_category
from app.services.exchange_rate import get_exchange_rate
from app.services.llm_service import get_llm_provider

router = APIRouter()


async def _to_parsed_items(
    parsed: dict[str, Any] | list[dict[str, Any]],
    household_id: int | None = None,
    payment_method_map: dict[str, int] | None = None,
) -> list[ParsedExpenseItem]:
    """LLM 파싱 결과를 ParsedExpenseItem 리스트로 변환 (외화 환율 변환 + 결제수단 매칭 포함)"""
    items = [parsed] if isinstance(parsed, dict) else parsed
    result = []
    for item in items:
        currency = item.get("currency")
        original_amount = item.get("original_amount")
        amount = item["amount"]
        exchange_rate = None

        # 외화인 경우 실시간 환율 변환
        if currency and currency != "KRW":
            rate = await get_exchange_rate(currency)
            if rate:
                exchange_rate = rate
                original_amount = amount
                amount = round(amount * rate)

        # 결제수단 이름 → ID 매칭
        payment_method_name = item.get("payment_method")
        payment_method_id = None
        if payment_method_name and payment_method_map:
            payment_method_id = payment_method_map.get(payment_method_name)

        result.append(
            ParsedExpenseItem(
                amount=amount,
                description=item.get("description", ""),
                category=item.get("category", "기타"),
                date=item.get("date", datetime.now().strftime("%Y-%m-%d")),
                memo=item.get("memo", ""),
                household_id=household_id,
                type=item.get("type", "expense"),
                payment_method=payment_method_name,
                payment_method_id=payment_method_id,
                currency=currency,
                original_amount=original_amount,
                exchange_rate=exchange_rate,
            )
        )
    return result


async def _handle_preview(
    parsed: dict[str, Any] | list[dict[str, Any]],
    household_id: int,
    payment_method_map: dict[str, int] | None = None,
) -> ChatResponse:
    """Preview 모드: LLM 파싱 결과만 반환 (DB 저장 안 함)"""
    parsed_items = await _to_parsed_items(parsed, household_id=household_id, payment_method_map=payment_method_map)
    count = len(parsed_items)
    total = sum(item.amount for item in parsed_items)
    income_count = sum(1 for item in parsed_items if item.type == "income")
    expense_count = count - income_count

    parts = []
    if expense_count > 0:
        parts.append(f"지출 {expense_count}건")
    if income_count > 0:
        parts.append(f"수입 {income_count}건")

    # 외화 변환 정보 추가
    fx_info = ""
    fx_items = [i for i in parsed_items if i.currency]
    if fx_items:
        fx_parts = [f"{i.currency} {i.original_amount:g} → ₩{i.amount:,.0f} (환율 {i.exchange_rate:,.2f})" for i in fx_items if i.exchange_rate]
        if fx_parts:
            fx_info = " [" + ", ".join(fx_parts) + "]"

    return ChatResponse(
        message=f"{'과 '.join(parts)}(총 ₩{total:,.0f})을 인식했습니다.{fx_info} 확인 후 저장해주세요.",
        expenses_created=None,
        incomes_created=None,
        parsed_items=parsed_items,
        parsed_expenses=parsed_items,  # 하위 호환
        insights=None,
    )


async def _save_and_respond(
    parsed: dict[str, Any] | list[dict[str, Any]],
    message: str,
    household_id: int,
    current_user: User,
    db: AsyncSession,
    payment_method_map: dict[str, int] | None = None,
    default_payment_method_id: int | None = None,
) -> ChatResponse:
    """일반 모드: LLM 파싱 결과를 DB에 저장하고 응답 생성"""
    items = [parsed] if isinstance(parsed, dict) else parsed
    created_expenses: list[Expense] = []
    created_incomes: list[Income] = []
    saved_amounts: list[int] = []  # 실제 저장된 금액 (외화 환율 변환 후)

    for item in items:
        item_type = item.get("type", "expense")
        category = await get_or_create_category(db, item.get("category", "기타"), current_user.id, household_id)  # type: ignore[arg-type]

        # 외화 환율 변환
        amount = item["amount"]
        currency = item.get("currency")
        memo = item.get("memo", "")
        if currency and currency != "KRW":
            rate = await get_exchange_rate(currency)
            if rate:
                original = amount
                amount = round(amount * rate)
                currency_memo = f"{currency} {original:g} (환율 {rate:,.2f})"
                memo = f"{memo}, {currency_memo}" if memo else currency_memo

        saved_amounts.append(amount)

        # 결제수단 매칭: LLM 파싱 → 이름 매칭 → 기본값 폴백
        pm_name = item.get("payment_method")
        pm_id = None
        if pm_name and payment_method_map:
            pm_id = payment_method_map.get(pm_name)
        if pm_id is None and item_type != "income":
            pm_id = default_payment_method_id

        record_kwargs: dict[str, Any] = {
            "user_id": current_user.id,
            "household_id": household_id,
            "amount": amount,
            "description": item.get("description", message),
            "category_id": category.id,
            "raw_input": message,
            "memo": memo if memo else None,
            "date": datetime.fromisoformat(item.get("date", datetime.now().isoformat())),
        }

        if item_type == "income":
            record = Income(**record_kwargs)
            db.add(record)
            created_incomes.append(record)
        else:
            record_kwargs["payment_method_id"] = pm_id
            record = Expense(**record_kwargs)
            db.add(record)
            created_expenses.append(record)

    await db.commit()
    for r in created_expenses + created_incomes:
        await db.refresh(r)

    # 응답 메시지 생성
    msg = _build_result_message(items, saved_amounts, created_expenses, created_incomes)

    return ChatResponse(
        message=msg,
        expenses_created=[ExpenseResponse.model_validate(exp) for exp in created_expenses] if created_expenses else None,
        incomes_created=[IncomeResponse.model_validate(inc) for inc in created_incomes] if created_incomes else None,
        parsed_items=None,
        parsed_expenses=None,
        insights=None,
    )


def _build_result_message(
    items: list[dict[str, Any]],
    saved_amounts: list[int],
    created_expenses: list[Expense],
    created_incomes: list[Income],
) -> str:
    """저장 완료 후 사용자에게 보여줄 메시지 생성"""
    total_amount = sum(saved_amounts)
    count = len(items)
    income_count = len(created_incomes)
    expense_count = len(created_expenses)

    if count == 1:
        item_type_label = "수입" if income_count > 0 else "지출"
        return f"₩{int(saved_amounts[0]):,}이(가) [{items[0].get('category', '기타')}] 카테고리로 {item_type_label} 기록되었습니다."

    parts = []
    if expense_count > 0:
        parts.append(f"지출 {expense_count}건")
    if income_count > 0:
        parts.append(f"수입 {income_count}건")
    return f"{' + '.join(parts)}(총 ₩{total_amount:,})이 기록되었습니다."


@router.post("", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def chat(
    request: Request,
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """채팅 인터페이스로 지출/수입 입력 및 인사이트 요청

    자연어로 입력된 내용을 LLM이 파싱하여 현재 로그인한 사용자의 지출 또는 수입으로 기록합니다.
    LLM이 type=income을 반환하면 수입으로, 그 외에는 지출로 기록됩니다.
    """
    # household_id 결정: 명시적 지정 → 활성 가구
    household_id = chat_request.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    # 가구 멤버 검증
    await get_household_member(household_id, current_user, db)

    llm = get_llm_provider("parse")

    # 4개 독립 DB 쿼리를 asyncio.gather로 병렬 실행 — 직렬 대비 레이턴시 감소 (#239)
    from sqlalchemy import select as sa_select

    from app.services.category_mapping_service import get_category_mappings_for_prompt

    async def _get_active_payment_methods() -> list[PaymentMethod]:
        result = await db.execute(
            sa_select(PaymentMethod).where(
                PaymentMethod.household_id == household_id,
                PaymentMethod.created_by == current_user.id,
                PaymentMethod.is_active == True,  # noqa: E712
            )
        )
        return list(result.scalars().all())

    user_categories, history_hints, cat_mappings, user_payment_methods = await asyncio.gather(
        get_user_categories(db, current_user.id, household_id),  # type: ignore[arg-type]
        get_category_hints(db, current_user.id, household_id),  # type: ignore[arg-type]
        get_category_mappings_for_prompt(db, user_id=current_user.id, household_id=household_id),  # type: ignore[arg-type]
        _get_active_payment_methods(),
    )

    # 결제수단 이름 → ID 매핑 (LLM 파싱 결과 매칭용)
    payment_method_map: dict[str, int] = {pm.name: pm.id for pm in user_payment_methods}  # type: ignore[misc]
    payment_method_names = list(payment_method_map.keys()) or None

    # LLM으로 사용자 입력 파싱 (결제수단 목록 포함)
    parsed = await llm.parse_expense(
        chat_request.message,
        categories=user_categories or None,
        history_hints=history_hints or None,
        category_mappings=cat_mappings or None,
        payment_methods=payment_method_names,
    )

    # 파싱 실패 처리
    if isinstance(parsed, dict) and "error" in parsed:
        return ChatResponse(
            message=parsed["error"],
            expenses_created=None,
            incomes_created=None,
            parsed_items=None,
            parsed_expenses=None,
            insights=None,
        )

    # 유효하지 않은 응답
    if not isinstance(parsed, dict | list):
        return ChatResponse(
            message="알 수 없는 응답 형식입니다.",
            expenses_created=None,
            incomes_created=None,
            parsed_items=None,
            parsed_expenses=None,
            insights=None,
        )

    # 기본 결제수단 ID 조회 (저장 시 폴백용)
    default_pm_id = await get_default_payment_method_id(db, household_id, current_user.id)  # type: ignore[arg-type]

    # Preview 모드 vs 일반 모드 라우팅
    if chat_request.preview:
        return await _handle_preview(parsed, household_id, payment_method_map=payment_method_map or None)

    return await _save_and_respond(
        parsed,
        chat_request.message,
        household_id,
        current_user,
        db,
        payment_method_map=payment_method_map or None,
        default_payment_method_id=default_pm_id,
    )

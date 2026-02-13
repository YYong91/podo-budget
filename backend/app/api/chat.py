"""채팅 API 라우트 - 자연어 지출 입력 처리

사용자별로 자연어 입력을 처리하여 지출을 생성합니다.
생성된 지출은 자동으로 현재 로그인한 사용자의 지출로 기록됩니다.

공유 가계부(Household) 연동:
- household_id가 있으면 해당 가구의 공유 지출로 기록
- 없으면 사용자의 활성 가구를 자동 감지

Preview 모드:
- preview=True이면 LLM 파싱 결과만 반환 (DB 저장 안 함)
- 프론트엔드에서 결과 확인/수정 후 일반 모드로 최종 저장

Rate Limiting:
- 사용자당 분당 10회로 제한 (LLM API 호출 보호)
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.expense import Expense
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, ParsedExpenseItem
from app.schemas.expense import ExpenseResponse
from app.services.category_service import get_or_create_category
from app.services.expense_context_detector import resolve_household_id
from app.services.llm_service import get_llm_provider

router = APIRouter()


def _to_parsed_items(parsed: dict | list, household_id: int | None = None) -> list[ParsedExpenseItem]:
    """LLM 파싱 결과를 ParsedExpenseItem 리스트로 변환"""
    items = [parsed] if isinstance(parsed, dict) else parsed
    result = []
    for item in items:
        result.append(
            ParsedExpenseItem(
                amount=item["amount"],
                description=item.get("description", ""),
                category=item.get("category", "기타"),
                date=item.get("date", datetime.now().strftime("%Y-%m-%d")),
                memo=item.get("memo", ""),
                household_id=household_id,
            )
        )
    return result


@router.post("/", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def chat(
    request: Request,
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """채팅 인터페이스로 지출 입력 및 인사이트 요청

    자연어로 입력된 지출을 LLM이 파싱하여 현재 로그인한 사용자의 지출로 기록합니다.
    household_id가 있으면 해당 가구의 공유 지출로 기록됩니다.

    preview=True이면 파싱 결과만 반환하고 DB에 저장하지 않습니다.
    """
    # household_id 결정: 명시적 지정 → 자연어 컨텍스트 → 활성 가구
    user_active = await get_user_active_household_id(current_user, db)
    household_id = await resolve_household_id(
        message=chat_request.message,
        explicit_household_id=chat_request.household_id,
        user_active_household_id=user_active,
    )

    # 가구가 있으면 멤버 검증
    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    llm = get_llm_provider("parse")

    # LLM으로 사용자 입력 파싱
    parsed = await llm.parse_expense(chat_request.message)

    # 파싱 실패 처리
    if isinstance(parsed, dict) and "error" in parsed:
        return ChatResponse(
            message=parsed["error"],
            expenses_created=None,
            parsed_expenses=None,
            insights=None,
        )

    # 유효하지 않은 응답
    if not isinstance(parsed, dict | list):
        return ChatResponse(
            message="알 수 없는 응답 형식입니다.",
            expenses_created=None,
            parsed_expenses=None,
            insights=None,
        )

    # Preview 모드: 파싱 결과만 반환 (저장하지 않음)
    if chat_request.preview:
        parsed_items = _to_parsed_items(parsed, household_id=household_id)
        count = len(parsed_items)
        total = sum(item.amount for item in parsed_items)
        return ChatResponse(
            message=f"{count}건의 지출(총 ₩{total:,.0f})을 인식했습니다. 확인 후 저장해주세요.",
            expenses_created=None,
            parsed_expenses=parsed_items,
            insights=None,
        )

    # 일반 모드: 파싱 후 DB에 저장
    items = [parsed] if isinstance(parsed, dict) else parsed
    created_expenses = []

    for item in items:
        category = await get_or_create_category(db, item.get("category", "기타"), current_user.id)
        expense = Expense(
            user_id=current_user.id,
            household_id=household_id,
            amount=item["amount"],
            description=item.get("description", chat_request.message),
            category_id=category.id,
            raw_input=chat_request.message,
            date=datetime.fromisoformat(item.get("date", datetime.now().isoformat())),
        )
        db.add(expense)
        created_expenses.append(expense)

    await db.commit()
    for expense in created_expenses:
        await db.refresh(expense)

    total_amount = sum(item["amount"] for item in items)
    count = len(items)
    msg = (
        f"₩{int(items[0]['amount']):,}이(가) [{items[0].get('category', '기타')}] 카테고리로 기록되었습니다."
        if count == 1
        else f"{count}건의 지출(총 ₩{total_amount:,})이 기록되었습니다."
    )

    return ChatResponse(
        message=msg,
        expenses_created=[ExpenseResponse.model_validate(exp) for exp in created_expenses],
        parsed_expenses=None,
        insights=None,
    )

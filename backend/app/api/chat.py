"""채팅 API 라우트 - 자연어 지출 입력 처리

사용자별로 자연어 입력을 처리하여 지출을 생성합니다.
생성된 지출은 자동으로 현재 로그인한 사용자의 지출로 기록됩니다.

Rate Limiting:
- 사용자당 분당 10회로 제한 (LLM API 호출 보호)
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.expense import Expense
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.expense import ExpenseResponse
from app.services.category_service import get_or_create_category
from app.services.llm_service import get_llm_provider

router = APIRouter()


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

    Rate Limiting:
    - 사용자당 분당 10회 제한
    - 초과 시 429 Too Many Requests 응답

    예시:
    - 단일 지출: "오늘 점심에 김치찌개 8000원 먹었어"
    - 여러 지출: "점심 8천원, 커피 5천원"

    Args:
        request: FastAPI Request 객체 (rate limiting용)
        chat_request: 사용자 메시지
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        생성된 지출 목록과 응답 메시지
    """
    llm = get_llm_provider("parse")

    # LLM으로 사용자 입력 파싱
    parsed = await llm.parse_expense(chat_request.message)

    # 단일 지출 (dict) 처리
    if isinstance(parsed, dict):
        # 파싱 실패
        if "error" in parsed:
            return ChatResponse(
                message=parsed["error"],
                expenses_created=None,
                insights=None,
            )

        # 카테고리 매칭/생성 (사용자별로 처리)
        category = await get_or_create_category(db, parsed.get("category", "기타"), current_user.id)

        # 지출 생성 (user_id 설정)
        expense = Expense(
            user_id=current_user.id,
            amount=parsed["amount"],
            description=parsed.get("description", chat_request.message),
            category_id=category.id,
            raw_input=chat_request.message,
            date=datetime.fromisoformat(parsed.get("date", datetime.now().isoformat())),
        )
        db.add(expense)
        await db.commit()
        await db.refresh(expense)

        amount_formatted = f"{int(parsed['amount']):,}"
        return ChatResponse(
            message=f"₩{amount_formatted}이(가) [{parsed.get('category', '기타')}] 카테고리로 기록되었습니다.",
            expenses_created=[ExpenseResponse.model_validate(expense)],
            insights=None,
        )

    # 여러 지출 (list) 처리
    elif isinstance(parsed, list):
        created_expenses = []

        for item in parsed:
            # 카테고리 매칭/생성 (사용자별로 처리)
            category = await get_or_create_category(db, item.get("category", "기타"), current_user.id)

            # 지출 생성 (user_id 설정)
            expense = Expense(
                user_id=current_user.id,
                amount=item["amount"],
                description=item.get("description", ""),
                category_id=category.id,
                raw_input=chat_request.message,
                date=datetime.fromisoformat(item.get("date", datetime.now().isoformat())),
            )
            db.add(expense)
            created_expenses.append(expense)

        await db.commit()

        # 모든 지출을 refresh
        for expense in created_expenses:
            await db.refresh(expense)

        # 총 금액 계산
        total_amount = sum(item["amount"] for item in parsed)
        count = len(parsed)

        return ChatResponse(
            message=f"{count}건의 지출(총 ₩{total_amount:,})이 기록되었습니다.",
            expenses_created=[ExpenseResponse.model_validate(exp) for exp in created_expenses],
            insights=None,
        )

    else:
        return ChatResponse(
            message="알 수 없는 응답 형식입니다.",
            expenses_created=None,
            insights=None,
        )

"""채팅 API 라우트 - 자연어 지출 입력 처리"""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.expense import Expense
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.expense import ExpenseResponse
from app.services.category_service import get_or_create_category
from app.services.llm_service import get_llm_provider

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    채팅 인터페이스로 지출 입력 및 인사이트 요청
    예: "오늘 점심에 김치찌개 8000원 먹었어"
    """
    llm = get_llm_provider()

    # LLM으로 사용자 입력 파싱
    parsed = await llm.parse_expense(request.message)

    # 파싱 실패
    if "error" in parsed:
        return ChatResponse(
            message=parsed["error"],
            expenses_created=None,
            insights=None,
        )

    # 카테고리 매칭/생성
    category = await get_or_create_category(db, parsed.get("category", "기타"))

    # 지출 생성
    expense = Expense(
        amount=parsed["amount"],
        description=parsed.get("description", request.message),
        category_id=category.id,
        raw_input=request.message,
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

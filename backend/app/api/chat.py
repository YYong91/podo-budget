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

    단일 지출: "오늘 점심에 김치찌개 8000원 먹었어"
    여러 지출: "점심 8천원, 커피 5천원"
    """
    llm = get_llm_provider()

    # LLM으로 사용자 입력 파싱
    parsed = await llm.parse_expense(request.message)

    # 단일 지출 (dict) 처리
    if isinstance(parsed, dict):
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

    # 여러 지출 (list) 처리
    elif isinstance(parsed, list):
        created_expenses = []

        for item in parsed:
            # 카테고리 매칭/생성
            category = await get_or_create_category(db, item.get("category", "기타"))

            # 지출 생성
            expense = Expense(
                amount=item["amount"],
                description=item.get("description", ""),
                category_id=category.id,
                raw_input=request.message,
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

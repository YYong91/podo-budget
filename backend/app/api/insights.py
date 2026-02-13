"""인사이트 API 라우트 - Claude AI 기반 지출 분석

현재 로그인한 사용자의 지출 데이터만 분석하여 인사이트를 제공합니다.

Rate Limiting:
- 사용자당 분당 5회로 제한 (LLM API 호출 보호, 분석 작업은 더 제한적)
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User
from app.services.llm_service import get_llm_provider

router = APIRouter()


@router.post("/generate")
@limiter.limit("5/minute")
async def generate_insights(
    request: Request,
    month: str = Query(..., description="YYYY-MM 형식", pattern=r"^\d{4}-\d{2}$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claude AI로 월별 지출 인사이트 생성

    현재 로그인한 사용자의 지출 데이터를 집계하여 Claude에게 분석을 요청합니다.

    Rate Limiting:
    - 사용자당 분당 5회 제한 (LLM API 호출 보호)
    - 초과 시 429 Too Many Requests 응답

    Args:
        request: FastAPI Request 객체 (rate limiting용)
        month: YYYY-MM 형식의 월
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        월별 통계와 AI 인사이트
    """
    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)

    # 사용자 필터 조건
    user_filter = Expense.user_id == current_user.id

    # 총합
    total_result = await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)).where(user_filter, Expense.date >= start, Expense.date < end))
    total = float(total_result.scalar())

    # 카테고리별 합계
    cat_result = await db.execute(
        select(Category.name, func.sum(Expense.amount).label("amount"))
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(user_filter, Expense.date >= start, Expense.date < end)
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
    )
    by_category = {row.name or "미분류": float(row.amount) for row in cat_result.all()}

    # 최근 지출 내역 (상위 20건)
    recent_result = await db.execute(select(Expense).where(user_filter, Expense.date >= start, Expense.date < end).order_by(Expense.amount.desc()).limit(20))
    top_expenses = [
        {
            "amount": e.amount,
            "description": e.description,
            "date": e.date.strftime("%Y-%m-%d"),
        }
        for e in recent_result.scalars().all()
    ]

    if total == 0:
        return {
            "month": month,
            "insights": f"{month}에 기록된 지출이 없습니다. 지출을 입력해주세요!",
        }

    # LLM에게 인사이트 생성 요청
    expenses_data = {
        "month": month,
        "total": total,
        "by_category": by_category,
        "top_expenses": top_expenses,
    }

    llm = get_llm_provider("insights")
    insights_text = await llm.generate_insights(expenses_data)

    return {
        "month": month,
        "total": total,
        "by_category": by_category,
        "insights": insights_text,
    }

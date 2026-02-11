"""인사이트 API 라우트 - Claude AI 기반 지출 분석"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.category import Category
from app.models.expense import Expense
from app.services.llm_service import get_llm_provider

router = APIRouter()


@router.post("/generate")
async def generate_insights(
    month: str = Query(..., description="YYYY-MM 형식", pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Claude AI로 월별 지출 인사이트 생성

    지출 데이터를 집계하여 Claude에게 분석을 요청합니다.
    """
    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)

    # 총합
    total_result = await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.date >= start, Expense.date < end))
    total = float(total_result.scalar())

    # 카테고리별 합계
    cat_result = await db.execute(
        select(Category.name, func.sum(Expense.amount).label("amount"))
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(Expense.date >= start, Expense.date < end)
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
    )
    by_category = {row.name or "미분류": float(row.amount) for row in cat_result.all()}

    # 최근 지출 내역 (상위 20건)
    recent_result = await db.execute(select(Expense).where(Expense.date >= start, Expense.date < end).order_by(Expense.amount.desc()).limit(20))
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

    llm = get_llm_provider()
    insights_text = await llm.generate_insights(expenses_data)

    return {
        "month": month,
        "total": total,
        "by_category": by_category,
        "insights": insights_text,
    }


@router.get("/budget-alerts")
async def get_budget_alerts(db: AsyncSession = Depends(get_db)):
    """예산 경고 알림 조회 (MVP 이후 구현 예정)"""
    return {"alerts": []}

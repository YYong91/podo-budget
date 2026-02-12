"""지출 CRUD API 라우트"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate

router = APIRouter()


@router.post("/", response_model=ExpenseResponse)
async def create_expense(
    expense: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
):
    """지출 직접 생성"""
    db_expense = Expense(**expense.model_dump())
    db.add(db_expense)
    await db.commit()
    await db.refresh(db_expense)
    return db_expense


@router.get("/", response_model=list[ExpenseResponse])
async def get_expenses(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    category_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """지출 목록 조회 (필터링, 페이지네이션)"""
    query = select(Expense)

    # 필터 적용
    if start_date:
        query = query.where(Expense.date >= start_date)
    if end_date:
        query = query.where(Expense.date <= end_date)
    if category_id:
        query = query.where(Expense.category_id == category_id)

    query = query.order_by(Expense.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/stats/monthly")
async def get_monthly_stats(
    month: str = Query(..., description="YYYY-MM 형식", pattern=r"^\d{4}-\d{2}$"),
    db: AsyncSession = Depends(get_db),
):
    """월별 지출 통계 (총합, 카테고리별 합계)"""
    from app.models.category import Category

    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)

    # 총합
    total_result = await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.date >= start, Expense.date < end))
    total = total_result.scalar()

    # 카테고리별 합계
    category_result = await db.execute(
        select(Category.name, func.sum(Expense.amount).label("amount"))
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(Expense.date >= start, Expense.date < end)
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
    )
    by_category = [{"category": row.name or "미분류", "amount": float(row.amount)} for row in category_result.all()]

    # 일별 추이 (DATE() 함수 — SQLite/PostgreSQL 모두 지원)
    day_col = func.date(Expense.date).label("day")
    daily_result = await db.execute(
        select(day_col, func.sum(Expense.amount).label("amount")).where(Expense.date >= start, Expense.date < end).group_by(day_col).order_by(day_col)
    )
    daily_trend = [{"date": str(row.day)[:10], "amount": float(row.amount)} for row in daily_result.all() if row.day is not None]

    return {
        "month": month,
        "total": float(total),
        "by_category": by_category,
        "daily_trend": daily_trend,
    }


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
):
    """특정 지출 조회"""
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="지출을 찾을 수 없습니다")
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_update: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
):
    """지출 수정"""
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="지출을 찾을 수 없습니다")

    update_data = expense_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(expense, key, value)

    await db.commit()
    await db.refresh(expense)
    return expense


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
):
    """지출 삭제"""
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="지출을 찾을 수 없습니다")

    await db.delete(expense)
    await db.commit()
    return {"message": "지출이 삭제되었습니다"}

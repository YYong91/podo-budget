"""지출 CRUD API 라우트

사용자별로 지출 데이터를 격리하여 관리합니다.
모든 엔드포인트는 JWT 인증이 필요하며, 각 사용자는 자신의 지출만 조회/수정할 수 있습니다.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate

router = APIRouter()


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 직접 생성

    인증된 사용자의 지출을 생성합니다.
    user_id는 자동으로 현재 로그인한 사용자로 설정됩니다.

    Args:
        expense: 지출 생성 데이터
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        생성된 지출 정보
    """
    db_expense = Expense(**expense.model_dump(), user_id=current_user.id)
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 목록 조회 (필터링, 페이지네이션)

    현재 로그인한 사용자의 지출만 조회합니다.

    Args:
        skip: 건너뛸 레코드 수 (페이지네이션)
        limit: 조회할 최대 레코드 수 (1~100)
        start_date: 시작일 필터 (이 날짜 이후)
        end_date: 종료일 필터 (이 날짜 이전)
        category_id: 카테고리 ID 필터
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        지출 목록 (최신순)
    """
    query = select(Expense).where(Expense.user_id == current_user.id)

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """월별 지출 통계 (총합, 카테고리별 합계)

    현재 로그인한 사용자의 월별 지출을 집계합니다.

    Args:
        month: YYYY-MM 형식의 월
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        월별 총합, 카테고리별 합계, 일별 추이
    """
    from app.models.category import Category

    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)

    # 사용자 필터 조건
    user_filter = Expense.user_id == current_user.id

    # 총합
    total_result = await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)).where(user_filter, Expense.date >= start, Expense.date < end))
    total = total_result.scalar()

    # 카테고리별 합계
    category_result = await db.execute(
        select(Category.name, func.sum(Expense.amount).label("amount"))
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(user_filter, Expense.date >= start, Expense.date < end)
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
    )
    by_category = [{"category": row.name or "미분류", "amount": float(row.amount)} for row in category_result.all()]

    # 일별 추이 (DATE() 함수 — SQLite/PostgreSQL 모두 지원)
    day_col = func.date(Expense.date).label("day")
    daily_result = await db.execute(
        select(day_col, func.sum(Expense.amount).label("amount"))
        .where(user_filter, Expense.date >= start, Expense.date < end)
        .group_by(day_col)
        .order_by(day_col)
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """특정 지출 조회

    현재 로그인한 사용자의 지출만 조회할 수 있습니다.
    다른 사용자의 지출에 접근 시 404 에러를 반환합니다.

    Args:
        expense_id: 지출 ID
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        지출 정보

    Raises:
        HTTPException 404: 지출을 찾을 수 없거나 소유자가 아닌 경우
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.user_id == current_user.id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_update: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 수정

    현재 로그인한 사용자의 지출만 수정할 수 있습니다.
    다른 사용자의 지출 수정 시도 시 404 에러를 반환합니다.

    Args:
        expense_id: 지출 ID
        expense_update: 수정할 필드들
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        수정된 지출 정보

    Raises:
        HTTPException 404: 지출을 찾을 수 없거나 소유자가 아닌 경우
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.user_id == current_user.id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    update_data = expense_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(expense, key, value)

    await db.commit()
    await db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 삭제

    현재 로그인한 사용자의 지출만 삭제할 수 있습니다.
    다른 사용자의 지출 삭제 시도 시 404 에러를 반환합니다.

    Args:
        expense_id: 지출 ID
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Raises:
        HTTPException 404: 지출을 찾을 수 없거나 소유자가 아닌 경우
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.user_id == current_user.id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    await db.delete(expense)
    await db.commit()

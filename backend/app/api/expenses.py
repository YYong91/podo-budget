"""지출 CRUD API 라우트

사용자별로 지출 데이터를 격리하여 관리합니다.
모든 엔드포인트는 JWT 인증이 필요하며, 각 사용자는 자신의 지출만 조회/수정할 수 있습니다.

공유 가계부(Household) 연동:
- household_id가 있으면 해당 가구의 공유 지출로 기록
- household_id가 없으면 사용자의 활성 가구를 자동 감지
- 가구 멤버 전체의 지출을 함께 조회할 수 있음
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
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
    household_id가 지정되면 해당 가구의 공유 지출로, 없으면 활성 가구를 자동 감지합니다.
    """
    # household_id 결정: 요청에서 받거나 활성 가구 자동 감지
    household_id = expense.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    # 가구가 있으면 멤버 검증
    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    expense_data = expense.model_dump(exclude={"household_id"})
    db_expense = Expense(**expense_data, user_id=current_user.id, household_id=household_id)
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
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 목록 조회 (필터링, 페이지네이션)

    household_id가 있으면 해당 가구 전체 멤버의 지출을 조회합니다.
    없으면 현재 사용자의 지출만 조회합니다 (하위 호환).
    """
    if household_id is not None:
        # 가구 멤버 검증
        await get_household_member(household_id, current_user, db)
        # 가구 전체 멤버의 지출 조회
        query = select(Expense).where(Expense.household_id == household_id)
    else:
        # 하위 호환: 본인 지출만 조회
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
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """월별 지출 통계 (총합, 카테고리별 합계)

    household_id가 있으면 가구 전체 멤버의 월별 통계를 집계합니다.
    """
    from app.models.category import Category

    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)

    # 필터 조건: 가구 또는 개인
    if household_id is not None:
        await get_household_member(household_id, current_user, db)
        scope_filter = Expense.household_id == household_id
    else:
        scope_filter = Expense.user_id == current_user.id

    # 총합
    total_result = await db.execute(select(func.coalesce(func.sum(Expense.amount), 0)).where(scope_filter, Expense.date >= start, Expense.date < end))
    total = total_result.scalar()

    # 카테고리별 합계
    category_result = await db.execute(
        select(Category.name, func.sum(Expense.amount).label("amount"))
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(scope_filter, Expense.date >= start, Expense.date < end)
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
    )
    by_category = [{"category": row.name or "미분류", "amount": float(row.amount)} for row in category_result.all()]

    # 일별 추이 (DATE() 함수 — SQLite/PostgreSQL 모두 지원)
    day_col = func.date(Expense.date).label("day")
    daily_result = await db.execute(
        select(day_col, func.sum(Expense.amount).label("amount"))
        .where(scope_filter, Expense.date >= start, Expense.date < end)
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

    지출의 household_id가 있으면 가구 멤버인지 확인합니다.
    없으면 본인 지출인지 확인합니다.
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    # 접근 권한 확인
    if expense.household_id is not None:
        # 가구 지출이면 멤버인지 확인
        await get_household_member(expense.household_id, current_user, db)
    elif expense.user_id != current_user.id:
        # 개인 지출이면 본인 것인지 확인
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

    본인이 입력한 지출만 수정할 수 있습니다 (user_id == current_user.id).
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

    본인이 입력한 지출만 삭제할 수 있습니다 (user_id == current_user.id).
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.user_id == current_user.id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    await db.delete(expense)
    await db.commit()

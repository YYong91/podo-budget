"""수입 CRUD API 라우트

사용자별로 수입 데이터를 격리하여 관리합니다.
모든 엔드포인트는 JWT 인증이 필요하며, 각 사용자는 자신의 수입만 조회/수정할 수 있습니다.

공유 가계부(Household) 연동:
- household_id가 있으면 해당 가구의 공유 수입으로 기록
- household_id가 없으면 사용자의 활성 가구를 자동 감지
- 가구 멤버 전체의 수입을 함께 조회할 수 있음
"""

from calendar import monthrange
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.category import Category
from app.models.income import Income
from app.models.user import User
from app.schemas.expense import CategoryStats, StatsPeriod, StatsResponse, TrendPoint
from app.schemas.income import IncomeCreate, IncomeResponse, IncomeUpdate

router = APIRouter()


@router.post("/", response_model=IncomeResponse, status_code=status.HTTP_201_CREATED)
async def create_income(
    income: IncomeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 생성"""
    household_id = income.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    income_data = income.model_dump(exclude={"household_id"})
    db_income = Income(**income_data, user_id=current_user.id, household_id=household_id)
    db.add(db_income)
    await db.commit()
    await db.refresh(db_income)
    return db_income


@router.get("/", response_model=list[IncomeResponse])
async def get_incomes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    category_id: int | None = None,
    household_id: int | None = None,
    member_user_id: int | None = Query(None, description="가구 내 특정 멤버의 수입만 조회"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 목록 조회 (필터링, 페이지네이션)"""
    if household_id is not None:
        await get_household_member(household_id, current_user, db)
        query = select(Income).where(Income.household_id == household_id)
        if member_user_id is not None:
            query = query.where(Income.user_id == member_user_id)
    else:
        query = select(Income).where(Income.user_id == current_user.id)

    if start_date:
        query = query.where(Income.date >= start_date)
    if end_date:
        query = query.where(Income.date <= end_date)
    if category_id is not None:
        query = query.where(Income.category_id == category_id)

    query = query.order_by(Income.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


def _get_week_range(d: date) -> tuple[date, date]:
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _get_week_label(d: date) -> str:
    first_day = d.replace(day=1)
    week_num = (d.day + first_day.weekday() - 1) // 7 + 1
    return f"{d.month}월 {week_num}주차"


def _get_month_range(d: date) -> tuple[date, date]:
    first = d.replace(day=1)
    _, last_day = monthrange(d.year, d.month)
    last = d.replace(day=last_day)
    return first, last


def _get_year_range(d: date) -> tuple[date, date]:
    return date(d.year, 1, 1), date(d.year, 12, 31)


def _build_income_scope_filter(household_id: int | None, current_user: User):
    if household_id is not None:
        return Income.household_id == household_id
    return Income.user_id == current_user.id


@router.get("/stats", response_model=StatsResponse)
async def get_income_stats(
    period: StatsPeriod = Query(..., description="통계 기간: weekly, monthly, yearly"),
    date: str | None = Query(None, description="기준 날짜 YYYY-MM-DD", alias="date"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 기간별 통계 (주간/월간/연간)"""
    from datetime import date as date_type

    ref_date = date_type.fromisoformat(date) if date else date_type.today()

    if period == StatsPeriod.weekly:
        start_d, end_d = _get_week_range(ref_date)
        label = _get_week_label(ref_date)
    elif period == StatsPeriod.monthly:
        start_d, end_d = _get_month_range(ref_date)
        label = f"{ref_date.year}년 {ref_date.month}월"
    else:
        start_d, end_d = _get_year_range(ref_date)
        label = f"{ref_date.year}년"

    start_dt = datetime(start_d.year, start_d.month, start_d.day)
    end_dt = datetime(end_d.year, end_d.month, end_d.day, 23, 59, 59)

    if household_id is not None:
        await get_household_member(household_id, current_user, db)
    scope_filter = _build_income_scope_filter(household_id, current_user)
    base_where = [scope_filter, Income.date >= start_dt, Income.date <= end_dt]

    # 총합/건수
    total_result = await db.execute(select(func.coalesce(func.sum(Income.amount), 0), func.count(Income.id)).where(*base_where))
    row = total_result.one()
    total = float(row[0])
    count = int(row[1])

    # 카테고리별
    cat_result = await db.execute(
        select(Category.name, func.sum(Income.amount).label("amount"), func.count(Income.id).label("cnt"))
        .join(Category, Income.category_id == Category.id, isouter=True)
        .where(*base_where)
        .group_by(Category.name)
        .order_by(func.sum(Income.amount).desc())
    )
    by_category = []
    for r in cat_result.all():
        amt = float(r.amount)
        by_category.append(
            CategoryStats(
                category=r.name or "미분류",
                amount=amt,
                count=int(r.cnt),
                percentage=round(amt / total * 100, 1) if total > 0 else 0,
            )
        )

    # 추이 데이터
    trend: list[TrendPoint] = []
    if period == StatsPeriod.yearly:
        for m in range(1, 13):
            m_start = datetime(ref_date.year, m, 1)
            _, m_last = monthrange(ref_date.year, m)
            m_end = datetime(ref_date.year, m, m_last, 23, 59, 59)
            r = await db.execute(select(func.coalesce(func.sum(Income.amount), 0)).where(scope_filter, Income.date >= m_start, Income.date <= m_end))
            trend.append(TrendPoint(label=f"{m}월", amount=float(r.scalar())))
    else:
        day_col = func.date(Income.date).label("day")
        daily_result = await db.execute(select(day_col, func.sum(Income.amount).label("amount")).where(*base_where).group_by(day_col).order_by(day_col))
        for r in daily_result.all():
            if r.day is not None:
                day_str = str(r.day)[:10]
                trend.append(TrendPoint(label=day_str[5:].replace("-", "/"), amount=float(r.amount)))

    return StatsResponse(
        period=period.value,
        label=label,
        start_date=str(start_d),
        end_date=str(end_d),
        total=total,
        count=count,
        by_category=by_category,
        trend=trend,
    )


@router.get("/{income_id}", response_model=IncomeResponse)
async def get_income(
    income_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """단일 수입 조회"""
    result = await db.execute(select(Income).where(Income.id == income_id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    if income.household_id is not None:
        await get_household_member(income.household_id, current_user, db)
    elif income.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    return income


@router.put("/{income_id}", response_model=IncomeResponse)
async def update_income(
    income_id: int,
    income_update: IncomeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 수정 (본인 것만)"""
    result = await db.execute(select(Income).where(Income.id == income_id, Income.user_id == current_user.id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    update_data = income_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(income, key, value)

    await db.commit()
    await db.refresh(income)
    return income


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(
    income_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 삭제 (본인 것만)"""
    result = await db.execute(select(Income).where(Income.id == income_id, Income.user_id == current_user.id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    await db.delete(income)
    await db.commit()

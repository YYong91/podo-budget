"""수입 CRUD API 라우트

사용자별로 수입 데이터를 격리하여 관리합니다.
모든 엔드포인트는 JWT 인증이 필요하며, 각 사용자는 자신의 수입만 조회/수정할 수 있습니다.

공유 가계부(Household) 연동:
- household_id가 있으면 해당 가구의 공유 수입으로 기록
- household_id가 없으면 사용자의 활성 가구를 자동 감지
- 가구 멤버 전체의 수입을 함께 조회할 수 있음
"""

import logging
from datetime import datetime

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
from app.utils.date_utils import get_month_range, get_week_label, get_week_range, get_year_range

logger = logging.getLogger(__name__)

router = APIRouter()


def _escape_like(value: str) -> str:
    """LIKE 패턴 특수문자 이스케이프"""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _apply_income_filters(
    stmt,
    *,
    query: str | None,
    start_date: str | None,
    end_date: str | None,
    category_id: int | None,
    member_user_id: int | None,
):
    """수입 공통 필터 적용"""
    if member_user_id is not None:
        stmt = stmt.where(Income.user_id == member_user_id)
    if query:
        stmt = stmt.where(Income.description.ilike(f"%{_escape_like(query)}%", escape="\\"))
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        stmt = stmt.where(Income.date >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        if len(end_date) == 10:
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        stmt = stmt.where(Income.date <= end_dt)
    if category_id is not None:
        stmt = stmt.where(Income.category_id == category_id)
    return stmt


@router.post("", response_model=IncomeResponse, status_code=status.HTTP_201_CREATED)
async def create_income(
    income: IncomeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 생성"""
    household_id = income.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    await get_household_member(household_id, current_user, db)

    income_data = income.model_dump(exclude={"household_id"})
    db_income = Income(**income_data, user_id=current_user.id, household_id=household_id)
    db.add(db_income)
    await db.commit()
    await db.refresh(db_income)
    logger.info("수입 생성: user=%s, amount=%s", current_user.id, income.amount)
    return db_income


@router.get("", response_model=list[IncomeResponse])
async def get_incomes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    start_date: str | None = Query(None, description="시작일 YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS"),
    end_date: str | None = Query(None, description="종료일 YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS"),
    category_id: int | None = None,
    household_id: int | None = None,
    member_user_id: int | None = Query(None, description="가구 내 특정 멤버의 수입만 조회"),
    query: str | None = Query(None, description="설명(description) 텍스트 검색"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 목록 조회 (필터링, 페이지네이션)"""
    # household_id 미지정 시 활성 가구 자동 감지
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    await get_household_member(household_id, current_user, db)
    stmt = select(Income).where(Income.household_id == household_id)
    stmt = _apply_income_filters(
        stmt,
        query=query,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        member_user_id=member_user_id,
    )

    stmt = stmt.order_by(Income.date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


def _build_income_scope_filter(household_id: int):
    """가구 스코프 필터 생성"""
    return Income.household_id == household_id


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
        start_d, end_d = get_week_range(ref_date)
        label = get_week_label(ref_date)
    elif period == StatsPeriod.monthly:
        start_d, end_d = get_month_range(ref_date)
        label = f"{ref_date.year}년 {ref_date.month}월"
    else:
        start_d, end_d = get_year_range(ref_date)
        label = f"{ref_date.year}년"

    start_dt = datetime(start_d.year, start_d.month, start_d.day)
    end_dt = datetime(end_d.year, end_d.month, end_d.day, 23, 59, 59)

    # household_id 미지정 시 활성 가구 자동 감지
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    scope_filter = _build_income_scope_filter(household_id)
    stats_filter = Income.exclude_from_stats == False  # noqa: E712
    base_where = [scope_filter, stats_filter, Income.date >= start_dt, Income.date <= end_dt]

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
        # 월별 12포인트 — 단일 GROUP BY 쿼리 (12번 직렬 → 1번, #164)
        month_col = func.extract("month", Income.date).label("month")
        monthly_result = await db.execute(
            select(month_col, func.coalesce(func.sum(Income.amount), 0).label("amount")).where(*base_where).group_by(month_col).order_by(month_col)
        )
        monthly_map = {int(r.month): float(r.amount) for r in monthly_result.all()}
        for m in range(1, 13):
            trend.append(TrendPoint(label=f"{m}월", amount=monthly_map.get(m, 0.0)))
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

    # 접근 권한 확인: 가구 멤버인지 검증
    if income.household_id is not None:
        try:
            await get_household_member(income.household_id, current_user, db)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다") from None
    else:
        # 레거시 데이터: household_id 없는 수입은 본인 것만 조회
        if income.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    return income


@router.put("/{income_id}", response_model=IncomeResponse)
async def update_income(
    income_id: int,
    income_update: IncomeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 수정 — 본인 또는 admin/owner"""
    result = await db.execute(select(Income).where(Income.id == income_id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    if income.household_id is None:
        # 레거시 데이터(마이그레이션 이전): household_id=None → 본인 확인만으로 수정 허용 (#147)
        if income.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")
    else:
        # 가구 멤버 검증 (비멤버는 존재 여부 노출 방지를 위해 404)
        try:
            member = await get_household_member(income.household_id, current_user, db)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다") from None

        # 본인이 아닌 경우 admin/owner 권한 필요
        if income.user_id != current_user.id and member.role not in ("admin", "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 항목을 수정할 권한이 없습니다",
            )

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
    """수입 삭제 — 본인 또는 admin/owner"""
    result = await db.execute(select(Income).where(Income.id == income_id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    if income.household_id is None:
        # 레거시 데이터(마이그레이션 이전): household_id=None → 본인 확인만으로 삭제 허용 (#147)
        if income.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")
    else:
        # 가구 멤버 검증 (비멤버는 존재 여부 노출 방지를 위해 404)
        try:
            member = await get_household_member(income.household_id, current_user, db)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다") from None

        # 본인이 아닌 경우 admin/owner 권한 필요
        if income.user_id != current_user.id and member.role not in ("admin", "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 항목을 삭제할 권한이 없습니다",
            )

    await db.delete(income)
    await db.commit()
    logger.info("수입 삭제: user=%s, income_id=%s", current_user.id, income_id)

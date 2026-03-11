"""예산 관리 API 라우트

예산 설정, 조회, 수정, 삭제 및 예산 초과 알림 기능을 제공합니다.
household_id가 있으면 가구 공유 예산, 없으면 개인 예산으로 처리합니다.
expenses/recurring과 동일한 household 패턴을 따릅니다.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User
from app.schemas.budget import (
    BudgetAlert,
    BudgetCreate,
    BudgetMonthlyCategoryStats,
    BudgetMonthlyStatsResponse,
    BudgetResponse,
    BudgetUpdate,
    CategoryBudgetOverview,
    MonthlySpending,
    TotalBudgetResponse,
    TotalBudgetUpdate,
)

router = APIRouter()


def _budget_scope_filter(household_id: int | None, current_user: User):
    """예산 조회 범위 필터 — household_id가 있으면 가구, 없으면 개인"""
    if household_id is not None:
        return Budget.household_id == household_id
    return Budget.user_id == current_user.id


def _expense_scope_filter(household_id: int | None, current_user: User):
    """지출 조회 범위 필터 — household_id가 있으면 가구, 없으면 개인"""
    if household_id is not None:
        return Expense.household_id == household_id
    return Expense.user_id == current_user.id


@router.get("", response_model=list[BudgetResponse])
async def get_budgets(
    household_id: int | None = Query(None, description="가구 ID (없으면 개인 예산)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """전체 예산 목록 조회

    household_id가 있으면 가구 공유 예산, 없으면 개인 예산을 반환합니다.
    """
    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    scope_filter = _budget_scope_filter(household_id, current_user)
    result = await db.execute(select(Budget).where(scope_filter).order_by(Budget.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    budget_data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예산 생성

    household_id가 지정되면 가구 공유 예산으로, 없으면 활성 가구를 자동 감지합니다.
    가구가 없으면 개인 예산으로 생성됩니다.
    """
    # household_id 결정: 요청에서 받거나 활성 가구 자동 감지
    household_id = budget_data.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    # 카테고리 존재 여부 확인
    result = await db.execute(select(Category).where(Category.id == budget_data.category_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다")

    # 종료일 검증
    if budget_data.end_date and budget_data.end_date < budget_data.start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="종료일은 시작일 이후여야 합니다")

    new_budget = Budget(
        user_id=current_user.id,
        household_id=household_id,
        category_id=budget_data.category_id,
        amount=budget_data.amount,
        period=budget_data.period,
        start_date=budget_data.start_date,
        end_date=budget_data.end_date,
        alert_threshold=budget_data.alert_threshold,
    )
    db.add(new_budget)
    await db.commit()
    await db.refresh(new_budget)
    return new_budget


@router.get("/total-budget", response_model=TotalBudgetResponse)
async def get_total_budget(
    current_user: User = Depends(get_current_user),
):
    """월 총 예산 조회 (개인 설정)"""
    return TotalBudgetResponse(
        total_monthly_budget=float(current_user.total_monthly_budget) if current_user.total_monthly_budget is not None else None,
    )


@router.put("/total-budget", response_model=TotalBudgetResponse)
async def update_total_budget(
    data: TotalBudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """월 총 예산 수정 (개인 설정)"""
    current_user.total_monthly_budget = data.amount
    await db.commit()
    await db.refresh(current_user)
    return TotalBudgetResponse(
        total_monthly_budget=float(current_user.total_monthly_budget) if current_user.total_monthly_budget is not None else None,
    )


# NOTE: 고정 경로 엔드포인트(alerts, category-overview, monthly-stats, total-budget)를 반드시 /{budget_id} 앞에 정의해야 함.
# FastAPI 0.109 (Starlette 0.35)에서는 /{budget_id} partial match 후 탐색을 멈춰
# 뒤에 정의된 고정 경로가 Method Not Allowed를 반환하는 버그가 있음.


@router.get("/alerts", response_model=list[BudgetAlert])
async def get_budget_alerts(
    household_id: int | None = Query(None, description="가구 ID (없으면 개인 예산)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예산 초과/경고 알림 조회

    household_id가 있으면 가구 공유 예산 알림, 없으면 개인 예산 알림을 조회합니다.
    각 카테고리별로 설정된 예산과 현재까지의 지출을 비교합니다.
    """
    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    budget_scope = _budget_scope_filter(household_id, current_user)
    expense_scope = _expense_scope_filter(household_id, current_user)

    result = await db.execute(select(Budget).where(budget_scope))
    budgets = result.scalars().all()

    alerts = []
    now = datetime.now()

    # 유효한 예산만 필터 (기간 미시작 제외)
    active_budgets = [b for b in budgets if b.start_date <= now]
    if not active_budgets:
        return alerts

    # 카테고리 배치 조회 (1 쿼리)
    category_ids = [b.category_id for b in active_budgets]
    cat_result = await db.execute(select(Category).where(Category.id.in_(category_ids)))
    categories_map = {c.id: c for c in cat_result.scalars().all()}

    # period_start별로 예산 그룹화 (period 타입별로 동일한 period_start 공유)
    budgets_by_period: dict[datetime, list] = {}
    for budget in active_budgets:
        if budget.period == "monthly":
            period_start = datetime(now.year, now.month, 1)
        elif budget.period == "weekly":
            days_since_monday = now.weekday()
            period_start = datetime(now.year, now.month, now.day) - timedelta(days=days_since_monday)
        else:  # daily
            period_start = datetime(now.year, now.month, now.day)
        budgets_by_period.setdefault(period_start, []).append(budget)

    # period_start별 지출 합계 배치 조회 (period 유형 수만큼 쿼리 — 보통 1~3회)
    spent_map: dict[int, float] = {}
    for period_start, period_budgets in budgets_by_period.items():
        period_cat_ids = [b.category_id for b in period_budgets]
        expense_result = await db.execute(
            select(Expense.category_id, func.sum(Expense.amount).label("total"))
            .where(
                expense_scope,
                Expense.category_id.in_(period_cat_ids),
                Expense.date >= period_start,
                Expense.date <= now,
            )
            .group_by(Expense.category_id)
        )
        for row in expense_result.all():
            spent_map[row.category_id] = float(row.total)
        # 지출 없는 카테고리는 0으로 초기화
        for cat_id in period_cat_ids:
            spent_map.setdefault(cat_id, 0.0)

    for budget in active_budgets:
        category = categories_map.get(budget.category_id)
        if not category:
            continue

        spent_amount = spent_map.get(budget.category_id, 0.0)
        budget_amount = float(budget.amount)
        usage_percentage = (spent_amount / budget_amount * 100) if budget_amount > 0 else 0
        remaining_amount = budget_amount - spent_amount
        is_exceeded = spent_amount > budget_amount
        is_warning = usage_percentage >= (budget.alert_threshold * 100)

        alerts.append(
            BudgetAlert(
                budget_id=budget.id,
                category_id=budget.category_id,
                category_name=category.name,
                budget_amount=budget.amount,
                spent_amount=spent_amount,
                remaining_amount=remaining_amount,
                usage_percentage=usage_percentage,
                is_exceeded=is_exceeded,
                is_warning=is_warning,
            )
        )

    alerts.sort(key=lambda x: (not x.is_exceeded, not x.is_warning, -x.usage_percentage))
    return alerts


@router.get("/category-overview", response_model=list[CategoryBudgetOverview])
async def get_category_overview(
    household_id: int | None = Query(None, description="가구 ID (없으면 개인 예산)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """카테고리별 예산 개요 조회 — 인라인 예산 편집 화면용

    household_id가 있으면 가구 공유 예산 개요, 없으면 개인 예산 개요를 반환합니다.
    모든 지출 카테고리와 함께 최근 3개월 지출액, 현재 예산 정보를 반환합니다.
    """
    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    budget_scope = _budget_scope_filter(household_id, current_user)
    expense_scope = _expense_scope_filter(household_id, current_user)

    now = datetime.now()

    # 최근 3개월 시작일 계산 (현재 월 포함 3개월)
    start_month = now.month - 2
    start_year = now.year
    while start_month <= 0:
        start_month += 12
        start_year -= 1
    start_date = datetime(start_year, start_month, 1)

    # 지출/공통 카테고리 조회 — 시스템 + 가계 + 솔로 개인 카테고리 (3-scope)
    category_conditions = [
        and_(Category.household_id.is_(None), Category.user_id.is_(None)),  # 시스템
        and_(Category.user_id == current_user.id, Category.household_id.is_(None)),  # 솔로 폴백
    ]
    if household_id is not None:
        category_conditions.append(Category.household_id == household_id)  # 가계
    categories_result = await db.execute(
        select(Category)
        .where(
            Category.type.in_(["expense", "both"]),
            or_(*category_conditions),
        )
        .order_by(Category.name)
    )
    categories = categories_result.scalars().all()

    # 현재 활성 예산 조회
    budgets_result = await db.execute(
        select(Budget)
        .where(
            budget_scope,
            Budget.start_date <= now,
            or_(Budget.end_date.is_(None), Budget.end_date >= now),
        )
        .order_by(Budget.created_at.desc())
    )
    budgets = budgets_result.scalars().all()

    # 카테고리별 현재 예산 매핑 (가장 최근 예산 하나만)
    budget_map: dict[int, Budget] = {}
    for budget in budgets:
        if budget.category_id not in budget_map:
            budget_map[budget.category_id] = budget

    # 최근 3개월 카테고리별 월별 지출 집계
    spending_result = await db.execute(
        select(
            Expense.category_id,
            extract("year", Expense.date).label("year"),
            extract("month", Expense.date).label("month"),
            func.sum(Expense.amount).label("amount"),
        )
        .where(
            expense_scope,
            Expense.date >= start_date,
            Expense.amount > 0,
            Expense.category_id.isnot(None),  # 카테고리 미설정 지출 제외
        )
        .group_by(
            Expense.category_id,
            extract("year", Expense.date),
            extract("month", Expense.date),
        )
    )
    spending_rows = spending_result.all()

    # 카테고리별 월별 지출 매핑
    spending_map: dict[int, list[MonthlySpending]] = {}
    for row in spending_rows:
        cat_id = int(row.category_id)
        if cat_id not in spending_map:
            spending_map[cat_id] = []
        spending_map[cat_id].append(MonthlySpending(year=int(row.year), month=int(row.month), amount=float(row.amount)))

    # 최신순 정렬
    for cat_id in spending_map:
        spending_map[cat_id].sort(key=lambda x: (x.year, x.month), reverse=True)

    # 결과 조합
    overview = []
    for cat in categories:
        budget = budget_map.get(cat.id)
        overview.append(
            CategoryBudgetOverview(
                category_id=cat.id,
                category_name=cat.name,
                monthly_spending=spending_map.get(cat.id, []),
                current_budget_id=budget.id if budget else None,
                current_budget_amount=float(budget.amount) if budget else None,
                alert_threshold=float(budget.alert_threshold) if budget else None,
            )
        )

    return overview


@router.get("/monthly-stats", response_model=BudgetMonthlyStatsResponse)
async def get_monthly_stats(
    month: str = Query(..., description="YYYY-MM 형식", pattern=r"^\d{4}-\d{2}$"),
    household_id: int | None = Query(None, description="가구 ID (없으면 개인 예산)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """월별 예산 대비 실제 지출 통계 조회

    household_id가 있으면 가구 공유 예산 통계, 없으면 개인 예산 통계를 반환합니다.
    예산이 설정된 카테고리만 포함됩니다.
    """
    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    budget_scope = _budget_scope_filter(household_id, current_user)
    expense_scope = _expense_scope_filter(household_id, current_user)

    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)

    # 현재 활성 예산 조회
    budgets_result = await db.execute(
        select(Budget)
        .where(
            budget_scope,
            Budget.period == "monthly",
            Budget.start_date <= start,
            or_(Budget.end_date.is_(None), Budget.end_date >= start),
        )
        .order_by(Budget.created_at.desc())
    )
    budgets = budgets_result.scalars().all()

    # 카테고리별 최신 예산 하나씩 선택
    budget_map: dict[int, Budget] = {}
    for budget in budgets:
        if budget.category_id not in budget_map:
            budget_map[budget.category_id] = budget

    if not budget_map:
        return BudgetMonthlyStatsResponse(
            month=month,
            total_budget=float(current_user.total_monthly_budget) if current_user.total_monthly_budget else None,
            total_spent=0.0,
            categories=[],
        )

    # 카테고리 정보 일괄 조회
    category_ids = list(budget_map.keys())
    categories_result = await db.execute(select(Category).where(Category.id.in_(category_ids)))
    category_map = {c.id: c for c in categories_result.scalars().all()}

    # 해당 월 카테고리별 지출 집계
    spending_result = await db.execute(
        select(Expense.category_id, func.sum(Expense.amount).label("total"))
        .where(
            expense_scope,
            Expense.date >= start,
            Expense.date < end,
            Expense.exclude_from_stats == False,  # noqa: E712
        )
        .group_by(Expense.category_id)
    )
    spending_map: dict[int, float] = {row.category_id: float(row.total) for row in spending_result.all()}

    # 결과 조합
    categories = []
    total_budget_sum = 0.0
    total_spent_sum = 0.0

    for cat_id, budget in budget_map.items():
        cat = category_map.get(cat_id)
        if not cat:
            continue
        budget_amount = float(budget.amount)
        spent_amount = spending_map.get(cat_id, 0.0)
        remaining_amount = budget_amount - spent_amount
        usage_percentage = (spent_amount / budget_amount * 100) if budget_amount > 0 else 0.0

        total_budget_sum += budget_amount
        total_spent_sum += spent_amount

        categories.append(
            BudgetMonthlyCategoryStats(
                category_name=cat.name,
                budget_amount=budget_amount,
                spent_amount=spent_amount,
                remaining_amount=remaining_amount,
                usage_percentage=usage_percentage,
                is_exceeded=spent_amount > budget_amount,
            )
        )

    categories.sort(key=lambda x: -x.usage_percentage)

    total_budget = float(current_user.total_monthly_budget) if current_user.total_monthly_budget else total_budget_sum or None

    return BudgetMonthlyStatsResponse(
        month=month,
        total_budget=total_budget,
        total_spent=total_spent_sum,
        categories=categories,
    )


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: int,
    budget_data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예산 수정

    가구 예산이면 가구 멤버 권한 확인, 개인 예산이면 소유자 확인 후 수정합니다.
    """
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예산을 찾을 수 없습니다")

    # 접근 권한 확인
    if budget.household_id is not None:
        await get_household_member(budget.household_id, current_user, db)
    elif budget.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예산을 찾을 수 없습니다")

    update_data = budget_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)

    if budget.end_date and budget.end_date < budget.start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="종료일은 시작일 이후여야 합니다")

    await db.commit()
    await db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예산 삭제

    가구 예산이면 가구 멤버 권한 확인, 개인 예산이면 소유자 확인 후 삭제합니다.
    """
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예산을 찾을 수 없습니다")

    # 접근 권한 확인
    if budget.household_id is not None:
        await get_household_member(budget.household_id, current_user, db)
    elif budget.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예산을 찾을 수 없습니다")

    await db.delete(budget)
    await db.commit()

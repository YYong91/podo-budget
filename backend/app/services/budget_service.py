"""예산 비즈니스 로직

예산 알림 조회, 카테고리 개요 등 복잡한 집계 로직을 담당합니다. (#176)
API 레이어는 HTTP 처리에 집중하고, 비즈니스 로직은 여기에서 관리합니다.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.schemas.budget import BudgetAlert, CategoryBudgetOverview, MonthlySpending


async def get_budget_alerts(db: AsyncSession, household_id: int, *, month: str | None = None) -> list[BudgetAlert]:
    """예산 초과/경고 알림 계산 (#176)

    카테고리별 예산과 현재까지의 지출을 비교하여 알림 목록을 반환합니다.
    배치 쿼리로 N+1 방지: 카테고리 1회, period별 지출 최대 3회.

    Args:
        db: 데이터베이스 세션
        household_id: 가구 ID
        month: 대상 월 YYYY-MM (None이면 현재 월)

    Returns:
        초과/경고 순으로 정렬된 BudgetAlert 목록
    """
    result = await db.execute(select(Budget).where(Budget.household_id == household_id))
    budgets = result.scalars().all()

    alerts: list[BudgetAlert] = []
    now = datetime.now(UTC).replace(tzinfo=None)

    # month 파라미터가 있으면 해당 월 기준, 없으면 현재 시점 기준
    if month:
        year, mon = map(int, month.split("-"))
        ref_date = datetime(year, mon, 1)
    else:
        ref_date = now

    # 유효한 예산만 필터 (기간 미시작 제외)
    active_budgets = [b for b in budgets if b.start_date <= ref_date]
    if not active_budgets:
        return alerts

    # 카테고리 배치 조회 (1 쿼리)
    category_ids = [b.category_id for b in active_budgets]
    cat_result = await db.execute(select(Category).where(Category.id.in_(category_ids)))
    categories_map = {c.id: c for c in cat_result.scalars().all()}

    # period_start/period_end별로 예산 그룹화
    budgets_by_period: dict[tuple[datetime, datetime], list[dict[str, Any]]] = {}
    for budget in active_budgets:
        if month:
            # month 지정 시: 해당 월 전체 기간으로 고정
            period_start = datetime(year, mon, 1)
            period_end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)
        elif budget.period == "monthly":
            period_start = datetime(now.year, now.month, 1)
            period_end = now
        elif budget.period == "weekly":
            days_since_monday = now.weekday()
            period_start = datetime(now.year, now.month, now.day) - timedelta(days=days_since_monday)
            period_end = now
        else:  # daily
            period_start = datetime(now.year, now.month, now.day)
            period_end = now
        budgets_by_period.setdefault((period_start, period_end), []).append(budget)

    # period별 지출 합계 배치 조회
    expense_scope = Expense.household_id == household_id
    spent_map: dict[int, float] = {}
    for (period_start, period_end), period_budgets in budgets_by_period.items():
        period_cat_ids = [b.category_id for b in period_budgets]  # type: ignore[attr-defined]
        expense_result = await db.execute(
            select(Expense.category_id, func.sum(Expense.amount).label("total"))
            .where(
                expense_scope,
                Expense.category_id.in_(period_cat_ids),
                Expense.date >= period_start,
                Expense.date < period_end,
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

        spent_amount = spent_map.get(budget.category_id, 0.0)  # type: ignore[call-overload]
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


async def get_category_overview(
    db: AsyncSession,
    household_id: int,
    user_id: int,
) -> list[CategoryBudgetOverview]:
    """카테고리별 예산 개요 조회 — 인라인 예산 편집 화면용 (#176)

    모든 지출 카테고리와 함께 최근 3개월 지출액, 현재 예산 정보를 반환합니다.

    Args:
        db: 데이터베이스 세션
        household_id: 가구 ID
        user_id: 현재 사용자 ID (솔로 카테고리 필터용)

    Returns:
        CategoryBudgetOverview 목록 (카테고리명 오름차순)
    """
    expense_scope = Expense.household_id == household_id
    budget_scope = Budget.household_id == household_id
    now = datetime.now(UTC).replace(tzinfo=None)

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
        and_(Category.user_id == user_id, Category.household_id.is_(None)),  # 솔로 폴백
        Category.household_id == household_id,  # 가계
    ]
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
            budget_map[budget.category_id] = budget  # type: ignore[index]

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
    return [
        CategoryBudgetOverview(
            category_id=cat.id,
            category_name=cat.name,
            monthly_spending=spending_map.get(cat.id, []),  # type: ignore[call-overload]
            current_budget_id=budget_map[cat.id].id if cat.id in budget_map else None,  # type: ignore[index]
            current_budget_amount=float(budget_map[cat.id].amount) if cat.id in budget_map else None,  # type: ignore[index]
            alert_threshold=float(budget_map[cat.id].alert_threshold) if cat.id in budget_map else None,  # type: ignore[index]
        )
        for cat in categories
    ]

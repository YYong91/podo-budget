"""예산 관리 API 라우트

예산 설정, 조회, 수정, 삭제 및 예산 초과 알림 기능을 제공합니다.
household_id가 있으면 가구 공유 예산, 없으면 개인 예산으로 처리합니다.
expenses/recurring과 동일한 household 패턴을 따릅니다.

복잡한 비즈니스 로직(알림, 카테고리 개요)은 budget_service로 위임 (#176)
"""

import logging
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
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
    BudgetBulkSaveRequest,
    BudgetBulkSaveResponse,
    BudgetCreate,
    BudgetMonthlyCategoryStats,
    BudgetMonthlyStatsResponse,
    BudgetResponse,
    BudgetUpdate,
    CategoryBudgetOverview,
    TotalBudgetResponse,
    TotalBudgetUpdate,
)
from app.services import budget_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _budget_scope_filter(household_id: int):
    """예산 조회 범위 필터 — 가구 기반"""
    return Budget.household_id == household_id


def _expense_scope_filter(household_id: int):
    """지출 조회 범위 필터 — 가구 기반"""
    return Expense.household_id == household_id


@router.get("", response_model=list[BudgetResponse])
async def get_budgets(
    household_id: int | None = Query(None, description="가구 ID (없으면 개인 예산)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """전체 예산 목록 조회

    household_id가 있으면 가구 공유 예산, 없으면 개인 예산을 반환합니다.
    """
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    scope_filter = _budget_scope_filter(household_id)
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
    logger.info("예산 생성: user=%s, category_id=%s, amount=%s", current_user.id, budget_data.category_id, budget_data.amount)
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


# NOTE: 고정 경로 엔드포인트(alerts, category-overview, monthly-stats, total-budget, bulk)를 반드시 /{budget_id} 앞에 정의해야 함.
# FastAPI 0.109 (Starlette 0.35)에서는 /{budget_id} partial match 후 탐색을 멈춰
# 뒤에 정의된 고정 경로가 Method Not Allowed를 반환하는 버그가 있음.


@router.put("/bulk", response_model=BudgetBulkSaveResponse)
async def bulk_save_budgets(
    data: BudgetBulkSaveRequest,
    household_id: int | None = Query(None, description="가구 ID (없으면 활성 가구 자동 감지)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """월별 예산 벌크 저장

    해당 월의 전체 예산을 한번에 갱신합니다.
    요청에 포함된 카테고리는 생성/업데이트, 누락된 기존 예산은 삭제됩니다.
    """
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    year, mon = map(int, data.month.split("-"))
    start_date = datetime(year, mon, 1)

    # 해당 월의 기존 예산 조회
    existing_result = await db.execute(
        select(Budget).where(
            Budget.household_id == household_id,
            Budget.period == "monthly",
            Budget.start_date == start_date,
        )
    )
    existing_budgets = {b.category_id: b for b in existing_result.scalars().all()}

    # 요청 카테고리 ID 집합
    request_category_ids = {item.category_id for item in data.budgets}

    created = 0
    updated = 0
    deleted = 0

    # 생성/업데이트
    for item in data.budgets:
        if item.category_id in existing_budgets:
            # 기존 예산 업데이트
            budget = existing_budgets[item.category_id]
            budget.amount = item.amount
            budget.alert_threshold = data.alert_threshold
            updated += 1
        else:
            # 새 예산 생성
            new_budget = Budget(
                user_id=current_user.id,
                household_id=household_id,
                category_id=item.category_id,
                amount=item.amount,
                period="monthly",
                start_date=start_date,
                alert_threshold=data.alert_threshold,
            )
            db.add(new_budget)
            created += 1

    # 요청에 없는 기존 예산 삭제
    for cat_id, budget in existing_budgets.items():
        if cat_id not in request_category_ids:
            await db.delete(budget)
            deleted += 1

    await db.commit()
    logger.info(
        "예산 벌크 저장: user=%s, household=%s, month=%s, created=%d, updated=%d, deleted=%d",
        current_user.id,
        household_id,
        data.month,
        created,
        updated,
        deleted,
    )
    return BudgetBulkSaveResponse(created=created, updated=updated, deleted=deleted)


@router.get("/alerts", response_model=list[BudgetAlert])
async def get_budget_alerts(
    household_id: int | None = Query(None, description="가구 ID (없으면 개인 예산)"),
    month: str | None = Query(None, description="YYYY-MM 형식 (없으면 현재 월)", pattern=r"^\d{4}-\d{2}$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예산 초과/경고 알림 조회 (로직은 budget_service에서 처리, #176)"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    return await budget_service.get_budget_alerts(db, household_id, month=month)


@router.get("/category-overview", response_model=list[CategoryBudgetOverview])
async def get_category_overview(
    household_id: int | None = Query(None, description="가구 ID (없으면 개인 예산)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """카테고리별 예산 개요 조회 — 인라인 예산 편집 화면용 (로직은 budget_service에서 처리, #176)"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    return await budget_service.get_category_overview(db, household_id, current_user.id)


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
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    budget_scope = _budget_scope_filter(household_id)
    expense_scope = _expense_scope_filter(household_id)

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

    # 접근 권한 확인: 가구 멤버인지 검증
    if budget.household_id is not None:
        try:
            await get_household_member(budget.household_id, current_user, db)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예산을 찾을 수 없습니다") from None
    else:
        if budget.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예산을 찾을 수 없습니다") from None

    update_data = budget_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)

    # DB 컬럼(DateTime)과 스키마(date) 혼용 방지: 둘 다 date로 정규화 후 비교
    def _as_date(val: datetime | date | None) -> date | None:
        if val is None:
            return None
        return val.date() if isinstance(val, datetime) else val

    if budget.end_date and _as_date(budget.end_date) < _as_date(budget.start_date):
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

    # 접근 권한 확인: 가구 멤버인지 검증
    if budget.household_id is not None:
        try:
            await get_household_member(budget.household_id, current_user, db)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예산을 찾을 수 없습니다") from None
    else:
        if budget.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예산을 찾을 수 없습니다") from None

    await db.delete(budget)
    await db.commit()

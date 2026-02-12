"""예산 관리 API 라우트

예산 설정, 조회, 수정, 삭제 및 예산 초과 알림 기능을 제공합니다.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.schemas.budget import BudgetAlert, BudgetCreate, BudgetResponse, BudgetUpdate

router = APIRouter()


@router.get("/", response_model=list[BudgetResponse])
async def get_budgets(db: AsyncSession = Depends(get_db)):
    """전체 예산 목록 조회

    설정된 모든 예산을 반환합니다.

    Args:
        db: 데이터베이스 세션

    Returns:
        예산 목록 (생성일 역순)
    """
    result = await db.execute(select(Budget).order_by(Budget.created_at.desc()))
    budgets = result.scalars().all()
    return budgets


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(budget_data: BudgetCreate, db: AsyncSession = Depends(get_db)):
    """예산 생성

    특정 카테고리에 대한 예산을 설정합니다.

    Args:
        budget_data: 예산 생성 정보
        db: 데이터베이스 세션

    Returns:
        생성된 예산 정보

    Raises:
        HTTPException 404: 카테고리가 존재하지 않는 경우
        HTTPException 400: 종료일이 시작일보다 이른 경우
    """
    # 카테고리 존재 여부 확인
    result = await db.execute(select(Category).where(Category.id == budget_data.category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"카테고리 ID {budget_data.category_id}를 찾을 수 없습니다",
        )

    # 종료일 검증 (종료일이 있는 경우 시작일보다 이후여야 함)
    if budget_data.end_date and budget_data.end_date < budget_data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료일은 시작일 이후여야 합니다",
        )

    # Budget 생성
    new_budget = Budget(
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


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(budget_id: int, budget_data: BudgetUpdate, db: AsyncSession = Depends(get_db)):
    """예산 수정

    기존 예산의 정보를 업데이트합니다. 제공된 필드만 수정됩니다.

    Args:
        budget_id: 예산 ID
        budget_data: 수정할 필드들
        db: 데이터베이스 세션

    Returns:
        수정된 예산 정보

    Raises:
        HTTPException 404: 예산을 찾을 수 없는 경우
        HTTPException 400: 종료일이 시작일보다 이른 경우
    """
    # 예산 조회
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"예산 ID {budget_id}를 찾을 수 없습니다",
        )

    # 제공된 필드만 업데이트
    update_data = budget_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)

    # 종료일 검증
    if budget.end_date and budget.end_date < budget.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료일은 시작일 이후여야 합니다",
        )

    await db.commit()
    await db.refresh(budget)

    return budget


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(budget_id: int, db: AsyncSession = Depends(get_db)):
    """예산 삭제

    Args:
        budget_id: 예산 ID
        db: 데이터베이스 세션

    Raises:
        HTTPException 404: 예산을 찾을 수 없는 경우
    """
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"예산 ID {budget_id}를 찾을 수 없습니다",
        )

    await db.delete(budget)
    await db.commit()


@router.get("/alerts", response_model=list[BudgetAlert])
async def get_budget_alerts(db: AsyncSession = Depends(get_db)):
    """예산 초과/경고 알림 조회

    각 카테고리별로 설정된 예산과 현재까지의 지출을 비교하여
    예산 초과 또는 경고 임계값 도달 여부를 알려줍니다.

    예산 기간(period) 내의 지출만 집계됩니다.
    - monthly: 시작일~종료일 또는 현재까지
    - weekly, daily: 마찬가지로 기간 내 지출 집계

    Args:
        db: 데이터베이스 세션

    Returns:
        예산 알림 목록 (초과/경고 있는 것 우선, 사용률 높은 순)
    """
    # 모든 활성 예산 조회
    result = await db.execute(select(Budget))
    budgets = result.scalars().all()

    alerts = []
    now = datetime.now()

    for budget in budgets:
        # 예산 기간 내의 지출 집계
        # 종료일이 없으면 현재까지, 있으면 종료일까지
        end_date = budget.end_date if budget.end_date else now

        # 예산이 아직 시작되지 않았으면 스킵
        if budget.start_date > now:
            continue

        # 카테고리 정보 조회
        category_result = await db.execute(select(Category).where(Category.id == budget.category_id))
        category = category_result.scalar_one_or_none()
        if not category:
            continue

        # 해당 카테고리의 기간 내 지출 합계
        expense_result = await db.execute(
            select(func.sum(Expense.amount))
            .where(Expense.category_id == budget.category_id)
            .where(Expense.date >= budget.start_date)
            .where(Expense.date <= end_date)
        )
        spent_amount = expense_result.scalar() or 0.0

        # 사용률 계산
        usage_percentage = (spent_amount / budget.amount * 100) if budget.amount > 0 else 0
        remaining_amount = budget.amount - spent_amount
        is_exceeded = spent_amount > budget.amount
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

    # 초과/경고 우선, 사용률 높은 순으로 정렬
    alerts.sort(key=lambda x: (not x.is_exceeded, not x.is_warning, -x.usage_percentage))

    return alerts

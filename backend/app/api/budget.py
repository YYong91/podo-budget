"""예산 관리 API 라우트

예산 설정, 조회, 수정, 삭제 및 예산 초과 알림 기능을 제공합니다.
사용자별로 예산 데이터를 격리하여 관리합니다.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User
from app.schemas.budget import BudgetAlert, BudgetCreate, BudgetResponse, BudgetUpdate

router = APIRouter()


@router.get("/", response_model=list[BudgetResponse])
async def get_budgets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """전체 예산 목록 조회

    현재 로그인한 사용자의 예산만 반환합니다.

    Args:
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        예산 목록 (생성일 역순)
    """
    result = await db.execute(select(Budget).where(Budget.user_id == current_user.id).order_by(Budget.created_at.desc()))
    budgets = result.scalars().all()
    return budgets


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    budget_data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예산 생성

    현재 사용자의 예산을 생성합니다.
    user_id는 자동으로 현재 로그인한 사용자로 설정됩니다.

    Args:
        budget_data: 예산 생성 정보
        current_user: 현재 인증된 사용자
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
            detail="카테고리를 찾을 수 없습니다",
        )

    # 종료일 검증 (종료일이 있는 경우 시작일보다 이후여야 함)
    if budget_data.end_date and budget_data.end_date < budget_data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료일은 시작일 이후여야 합니다",
        )

    # Budget 생성
    new_budget = Budget(
        user_id=current_user.id,
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
async def update_budget(
    budget_id: int,
    budget_data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예산 수정

    현재 로그인한 사용자의 예산만 수정할 수 있습니다.
    제공된 필드만 수정됩니다.

    Args:
        budget_id: 예산 ID
        budget_data: 수정할 필드들
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        수정된 예산 정보

    Raises:
        HTTPException 404: 예산을 찾을 수 없거나 소유자가 아닌 경우
        HTTPException 400: 종료일이 시작일보다 이른 경우
    """
    # 예산 조회 (소유자 확인 포함)
    result = await db.execute(select(Budget).where(Budget.id == budget_id, Budget.user_id == current_user.id))
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="예산을 찾을 수 없습니다",
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
async def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예산 삭제

    현재 로그인한 사용자의 예산만 삭제할 수 있습니다.

    Args:
        budget_id: 예산 ID
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Raises:
        HTTPException 404: 예산을 찾을 수 없거나 소유자가 아닌 경우
    """
    result = await db.execute(select(Budget).where(Budget.id == budget_id, Budget.user_id == current_user.id))
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="예산을 찾을 수 없습니다",
        )

    await db.delete(budget)
    await db.commit()


@router.get("/alerts", response_model=list[BudgetAlert])
async def get_budget_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """예산 초과/경고 알림 조회

    현재 로그인한 사용자의 예산 알림만 조회합니다.
    각 카테고리별로 설정된 예산과 현재까지의 지출을 비교하여
    예산 초과 또는 경고 임계값 도달 여부를 알려줍니다.

    예산 기간(period) 내의 지출만 집계됩니다.
    - monthly: 시작일~종료일 또는 현재까지
    - weekly, daily: 마찬가지로 기간 내 지출 집계

    Args:
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        예산 알림 목록 (초과/경고 있는 것 우선, 사용률 높은 순)
    """
    # 현재 사용자의 활성 예산 조회
    result = await db.execute(select(Budget).where(Budget.user_id == current_user.id))
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

        # 해당 카테고리의 기간 내 지출 합계 (사용자 필터 추가)
        expense_result = await db.execute(
            select(func.sum(Expense.amount)).where(
                Expense.user_id == current_user.id,
                Expense.category_id == budget.category_id,
                Expense.date >= budget.start_date,
                Expense.date <= end_date,
            )
        )
        spent_amount = float(expense_result.scalar() or 0)

        # 사용률 계산
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

    # 초과/경고 우선, 사용률 높은 순으로 정렬
    alerts.sort(key=lambda x: (not x.is_exceeded, not x.is_warning, -x.usage_percentage))

    return alerts

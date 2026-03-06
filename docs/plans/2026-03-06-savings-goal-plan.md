# Phase 2: 저축 목표 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 가족 단위 저축 목표 설정, 자산 연결, 달성률/필요 저축액/필요 수익률 자동 계산, 저축 여력 분석

**Architecture:** SavingsGoal + GoalAssetLink(M2M) + GoalContribution 모델. Phase 1 Asset/AssetSnapshot과 연동하여 실시간 평가액 기반 달성률 계산. 기존 지출/수입 데이터로 저축 여력 산출.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, React 19, Tailwind CSS v4 (Grape), Recharts

**선행 조건:** Phase 1 (자산/부채 현황) 완료

---

### Task 1: SavingsGoal, GoalAssetLink, GoalContribution 모델 정의

**Files:**
- Create: `backend/app/models/savings_goal.py`
- Create: `backend/app/models/goal_asset_link.py`
- Create: `backend/app/models/goal_contribution.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: SavingsGoal 모델 생성**

```python
# backend/app/models/savings_goal.py
from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class SavingsGoal(Base):
    __tablename__ = "savings_goals"
    __table_args__ = (
        Index("ix_savings_goals_household_id", "household_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # "내 집 마련", "노후 연금" 등
    target_amount = Column(Numeric(18, 2), nullable=False)
    target_date = Column(Date, nullable=False)
    priority = Column(Integer, nullable=False, default=0)  # 낮을수록 높은 우선순위
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="savings_goals")
    household = relationship("Household", backref="savings_goals")
    linked_assets = relationship("GoalAssetLink", back_populates="goal", cascade="all, delete-orphan")
    contributions = relationship("GoalContribution", back_populates="goal", cascade="all, delete-orphan")
```

**Step 2: GoalAssetLink 모델 생성 (M2M)**

```python
# backend/app/models/goal_asset_link.py
from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class GoalAssetLink(Base):
    __tablename__ = "goal_asset_links"
    __table_args__ = (
        UniqueConstraint("goal_id", "asset_id", name="uq_goal_asset"),
    )

    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("savings_goals.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    goal = relationship("SavingsGoal", back_populates="linked_assets")
    asset = relationship("Asset")
```

**Step 3: GoalContribution 모델 생성**

```python
# backend/app/models/goal_contribution.py
from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    __table_args__ = (
        Index("ix_goal_contributions_goal_month", "goal_id", "month"),
    )

    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("savings_goals.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Numeric(18, 2), nullable=False)
    month = Column(Date, nullable=False)  # 월 단위 (YYYY-MM-01)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    goal = relationship("SavingsGoal", back_populates="contributions")
    user = relationship("User")
```

**Step 4: models/__init__.py에 등록**

`backend/app/models/__init__.py`에 추가:
```python
from app.models.savings_goal import SavingsGoal
from app.models.goal_asset_link import GoalAssetLink
from app.models.goal_contribution import GoalContribution

# __all__에 "SavingsGoal", "GoalAssetLink", "GoalContribution" 추가
```

**Step 5: Commit**

```bash
git add backend/app/models/savings_goal.py backend/app/models/goal_asset_link.py backend/app/models/goal_contribution.py backend/app/models/__init__.py
git commit -m "feat: SavingsGoal, GoalAssetLink, GoalContribution 모델 정의"
```

---

### Task 2: Alembic 마이그레이션

**Files:**
- Create: `backend/alembic/versions/<auto>_add_savings_goals_tables.py`

**Step 1: 마이그레이션 생성**

```bash
cd backend
alembic revision --autogenerate -m "add savings_goals goal_asset_links goal_contributions tables"
```

**Step 2: 마이그레이션 파일 확인**

- `savings_goals` 테이블 생성 확인
- `goal_asset_links` 테이블 + `uq_goal_asset` unique constraint 확인
- `goal_contributions` 테이블 확인
- SQLite batch_alter_table 필요 시 수정

**Step 3: 마이그레이션 적용**

```bash
alembic upgrade head
```

**Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "chore: 저축 목표 테이블 마이그레이션 추가"
```

---

### Task 3: Pydantic 스키마

**Files:**
- Create: `backend/app/schemas/savings_goal.py`

**Step 1: 스키마 정의**

```python
# backend/app/schemas/savings_goal.py
from datetime import date, datetime

from pydantic import BaseModel, Field


class GoalBase(BaseModel):
    name: str
    target_amount: float = Field(..., gt=0)
    target_date: date
    priority: int = 0
    memo: str | None = None


class GoalCreate(GoalBase):
    household_id: int | None = None


class GoalUpdate(BaseModel):
    name: str | None = None
    target_amount: float | None = Field(None, gt=0)
    target_date: date | None = None
    priority: int | None = None
    memo: str | None = None


class GoalAssetLinkRequest(BaseModel):
    asset_ids: list[int]  # 연결할 자산 ID 목록


class GoalContributionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    month: date  # YYYY-MM-01


class GoalContributionResponse(BaseModel):
    id: int
    goal_id: int
    user_id: int
    amount: float
    month: date
    created_at: datetime

    class Config:
        from_attributes = True


class LinkedAssetInfo(BaseModel):
    """목표에 연결된 자산 정보 (평가액 포함)"""
    asset_id: int
    name: str
    type: str
    current_value: float | None = None


class GoalCalculations(BaseModel):
    """목표 자동 계산 결과"""
    current_allocated: float  # 배정 자산 평가액 합계
    achievement_pct: float  # 달성률 %
    remaining_amount: float  # 남은 금액
    remaining_months: int  # 남은 개월 수
    required_monthly_savings: float  # 필요 월 저축액
    required_annual_return_pct: float | None  # 필요 연 수익률 %
    estimated_completion_date: date | None  # 현재 속도 기반 예상 달성일


class GoalResponse(GoalBase):
    id: int
    household_id: int | None = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    linked_assets: list[LinkedAssetInfo] = []
    calculations: GoalCalculations | None = None

    class Config:
        from_attributes = True


class GoalSummary(BaseModel):
    """전체 목표 요약"""
    total_goals: int
    total_target_amount: float
    total_allocated: float
    total_achievement_pct: float
    total_required_monthly_savings: float
    monthly_savings_capacity: float | None = None  # 월 수입 - 월 지출 - 월 대출상환
    savings_gap: float | None = None  # 필요 저축액 - 저축 여력 (양수면 부족)
```

**Step 2: Commit**

```bash
git add backend/app/schemas/savings_goal.py
git commit -m "feat: 저축 목표 Pydantic 스키마 정의"
```

---

### Task 4: 저축 목표 서비스 (비즈니스 로직)

**Files:**
- Create: `backend/app/services/goal_service.py`

**Step 1: 목표 CRUD + 계산 로직**

```python
# backend/app/services/goal_service.py
"""저축 목표 비즈니스 로직"""
import math
from datetime import date
from decimal import Decimal

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset import Asset
from app.models.goal_asset_link import GoalAssetLink
from app.models.goal_contribution import GoalContribution
from app.models.savings_goal import SavingsGoal
from app.models.expense import Expense
from app.models.income import Income
from app.models.user import User
from app.services.price_service import get_asset_current_value


async def create_goal(db: AsyncSession, goal_data: dict, user: User) -> SavingsGoal:
    """목표 생성"""
    household_id = goal_data.pop("household_id", None)
    if household_id is None:
        from app.services.asset_service import get_user_active_household_id
        household_id = await get_user_active_household_id(user, db)

    goal = SavingsGoal(**goal_data, created_by=user.id, household_id=household_id)
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


async def get_goals(db: AsyncSession, user: User, household_id: int | None = None) -> list[SavingsGoal]:
    """목표 목록 조회"""
    query = select(SavingsGoal).options(
        selectinload(SavingsGoal.linked_assets).selectinload(GoalAssetLink.asset)
    )
    if household_id is not None:
        query = query.where(SavingsGoal.household_id == household_id)
    else:
        query = query.where(SavingsGoal.created_by == user.id)
    query = query.order_by(SavingsGoal.priority, SavingsGoal.target_date)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_goal_by_id(db: AsyncSession, goal_id: int, user: User) -> SavingsGoal | None:
    """목표 상세 조회"""
    result = await db.execute(
        select(SavingsGoal)
        .options(
            selectinload(SavingsGoal.linked_assets).selectinload(GoalAssetLink.asset),
            selectinload(SavingsGoal.contributions),
        )
        .where(SavingsGoal.id == goal_id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        return None
    if goal.household_id:
        return goal  # household 멤버 체크는 API 레이어에서
    elif goal.created_by != user.id:
        return None
    return goal


async def update_goal(db: AsyncSession, goal: SavingsGoal, update_data: dict) -> SavingsGoal:
    """목표 수정"""
    for key, value in update_data.items():
        setattr(goal, key, value)
    await db.commit()
    await db.refresh(goal)
    return goal


async def delete_goal(db: AsyncSession, goal: SavingsGoal) -> None:
    """목표 삭제 (cascade로 link, contribution도 삭제)"""
    await db.delete(goal)
    await db.commit()


async def link_assets(db: AsyncSession, goal: SavingsGoal, asset_ids: list[int]) -> None:
    """목표에 자산 연결 (기존 연결 교체)"""
    # 기존 연결 삭제
    from sqlalchemy import delete
    await db.execute(delete(GoalAssetLink).where(GoalAssetLink.goal_id == goal.id))

    # 새 연결 추가
    for asset_id in asset_ids:
        link = GoalAssetLink(goal_id=goal.id, asset_id=asset_id)
        db.add(link)
    await db.commit()


async def add_contribution(db: AsyncSession, goal_id: int, user: User, amount: float, month: date) -> GoalContribution:
    """월별 저축 기록 추가"""
    # 같은 월에 이미 기록이 있으면 업데이트
    normalized_month = month.replace(day=1)
    result = await db.execute(
        select(GoalContribution).where(
            GoalContribution.goal_id == goal_id,
            GoalContribution.user_id == user.id,
            GoalContribution.month == normalized_month,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.amount = amount
        await db.commit()
        await db.refresh(existing)
        return existing

    contribution = GoalContribution(
        goal_id=goal_id, user_id=user.id, amount=amount, month=normalized_month
    )
    db.add(contribution)
    await db.commit()
    await db.refresh(contribution)
    return contribution


async def calculate_goal(db: AsyncSession, goal: SavingsGoal) -> dict:
    """목표 자동 계산

    Returns: GoalCalculations 필드 dict
    """
    # 1. 배정 자산 평가액 합산
    current_allocated = 0.0
    linked_asset_infos = []
    for link in goal.linked_assets:
        asset = link.asset
        price_info = await get_asset_current_value(asset)
        value = price_info.get("current_value") or 0
        current_allocated += value
        linked_asset_infos.append({
            "asset_id": asset.id,
            "name": asset.name,
            "type": asset.type,
            "current_value": value,
        })

    target = float(goal.target_amount)

    # 2. 달성률
    achievement_pct = (current_allocated / target * 100) if target > 0 else 0

    # 3. 남은 금액
    remaining = max(0, target - current_allocated)

    # 4. 남은 개월 수
    today = date.today()
    remaining_months = max(1, (goal.target_date.year - today.year) * 12 + (goal.target_date.month - today.month))

    # 5. 필요 월 저축액
    required_monthly = remaining / remaining_months if remaining_months > 0 else remaining

    # 6. 필요 연 수익률 (복리: FV = PV * (1 + r)^n → r = (FV/PV)^(1/n) - 1)
    required_annual_return = None
    if current_allocated > 0 and remaining > 0:
        years = remaining_months / 12
        if years > 0:
            try:
                ratio = target / current_allocated
                required_annual_return = (math.pow(ratio, 1 / years) - 1) * 100
            except (ValueError, OverflowError):
                pass

    # 7. 현재 속도 기반 예상 달성일
    # 최근 3개월 평균 월 저축액으로 추정
    estimated_completion = None
    if goal.contributions:
        recent = sorted(goal.contributions, key=lambda c: c.month, reverse=True)[:3]
        avg_monthly = sum(float(c.amount) for c in recent) / len(recent)
        if avg_monthly > 0:
            months_needed = remaining / avg_monthly
            estimated_year = today.year + int((today.month + months_needed - 1) // 12)
            estimated_month = int((today.month + months_needed - 1) % 12) + 1
            try:
                estimated_completion = date(estimated_year, estimated_month, 1)
            except ValueError:
                pass

    return {
        "current_allocated": current_allocated,
        "achievement_pct": round(achievement_pct, 1),
        "remaining_amount": remaining,
        "remaining_months": remaining_months,
        "required_monthly_savings": round(required_monthly, 0),
        "required_annual_return_pct": round(required_annual_return, 1) if required_annual_return is not None else None,
        "estimated_completion_date": estimated_completion,
        "linked_assets": linked_asset_infos,
    }


async def get_goals_summary(db: AsyncSession, user: User, household_id: int | None = None) -> dict:
    """전체 목표 요약 + 저축 여력"""
    goals = await get_goals(db, user, household_id)

    total_target = 0.0
    total_allocated = 0.0
    total_required_monthly = 0.0

    for goal in goals:
        calc = await calculate_goal(db, goal)
        total_target += float(goal.target_amount)
        total_allocated += calc["current_allocated"]
        total_required_monthly += calc["required_monthly_savings"]

    total_achievement_pct = (total_allocated / total_target * 100) if total_target > 0 else 0

    # 저축 여력 계산: 최근 3개월 평균 (수입 - 지출 - 월 대출상환)
    savings_capacity = await _calculate_savings_capacity(db, user, household_id)

    savings_gap = None
    if savings_capacity is not None:
        savings_gap = total_required_monthly - savings_capacity  # 양수면 부족

    return {
        "total_goals": len(goals),
        "total_target_amount": total_target,
        "total_allocated": total_allocated,
        "total_achievement_pct": round(total_achievement_pct, 1),
        "total_required_monthly_savings": round(total_required_monthly, 0),
        "monthly_savings_capacity": round(savings_capacity, 0) if savings_capacity is not None else None,
        "savings_gap": round(savings_gap, 0) if savings_gap is not None else None,
    }


async def _calculate_savings_capacity(db: AsyncSession, user: User, household_id: int | None) -> float | None:
    """월 저축 여력 = 최근 3개월 평균(수입 - 지출) - 월 대출상환액 합계"""
    from datetime import timedelta

    today = date.today()
    three_months_ago = today.replace(day=1) - timedelta(days=90)

    # 최근 3개월 총 수입
    income_query = select(sa_func.coalesce(sa_func.sum(Income.amount), 0))
    if household_id:
        income_query = income_query.where(Income.household_id == household_id)
    else:
        income_query = income_query.where(Income.user_id == user.id)
    income_query = income_query.where(Income.date >= three_months_ago)
    income_result = await db.execute(income_query)
    total_income = float(income_result.scalar() or 0)

    # 최근 3개월 총 지출
    expense_query = select(sa_func.coalesce(sa_func.sum(Expense.amount), 0))
    if household_id:
        expense_query = expense_query.where(Expense.household_id == household_id)
    else:
        expense_query = expense_query.where(Expense.user_id == user.id)
    expense_query = expense_query.where(Expense.date >= three_months_ago)
    expense_result = await db.execute(expense_query)
    total_expense = float(expense_result.scalar() or 0)

    # 월 평균
    avg_monthly_net = (total_income - total_expense) / 3

    # 월 대출 상환액 합계
    loan_query = select(sa_func.coalesce(sa_func.sum(Asset.monthly_payment), 0)).where(
        Asset.is_liability == True,
        Asset.monthly_payment.isnot(None),
    )
    if household_id:
        loan_query = loan_query.where(Asset.household_id == household_id)
    else:
        loan_query = loan_query.where(Asset.created_by == user.id)
    loan_result = await db.execute(loan_query)
    monthly_loan = float(loan_result.scalar() or 0)

    return avg_monthly_net - monthly_loan
```

**Step 2: Commit**

```bash
git add backend/app/services/goal_service.py
git commit -m "feat: 저축 목표 서비스 (CRUD, 자동 계산, 저축 여력)"
```

---

### Task 5: API 라우터

**Files:**
- Create: `backend/app/api/goals.py`
- Modify: `backend/app/main.py` (라우터 등록)

**Step 1: goals API 라우터**

```python
# backend/app/api/goals.py
"""저축 목표 API"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.savings_goal import (
    GoalContributionCreate,
    GoalContributionResponse,
    GoalCreate,
    GoalResponse,
    GoalSummary,
    GoalUpdate,
    GoalAssetLinkRequest,
)
from app.services import goal_service

router = APIRouter()


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """저축 목표 생성"""
    goal_data = goal.model_dump()
    result = await goal_service.create_goal(db, goal_data, current_user)
    calc = await goal_service.calculate_goal(db, result)
    return _build_goal_response(result, calc)


@router.get("", response_model=list[GoalResponse])
async def get_goals(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """저축 목표 목록"""
    if household_id is not None:
        from app.api.dependencies import get_household_member
        await get_household_member(household_id, current_user, db)
    goals = await goal_service.get_goals(db, current_user, household_id)
    results = []
    for goal in goals:
        calc = await goal_service.calculate_goal(db, goal)
        results.append(_build_goal_response(goal, calc))
    return results


@router.get("/summary", response_model=GoalSummary)
async def get_summary(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """전체 목표 요약 (필요 저축액 합산, 저축 여력)"""
    if household_id is not None:
        from app.api.dependencies import get_household_member
        await get_household_member(household_id, current_user, db)
    return await goal_service.get_goals_summary(db, current_user, household_id)


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """저축 목표 상세 + 계산 결과"""
    goal = await goal_service.get_goal_by_id(db, goal_id, current_user)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="목표를 찾을 수 없습니다")
    if goal.household_id:
        from app.api.dependencies import get_household_member
        await get_household_member(goal.household_id, current_user, db)
    calc = await goal_service.calculate_goal(db, goal)
    return _build_goal_response(goal, calc)


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: int,
    goal_update: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """저축 목표 수정 (본인 생성분만)"""
    from sqlalchemy import select
    from app.models.savings_goal import SavingsGoal
    result = await db.execute(select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.created_by == current_user.id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="목표를 찾을 수 없습니다")
    update_data = goal_update.model_dump(exclude_unset=True)
    updated = await goal_service.update_goal(db, goal, update_data)
    calc = await goal_service.calculate_goal(db, updated)
    return _build_goal_response(updated, calc)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """저축 목표 삭제 (본인 생성분만)"""
    from sqlalchemy import select
    from app.models.savings_goal import SavingsGoal
    result = await db.execute(select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.created_by == current_user.id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="목표를 찾을 수 없습니다")
    await goal_service.delete_goal(db, goal)


@router.post("/{goal_id}/link", status_code=status.HTTP_200_OK)
async def link_assets(
    goal_id: int,
    req: GoalAssetLinkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """목표에 자산 연결/교체"""
    goal = await goal_service.get_goal_by_id(db, goal_id, current_user)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="목표를 찾을 수 없습니다")
    await goal_service.link_assets(db, goal, req.asset_ids)
    return {"message": "자산이 연결되었습니다", "linked_count": len(req.asset_ids)}


@router.post("/{goal_id}/contributions", response_model=GoalContributionResponse, status_code=status.HTTP_201_CREATED)
async def add_contribution(
    goal_id: int,
    contribution: GoalContributionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """월별 저축 기록 추가"""
    goal = await goal_service.get_goal_by_id(db, goal_id, current_user)
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="목표를 찾을 수 없습니다")
    return await goal_service.add_contribution(db, goal_id, current_user, contribution.amount, contribution.month)


def _build_goal_response(goal, calc: dict) -> dict:
    """GoalResponse 빌드 헬퍼"""
    return {
        "id": goal.id,
        "household_id": goal.household_id,
        "created_by": goal.created_by,
        "name": goal.name,
        "target_amount": float(goal.target_amount),
        "target_date": goal.target_date,
        "priority": goal.priority,
        "memo": goal.memo,
        "created_at": goal.created_at,
        "updated_at": goal.updated_at,
        "linked_assets": calc.get("linked_assets", []),
        "calculations": {
            "current_allocated": calc["current_allocated"],
            "achievement_pct": calc["achievement_pct"],
            "remaining_amount": calc["remaining_amount"],
            "remaining_months": calc["remaining_months"],
            "required_monthly_savings": calc["required_monthly_savings"],
            "required_annual_return_pct": calc["required_annual_return_pct"],
            "estimated_completion_date": calc.get("estimated_completion_date"),
        },
    }
```

**Step 2: main.py에 라우터 등록**

`backend/app/main.py` 수정:
- import 행에 `goals` 추가: `from app.api import ..., goals`
- 라우터 등록 추가: `app.include_router(goals.router, prefix="/api/goals", tags=["goals"])`

**Step 3: Commit**

```bash
git add backend/app/api/goals.py backend/app/main.py
git commit -m "feat: 저축 목표 API 라우터 (CRUD, 자산 연결, 저축 기록, 요약)"
```

---

### Task 6: 백엔드 테스트

**Files:**
- Create: `backend/tests/test_goals.py`

**Step 1: 저축 목표 테스트**

```python
# backend/tests/test_goals.py
"""저축 목표 API 테스트"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_goal(authenticated_client: AsyncClient):
    """목표 생성"""
    resp = await authenticated_client.post("/api/goals", json={
        "name": "내 집 마련",
        "target_amount": 500000000,
        "target_date": "2030-01-01",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "내 집 마련"
    assert data["target_amount"] == 500000000
    assert data["calculations"]["achievement_pct"] == 0


@pytest.mark.asyncio
async def test_get_goals_list(authenticated_client: AsyncClient):
    """목표 목록 조회"""
    await authenticated_client.post("/api/goals", json={"name": "목표1", "target_amount": 100000000, "target_date": "2028-01-01"})
    await authenticated_client.post("/api/goals", json={"name": "목표2", "target_amount": 50000000, "target_date": "2027-06-01"})

    resp = await authenticated_client.get("/api/goals")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_goal_with_linked_asset(authenticated_client: AsyncClient):
    """자산 연결 후 달성률 계산"""
    # 자산 생성 (수동 평가액 1억)
    asset_resp = await authenticated_client.post("/api/assets", json={
        "name": "예금", "type": "deposit", "manual_value": 100000000,
    })
    asset_id = asset_resp.json()["id"]

    # 목표 생성 (5억)
    goal_resp = await authenticated_client.post("/api/goals", json={
        "name": "내 집 마련", "target_amount": 500000000, "target_date": "2030-01-01",
    })
    goal_id = goal_resp.json()["id"]

    # 자산 연결
    link_resp = await authenticated_client.post(f"/api/goals/{goal_id}/link", json={"asset_ids": [asset_id]})
    assert link_resp.status_code == 200

    # 상세 조회 → 달성률 20%
    detail = await authenticated_client.get(f"/api/goals/{goal_id}")
    assert detail.status_code == 200
    calc = detail.json()["calculations"]
    assert calc["current_allocated"] == 100000000
    assert calc["achievement_pct"] == 20.0


@pytest.mark.asyncio
async def test_update_goal(authenticated_client: AsyncClient):
    """목표 수정"""
    resp = await authenticated_client.post("/api/goals", json={"name": "목표", "target_amount": 100000000, "target_date": "2028-01-01"})
    goal_id = resp.json()["id"]

    update_resp = await authenticated_client.put(f"/api/goals/{goal_id}", json={"target_amount": 200000000})
    assert update_resp.status_code == 200
    assert update_resp.json()["target_amount"] == 200000000


@pytest.mark.asyncio
async def test_delete_goal(authenticated_client: AsyncClient):
    """목표 삭제"""
    resp = await authenticated_client.post("/api/goals", json={"name": "삭제목표", "target_amount": 50000000, "target_date": "2027-01-01"})
    goal_id = resp.json()["id"]

    del_resp = await authenticated_client.delete(f"/api/goals/{goal_id}")
    assert del_resp.status_code == 204

    get_resp = await authenticated_client.get(f"/api/goals/{goal_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_add_contribution(authenticated_client: AsyncClient):
    """월별 저축 기록"""
    resp = await authenticated_client.post("/api/goals", json={"name": "목표", "target_amount": 100000000, "target_date": "2028-01-01"})
    goal_id = resp.json()["id"]

    contrib_resp = await authenticated_client.post(f"/api/goals/{goal_id}/contributions", json={
        "amount": 2000000, "month": "2026-03-01",
    })
    assert contrib_resp.status_code == 201
    assert contrib_resp.json()["amount"] == 2000000


@pytest.mark.asyncio
async def test_goals_summary(authenticated_client: AsyncClient):
    """전체 목표 요약"""
    await authenticated_client.post("/api/goals", json={"name": "목표1", "target_amount": 100000000, "target_date": "2028-01-01"})
    await authenticated_client.post("/api/goals", json={"name": "목표2", "target_amount": 50000000, "target_date": "2027-01-01"})

    resp = await authenticated_client.get("/api/goals/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_goals"] == 2
    assert data["total_target_amount"] == 150000000


@pytest.mark.asyncio
async def test_goal_isolation(authenticated_client: AsyncClient, authenticated_client_2: AsyncClient):
    """다른 유저 목표 접근 불가"""
    resp = await authenticated_client.post("/api/goals", json={"name": "내 목표", "target_amount": 100000000, "target_date": "2028-01-01"})
    goal_id = resp.json()["id"]

    other_resp = await authenticated_client_2.get(f"/api/goals/{goal_id}")
    assert other_resp.status_code == 404
```

**Step 2: 테스트 실행**

```bash
cd backend && pytest tests/test_goals.py -v
```

**Step 3: Commit**

```bash
git add backend/tests/test_goals.py
git commit -m "test: 저축 목표 API 테스트 (CRUD, 자산 연결, 저축 기록, 격리)"
```

---

### Task 7: 프론트엔드 타입 + API 클라이언트

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/goals.ts`

**Step 1: 타입 정의 추가**

`frontend/src/types/index.ts`에 추가:

```typescript
export interface LinkedAssetInfo {
  asset_id: number
  name: string
  type: string
  current_value: number | null
}

export interface GoalCalculations {
  current_allocated: number
  achievement_pct: number
  remaining_amount: number
  remaining_months: number
  required_monthly_savings: number
  required_annual_return_pct: number | null
  estimated_completion_date: string | null
}

export interface SavingsGoal {
  id: number
  household_id: number | null
  created_by: number
  name: string
  target_amount: number
  target_date: string
  priority: number
  memo: string | null
  created_at: string
  updated_at: string
  linked_assets: LinkedAssetInfo[]
  calculations: GoalCalculations | null
}

export interface GoalSummary {
  total_goals: number
  total_target_amount: number
  total_allocated: number
  total_achievement_pct: number
  total_required_monthly_savings: number
  monthly_savings_capacity: number | null
  savings_gap: number | null
}

export interface GoalContribution {
  id: number
  goal_id: number
  user_id: number
  amount: number
  month: string
  created_at: string
}
```

**Step 2: API 클라이언트**

```typescript
// frontend/src/api/goals.ts
import apiClient from './client'
import type { SavingsGoal, GoalSummary, GoalContribution } from '../types'

interface CreateGoalParams {
  name: string
  target_amount: number
  target_date: string
  priority?: number
  memo?: string | null
  household_id?: number | null
}

export const goalApi = {
  getAll: (householdId?: number) =>
    apiClient.get<SavingsGoal[]>('/goals', { params: householdId != null ? { household_id: householdId } : undefined }),

  getById: (id: number) =>
    apiClient.get<SavingsGoal>(`/goals/${id}`),

  create: (data: CreateGoalParams) =>
    apiClient.post<SavingsGoal>('/goals', data),

  update: (id: number, data: Partial<CreateGoalParams>) =>
    apiClient.put<SavingsGoal>(`/goals/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/goals/${id}`),

  linkAssets: (goalId: number, assetIds: number[]) =>
    apiClient.post(`/goals/${goalId}/link`, { asset_ids: assetIds }),

  addContribution: (goalId: number, amount: number, month: string) =>
    apiClient.post<GoalContribution>(`/goals/${goalId}/contributions`, { amount, month }),

  getSummary: (householdId?: number) =>
    apiClient.get<GoalSummary>('/goals/summary', { params: householdId != null ? { household_id: householdId } : undefined }),
}
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/goals.ts
git commit -m "feat: 프론트엔드 SavingsGoal 타입 및 API 클라이언트"
```

---

### Task 8: 저축 목표 목록 페이지

**Files:**
- Create: `frontend/src/pages/GoalList.tsx`
- Modify: `frontend/src/App.tsx` (라우트 추가)
- Modify: `frontend/src/components/Layout.tsx` (사이드바 메뉴 추가)

**Step 1: GoalList 컴포넌트**

저축 목표 목록 페이지 구현:
- **상단 요약 카드**: 전체 목표 요약 (`/api/goals/summary`)
  - 총 필요 월 저축액 vs 월 저축 여력 (부족하면 빨간색)
  - 전체 달성률
- **목표 카드 목록**: 각 카드에
  - 목표명 + 목표 금액 + 목표일
  - 프로그레스 바 (달성률 %)
  - 현재 배정 자산 합계 / 목표 금액
  - 필요 월 저축액
  - 필요 연 수익률 (있으면)
  - 클릭 → `/goals/{id}` 상세
- **우측 상단**: "목표 추가" 버튼 → `/goals/new`

Grape 디자인 시스템 사용. 프로그레스 바는 grape 색상.

**Step 2: App.tsx 라우트 추가**

```typescript
const GoalList = lazy(() => import('./pages/GoalList'))
const GoalForm = lazy(() => import('./pages/GoalForm'))
const GoalDetail = lazy(() => import('./pages/GoalDetail'))

// Route 추가
<Route path="/goals" element={<GoalList />} />
<Route path="/goals/new" element={<GoalForm />} />
<Route path="/goals/:id" element={<GoalDetail />} />
```

**Step 3: Layout.tsx 사이드바 메뉴**

navItems에 추가 (자산 관리 아래):
```typescript
{ path: '/goals', label: '저축 목표', icon: Target },
```

lucide-react `Target` 아이콘 사용.

**Step 4: Commit**

```bash
git add frontend/src/pages/GoalList.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: 저축 목표 목록 페이지 + 라우팅 + 사이드바"
```

---

### Task 9: 저축 목표 생성/수정 폼

**Files:**
- Create: `frontend/src/pages/GoalForm.tsx`

**Step 1: GoalForm 컴포넌트**

목표 생성/수정 폼:
- 목표명 입력
- 목표 금액 입력 (₩ 포맷)
- 목표 달성일 date picker
- 우선순위 선택 (높음/보통/낮음)
- 메모 (선택)
- 자산 연결: 체크박스 리스트 (보유 자산 목록에서 선택)
  - `/api/assets` 호출하여 보유 자산 표시
  - 각 자산 옆에 현재 평가액 표시
- 저장 성공 → `/goals` 이동 + 토스트

edit 모드: URL param `id`가 있으면 기존 데이터 로드 후 수정

**Step 2: Commit**

```bash
git add frontend/src/pages/GoalForm.tsx
git commit -m "feat: 저축 목표 생성/수정 폼 (자산 연결 포함)"
```

---

### Task 10: 저축 목표 상세 페이지

**Files:**
- Create: `frontend/src/pages/GoalDetail.tsx`

**Step 1: GoalDetail 컴포넌트**

목표 상세 페이지:
- **상단**: 목표명, 프로그레스 바(달성률), 남은 금액
- **계산 결과 카드들**:
  - 필요 월 저축액
  - 필요 연 수익률
  - 예상 달성일 (현재 속도 기준)
  - 남은 개월 수
- **연결된 자산 목록**: 자산명, 유형, 현재 평가액
  - "자산 편집" 버튼 → GoalForm edit 모드
- **월별 저축 기록**:
  - 기록 추가 폼 (금액 + 월)
  - 기록 목록 (최근순)
- **하단 버튼**: 수정 / 삭제

**Step 2: Commit**

```bash
git add frontend/src/pages/GoalDetail.tsx
git commit -m "feat: 저축 목표 상세 페이지 (계산 결과, 자산 목록, 저축 기록)"
```

---

### Task 11: 프론트엔드 테스트

**Files:**
- Create: `frontend/src/__tests__/GoalList.test.tsx`

**Step 1: 테스트 작성**

GoalList 테스트:
- 목표 목록 렌더링 확인
- 요약 카드 (총 필요 저축액, 저축 여력) 표시 확인
- 프로그레스 바 달성률 표시 확인
- "목표 추가" 버튼 존재 확인

Mock: goalApi.getAll, goalApi.getSummary

**Step 2: 테스트 실행**

```bash
cd frontend && npm test
```

**Step 3: Commit**

```bash
git add frontend/src/__tests__/GoalList.test.tsx
git commit -m "test: 저축 목표 프론트엔드 테스트"
```

---

### Task 12: 통합 테스트 + 린트 + 최종 확인

**Step 1: 백엔드 전체 테스트**

```bash
cd backend && pytest -v
```

**Step 2: 프론트엔드 빌드 + 테스트**

```bash
cd frontend && npm run build && npm test
```

**Step 3: 린트**

```bash
cd backend && ruff check --fix . && ruff format .
```

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "chore: Phase 2 저축 목표 통합 테스트 및 린트 정리"
```

---

## 요약

| Task | 내용 | 파일 수 |
|------|------|---------|
| 1 | SavingsGoal, GoalAssetLink, GoalContribution 모델 | 4 |
| 2 | Alembic 마이그레이션 | 1 |
| 3 | Pydantic 스키마 | 1 |
| 4 | 저축 목표 서비스 (계산 로직 + 저축 여력) | 1 |
| 5 | API 라우터 + main.py 등록 | 2 |
| 6 | 백엔드 테스트 | 1 |
| 7 | 프론트엔드 타입 + API | 2 |
| 8 | 목표 목록 페이지 + 라우팅 + 사이드바 | 3 |
| 9 | 목표 생성/수정 폼 | 1 |
| 10 | 목표 상세 페이지 | 1 |
| 11 | 프론트엔드 테스트 | 1 |
| 12 | 통합 테스트 + 린트 | 0 |

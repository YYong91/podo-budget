"""온보딩 API — 가구 미소속 사용자의 초기 설정

가구에 소속되지 않은 사용자가 기본 가구를 생성할 수 있는 엔드포인트입니다.
프론트엔드 온보딩 플로우에서 사용됩니다.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.user import User
from app.schemas.onboarding import CreateDefaultHousehold, OnboardingStatus

router = APIRouter()


async def _count_active_households(user_id: int, db: AsyncSession) -> int:
    """사용자의 활성 가구 멤버십 수 조회"""
    result = await db.execute(
        select(func.count())
        .select_from(HouseholdMember)
        .join(Household, HouseholdMember.household_id == Household.id)
        .where(
            and_(
                HouseholdMember.user_id == user_id,
                HouseholdMember.left_at.is_(None),
                Household.deleted_at.is_(None),
            )
        )
    )
    return result.scalar_one()


@router.get("/status", response_model=OnboardingStatus)
async def get_onboarding_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """온보딩 상태 조회

    사용자가 가구에 소속되어 있는지 확인합니다.
    """
    count = await _count_active_households(current_user.id, db)
    return OnboardingStatus(has_household=count > 0, household_count=count)


@router.post("/create-household", status_code=status.HTTP_201_CREATED)
async def create_default_household(
    body: CreateDefaultHousehold,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """기본 가구 생성 + owner 멤버십 추가

    가구 이름을 지정하지 않으면 "{username}님의 가계부"로 생성됩니다.
    """
    name = body.name or f"{current_user.username}님의 가계부"

    household = Household(name=name)
    db.add(household)
    await db.flush()  # ID 할당

    member = HouseholdMember(
        household_id=household.id,
        user_id=current_user.id,
        role="owner",
        joined_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(member)
    await db.commit()
    await db.refresh(household)

    return {"id": household.id, "name": household.name}

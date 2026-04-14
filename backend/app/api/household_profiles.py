"""가구 프로필(HouseholdProfile) API 라우터

가구의 재무적 맥락 정보(온보딩, 재무 목표)를 관리하는 RESTful API 엔드포인트입니다.

주요 기능:
- 가구 프로필 조회
- 가구 프로필 생성/수정 (upsert)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.household_profile import HouseholdProfile
from app.models.user import User
from app.schemas.household_profile import HouseholdProfileCreate, HouseholdProfileResponse

router = APIRouter()


@router.get("/{household_id}", response_model=HouseholdProfileResponse)
async def get_household_profile(
    household_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """가구 프로필 조회

    Args:
        household_id: 가구 ID
        current_user: 현재 로그인한 사용자
        db: 데이터베이스 세션

    Returns:
        가구 프로필 정보

    Raises:
        HTTPException 404: 가구를 찾을 수 없음
        HTTPException 403: 접근 권한 없음
        HTTPException 404: 프로필이 없음
    """
    # 가구 접근 권한 검증
    await get_household_member(household_id, current_user, db)

    # 프로필 조회
    profile = await db.scalar(select(HouseholdProfile).where(HouseholdProfile.household_id == household_id))

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로필이 없습니다",
        )

    return profile


@router.put("/{household_id}", response_model=HouseholdProfileResponse)
async def upsert_household_profile(
    household_id: int,
    body: HouseholdProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """가구 프로필 생성/수정 (upsert)

    프로필이 없으면 생성하고, 있으면 수정합니다.

    Args:
        household_id: 가구 ID
        body: 프로필 생성/수정 데이터
        current_user: 현재 로그인한 사용자
        db: 데이터베이스 세션

    Returns:
        생성/수정된 가구 프로필 정보

    Raises:
        HTTPException 404: 가구를 찾을 수 없음
        HTTPException 403: 접근 권한 없음
    """
    # 가구 접근 권한 검증
    await get_household_member(household_id, current_user, db)

    # 기존 프로필 조회
    profile = await db.scalar(select(HouseholdProfile).where(HouseholdProfile.household_id == household_id))

    if profile is None:
        # 신규 생성
        profile = HouseholdProfile(household_id=household_id, **body.model_dump())
        db.add(profile)
    else:
        # 기존 수정 — None 값도 업데이트 (exclude_none=False)
        for field, value in body.model_dump(exclude_none=False).items():
            setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    return profile

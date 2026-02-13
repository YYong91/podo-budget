"""API 의존성 함수 모음

가구(Household) 관련 권한 체크를 위한 FastAPI Depends 함수들입니다.

권한 체계:
- owner: 가구 소유자, 모든 권한 보유
- admin: 관리자, 멤버 초대/추방, 가구 설정 수정 가능
- member: 일반 멤버, 지출 기록 및 조회만 가능
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.user import User


async def get_household_member(
    household_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HouseholdMember:
    """가구 멤버 정보 조회 및 검증

    현재 사용자가 해당 가구의 활성 멤버인지 확인합니다.

    Args:
        household_id: 가구 ID
        current_user: 현재 로그인한 사용자
        db: 데이터베이스 세션

    Returns:
        HouseholdMember: 현재 사용자의 가구 멤버 객체

    Raises:
        HTTPException 404: 가구가 존재하지 않거나 소프트 삭제됨
        HTTPException 403: 사용자가 해당 가구의 멤버가 아님
    """
    # 가구 존재 여부 확인 (소프트 삭제되지 않은 가구)
    household_query = select(Household).where(
        and_(
            Household.id == household_id,
            Household.deleted_at.is_(None),  # 소프트 삭제되지 않은 가구만
        )
    )
    result = await db.execute(household_query)
    household = result.scalar_one_or_none()

    if not household:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="가구를 찾을 수 없습니다")

    # 멤버 자격 확인 (탈퇴하지 않은 활성 멤버)
    member_query = select(HouseholdMember).where(
        and_(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == current_user.id,
            HouseholdMember.left_at.is_(None),  # 탈퇴하지 않은 멤버만
        )
    )
    result = await db.execute(member_query)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 가구에 접근할 권한이 없습니다")

    return member


async def require_household_admin(
    member: HouseholdMember = Depends(get_household_member),
) -> HouseholdMember:
    """가구 관리자 권한 검증

    현재 사용자가 admin 이상의 권한을 가지고 있는지 확인합니다.

    Args:
        member: 현재 사용자의 가구 멤버 객체

    Returns:
        HouseholdMember: 권한이 확인된 멤버 객체

    Raises:
        HTTPException 403: admin 또는 owner 권한이 없음
    """
    if member.role not in ["admin", "owner"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다")

    return member


async def require_household_owner(
    member: HouseholdMember = Depends(get_household_member),
) -> HouseholdMember:
    """가구 소유자 권한 검증

    현재 사용자가 owner 권한을 가지고 있는지 확인합니다.

    Args:
        member: 현재 사용자의 가구 멤버 객체

    Returns:
        HouseholdMember: 권한이 확인된 멤버 객체

    Raises:
        HTTPException 403: owner 권한이 없음
    """
    if member.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="소유자 권한이 필요합니다")

    return member

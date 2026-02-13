"""초대(Invitation) API 라우터

사용자가 받은 초대를 조회하고 수락/거절하기 위한 API 엔드포인트입니다.
households.py와 분리된 이유: 다른 prefix(/api/invitations)를 사용하기 위함

주요 기능:
- 내가 받은 초대 목록 조회
- 초대 수락 (자동으로 HouseholdMember 생성)
- 초대 거절
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.user import User
from app.schemas.household import InvitationResponse

router = APIRouter()


@router.get("/my", response_model=list[InvitationResponse])
async def list_my_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내가 받은 초대 목록 조회

    현재 사용자의 이메일로 받은 모든 초대를 조회합니다.

    Args:
        current_user: 현재 로그인한 사용자
        db: 데이터베이스 세션

    Returns:
        초대 목록 (토큰 제외)

    Business Rules:
        - 사용자의 이메일 또는 user_id로 받은 초대를 모두 조회합니다
        - 만료된 초대도 포함됩니다
        - 토큰은 보안상 목록에서 제외됩니다
    """
    # 이메일 또는 user_id로 초대 조회
    conditions = [HouseholdInvitation.invitee_user_id == current_user.id]
    if current_user.email:
        conditions.append(HouseholdInvitation.invitee_email == current_user.email)

    query = select(HouseholdInvitation).where(or_(*conditions)).order_by(HouseholdInvitation.created_at.desc())

    result = await db.execute(query)
    invitations = result.scalars().all()

    # 응답 생성
    response_list = []
    for inv in invitations:
        # 가구 정보 조회
        household_query = select(Household).where(Household.id == inv.household_id)
        household_result = await db.execute(household_query)
        household = household_result.scalar_one_or_none()

        # 가구가 소프트 삭제된 경우 건너뛰기
        if not household or household.deleted_at is not None:
            continue

        # 초대자 정보 조회
        inviter_query = select(User).where(User.id == inv.inviter_id)
        inviter_result = await db.execute(inviter_query)
        inviter = inviter_result.scalar_one()

        response_list.append(
            InvitationResponse(
                id=inv.id,
                household_id=household.id,
                household_name=household.name,
                invitee_email=inv.invitee_email,
                inviter_username=inviter.username,
                role=inv.role,
                status=inv.status,
                expires_at=inv.expires_at,
                created_at=inv.created_at,
                responded_at=inv.responded_at,
                token=None,  # 목록 조회 시에는 토큰 미포함
            )
        )

    return response_list


@router.post("/{token}/accept", response_model=InvitationResponse)
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """초대 수락

    토큰으로 초대를 수락하고 자동으로 가구 멤버로 추가됩니다.

    Args:
        token: 초대 토큰 (UUID)
        current_user: 현재 로그인한 사용자
        db: 데이터베이스 세션

    Returns:
        수락된 초대 정보

    Business Rules:
        - pending 상태의 초대만 수락 가능
        - 만료된 초대는 수락 불가
        - 수락 시 자동으로 HouseholdMember 생성
        - 초대 상태를 "accepted"로 변경
        - 이미 멤버인 경우 에러 반환
    """
    # 토큰으로 초대 조회
    invitation_query = select(HouseholdInvitation).where(HouseholdInvitation.token == token)
    result = await db.execute(invitation_query)
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="초대를 찾을 수 없습니다")

    # 권한 확인: 이메일이 일치하거나 user_id가 일치해야 함
    if invitation.invitee_user_id != current_user.id and (not current_user.email or invitation.invitee_email != current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 초대를 수락할 권한이 없습니다")

    # 상태 확인
    if invitation.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"이미 처리된 초대입니다 (상태: {invitation.status})")

    # 만료 확인
    if invitation.expires_at < datetime.utcnow():
        # 만료된 초대는 상태를 expired로 변경
        invitation.status = "expired"
        invitation.responded_at = datetime.utcnow()
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="만료된 초대입니다")

    # 가구 존재 및 활성 상태 확인
    household_query = select(Household).where(and_(Household.id == invitation.household_id, Household.deleted_at.is_(None)))
    household_result = await db.execute(household_query)
    household = household_result.scalar_one_or_none()

    if not household:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="가구를 찾을 수 없습니다")

    # 이미 멤버인지 확인
    existing_member_query = select(HouseholdMember).where(
        and_(
            HouseholdMember.household_id == invitation.household_id,
            HouseholdMember.user_id == current_user.id,
            HouseholdMember.left_at.is_(None),
        )
    )
    existing_member_result = await db.execute(existing_member_query)
    existing_member = existing_member_result.scalar_one_or_none()

    if existing_member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 가구 멤버입니다")

    # 멤버 추가
    new_member = HouseholdMember(
        household_id=invitation.household_id,
        user_id=current_user.id,
        role=invitation.role,
    )
    db.add(new_member)

    # 초대 상태 업데이트
    invitation.status = "accepted"
    invitation.responded_at = datetime.utcnow()
    invitation.invitee_user_id = current_user.id  # user_id가 없었던 경우 업데이트

    await db.commit()
    await db.refresh(invitation)

    # 초대자 정보 조회
    inviter_query = select(User).where(User.id == invitation.inviter_id)
    inviter_result = await db.execute(inviter_query)
    inviter = inviter_result.scalar_one()

    return InvitationResponse(
        id=invitation.id,
        household_id=household.id,
        household_name=household.name,
        invitee_email=invitation.invitee_email,
        inviter_username=inviter.username,
        role=invitation.role,
        status=invitation.status,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        responded_at=invitation.responded_at,
        token=None,
    )


@router.post("/{token}/reject", response_model=InvitationResponse)
async def reject_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """초대 거절

    토큰으로 초대를 거절합니다.

    Args:
        token: 초대 토큰 (UUID)
        current_user: 현재 로그인한 사용자
        db: 데이터베이스 세션

    Returns:
        거절된 초대 정보

    Business Rules:
        - pending 상태의 초대만 거절 가능
        - 초대 상태를 "rejected"로 변경
    """
    # 토큰으로 초대 조회
    invitation_query = select(HouseholdInvitation).where(HouseholdInvitation.token == token)
    result = await db.execute(invitation_query)
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="초대를 찾을 수 없습니다")

    # 권한 확인
    if invitation.invitee_user_id != current_user.id and (not current_user.email or invitation.invitee_email != current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 초대를 거절할 권한이 없습니다")

    # 상태 확인
    if invitation.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"이미 처리된 초대입니다 (상태: {invitation.status})")

    # 초대 거절
    invitation.status = "rejected"
    invitation.responded_at = datetime.utcnow()
    invitation.invitee_user_id = current_user.id  # user_id가 없었던 경우 업데이트

    await db.commit()
    await db.refresh(invitation)

    # 가구 및 초대자 정보 조회
    household_query = select(Household).where(Household.id == invitation.household_id)
    household_result = await db.execute(household_query)
    household = household_result.scalar_one()

    inviter_query = select(User).where(User.id == invitation.inviter_id)
    inviter_result = await db.execute(inviter_query)
    inviter = inviter_result.scalar_one()

    return InvitationResponse(
        id=invitation.id,
        household_id=household.id,
        household_name=household.name,
        invitee_email=invitation.invitee_email,
        inviter_username=inviter.username,
        role=invitation.role,
        status=invitation.status,
        expires_at=invitation.expires_at,
        created_at=invitation.created_at,
        responded_at=invitation.responded_at,
        token=None,
    )

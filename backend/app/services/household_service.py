"""가구 서비스 — 복잡한 비즈니스 로직 분리 (#193)

복잡한 트랜잭션/멀티쿼리 로직을 api/households.py에서 분리합니다.

분리 대상:
- create_household_invitation: 6+ 쿼리 + 이메일 발송
- leave_household_with_transfer: owner 자동 양도 트랜잭션
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.user import User
from app.schemas.household import InvitationCreate
from app.services.email_service import send_invitation_email


@dataclass
class InvitationResult:
    """초대 생성 결과"""

    invitation: HouseholdInvitation
    household: Household
    inviter: User
    token: str
    email_sent: bool


async def create_household_invitation(
    db: AsyncSession,
    household_id: int,
    inviter_member: HouseholdMember,
    invitation_data: InvitationCreate,
) -> InvitationResult:
    """가구 초대 생성 — 검증, DB 저장, 이메일 발송을 단일 트랜잭션으로 처리 (#193)

    Args:
        db: 데이터베이스 세션
        household_id: 가구 ID
        inviter_member: 초대자의 멤버 정보 (권한 검증 완료된 상태로 전달)
        invitation_data: 초대 정보 (이메일, 역할)

    Returns:
        InvitationResult: 초대 생성 결과 (초대 정보 + 관련 데이터)

    Raises:
        HTTPException 400: owner 역할 초대, 이미 멤버, 중복 초대
    """
    # owner 역할 초대 방지
    if invitation_data.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="소유자 역할로 초대할 수 없습니다")

    # 해당 이메일의 사용자 조회
    user_result = await db.execute(select(User).where(User.email == invitation_data.email))
    invitee_user = user_result.scalar_one_or_none()

    # 이미 멤버인지 확인
    if invitee_user:
        existing_member_result = await db.execute(
            select(HouseholdMember).where(
                and_(
                    HouseholdMember.household_id == household_id,
                    HouseholdMember.user_id == invitee_user.id,
                    HouseholdMember.left_at.is_(None),
                )
            )
        )
        if existing_member_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 가구 멤버입니다")

    # pending 상태의 중복 초대 확인
    duplicate_result = await db.execute(
        select(HouseholdInvitation).where(
            and_(
                HouseholdInvitation.household_id == household_id,
                HouseholdInvitation.invitee_email == invitation_data.email,
                HouseholdInvitation.status == "pending",
            )
        )
    )
    if duplicate_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 초대가 전송되었습니다")

    # 초대 생성
    token = str(uuid.uuid4())
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7)

    invitation = HouseholdInvitation(
        household_id=household_id,
        inviter_id=inviter_member.user_id,
        invitee_email=invitation_data.email,
        invitee_user_id=invitee_user.id if invitee_user else None,
        token=token,
        role=invitation_data.role,
        status="pending",
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    # 가구 및 초대자 정보 조회 (이메일 발송용)
    household_result = await db.execute(select(Household).where(Household.id == household_id))
    household = household_result.scalar_one()

    inviter_result = await db.execute(select(User).where(User.id == inviter_member.user_id))
    inviter = inviter_result.scalar_one()

    # 초대 이메일 발송 (실패해도 초대 자체는 성공)
    email_sent = await send_invitation_email(
        to_email=invitation.invitee_email,
        household_name=household.name,
        inviter_name=inviter.username,
        invite_token=token,
    )

    return InvitationResult(
        invitation=invitation,
        household=household,
        inviter=inviter,
        token=token,
        email_sent=email_sent,
    )


@dataclass
class LeaveResult:
    """탈퇴 결과"""

    message: str
    transferred_to: int | None


async def leave_household_with_transfer(
    db: AsyncSession,
    household_id: int,
    member: HouseholdMember,
) -> LeaveResult:
    """가구 탈퇴 — owner 역할 자동 양도 포함 (#193)

    owner 탈퇴 시 다른 멤버에게 역할을 자동으로 양도합니다.
    admin → member → 가입 순서 우선으로 양도합니다.

    Args:
        db: 데이터베이스 세션
        household_id: 가구 ID
        member: 탈퇴하려는 멤버 정보

    Returns:
        LeaveResult: 탈퇴 결과 메시지 + 역할 양도 대상 user_id

    Raises:
        HTTPException 400: 마지막 멤버가 탈퇴를 시도하는 경우
    """
    transferred_to: int | None = None

    # owner 탈퇴 시 역할 양도
    if member.role == "owner":
        other_members_result = await db.execute(
            select(HouseholdMember)
            .where(
                and_(
                    HouseholdMember.household_id == household_id,
                    HouseholdMember.user_id != member.user_id,
                    HouseholdMember.left_at.is_(None),
                )
            )
            .order_by(
                # admin 우선, 그 다음 member, 그 다음 가입 순서
                HouseholdMember.role.desc(),
                HouseholdMember.joined_at.asc(),
            )
        )
        other_members = other_members_result.scalars().all()

        if not other_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="마지막 멤버는 탈퇴할 수 없습니다. 가구를 삭제하세요",
            )

        # 첫 번째 멤버에게 owner 양도
        new_owner = other_members[0]
        new_owner.role = "owner"
        transferred_to = new_owner.user_id

    # 현재 사용자 탈퇴 처리
    member.left_at = datetime.now(UTC).replace(tzinfo=None)
    await db.commit()

    message = "가구에서 탈퇴했습니다"
    if transferred_to:
        message = f"가구에서 탈퇴했습니다. 소유자 역할이 사용자 ID {transferred_to}에게 양도되었습니다"

    return LeaveResult(message=message, transferred_to=transferred_to)

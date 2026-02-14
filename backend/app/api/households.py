"""가구(Household) API 라우터

가구 CRUD, 멤버 관리, 초대 시스템을 위한 RESTful API 엔드포인트입니다.

주요 기능:
- 가구 생성/조회/수정/삭제 (CRUD)
- 멤버 역할 변경 및 추방
- 자발적 탈퇴 및 owner 역할 자동 양도
- 초대 생성/조회/수락/거절/취소
"""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_household_member, require_household_admin, require_household_owner
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.user import User
from app.schemas.household import (
    HouseholdCreate,
    HouseholdDetailResponse,
    HouseholdResponse,
    HouseholdUpdate,
    InvitationCreate,
    InvitationResponse,
    LeaveResponse,
    MemberResponse,
    MemberRoleUpdate,
)
from app.services.email_service import send_invitation_email

router = APIRouter()


# ===== Household CRUD =====


@router.post("/", response_model=HouseholdResponse, status_code=status.HTTP_201_CREATED)
async def create_household(
    household_data: HouseholdCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """가구 생성

    새로운 가구를 생성하고 생성자를 owner로 자동 등록합니다.

    Args:
        household_data: 가구 생성 데이터 (이름, 설명, 통화)
        current_user: 현재 로그인한 사용자
        db: 데이터베이스 세션

    Returns:
        생성된 가구 정보

    Business Rules:
        - 가구 생성자는 자동으로 owner 역할을 부여받습니다
        - owner는 가구의 모든 권한을 가집니다
    """
    # 1. 가구 생성
    household = Household(
        name=household_data.name,
        description=household_data.description,
        currency=household_data.currency,
    )
    db.add(household)
    await db.flush()  # ID 생성을 위해 flush

    # 2. 생성자를 owner로 추가
    member = HouseholdMember(
        household_id=household.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(member)
    await db.commit()
    await db.refresh(household)

    # 3. 응답 생성
    return HouseholdResponse(
        id=household.id,
        name=household.name,
        description=household.description,
        currency=household.currency,
        my_role="owner",
        member_count=1,
        created_at=household.created_at,
    )


@router.get("/", response_model=list[HouseholdResponse])
async def list_households(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내가 속한 가구 목록 조회

    현재 사용자가 속한 모든 활성 가구를 조회합니다.

    Args:
        current_user: 현재 로그인한 사용자
        db: 데이터베이스 세션

    Returns:
        가구 목록 (역할, 멤버 수 포함)

    Business Rules:
        - 탈퇴한 가구는 목록에 표시되지 않습니다
        - 소프트 삭제된 가구는 목록에 표시되지 않습니다
    """
    # 활성 멤버인 가구만 조회
    query = (
        select(Household, HouseholdMember.role)
        .join(HouseholdMember, Household.id == HouseholdMember.household_id)
        .where(
            and_(
                HouseholdMember.user_id == current_user.id,
                HouseholdMember.left_at.is_(None),  # 활성 멤버만
                Household.deleted_at.is_(None),  # 활성 가구만
            )
        )
        .order_by(Household.created_at.desc())
    )

    result = await db.execute(query)
    households_with_role = result.all()

    # 각 가구의 멤버 수 계산
    response_list = []
    for household, my_role in households_with_role:
        # 활성 멤버 수 계산
        count_query = select(func.count(HouseholdMember.id)).where(
            and_(
                HouseholdMember.household_id == household.id,
                HouseholdMember.left_at.is_(None),
            )
        )
        count_result = await db.execute(count_query)
        member_count = count_result.scalar() or 0

        response_list.append(
            HouseholdResponse(
                id=household.id,
                name=household.name,
                description=household.description,
                currency=household.currency,
                my_role=my_role,
                member_count=member_count,
                created_at=household.created_at,
            )
        )

    return response_list


@router.get("/{household_id}", response_model=HouseholdDetailResponse)
async def get_household(
    household_id: int,
    member: HouseholdMember = Depends(get_household_member),
    db: AsyncSession = Depends(get_db),
):
    """가구 상세 정보 조회

    가구 정보 및 활성 멤버 목록을 조회합니다.

    Args:
        household_id: 가구 ID
        member: 현재 사용자의 멤버 정보 (권한 검증용)
        db: 데이터베이스 세션

    Returns:
        가구 상세 정보 (멤버 목록 포함)

    Permissions:
        - 가구 멤버만 조회 가능
    """
    # 가구 정보 조회 (eager loading으로 멤버 정보 함께 조회)
    query = select(Household).where(Household.id == household_id).options(selectinload(Household.members))

    result = await db.execute(query)
    household = result.scalar_one()

    # 활성 멤버만 필터링하고 사용자 정보 조회
    active_members = []
    for m in household.members:
        if m.left_at is None:  # 활성 멤버만
            # 사용자 정보 조회
            user_query = select(User).where(User.id == m.user_id)
            user_result = await db.execute(user_query)
            user = user_result.scalar_one()

            active_members.append(
                MemberResponse(
                    user_id=user.id,
                    username=user.username,
                    email=user.email,
                    role=m.role,
                    joined_at=m.joined_at,
                )
            )

    return HouseholdDetailResponse(
        id=household.id,
        name=household.name,
        description=household.description,
        currency=household.currency,
        my_role=member.role,
        member_count=len(active_members),
        created_at=household.created_at,
        members=active_members,
    )


@router.put("/{household_id}", response_model=HouseholdResponse)
async def update_household(
    household_id: int,
    household_data: HouseholdUpdate,
    member: HouseholdMember = Depends(require_household_admin),
    db: AsyncSession = Depends(get_db),
):
    """가구 정보 수정

    가구 이름 및 설명을 수정합니다.

    Args:
        household_id: 가구 ID
        household_data: 수정할 가구 데이터
        member: 현재 사용자의 멤버 정보 (권한 검증용)
        db: 데이터베이스 세션

    Returns:
        수정된 가구 정보

    Permissions:
        - admin 이상 권한 필요
    """
    # 가구 조회
    query = select(Household).where(Household.id == household_id)
    result = await db.execute(query)
    household = result.scalar_one()

    # 변경된 필드만 업데이트
    if household_data.name is not None:
        household.name = household_data.name
    if household_data.description is not None:
        household.description = household_data.description

    await db.commit()
    await db.refresh(household)

    # 멤버 수 계산
    count_query = select(func.count(HouseholdMember.id)).where(
        and_(
            HouseholdMember.household_id == household_id,
            HouseholdMember.left_at.is_(None),
        )
    )
    count_result = await db.execute(count_query)
    member_count = count_result.scalar() or 0

    return HouseholdResponse(
        id=household.id,
        name=household.name,
        description=household.description,
        currency=household.currency,
        my_role=member.role,
        member_count=member_count,
        created_at=household.created_at,
    )


@router.delete("/{household_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_household(
    household_id: int,
    member: HouseholdMember = Depends(require_household_owner),
    db: AsyncSession = Depends(get_db),
):
    """가구 삭제 (소프트 삭제)

    가구를 소프트 삭제합니다. 실제 데이터는 삭제되지 않고 deleted_at이 설정됩니다.

    Args:
        household_id: 가구 ID
        member: 현재 사용자의 멤버 정보 (권한 검증용)
        db: 데이터베이스 세션

    Returns:
        None (204 No Content)

    Permissions:
        - owner 권한 필요

    Business Rules:
        - 소프트 삭제로 데이터는 보존됩니다
        - 관련된 멤버십과 초대는 자동으로 cascade 처리됩니다
    """
    # 소프트 삭제
    update_stmt = (
        update(Household)
        .where(Household.id == household_id)
        .values(deleted_at=datetime.now(UTC).replace(tzinfo=None))
        .execution_options(synchronize_session="fetch")
    )

    await db.execute(update_stmt)
    await db.commit()


# ===== 멤버 관리 =====


@router.patch("/{household_id}/members/{user_id}/role", response_model=MemberResponse)
async def update_member_role(
    household_id: int,
    user_id: int,
    role_data: MemberRoleUpdate,
    member: HouseholdMember = Depends(require_household_owner),
    db: AsyncSession = Depends(get_db),
):
    """멤버 역할 변경

    가구 멤버의 역할을 변경합니다.

    Args:
        household_id: 가구 ID
        user_id: 역할을 변경할 사용자 ID
        role_data: 새로운 역할 정보
        member: 현재 사용자의 멤버 정보 (권한 검증용)
        db: 데이터베이스 세션

    Returns:
        변경된 멤버 정보

    Permissions:
        - owner 권한 필요

    Business Rules:
        - owner 역할로 변경할 수 없습니다 (별도 API 필요)
        - 자기 자신의 역할은 변경할 수 없습니다
    """
    # 자기 자신의 역할 변경 방지
    if user_id == member.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자신의 역할은 변경할 수 없습니다")

    # 대상 멤버 조회
    target_member_query = select(HouseholdMember).where(
        and_(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == user_id,
            HouseholdMember.left_at.is_(None),
        )
    )
    result = await db.execute(target_member_query)
    target_member = result.scalar_one_or_none()

    if not target_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="해당 멤버를 찾을 수 없습니다")

    # owner의 역할 변경 방지
    if target_member.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="소유자의 역할은 변경할 수 없습니다")

    # 역할 변경
    target_member.role = role_data.role
    await db.commit()
    await db.refresh(target_member)

    # 사용자 정보 조회
    user_query = select(User).where(User.id == user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one()

    return MemberResponse(
        user_id=user.id,
        username=user.username,
        email=user.email,
        role=target_member.role,
        joined_at=target_member.joined_at,
    )


@router.delete("/{household_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    household_id: int,
    user_id: int,
    member: HouseholdMember = Depends(require_household_admin),
    db: AsyncSession = Depends(get_db),
):
    """멤버 추방

    가구에서 멤버를 추방합니다 (소프트 삭제).

    Args:
        household_id: 가구 ID
        user_id: 추방할 사용자 ID
        member: 현재 사용자의 멤버 정보 (권한 검증용)
        db: 데이터베이스 세션

    Returns:
        None (204 No Content)

    Permissions:
        - admin 이상 권한 필요

    Business Rules:
        - owner는 추방할 수 없습니다
        - 자기 자신은 추방할 수 없습니다 (탈퇴 API 사용)
    """
    # 자기 자신 추방 방지
    if user_id == member.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자기 자신은 추방할 수 없습니다. 탈퇴 API를 사용하세요")

    # 대상 멤버 조회
    target_member_query = select(HouseholdMember).where(
        and_(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == user_id,
            HouseholdMember.left_at.is_(None),
        )
    )
    result = await db.execute(target_member_query)
    target_member = result.scalar_one_or_none()

    if not target_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="해당 멤버를 찾을 수 없습니다")

    # owner 추방 방지
    if target_member.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="소유자는 추방할 수 없습니다")

    # 소프트 삭제 (left_at 설정)
    target_member.left_at = datetime.now(UTC).replace(tzinfo=None)
    await db.commit()


@router.post("/{household_id}/leave", response_model=LeaveResponse)
async def leave_household(
    household_id: int,
    member: HouseholdMember = Depends(get_household_member),
    db: AsyncSession = Depends(get_db),
):
    """가구 자발적 탈퇴

    현재 사용자가 가구에서 탈퇴합니다.

    Args:
        household_id: 가구 ID
        member: 현재 사용자의 멤버 정보
        db: 데이터베이스 세션

    Returns:
        탈퇴 결과 메시지 (owner인 경우 역할 양도 정보 포함)

    Permissions:
        - 가구 멤버만 가능

    Business Rules:
        - owner가 탈퇴하는 경우, 자동으로 admin 중 한 명에게 owner 역할을 양도합니다
        - admin이 없으면 일반 member 중 한 명에게 양도합니다
        - 혼자 남은 owner는 탈퇴할 수 없습니다 (가구 삭제 필요)
    """
    # owner 탈퇴 시 역할 양도 처리
    if member.role == "owner":
        # 다른 활성 멤버 조회
        other_members_query = (
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
        result = await db.execute(other_members_query)
        other_members = result.scalars().all()

        if not other_members:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="마지막 멤버는 탈퇴할 수 없습니다. 가구를 삭제하세요")

        # 첫 번째 멤버에게 owner 양도
        new_owner = other_members[0]
        new_owner.role = "owner"
        transferred_to = new_owner.user_id
    else:
        transferred_to = None

    # 현재 사용자 탈퇴 처리
    member.left_at = datetime.now(UTC).replace(tzinfo=None)
    await db.commit()

    message = "가구에서 탈퇴했습니다"
    if transferred_to:
        message = f"가구에서 탈퇴했습니다. 소유자 역할이 사용자 ID {transferred_to}에게 양도되었습니다"

    return LeaveResponse(message=message, transferred_to=transferred_to)


# ===== 초대 시스템 =====


@router.post("/{household_id}/invitations", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    household_id: int,
    invitation_data: InvitationCreate,
    member: HouseholdMember = Depends(require_household_admin),
    db: AsyncSession = Depends(get_db),
):
    """가구 초대 생성

    이메일 주소로 새로운 사용자를 가구에 초대합니다.

    Args:
        household_id: 가구 ID
        invitation_data: 초대 정보 (이메일, 역할)
        member: 현재 사용자의 멤버 정보 (권한 검증용)
        db: 데이터베이스 세션

    Returns:
        생성된 초대 정보 (토큰 포함)

    Permissions:
        - admin 이상 권한 필요

    Business Rules:
        - 같은 이메일로 pending 상태의 초대가 이미 존재하면 생성 불가
        - 이미 가구 멤버인 사용자는 초대할 수 없습니다
        - 초대는 기본 7일 후 만료됩니다
        - owner 역할로는 초대할 수 없습니다
    """
    # owner 역할 초대 방지
    if invitation_data.role == "owner":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="소유자 역할로 초대할 수 없습니다")

    # 해당 이메일의 사용자가 있는지 확인
    user_query = select(User).where(User.email == invitation_data.email)
    user_result = await db.execute(user_query)
    invitee_user = user_result.scalar_one_or_none()

    # 이미 멤버인지 확인
    if invitee_user:
        existing_member_query = select(HouseholdMember).where(
            and_(
                HouseholdMember.household_id == household_id,
                HouseholdMember.user_id == invitee_user.id,
                HouseholdMember.left_at.is_(None),
            )
        )
        existing_member_result = await db.execute(existing_member_query)
        existing_member = existing_member_result.scalar_one_or_none()

        if existing_member:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 가구 멤버입니다")

    # pending 상태의 중복 초대 확인
    duplicate_query = select(HouseholdInvitation).where(
        and_(
            HouseholdInvitation.household_id == household_id,
            HouseholdInvitation.invitee_email == invitation_data.email,
            HouseholdInvitation.status == "pending",
        )
    )
    duplicate_result = await db.execute(duplicate_query)
    duplicate = duplicate_result.scalar_one_or_none()

    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 초대가 전송되었습니다")

    # 초대 생성
    token = str(uuid.uuid4())
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7)

    invitation = HouseholdInvitation(
        household_id=household_id,
        inviter_id=member.user_id,
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

    # 가구 및 초대자 정보 조회
    household_query = select(Household).where(Household.id == household_id)
    household_result = await db.execute(household_query)
    household = household_result.scalar_one()

    inviter_query = select(User).where(User.id == member.user_id)
    inviter_result = await db.execute(inviter_query)
    inviter = inviter_result.scalar_one()

    # 초대 이메일 발송 (비동기, 실패해도 초대 자체는 성공)
    await send_invitation_email(
        to_email=invitation.invitee_email,
        household_name=household.name,
        inviter_name=inviter.username,
        invite_token=token,
    )

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
        token=token,  # 초대 생성 시에만 토큰 포함
    )


@router.get("/{household_id}/invitations", response_model=list[InvitationResponse])
async def list_invitations(
    household_id: int,
    member: HouseholdMember = Depends(require_household_admin),
    db: AsyncSession = Depends(get_db),
):
    """가구 초대 목록 조회

    특정 가구의 모든 초대를 조회합니다.

    Args:
        household_id: 가구 ID
        member: 현재 사용자의 멤버 정보 (권한 검증용)
        db: 데이터베이스 세션

    Returns:
        초대 목록 (토큰 제외)

    Permissions:
        - admin 이상 권한 필요
    """
    # 초대 목록 조회
    query = select(HouseholdInvitation).where(HouseholdInvitation.household_id == household_id).order_by(HouseholdInvitation.created_at.desc())

    result = await db.execute(query)
    invitations = result.scalars().all()

    # 가구 정보 조회
    household_query = select(Household).where(Household.id == household_id)
    household_result = await db.execute(household_query)
    household = household_result.scalar_one()

    # 응답 생성
    response_list = []
    for inv in invitations:
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


@router.delete("/{household_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(
    household_id: int,
    invitation_id: int,
    member: HouseholdMember = Depends(require_household_admin),
    db: AsyncSession = Depends(get_db),
):
    """초대 취소

    pending 상태의 초대를 취소합니다.

    Args:
        household_id: 가구 ID
        invitation_id: 초대 ID
        member: 현재 사용자의 멤버 정보 (권한 검증용)
        db: 데이터베이스 세션

    Returns:
        None (204 No Content)

    Permissions:
        - admin 이상 권한 필요

    Business Rules:
        - pending 상태의 초대만 취소할 수 있습니다
    """
    # 초대 조회
    invitation_query = select(HouseholdInvitation).where(
        and_(
            HouseholdInvitation.id == invitation_id,
            HouseholdInvitation.household_id == household_id,
        )
    )
    result = await db.execute(invitation_query)
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="초대를 찾을 수 없습니다")

    # pending 상태 확인
    if invitation.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 처리된 초대는 취소할 수 없습니다")

    # 초대 삭제
    delete_stmt = delete(HouseholdInvitation).where(HouseholdInvitation.id == invitation_id)
    await db.execute(delete_stmt)
    await db.commit()

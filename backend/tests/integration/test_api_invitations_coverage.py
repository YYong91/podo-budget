"""api/invitations.py 커버리지 강화 테스트 (#400)

누락 시나리오:
- 초대 거절: 존재하지 않는 토큰 → 404
- 초대 거절: 권한 없음 → 403
- 초대 거절: 이미 처리된 초대 → 400
- 초대 수락: 이미 멤버인 경우 → 400
- 초대 수락: 가구가 삭제된 경우 → 404
- 초대 목록: 소프트 삭제된 가구 초대 필터링
- 초대 목록: 이메일 또는 user_id 기반 조회
- 초대 수락: 이전 탈퇴 멤버 복원(former member)
- 초대 생성/취소는 households.py에서 처리 (별도 테스트)
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.user import User

# ── Helper ──────────────────────────────────────────────


def _make_invitation(
    household_id: int,
    inviter_id: int,
    invitee_email: str,
    invitee_user_id: int | None = None,
    status: str = "pending",
    expires_in_days: int = 7,
    role: str = "member",
) -> HouseholdInvitation:
    return HouseholdInvitation(
        household_id=household_id,
        inviter_id=inviter_id,
        invitee_email=invitee_email,
        invitee_user_id=invitee_user_id,
        token=str(uuid.uuid4()),
        role=role,
        status=status,
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=expires_in_days),
    )


# ── 초대 거절: 존재하지 않는 토큰 → 404 ────────────────


@pytest.mark.asyncio
async def test_reject_nonexistent_token_returns_404(authenticated_client):
    """존재하지 않는 토큰으로 거절 시도 → 404"""
    fake_token = str(uuid.uuid4())
    response = await authenticated_client.post(f"/api/invitations/{fake_token}/reject")
    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


# ── 초대 거절: 권한 없음 → 403 ─────────────────────────


@pytest.mark.asyncio
async def test_reject_invitation_wrong_user_returns_403(
    authenticated_client,
    test_user: User,
    test_user2: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """다른 사람에게 온 초대를 거절 시도 → 403"""
    invitation = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email="someone_else@example.com",  # test_user 이메일과 다름
        invitee_user_id=None,
        token=str(uuid.uuid4()),
        role="member",
        status="pending",
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7),
    )
    db_session.add(invitation)
    await db_session.commit()

    response = await authenticated_client.post(f"/api/invitations/{invitation.token}/reject")
    assert response.status_code == 403
    assert "권한" in response.json()["detail"]


# ── 초대 거절: 이미 처리된 초대 → 400 ──────────────────


@pytest.mark.asyncio
async def test_reject_already_rejected_invitation_returns_400(
    authenticated_client2,
    test_user: User,
    test_user2: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """이미 거절된 초대를 다시 거절 → 400"""
    invitation = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
        token=str(uuid.uuid4()),
        role="member",
        status="rejected",
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7),
        responded_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db_session.add(invitation)
    await db_session.commit()

    response = await authenticated_client2.post(f"/api/invitations/{invitation.token}/reject")
    assert response.status_code == 400
    assert "처리된" in response.json()["detail"]


# ── 초대 수락: 이미 멤버인 경우 → 400 ──────────────────


@pytest.mark.asyncio
async def test_accept_invitation_already_member_returns_400(
    authenticated_client2,
    test_user: User,
    test_user2: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """이미 가구 멤버인 사용자가 초대 수락 시도 → 400"""
    # test_user2를 test_household 멤버로 추가
    member = HouseholdMember(
        household_id=test_household.id,
        user_id=test_user2.id,
        role="member",
    )
    db_session.add(member)
    await db_session.flush()

    # test_user2에게 보낸 초대
    invitation = _make_invitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
    )
    db_session.add(invitation)
    await db_session.commit()

    response = await authenticated_client2.post(f"/api/invitations/{invitation.token}/accept")
    assert response.status_code == 400
    assert "이미 가구 멤버" in response.json()["detail"]


# ── 초대 수락: 가구가 삭제된(soft-delete) 경우 → 404 ───


@pytest.mark.asyncio
async def test_accept_invitation_deleted_household_returns_404(
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session: AsyncSession,
):
    """소프트 삭제된 가구의 초대를 수락 → 404"""
    # 삭제된 가구 생성
    deleted_household = Household(
        name="삭제된 가구",
        deleted_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db_session.add(deleted_household)
    await db_session.flush()

    # 초대 생성
    invitation = _make_invitation(
        household_id=deleted_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
    )
    db_session.add(invitation)
    await db_session.commit()

    response = await authenticated_client2.post(f"/api/invitations/{invitation.token}/accept")
    assert response.status_code == 404
    assert "가구를 찾을 수 없습니다" in response.json()["detail"]


# ── 초대 수락: 이전 탈퇴 멤버(former member) 복원 ──────


@pytest.mark.asyncio
async def test_accept_invitation_restores_former_member(
    authenticated_client2,
    test_user: User,
    test_user2: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """이전에 탈퇴한 멤버가 초대 수락 시 기존 레코드 복원"""
    # 탈퇴한 멤버 레코드 생성
    former_member = HouseholdMember(
        household_id=test_household.id,
        user_id=test_user2.id,
        role="member",
        left_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=30),
    )
    db_session.add(former_member)
    await db_session.flush()

    # 초대 생성 (admin 역할)
    invitation = _make_invitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
        role="admin",
    )
    db_session.add(invitation)
    await db_session.commit()

    response = await authenticated_client2.post(f"/api/invitations/{invitation.token}/accept")
    assert response.status_code == 200

    # 기존 멤버 레코드가 복원되었는지 확인
    await db_session.refresh(former_member)
    assert former_member.left_at is None
    assert former_member.role == "admin"  # 초대에서 지정한 역할로 변경


# ── 초대 목록: 소프트 삭제된 가구 초대 필터링 ───────────


@pytest.mark.asyncio
async def test_list_my_invitations_excludes_deleted_household(
    authenticated_client2,
    test_user: User,
    test_user2: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """소프트 삭제된 가구의 초대는 목록에서 제외"""
    # 삭제된 가구 생성
    deleted_household = Household(
        name="삭제될 가구",
        deleted_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db_session.add(deleted_household)
    await db_session.flush()

    # 삭제된 가구에 대한 초대
    inv_deleted = _make_invitation(
        household_id=deleted_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
    )
    db_session.add(inv_deleted)

    # 정상 가구에 대한 초대
    inv_normal = _make_invitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
    )
    db_session.add(inv_normal)
    await db_session.commit()

    response = await authenticated_client2.get("/api/invitations/my")
    assert response.status_code == 200

    data = response.json()
    # 삭제된 가구 초대는 필터링, 정상 초대만 반환
    assert len(data) == 1
    assert data[0]["household_name"] == test_household.name


# ── 초대 목록: 처리된 초대의 토큰은 None ────────────────


@pytest.mark.asyncio
async def test_list_my_invitations_hides_token_for_non_pending(
    authenticated_client2,
    test_user: User,
    test_user2: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """pending이 아닌 초대의 토큰은 None으로 반환"""
    # accepted 상태 초대
    inv = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
        token=str(uuid.uuid4()),
        role="member",
        status="accepted",
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7),
        responded_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db_session.add(inv)
    await db_session.commit()

    response = await authenticated_client2.get("/api/invitations/my")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["token"] is None  # accepted 초대의 토큰은 숨김


# ── 초대 목록: 이메일 기반 조회 (user_id 없이) ──────────


@pytest.mark.asyncio
async def test_list_my_invitations_by_email_only(
    authenticated_client2,
    test_user: User,
    test_user2: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """invitee_user_id 없이 이메일만으로 초대된 경우에도 조회"""
    # user_id 없이 이메일로만 초대
    inv = _make_invitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=None,  # user_id 없음
    )
    db_session.add(inv)
    await db_session.commit()

    response = await authenticated_client2.get("/api/invitations/my")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1


# ── 초대 수락: 이메일 매칭으로 수락 ─────────────────────


@pytest.mark.asyncio
async def test_accept_invitation_by_email_match(
    authenticated_client2,
    test_user: User,
    test_user2: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """invitee_user_id 없이 이메일로만 초대된 경우 수락 가능"""
    # user_id 없이 이메일만으로 초대
    inv = _make_invitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=None,
    )
    db_session.add(inv)
    await db_session.commit()

    response = await authenticated_client2.post(f"/api/invitations/{inv.token}/accept")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "accepted"

    # invitee_user_id가 수락한 유저로 업데이트
    await db_session.refresh(inv)
    assert inv.invitee_user_id == test_user2.id

"""초대(Invitation) API 통합 테스트 (#194)

accept_invitation에서 만료된 초대 처리 시 responded_at이 설정되는지 검증하고,
초대 수락 시 정상 동작을 확인합니다.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.user import User

# --- Helper ---


def _make_invitation(
    household_id: int,
    inviter_id: int,
    invitee_email: str,
    invitee_user_id: int | None = None,
    status: str = "pending",
    expires_in_days: int = 7,
) -> HouseholdInvitation:
    """테스트용 초대 객체 생성"""
    return HouseholdInvitation(
        household_id=household_id,
        inviter_id=inviter_id,
        invitee_email=invitee_email,
        invitee_user_id=invitee_user_id,
        token=str(uuid.uuid4()),
        role="member",
        status=status,
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=expires_in_days),
    )


# --- 만료 처리 테스트 (#194) ---


@pytest.mark.asyncio
async def test_expired_invitation_sets_responded_at(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """만료된 초대 수락 시 responded_at이 설정된다 (#194)

    invitations.py:141-146 만료 처리 코드:
        invitation.status = "expired"
        invitation.responded_at = datetime.now(UTC).replace(tzinfo=None)

    만료된 초대를 수락 시도하면:
    - 400 에러 반환
    - responded_at이 None이 아닌 값으로 설정됨
    """
    # 이미 만료된 초대 생성 (expires_at이 과거)
    expired_invitation = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=str(uuid.uuid4()),
        role="member",
        status="pending",
        expires_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),  # 이미 만료
    )
    db_session.add(expired_invitation)
    await db_session.commit()
    await db_session.refresh(expired_invitation)

    token = expired_invitation.token
    assert expired_invitation.responded_at is None  # 처리 전에는 None

    # 만료된 초대 수락 시도
    response = await authenticated_client.post(f"/api/invitations/{token}/accept")

    assert response.status_code == 400
    assert "만료" in response.json()["detail"]

    # DB에서 초대 상태 재조회하여 responded_at 설정 확인
    await db_session.refresh(expired_invitation)
    assert expired_invitation.status == "expired"
    assert expired_invitation.responded_at is not None, "만료 처리 시 responded_at이 설정되어야 한다"


@pytest.mark.asyncio
async def test_accept_invitation_success(
    db_session: AsyncSession,
    test_user: User,
    test_user2: User,
    test_household: Household,
    authenticated_client2,
):
    """유효한 초대 수락 성공 — responded_at이 설정되고 멤버가 추가된다"""
    # test_user가 test_user2를 test_household에 초대
    invitation = _make_invitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
    )
    db_session.add(invitation)
    await db_session.commit()
    await db_session.refresh(invitation)

    token = invitation.token
    assert invitation.responded_at is None

    # test_user2가 초대 수락
    response = await authenticated_client2.post(f"/api/invitations/{token}/accept")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "accepted"
    assert data["responded_at"] is not None

    # DB에서 responded_at 재확인
    await db_session.refresh(invitation)
    assert invitation.responded_at is not None
    assert invitation.status == "accepted"


@pytest.mark.asyncio
async def test_reject_invitation_sets_responded_at(
    db_session: AsyncSession,
    test_user: User,
    test_user2: User,
    test_household: Household,
    authenticated_client2,
):
    """초대 거절 시 responded_at이 설정된다"""
    invitation = _make_invitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
    )
    db_session.add(invitation)
    await db_session.commit()
    await db_session.refresh(invitation)

    token = invitation.token

    response = await authenticated_client2.post(f"/api/invitations/{token}/reject")
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"

    await db_session.refresh(invitation)
    assert invitation.responded_at is not None
    assert invitation.status == "rejected"


@pytest.mark.asyncio
async def test_accept_already_accepted_invitation_returns_400(
    db_session: AsyncSession,
    test_user: User,
    test_user2: User,
    test_household: Household,
    authenticated_client2,
):
    """이미 처리된(accepted) 초대를 재수락하면 400"""
    # 이미 수락된 초대
    invitation = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
        token=str(uuid.uuid4()),
        role="member",
        status="accepted",  # 이미 수락됨
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7),
        responded_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db_session.add(invitation)
    await db_session.commit()

    response = await authenticated_client2.post(f"/api/invitations/{invitation.token}/accept")
    assert response.status_code == 400
    assert "처리된" in response.json()["detail"]


@pytest.mark.asyncio
async def test_accept_nonexistent_invitation_returns_404(
    authenticated_client,
    test_user: User,
):
    """존재하지 않는 토큰으로 수락 시도 시 404"""
    fake_token = str(uuid.uuid4())
    response = await authenticated_client.post(f"/api/invitations/{fake_token}/accept")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_my_invitations(
    db_session: AsyncSession,
    test_user: User,
    test_user2: User,
    test_household: Household,
    authenticated_client2,
):
    """내가 받은 초대 목록 조회"""
    invitation = _make_invitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=test_user2.email,
        invitee_user_id=test_user2.id,
    )
    db_session.add(invitation)
    await db_session.commit()

    response = await authenticated_client2.get("/api/invitations/my")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "pending"
    # pending 상태 초대에는 토큰이 포함됨 (수락/거절에 필요)
    assert data[0]["token"] is not None


@pytest.mark.asyncio
async def test_wrong_user_cannot_accept_invitation(
    db_session: AsyncSession,
    test_user: User,
    test_user2: User,
    test_household: Household,
    authenticated_client,
):
    """다른 사람에게 온 초대는 수락할 수 없다 — 403"""
    # test_user2 이메일로 초대했는데 test_user(authenticated_client)가 수락 시도
    other_email = "other_person@example.com"
    invitation = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email=other_email,  # test_user 이메일과 다름
        invitee_user_id=None,
        token=str(uuid.uuid4()),
        role="member",
        status="pending",
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7),
    )
    db_session.add(invitation)
    await db_session.commit()

    # test_user가 다른 사람에게 온 초대를 수락 시도
    response = await authenticated_client.post(f"/api/invitations/{invitation.token}/accept")
    assert response.status_code == 403
    assert "권한" in response.json()["detail"]

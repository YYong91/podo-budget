"""초대 수락/거절 + 내 초대 목록 커버리지 테스트

api/invitations.py 미커버 라인: 68-95, 126-206, 246-276
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.user import User


@pytest.mark.asyncio
async def test_list_my_invitations(authenticated_client, test_user, test_household, db_session):
    """내가 받은 초대 목록 조회"""
    # 다른 가구 생성
    household2 = Household(name="초대 대상 가구")
    db_session.add(household2)
    await db_session.flush()

    inviter = User(
        auth_user_id="inviter-001",
        username="초대자",
        email="inviter@test.com",
    )
    db_session.add(inviter)
    await db_session.flush()

    # 멤버십 추가
    m = HouseholdMember(household_id=household2.id, user_id=inviter.id, role="owner")
    db_session.add(m)
    await db_session.flush()

    inv = HouseholdInvitation(
        household_id=household2.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=str(uuid.uuid4()),
        role="member",
        status="pending",
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.get("/api/invitations/my")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["household_name"] == "초대 대상 가구"


@pytest.mark.asyncio
async def test_accept_invitation(authenticated_client, test_user, test_household, db_session):
    """초대 수락"""
    household2 = Household(name="새 가구")
    db_session.add(household2)
    await db_session.flush()

    inviter = User(
        auth_user_id="inviter-002",
        username="초대자2",
        email="inviter2@test.com",
    )
    db_session.add(inviter)
    await db_session.flush()

    m = HouseholdMember(household_id=household2.id, user_id=inviter.id, role="owner")
    db_session.add(m)
    await db_session.flush()

    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=household2.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="pending",
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/invitations/{token}/accept")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "accepted"


@pytest.mark.asyncio
async def test_accept_invitation_not_found(authenticated_client):
    """존재하지 않는 초대 수락 → 404"""
    resp = await authenticated_client.post("/api/invitations/nonexistent-token/accept")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_accept_expired_invitation(authenticated_client, test_user, test_household, db_session):
    """만료된 초대 수락 → 400"""
    household2 = Household(name="새 가구")
    db_session.add(household2)
    await db_session.flush()

    inviter = User(auth_user_id="inviter-003", username="초대자3", email="inviter3@test.com")
    db_session.add(inviter)
    await db_session.flush()

    m = HouseholdMember(household_id=household2.id, user_id=inviter.id, role="owner")
    db_session.add(m)
    await db_session.flush()

    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=household2.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="pending",
        expires_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=1),  # 만료
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/invitations/{token}/accept")
    assert resp.status_code == 400
    assert "만료" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_accept_already_processed(authenticated_client, test_user, test_household, db_session):
    """이미 처리된 초대 수락 → 400"""
    household2 = Household(name="새 가구")
    db_session.add(household2)
    await db_session.flush()

    inviter = User(auth_user_id="inviter-004", username="초대자4", email="inviter4@test.com")
    db_session.add(inviter)
    await db_session.flush()

    m = HouseholdMember(household_id=household2.id, user_id=inviter.id, role="owner")
    db_session.add(m)
    await db_session.flush()

    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=household2.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="accepted",
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/invitations/{token}/accept")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reject_invitation(authenticated_client, test_user, test_household, db_session):
    """초대 거절"""
    household2 = Household(name="거절 대상 가구")
    db_session.add(household2)
    await db_session.flush()

    inviter = User(auth_user_id="inviter-005", username="초대자5", email="inviter5@test.com")
    db_session.add(inviter)
    await db_session.flush()

    m = HouseholdMember(household_id=household2.id, user_id=inviter.id, role="owner")
    db_session.add(m)
    await db_session.flush()

    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=household2.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="pending",
        expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/invitations/{token}/reject")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"


@pytest.mark.asyncio
async def test_reject_invitation_not_found(authenticated_client):
    """존재하지 않는 초대 거절 → 404"""
    resp = await authenticated_client.post("/api/invitations/nonexistent-token/reject")
    assert resp.status_code == 404

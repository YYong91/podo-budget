"""서비스 계층 커버리지 향상 테스트

admin_service, asset_goal_service, household_service의
미커버 영역을 테스트합니다.
"""

from datetime import date, datetime
from unittest.mock import AsyncMock, patch

import pytest

# ──────────────────────────────────────────
# admin_service 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_dashboard_stats(db_session, test_user, test_household):
    """대시보드 통합 현황"""
    from app.models.expense import Expense
    from app.models.income import Income
    from app.services.admin_service import get_dashboard_stats

    # 오늘 거래 추가
    now = datetime.utcnow()
    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=10000,
            description="대시보드지출",
            date=now,
        )
    )
    db_session.add(
        Income(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=50000,
            description="대시보드수입",
            date=now,
        )
    )
    await db_session.commit()

    result = await get_dashboard_stats(db_session)
    assert result.total_users >= 1
    assert result.active_users >= 1
    assert result.total_households >= 1


@pytest.mark.asyncio
async def test_admin_user_list(db_session, test_user, test_household):
    """사용자 목록 조회"""
    from app.services.admin_service import get_user_list

    result = await get_user_list(db_session, page=1, page_size=10)
    assert result.total >= 1
    assert len(result.users) >= 1


@pytest.mark.asyncio
async def test_admin_user_list_search(db_session, test_user, test_household):
    """사용자 검색"""
    from app.services.admin_service import get_user_list

    result = await get_user_list(db_session, page=1, page_size=10, search="testuser")
    assert result.total >= 1


@pytest.mark.asyncio
async def test_admin_user_detail(db_session, test_user, test_household):
    """사용자 상세 조회"""
    from app.services.admin_service import get_user_detail

    result = await get_user_detail(db_session, test_user.id)
    assert result is not None
    assert result.id == test_user.id


@pytest.mark.asyncio
async def test_admin_user_detail_not_found(db_session, test_user, test_household):
    """없는 사용자 상세 조회"""
    from app.services.admin_service import get_user_detail

    result = await get_user_detail(db_session, 99999)
    assert result is None


@pytest.mark.asyncio
async def test_admin_update_user(db_session, test_user, test_household):
    """사용자 활성/비활성 토글"""
    from app.services.admin_service import update_user

    success = await update_user(db_session, test_user.id, is_active=False)
    assert success is True

    # 되돌리기
    success = await update_user(db_session, test_user.id, is_active=True)
    assert success is True


@pytest.mark.asyncio
async def test_admin_update_user_not_found(db_session, test_user, test_household):
    """없는 사용자 수정"""
    from app.services.admin_service import update_user

    success = await update_user(db_session, 99999, is_active=True)
    assert success is False


# ──────────────────────────────────────────
# asset_goal_service 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_asset_goal_upsert_create(db_session, test_user, test_household):
    """순자산 목표 생성"""
    from app.services.asset_goal_service import upsert_goal

    goal = await upsert_goal(
        user_id=test_user.id,
        household_id=test_household.id,
        target_net_worth=100000000.0,
        target_date=date(2027, 12, 31),
        db=db_session,
    )
    assert goal is not None
    assert float(goal.target_net_worth) == 100000000.0

    # 동일 사용자/가구로 업데이트
    goal2 = await upsert_goal(
        user_id=test_user.id,
        household_id=test_household.id,
        target_net_worth=200000000.0,
        target_date=date(2028, 6, 30),
        db=db_session,
    )
    assert float(goal2.target_net_worth) == 200000000.0


@pytest.mark.asyncio
async def test_asset_goal_delete(db_session, test_user, test_household):
    """순자산 목표 삭제"""
    from app.services.asset_goal_service import delete_goal, upsert_goal

    await upsert_goal(
        user_id=test_user.id,
        household_id=test_household.id,
        target_net_worth=50000000.0,
        target_date=date(2027, 6, 30),
        db=db_session,
    )

    deleted = await delete_goal(test_user.id, test_household.id, db_session)
    assert deleted is True

    deleted = await delete_goal(test_user.id, test_household.id, db_session)
    assert deleted is False


@pytest.mark.asyncio
async def test_asset_goal_with_insight(db_session, test_user, test_household):
    """목표 + 인사이트 조회"""
    from app.services.asset_goal_service import get_goal_with_insight, upsert_goal

    await upsert_goal(
        user_id=test_user.id,
        household_id=test_household.id,
        target_net_worth=100000000.0,
        target_date=date(2028, 12, 31),
        db=db_session,
    )
    await db_session.commit()

    result = await get_goal_with_insight(test_user, test_household.id, db_session)
    assert result is not None
    assert "progress_pct" in result
    assert "pace_status" in result
    assert "pace_message" in result


@pytest.mark.asyncio
async def test_asset_goal_with_insight_none(db_session, test_user, test_household):
    """목표 없을 때 인사이트 → None"""
    from app.services.asset_goal_service import get_goal_with_insight

    result = await get_goal_with_insight(test_user, test_household.id, db_session)
    assert result is None


@pytest.mark.asyncio
async def test_asset_goal_achieved(db_session, test_user, test_household):
    """목표 달성 상태 (target < current)"""
    from app.models.asset import Asset
    from app.services.asset_goal_service import get_goal_with_insight, upsert_goal

    # 자산 추가 (deposit 타입, manual_value 사용)
    db_session.add(
        Asset(
            name="큰자산",
            type="deposit",
            manual_value=200000000,
            is_liability=False,
            created_by=test_user.id,
            household_id=test_household.id,
        )
    )
    await db_session.flush()

    # 작은 목표 설정 (현재 순자산보다 작은 금액)
    await upsert_goal(
        user_id=test_user.id,
        household_id=test_household.id,
        target_net_worth=100000000.0,
        target_date=date(2027, 12, 31),
        db=db_session,
    )
    await db_session.commit()

    result = await get_goal_with_insight(test_user, test_household.id, db_session)
    # 목표가 달성되었거나 빠른 페이스
    assert result["pace_status"] in ("ahead", "on_track")
    assert result["progress_pct"] >= 100.0 or result["pace_status"] == "on_track"


@pytest.mark.asyncio
async def test_asset_monthly_savings(db_session, test_user, test_household):
    """이번 달 저축액 — 저축성지출 카테고리 기반"""
    from app.services.asset_goal_service import get_monthly_savings

    result = await get_monthly_savings(test_household.id, db_session)
    assert "savings" in result
    assert "month" in result


@pytest.mark.asyncio
async def test_calc_avg_monthly_growth():
    """월평균 순자산 증가율 계산"""
    from app.services.asset_goal_service import _calc_avg_monthly_growth

    # 스냅샷이 1개 미만이면 None
    assert _calc_avg_monthly_growth([]) is None

    # 스냅샷 모킹
    class FakeSnapshot:
        def __init__(self, nw):
            self.net_worth = nw

    snapshots = [FakeSnapshot(200), FakeSnapshot(150), FakeSnapshot(100)]
    result = _calc_avg_monthly_growth(snapshots)
    assert result == 50.0  # (200 - 100) / 2


# ──────────────────────────────────────────
# household_service 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_household_invitation_creation(db_session, test_user, test_household):
    """초대 생성 서비스"""
    from sqlalchemy import and_, select

    from app.models.household_member import HouseholdMember
    from app.schemas.household import InvitationCreate
    from app.services.household_service import create_household_invitation

    # test_user의 멤버 객체 가져오기
    result = await db_session.execute(
        select(HouseholdMember).where(
            and_(
                HouseholdMember.household_id == test_household.id,
                HouseholdMember.user_id == test_user.id,
            )
        )
    )
    member = result.scalar_one()

    with patch("app.services.household_service.send_invitation_email", new_callable=AsyncMock) as mock_email:
        mock_email.return_value = True
        inv_result = await create_household_invitation(
            db=db_session,
            household_id=test_household.id,
            inviter_member=member,
            invitation_data=InvitationCreate(email="newinvite@test.com", role="member"),
        )
        assert inv_result.email_sent is True
        assert inv_result.invitation.status == "pending"


@pytest.mark.asyncio
async def test_household_invitation_owner_role_rejected(db_session, test_user, test_household):
    """owner 역할 초대 — InvitationCreate 스키마에서 거부"""
    from pydantic import ValidationError

    from app.schemas.household import InvitationCreate

    # InvitationCreate는 role="owner"를 스키마 수준에서 거부
    with pytest.raises(ValidationError):
        InvitationCreate(email="owner@test.com", role="owner")


@pytest.mark.asyncio
async def test_household_invitation_duplicate(db_session, test_user, test_household):
    """중복 초대 방지"""
    from fastapi import HTTPException
    from sqlalchemy import and_, select

    from app.models.household_member import HouseholdMember
    from app.schemas.household import InvitationCreate
    from app.services.household_service import create_household_invitation

    result = await db_session.execute(
        select(HouseholdMember).where(
            and_(
                HouseholdMember.household_id == test_household.id,
                HouseholdMember.user_id == test_user.id,
            )
        )
    )
    member = result.scalar_one()

    with patch("app.services.household_service.send_invitation_email", new_callable=AsyncMock) as mock_email:
        mock_email.return_value = True
        # 첫 번째 초대
        await create_household_invitation(
            db=db_session,
            household_id=test_household.id,
            inviter_member=member,
            invitation_data=InvitationCreate(email="dup@test.com", role="member"),
        )

        # 중복 초대 → 에러
        with pytest.raises(HTTPException) as exc_info:
            await create_household_invitation(
                db=db_session,
                household_id=test_household.id,
                inviter_member=member,
                invitation_data=InvitationCreate(email="dup@test.com", role="member"),
            )
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_household_invitation_already_member(db_session, test_user, test_household):
    """이미 멤버인 사용자 초대 → 에러"""
    from fastapi import HTTPException
    from sqlalchemy import and_, select

    from app.models.household_member import HouseholdMember
    from app.models.user import User
    from app.schemas.household import InvitationCreate
    from app.services.household_service import create_household_invitation

    # 다른 유저를 같은 가구에 추가
    other = User(auth_user_id="hs-alr-001", username="alrmember", email="alrmember@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="member"))
    await db_session.commit()

    result = await db_session.execute(
        select(HouseholdMember).where(
            and_(
                HouseholdMember.household_id == test_household.id,
                HouseholdMember.user_id == test_user.id,
            )
        )
    )
    member = result.scalar_one()

    with pytest.raises(HTTPException) as exc_info:
        await create_household_invitation(
            db=db_session,
            household_id=test_household.id,
            inviter_member=member,
            invitation_data=InvitationCreate(email="alrmember@test.com", role="member"),
        )
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_household_leave_owner_transfer(db_session, test_user, test_household):
    """owner 탈퇴 — 역할 양도"""
    from sqlalchemy import and_, select

    from app.models.household_member import HouseholdMember
    from app.models.user import User
    from app.services.household_service import leave_household_with_transfer

    # 다른 멤버 추가
    other = User(auth_user_id="hs-leave-001", username="leaveuser2", email="leave2@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="admin"))
    await db_session.commit()

    result = await db_session.execute(
        select(HouseholdMember).where(
            and_(
                HouseholdMember.household_id == test_household.id,
                HouseholdMember.user_id == test_user.id,
            )
        )
    )
    member = result.scalar_one()

    leave_result = await leave_household_with_transfer(
        db=db_session,
        household_id=test_household.id,
        member=member,
    )
    assert leave_result.transferred_to == other.id
    assert "양도" in leave_result.message


@pytest.mark.asyncio
async def test_household_leave_last_member(db_session, test_user, test_household):
    """마지막 멤버 탈퇴 → 에러"""
    from fastapi import HTTPException
    from sqlalchemy import and_, select

    from app.models.household_member import HouseholdMember
    from app.services.household_service import leave_household_with_transfer

    result = await db_session.execute(
        select(HouseholdMember).where(
            and_(
                HouseholdMember.household_id == test_household.id,
                HouseholdMember.user_id == test_user.id,
            )
        )
    )
    member = result.scalar_one()

    with pytest.raises(HTTPException) as exc_info:
        await leave_household_with_transfer(
            db=db_session,
            household_id=test_household.id,
            member=member,
        )
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_household_leave_non_owner(db_session, test_user, test_household):
    """일반 멤버 탈퇴 — 양도 없음"""

    from app.models.household_member import HouseholdMember
    from app.models.user import User
    from app.services.household_service import leave_household_with_transfer

    # 다른 사용자를 member로 추가
    other = User(auth_user_id="hs-nm-001", username="nonowner", email="nonowner@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    other_member = HouseholdMember(household_id=test_household.id, user_id=other.id, role="member")
    db_session.add(other_member)
    await db_session.commit()
    await db_session.refresh(other_member)

    leave_result = await leave_household_with_transfer(
        db=db_session,
        household_id=test_household.id,
        member=other_member,
    )
    assert leave_result.transferred_to is None
    assert "탈퇴" in leave_result.message

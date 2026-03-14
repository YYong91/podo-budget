"""Admin 대시보드 API 테스트

접근 제어(403), 통계 엔드포인트 응답 검증을 수행합니다.
test_user(id=1)는 ADMIN_USER_ID=1과 일치하므로 관리자로 간주됩니다.
"""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.models.expense import Expense
from app.models.feedback import Feedback
from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.user import User

# ── 접근 제어 테스트 ──


@pytest.mark.asyncio
async def test_admin_endpoints_require_auth(client: AsyncClient):
    """인증 없이 admin 엔드포인트 접근 시 401"""
    endpoints = [
        "/api/admin/stats/overview",
        "/api/admin/stats/transactions",
        "/api/admin/stats/households",
        "/api/admin/stats/feedback",
        "/api/admin/users",
    ]
    for endpoint in endpoints:
        response = await client.get(endpoint)
        assert response.status_code == 401, f"{endpoint}: expected 401, got {response.status_code}"


@pytest.mark.asyncio
async def test_admin_endpoints_require_admin_role(client: AsyncClient, db_session, test_user: User):
    """일반 사용자(id != ADMIN_USER_ID)가 admin 엔드포인트 접근 시 403

    test_user(id=1)를 먼저 생성한 뒤, id=2인 비관리자 토큰으로 요청
    """
    from tests.conftest import TEST_AUTH_USER_ID_2, create_test_token

    # test_user(id=1)가 이미 생성됨 → test_user2(id=2)를 생성
    user2 = User(auth_user_id=TEST_AUTH_USER_ID_2, username="nonadmin", email="nonadmin@test.com", is_active=True)
    db_session.add(user2)
    await db_session.commit()

    token2 = create_test_token(auth_user_id=TEST_AUTH_USER_ID_2, email="nonadmin@test.com", name="nonadmin")
    headers = {"Authorization": f"Bearer {token2}"}

    endpoints = [
        "/api/admin/stats/overview",
        "/api/admin/stats/transactions",
        "/api/admin/stats/households",
        "/api/admin/stats/feedback",
        "/api/admin/users",
    ]
    for endpoint in endpoints:
        response = await client.get(endpoint, headers=headers)
        assert response.status_code == 403, f"{endpoint}: expected 403, got {response.status_code}"


# ── 개요 통계 테스트 ──


@pytest.mark.asyncio
async def test_overview_stats_empty(authenticated_client: AsyncClient):
    """사용자만 있고 거래 없는 상태에서 개요 통계"""
    response = await authenticated_client.get("/api/admin/stats/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["total_users"] >= 1  # test_user가 존재
    assert data["dau"] == 0  # 거래 없음
    assert data["mau"] == 0
    assert data["new_signups_today"] >= 1


@pytest.mark.asyncio
async def test_overview_stats_with_transactions(authenticated_client: AsyncClient, db_session, test_user: User):
    """거래가 있는 상태에서 DAU/MAU 확인"""
    # 지출 하나 추가
    expense = Expense(
        user_id=test_user.id,
        amount=10000,
        description="테스트 지출",
        date=datetime.now(UTC),
    )
    db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/admin/stats/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["dau"] >= 1
    assert data["mau"] >= 1


# ── 거래 통계 테스트 ──


@pytest.mark.asyncio
async def test_transaction_stats_empty(authenticated_client: AsyncClient):
    """거래 없는 상태에서 통계"""
    response = await authenticated_client.get("/api/admin/stats/transactions")
    assert response.status_code == 200
    data = response.json()
    assert data["total_expense_amount"] == 0
    assert data["total_income_amount"] == 0
    assert data["total_expense_count"] == 0
    assert data["daily_counts"] == []


@pytest.mark.asyncio
async def test_transaction_stats_with_data(authenticated_client: AsyncClient, db_session, test_user: User):
    """거래 데이터가 있는 상태에서 통계"""
    now = datetime.now(UTC)
    db_session.add(Expense(user_id=test_user.id, amount=5000, description="커피", date=now))
    db_session.add(Expense(user_id=test_user.id, amount=15000, description="점심", date=now))
    db_session.add(Income(user_id=test_user.id, amount=3000000, description="월급", date=now))
    await db_session.commit()

    response = await authenticated_client.get("/api/admin/stats/transactions?days=7")
    assert response.status_code == 200
    data = response.json()
    assert data["total_expense_count"] == 2
    assert data["total_income_count"] == 1
    assert data["total_expense_amount"] == 20000
    assert data["total_income_amount"] == 3000000


# ── 가구 통계 테스트 ──


@pytest.mark.asyncio
async def test_household_stats_empty(authenticated_client: AsyncClient):
    """가구 없는 상태에서 통계"""
    response = await authenticated_client.get("/api/admin/stats/households")
    assert response.status_code == 200
    data = response.json()
    assert data["total_households"] == 0
    assert data["total_members"] == 0


@pytest.mark.asyncio
async def test_household_stats_with_data(authenticated_client: AsyncClient, db_session, test_user: User, test_user2: User):
    """가구 데이터가 있는 상태에서 통계"""
    household = Household(name="테스트 가구")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)

    db_session.add(HouseholdMember(household_id=household.id, user_id=test_user.id, role="owner"))
    db_session.add(HouseholdMember(household_id=household.id, user_id=test_user2.id, role="member"))
    db_session.add(
        HouseholdInvitation(
            household_id=household.id,
            inviter_id=test_user.id,
            invitee_email="new@test.com",
            token="test-token-123",
            status="pending",
            expires_at=datetime.now(UTC),
        )
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/admin/stats/households")
    assert response.status_code == 200
    data = response.json()
    assert data["total_households"] == 1
    assert data["total_members"] == 2
    assert data["invitation_stats"]["total"] == 1
    assert data["invitation_stats"]["pending"] == 1


# ── 피드백 통계 테스트 ──


@pytest.mark.asyncio
async def test_feedback_stats(authenticated_client: AsyncClient, db_session, test_user: User):
    """피드백 통계"""
    db_session.add(Feedback(user_id=test_user.id, type="feature", title="요청1", content="내용1", status="new"))
    db_session.add(Feedback(user_id=test_user.id, type="bug", title="버그1", content="내용2", status="done"))
    await db_session.commit()

    response = await authenticated_client.get("/api/admin/stats/feedback")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["by_type"]["feature"] == 1
    assert data["by_type"]["bug"] == 1
    assert data["by_status"]["new"] == 1
    assert data["by_status"]["done"] == 1


# ── 사용자 관리 테스트 ──


@pytest.mark.asyncio
async def test_user_list(authenticated_client: AsyncClient, test_user: User):
    """사용자 목록 조회"""
    response = await authenticated_client.get("/api/admin/users")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert len(data["users"]) >= 1
    assert data["users"][0]["username"] == test_user.username


@pytest.mark.asyncio
async def test_user_list_search(authenticated_client: AsyncClient, test_user: User, test_user2: User):
    """사용자 검색"""
    response = await authenticated_client.get("/api/admin/users?search=testuser2")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["users"][0]["username"] == "testuser2"


@pytest.mark.asyncio
async def test_user_detail(authenticated_client: AsyncClient, test_user: User):
    """사용자 상세 조회"""
    response = await authenticated_client.get(f"/api/admin/users/{test_user.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_user.id
    assert data["username"] == test_user.username
    assert data["expense_count"] == 0
    assert data["income_count"] == 0


@pytest.mark.asyncio
async def test_user_detail_not_found(authenticated_client: AsyncClient):
    """존재하지 않는 사용자 상세 조회"""
    response = await authenticated_client.get("/api/admin/users/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_user_deactivate(authenticated_client: AsyncClient, test_user2: User):
    """사용자 비활성화"""
    response = await authenticated_client.patch(
        f"/api/admin/users/{test_user2.id}",
        json={"is_active": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_user_activate(authenticated_client: AsyncClient, db_session, test_user2: User):
    """사용자 활성화"""
    test_user2.is_active = False
    await db_session.commit()

    response = await authenticated_client.patch(
        f"/api/admin/users/{test_user2.id}",
        json={"is_active": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is True


# ── auth /me is_admin 테스트 ──


@pytest.mark.asyncio
async def test_auth_me_is_admin_true(authenticated_client: AsyncClient):
    """admin 사용자의 /me 응답에 is_admin=True"""
    response = await authenticated_client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["is_admin"] is True


@pytest.mark.asyncio
async def test_auth_me_is_admin_false(client: AsyncClient, db_session, test_user: User):
    """일반 사용자의 /me 응답에 is_admin=False"""
    from tests.conftest import TEST_AUTH_USER_ID_2, create_test_token

    user2 = User(auth_user_id=TEST_AUTH_USER_ID_2, username="nonadmin2", email="nonadmin2@test.com", is_active=True)
    db_session.add(user2)
    await db_session.commit()

    token2 = create_test_token(auth_user_id=TEST_AUTH_USER_ID_2, email="nonadmin2@test.com", name="nonadmin2")
    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token2}"})
    assert response.status_code == 200
    data = response.json()
    assert data["is_admin"] is False

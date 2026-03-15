"""Admin 대시보드 API 테스트

접근 제어(403), 대시보드 통합 통계, 사용자 관리 엔드포인트를 검증합니다.
test_user(id=1)는 ADMIN_USER_ID=1과 일치하므로 관리자로 간주됩니다.
"""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.models.expense import Expense
from app.models.feedback import Feedback
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.user import User

# ── 접근 제어 테스트 ──


@pytest.mark.asyncio
async def test_admin_endpoints_require_auth(client: AsyncClient):
    """인증 없이 admin 엔드포인트 접근 시 401"""
    endpoints = [
        "/api/admin/stats/dashboard",
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
        "/api/admin/stats/dashboard",
        "/api/admin/users",
    ]
    for endpoint in endpoints:
        response = await client.get(endpoint, headers=headers)
        assert response.status_code == 403, f"{endpoint}: expected 403, got {response.status_code}"


@pytest.mark.asyncio
async def test_old_endpoints_removed(authenticated_client: AsyncClient):
    """삭제된 엔드포인트가 404를 반환하는지 확인"""
    old_endpoints = [
        "/api/admin/stats/overview",
        "/api/admin/stats/transactions",
        "/api/admin/stats/households",
        "/api/admin/stats/feedback",
    ]
    for endpoint in old_endpoints:
        response = await authenticated_client.get(endpoint)
        # 라우트가 없으므로 405(Method Not Allowed) 또는 404
        assert response.status_code in (404, 405), f"{endpoint}: expected 404/405, got {response.status_code}"


# ── 대시보드 통합 통계 테스트 ──


@pytest.mark.asyncio
async def test_dashboard_stats_empty(authenticated_client: AsyncClient):
    """사용자만 있고 거래 없는 상태에서 대시보드 통계"""
    response = await authenticated_client.get("/api/admin/stats/dashboard")
    assert response.status_code == 200
    data = response.json()

    # 헬스 카드 필드
    assert data["total_users"] >= 1  # test_user 존재
    assert data["active_users"] >= 1
    assert data["today_active_users"] == 0  # 거래 없음
    assert data["today_transaction_count"] == 0
    assert "pending_feedback_count" in data
    assert "total_households" in data
    assert "telegram_linked_count" in data

    # 최근 활동 (가입 이벤트만)
    assert isinstance(data["recent_activity"], list)
    # 가입 이벤트가 있어야 함
    signup_events = [a for a in data["recent_activity"] if a["type"] == "signup"]
    assert len(signup_events) >= 1

    # 이탈 감지
    assert isinstance(data["inactive_users"], list)


@pytest.mark.asyncio
async def test_dashboard_stats_with_transactions(authenticated_client: AsyncClient, db_session, test_user: User, test_household: Household):
    """거래 + 피드백이 있는 상태에서 대시보드 통계"""
    now = datetime.now(UTC)

    # 오늘 거래 추가
    db_session.add(Expense(user_id=test_user.id, household_id=test_household.id, amount=10000, description="테스트 지출", date=now))
    db_session.add(Income(user_id=test_user.id, household_id=test_household.id, amount=3000000, description="월급", date=now))
    db_session.add(Feedback(user_id=test_user.id, type="feature", title="요청1", content="내용1", status="new"))
    db_session.add(Feedback(user_id=test_user.id, type="bug", title="버그1", content="내용2", status="done"))
    await db_session.commit()

    response = await authenticated_client.get("/api/admin/stats/dashboard")
    assert response.status_code == 200
    data = response.json()

    # 오늘 활동
    assert data["today_active_users"] >= 1
    assert data["today_transaction_count"] >= 2

    # 미처리 피드백
    assert data["pending_feedback_count"] >= 1

    # 최근 활동에 거래와 피드백 포함
    activity_types = {a["type"] for a in data["recent_activity"]}
    assert "expense" in activity_types
    assert "income" in activity_types


@pytest.mark.asyncio
async def test_dashboard_inactive_users(authenticated_client: AsyncClient, db_session, test_user: User, test_household: Household):
    """이탈 감지 — 오래된 거래만 있는 사용자"""
    from tests.conftest import TEST_AUTH_USER_ID_2

    # 비활동 사용자 생성
    old_user = User(
        auth_user_id=TEST_AUTH_USER_ID_2,
        username="inactive_user",
        email="inactive@test.com",
        is_active=True,
    )
    db_session.add(old_user)
    await db_session.flush()

    # 비활동 사용자도 가구 멤버십 추가
    member = HouseholdMember(household_id=test_household.id, user_id=old_user.id, role="member")
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(old_user)

    # 30일 전 거래
    old_date = datetime.now(UTC) - timedelta(days=30)
    db_session.add(Expense(user_id=old_user.id, household_id=test_household.id, amount=5000, description="옛날 지출", date=old_date, created_at=old_date))
    await db_session.commit()

    response = await authenticated_client.get("/api/admin/stats/dashboard")
    assert response.status_code == 200
    data = response.json()

    # 이탈 감지에 비활동 사용자가 포함
    inactive_ids = [u["id"] for u in data["inactive_users"]]
    assert old_user.id in inactive_ids

    # 비활동 일수 확인
    inactive_item = next(u for u in data["inactive_users"] if u["id"] == old_user.id)
    assert inactive_item["days_inactive"] >= 29


@pytest.mark.asyncio
async def test_dashboard_with_households(authenticated_client: AsyncClient, db_session, test_user: User):
    """가구가 있는 상태에서 대시보드 통계"""
    household = Household(name="테스트 가구")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)

    db_session.add(HouseholdMember(household_id=household.id, user_id=test_user.id, role="owner"))
    await db_session.commit()

    response = await authenticated_client.get("/api/admin/stats/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["total_households"] >= 1


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

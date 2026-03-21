"""Admin API 통합 테스트

- GET /api/admin/stats/dashboard — 대시보드 (관리자 전용)
- GET /api/admin/users — 사용자 목록
- GET /api/admin/users/{id} — 사용자 상세
- PATCH /api/admin/users/{id} — 사용자 수정 (활성/비활성)

보안 검증:
- 비관리자 접근 시 403 반환
"""

from unittest.mock import patch

import pytest

from app.core.config import settings
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.user import User

# ──────────────────────────────────────────────
# 관리자 클라이언트 fixture
# ──────────────────────────────────────────────


@pytest.fixture
async def admin_user(db_session):
    """ADMIN_USER_ID로 등록된 관리자 사용자"""
    user = User(
        auth_user_id=7000000000001,
        username="admin_user",
        email="admin@example.com",
        hashed_password=None,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    # 가구 필요 (관리자도 가구 소속 필요)
    household = Household(name="관리자 가구")
    db_session.add(household)
    await db_session.flush()

    member = HouseholdMember(household_id=household.id, user_id=user.id, role="owner")
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_client(db_session, admin_user):
    """관리자 JWT 인증 클라이언트"""

    from httpx import ASGITransport, AsyncClient

    from app.core.database import get_db
    from app.main import app
    from tests.conftest import _db_override, create_test_token

    token = create_test_token(
        auth_user_id=admin_user.auth_user_id,
        email=admin_user.email,
        name=admin_user.username,
    )

    app.dependency_overrides[get_db] = _db_override(db_session)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": f"Bearer {token}"},
        ) as ac:
            # ADMIN_USER_ID를 admin_user.id로 오버라이드
            with patch.object(settings, "ADMIN_USER_ID", admin_user.id):
                yield ac
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────
# 권한 거부 테스트 (일반 사용자)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dashboard_stats_non_admin(authenticated_client):
    """비관리자 접근 → 403"""
    response = await authenticated_client.get("/api/admin/stats/dashboard")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_user_list_non_admin(authenticated_client):
    """비관리자 사용자 목록 접근 → 403"""
    response = await authenticated_client.get("/api/admin/users")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_user_detail_non_admin(authenticated_client, test_user: User):
    """비관리자 사용자 상세 접근 → 403"""
    response = await authenticated_client.get(f"/api/admin/users/{test_user.id}")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_admin(client):
    """미인증 관리자 접근 → 401"""
    response = await client.get("/api/admin/stats/dashboard")
    assert response.status_code == 401


# ──────────────────────────────────────────────
# 관리자 접근 성공 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dashboard_stats_admin(admin_client):
    """관리자 대시보드 조회 성공"""
    response = await admin_client.get("/api/admin/stats/dashboard")
    assert response.status_code == 200

    data = response.json()
    # DashboardStatsResponse 필드 확인
    assert "total_users" in data
    assert "active_users" in data
    assert isinstance(data["total_users"], int)


@pytest.mark.asyncio
async def test_user_list_admin(admin_client, test_user: User):
    """관리자 사용자 목록 조회"""
    response = await admin_client.get("/api/admin/users")
    assert response.status_code == 200

    data = response.json()
    assert "users" in data
    assert "total" in data
    assert isinstance(data["users"], list)


@pytest.mark.asyncio
async def test_user_list_pagination(admin_client):
    """사용자 목록 페이지네이션"""
    response = await admin_client.get("/api/admin/users?page=1&page_size=10")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_user_detail_admin(admin_client, test_user: User):
    """관리자 사용자 상세 조회"""
    response = await admin_client.get(f"/api/admin/users/{test_user.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == test_user.id
    assert data["email"] == test_user.email


@pytest.mark.asyncio
async def test_user_detail_not_found(admin_client):
    """존재하지 않는 사용자 → 404"""
    response = await admin_client.get("/api/admin/users/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_user_deactivate(admin_client, test_user: User):
    """사용자 비활성화"""
    response = await admin_client.patch(
        f"/api/admin/users/{test_user.id}",
        json={"is_active": False},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_update_user_not_found(admin_client):
    """존재하지 않는 사용자 수정 → 404"""
    response = await admin_client.patch("/api/admin/users/99999", json={"is_active": True})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_user_list_search(admin_client, test_user: User):
    """사용자 목록 검색 필터"""
    response = await admin_client.get(f"/api/admin/users?search={test_user.username}")
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data["users"], list)

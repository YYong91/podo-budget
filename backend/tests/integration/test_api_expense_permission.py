"""지출 수정/삭제 권한 테스트

owner/admin은 가구 내 모든 거래를 수정/삭제할 수 있고,
member는 본인 거래만 수정/삭제할 수 있다.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.main import app
from app.models.expense import Expense
from app.models.household_member import HouseholdMember
from app.models.user import User

TEST_AUTH_USER_ID_ADMIN = 1000000000003


@pytest.fixture
async def user2_as_member(db_session: AsyncSession, test_user2, test_household):
    """test_user2를 test_household에 member로 추가"""
    member = HouseholdMember(
        household_id=test_household.id,
        user_id=test_user2.id,
        role="member",
    )
    db_session.add(member)
    await db_session.commit()
    return member


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession, test_household):
    """test_household의 admin 사용자"""
    user = User(
        auth_user_id=TEST_AUTH_USER_ID_ADMIN,
        username="adminuser",
        email="admin@example.com",
        hashed_password=None,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    member = HouseholdMember(
        household_id=test_household.id,
        user_id=user.id,
        role="admin",
    )
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def authenticated_client_admin(db_session: AsyncSession, admin_user: User):
    """admin 사용자로 인증된 클라이언트"""
    from tests.conftest import create_test_token

    token = create_test_token(
        auth_user_id=admin_user.auth_user_id,
        email=admin_user.email,
        name=admin_user.username,
    )

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def other_user_expense(db_session: AsyncSession, test_user2, test_household, user2_as_member):
    """test_user2가 생성한 지출 (test_household 소속)"""
    expense = Expense(
        user_id=test_user2.id,
        household_id=test_household.id,
        description="다른 멤버 지출",
        amount=5000,
        category_id=None,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)
    return expense


@pytest.mark.asyncio
async def test_owner_can_update_other_member_expense(
    authenticated_client: AsyncClient,
    other_user_expense: Expense,
):
    """owner는 다른 멤버의 지출을 수정할 수 있다"""
    response = await authenticated_client.put(
        f"/api/expenses/{other_user_expense.id}",
        json={"description": "수정됨", "amount": 9999},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "수정됨"
    assert float(response.json()["amount"]) == 9999


@pytest.mark.asyncio
async def test_member_cannot_update_other_member_expense(
    authenticated_client2: AsyncClient,
    test_user,
    test_household,
    db_session: AsyncSession,
    user2_as_member,
):
    """member는 다른 멤버의 지출을 수정할 수 없다 (403)"""
    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        description="owner 지출",
        amount=10000,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    response = await authenticated_client2.put(
        f"/api/expenses/{expense.id}",
        json={"description": "수정 시도"},
    )
    assert response.status_code == 403
    assert "권한" in response.json()["detail"]


@pytest.mark.asyncio
async def test_admin_can_update_other_member_expense(
    authenticated_client_admin: AsyncClient,
    other_user_expense: Expense,
):
    """admin은 다른 멤버의 지출을 수정할 수 있다"""
    response = await authenticated_client_admin.put(
        f"/api/expenses/{other_user_expense.id}",
        json={"description": "admin이 수정", "amount": 7777},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "admin이 수정"
    assert float(response.json()["amount"]) == 7777


@pytest.mark.asyncio
async def test_admin_can_delete_other_member_expense(
    authenticated_client_admin: AsyncClient,
    other_user_expense: Expense,
):
    """admin은 다른 멤버의 지출을 삭제할 수 있다"""
    response = await authenticated_client_admin.delete(
        f"/api/expenses/{other_user_expense.id}",
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_member_can_update_own_expense(
    authenticated_client2: AsyncClient,
    other_user_expense: Expense,
):
    """member는 본인 지출은 수정할 수 있다"""
    response = await authenticated_client2.put(
        f"/api/expenses/{other_user_expense.id}",
        json={"description": "내 지출 수정"},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "내 지출 수정"


@pytest.mark.asyncio
async def test_owner_can_delete_other_member_expense(
    authenticated_client: AsyncClient,
    other_user_expense: Expense,
):
    """owner는 다른 멤버의 지출을 삭제할 수 있다"""
    response = await authenticated_client.delete(
        f"/api/expenses/{other_user_expense.id}",
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_member_cannot_delete_other_member_expense(
    authenticated_client2: AsyncClient,
    test_user,
    test_household,
    db_session: AsyncSession,
    user2_as_member,
):
    """member는 다른 멤버의 지출을 삭제할 수 없다 (403)"""
    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        description="owner 지출",
        amount=10000,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    response = await authenticated_client2.delete(
        f"/api/expenses/{expense.id}",
    )
    assert response.status_code == 403
    assert "권한" in response.json()["detail"]


@pytest.mark.asyncio
async def test_member_can_delete_own_expense(
    authenticated_client2: AsyncClient,
    other_user_expense: Expense,
):
    """member는 본인 지출은 삭제할 수 있다"""
    response = await authenticated_client2.delete(
        f"/api/expenses/{other_user_expense.id}",
    )
    assert response.status_code == 204

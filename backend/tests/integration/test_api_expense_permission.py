"""지출 수정/삭제 권한 테스트

owner/admin은 가구 내 모든 거래를 수정/삭제할 수 있고,
member는 본인 거래만 수정/삭제할 수 있다.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.household_member import HouseholdMember


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

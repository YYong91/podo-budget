"""수입 수정/삭제 권한 테스트"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household_member import HouseholdMember
from app.models.income import Income


@pytest.fixture
async def user2_as_member_for_income(db_session: AsyncSession, test_user2, test_household):
    """test_user2를 test_household에 member로 추가"""
    result = await db_session.execute(
        select(HouseholdMember).where(
            HouseholdMember.household_id == test_household.id,
            HouseholdMember.user_id == test_user2.id,
        )
    )
    if not result.scalar_one_or_none():
        member = HouseholdMember(
            household_id=test_household.id,
            user_id=test_user2.id,
            role="member",
        )
        db_session.add(member)
        await db_session.commit()
        return member
    return result.scalar_one_or_none()


@pytest.fixture
async def other_user_income(db_session: AsyncSession, test_user2, test_household, user2_as_member_for_income):
    """test_user2가 생성한 수입 (test_household 소속)"""
    income = Income(
        user_id=test_user2.id,
        household_id=test_household.id,
        description="다른 멤버 수입",
        amount=50000,
        category_id=None,
    )
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)
    return income


@pytest.mark.asyncio
async def test_owner_can_update_other_member_income(
    authenticated_client: AsyncClient,
    other_user_income: Income,
):
    """owner는 다른 멤버의 수입을 수정할 수 있다"""
    response = await authenticated_client.put(
        f"/api/income/{other_user_income.id}",
        json={"description": "수정됨", "amount": 99999},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "수정됨"


@pytest.mark.asyncio
async def test_member_cannot_update_other_member_income(
    authenticated_client2: AsyncClient,
    test_user,
    test_household,
    db_session: AsyncSession,
    user2_as_member_for_income,
):
    """member는 다른 멤버의 수입을 수정할 수 없다"""
    income = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        description="owner 수입",
        amount=100000,
    )
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client2.put(
        f"/api/income/{income.id}",
        json={"description": "수정 시도"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_owner_can_delete_other_member_income(
    authenticated_client: AsyncClient,
    other_user_income: Income,
):
    """owner는 다른 멤버의 수입을 삭제할 수 있다"""
    response = await authenticated_client.delete(
        f"/api/income/{other_user_income.id}",
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_member_cannot_delete_other_member_income(
    authenticated_client2: AsyncClient,
    test_user,
    test_household,
    db_session: AsyncSession,
    user2_as_member_for_income,
):
    """member는 다른 멤버의 수입을 삭제할 수 없다"""
    income = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        description="owner 수입",
        amount=100000,
    )
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client2.delete(
        f"/api/income/{income.id}",
    )
    assert response.status_code == 403

"""인증 API 추가 통합 테스트

기존 test_api_auth.py에서 커버하지 않는 경로를 테스트합니다:
- 이메일 포함 회원가입
- 이메일 중복 회원가입
- 계정 삭제 (회원 탈퇴)
"""

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, hash_password
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.user import User

TEST_PASSWORD = "password123"  # pragma: allowlist secret


@pytest.mark.asyncio
async def test_register_with_email(client: AsyncClient):
    """이메일 포함 회원가입 성공 테스트"""
    response = await client.post(
        "/api/auth/register",
        json={
            "username": "emailuser",
            "password": TEST_PASSWORD,
            "email": "user@example.com",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "emailuser"
    assert data["email"] == "user@example.com"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, db_session: AsyncSession):
    """중복 이메일로 회원가입 시도 테스트"""
    # 기존 사용자 생성 (이메일 포함)
    user = User(
        username="existing_user",
        hashed_password=hash_password(TEST_PASSWORD),
        email="taken@example.com",
    )
    db_session.add(user)
    await db_session.commit()

    # 같은 이메일로 회원가입 시도
    response = await client.post(
        "/api/auth/register",
        json={
            "username": "new_user",
            "password": TEST_PASSWORD,
            "email": "taken@example.com",
        },
    )

    assert response.status_code == 400
    assert "이미 사용 중인 이메일" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_account_success(client: AsyncClient, db_session: AsyncSession):
    """계정 삭제 성공 테스트 — 관련 데이터도 함께 삭제"""
    # 1. 사용자 생성
    user = User(
        username="delete_me",
        hashed_password=hash_password(TEST_PASSWORD),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # 2. 카테고리 + 지출 + 예산 생성
    category = Category(user_id=user.id, name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    expense = Expense(
        user_id=user.id,
        amount=8000,
        description="김치찌개",
        category_id=category.id,
        date=datetime.now(),
    )
    db_session.add(expense)

    budget = Budget(
        user_id=user.id,
        category_id=category.id,
        amount=300000,
        period="monthly",
        start_date=datetime.now(),
    )
    db_session.add(budget)
    await db_session.commit()

    # 3. JWT 토큰 생성
    token = create_access_token(data={"sub": "delete_me"})

    # 4. 계정 삭제 요청
    response = await client.delete(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 204

    # 5. 사용자가 삭제되었는지 확인
    result = await db_session.execute(select(User).where(User.id == user.id))
    assert result.scalar_one_or_none() is None

    # 6. 관련 데이터도 삭제되었는지 확인
    expense_result = await db_session.execute(select(Expense).where(Expense.user_id == user.id))
    assert len(expense_result.scalars().all()) == 0

    budget_result = await db_session.execute(select(Budget).where(Budget.user_id == user.id))
    assert len(budget_result.scalars().all()) == 0

    category_result = await db_session.execute(select(Category).where(Category.user_id == user.id))
    assert len(category_result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_delete_account_with_household(client: AsyncClient, db_session: AsyncSession):
    """가구 멤버인 사용자 계정 삭제 — 가구 소프트 삭제 확인"""
    # 1. 사용자 생성
    user = User(
        username="household_deleter",
        hashed_password=hash_password(TEST_PASSWORD),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # 2. 가구 생성 + owner 멤버 등록
    household = Household(name="삭제될 가구")
    db_session.add(household)
    await db_session.flush()

    member = HouseholdMember(
        household_id=household.id,
        user_id=user.id,
        role="owner",
    )
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(household)

    # 3. JWT 토큰 생성
    token = create_access_token(data={"sub": "household_deleter"})

    # 4. 계정 삭제 요청
    response = await client.delete(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 204

    # 5. 사용자 삭제됨
    result = await db_session.execute(select(User).where(User.id == user.id))
    assert result.scalar_one_or_none() is None

    # 6. 멤버십이 소프트 삭제됨 (left_at 설정)
    member_result = await db_session.execute(select(HouseholdMember).where(HouseholdMember.user_id == user.id))
    member_record = member_result.scalar_one()
    assert member_record.left_at is not None

    # 7. 활성 멤버가 0명인 가구는 소프트 삭제됨
    household_result = await db_session.execute(select(Household).where(Household.id == household.id))
    household_record = household_result.scalar_one()
    assert household_record.deleted_at is not None

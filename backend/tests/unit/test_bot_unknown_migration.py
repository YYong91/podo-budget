"""
kakao_unknown 레거시 데이터 이관 테스트

PR #105 이후 카카오 사용자 ID 추출 버그가 수정되면서,
기존 kakao_unknown에 쌓였던 데이터를 실제 유저로 이관하는 로직을 테스트합니다.
"""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.user import User
from app.services.bot_user_service import (
    _migrate_unknown_bot_data,
    get_or_create_bot_user,
)


async def _create_bot_user_with_household(db_session, platform: str, platform_user_id: str) -> tuple[User, Household]:
    """테스트용 봇 유저 + 가구 생성 헬퍼"""
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    user = User(
        username=f"{platform}_{platform_user_id}",
        email=None,
        hashed_password=pwd_context.hash("test"),
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    household = Household(name="내 가계부", currency="KRW")
    db_session.add(household)
    await db_session.flush()

    member = HouseholdMember(household_id=household.id, user_id=user.id, role="owner")
    db_session.add(member)
    await db_session.flush()

    return user, household


async def _create_expense(db_session, user_id: int, household_id: int, amount: float, category_name: str = "식비") -> Expense:
    """테스트용 지출 생성 헬퍼"""
    # 카테고리 찾기 또는 생성
    result = await db_session.execute(select(Category).where(Category.name == category_name, Category.household_id == household_id))
    category = result.scalar_one_or_none()
    if not category:
        category = Category(name=category_name, household_id=household_id)
        db_session.add(category)
        await db_session.flush()

    expense = Expense(
        user_id=user_id,
        household_id=household_id,
        amount=amount,
        description=f"테스트 지출 {amount}원",
        category_id=category.id,
        date=datetime.now(),
    )
    db_session.add(expense)
    await db_session.flush()
    return expense


@pytest.mark.asyncio
async def test_migrate_unknown_data_on_first_real_user(db_session):
    """kakao_unknown 유저에 지출 데이터가 있을 때, 실제 카카오 유저 생성 시 데이터가 이관되는지 확인"""
    # 1) kakao_unknown 유저와 지출 생성
    unknown_user, unknown_household = await _create_bot_user_with_household(db_session, "kakao", "unknown")
    await _create_expense(db_session, unknown_user.id, unknown_household.id, 8000)
    await _create_expense(db_session, unknown_user.id, unknown_household.id, 5000)
    await db_session.commit()

    # unknown 유저에 2건 확인
    result = await db_session.execute(select(Expense).where(Expense.user_id == unknown_user.id))
    assert len(result.scalars().all()) == 2

    # 2) 실제 카카오 유저 생성 (auto_create_household=True → unknown 데이터 이관 트리거)
    real_user = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id="real_abc123", auto_create_household=True)
    await db_session.commit()

    # 3) unknown 유저의 지출이 real_user로 이관됐는지 확인
    result = await db_session.execute(select(Expense).where(Expense.user_id == real_user.id))
    real_expenses = result.scalars().all()
    assert len(real_expenses) == 2

    # unknown 유저에는 지출이 없어야 함
    result = await db_session.execute(select(Expense).where(Expense.user_id == unknown_user.id))
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_no_migration_when_no_unknown_user(db_session):
    """kakao_unknown 유저가 없으면 오류 없이 정상 동작해야 함"""
    real_user = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id="new_user_123", auto_create_household=True)
    await db_session.commit()

    assert real_user is not None
    assert real_user.username == "kakao_new_user_123"


@pytest.mark.asyncio
async def test_unknown_migration_only_on_new_user(db_session):
    """이미 이관된 데이터는 두 번째 유저에게 이관되지 않아야 함"""
    # 1) kakao_unknown 유저와 지출 생성
    unknown_user, unknown_household = await _create_bot_user_with_household(db_session, "kakao", "unknown")
    await _create_expense(db_session, unknown_user.id, unknown_household.id, 8000)
    await db_session.commit()

    # 2) 첫 번째 실제 유저 생성 → unknown 데이터 이관
    user1 = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id="first_user", auto_create_household=True)
    await db_session.commit()

    # 3) 두 번째 실제 유저 생성 → 이관할 데이터 없음
    user2 = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id="second_user", auto_create_household=True)
    await db_session.commit()

    # user1에 1건, user2에 0건
    result = await db_session.execute(select(Expense).where(Expense.user_id == user1.id))
    assert len(result.scalars().all()) == 1

    result = await db_session.execute(select(Expense).where(Expense.user_id == user2.id))
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_migrate_unknown_bot_data_directly(db_session):
    """_migrate_unknown_bot_data 함수 직접 호출 테스트"""
    # 1) kakao_unknown 유저와 데이터 생성
    unknown_user, unknown_household = await _create_bot_user_with_household(db_session, "kakao", "unknown")
    await _create_expense(db_session, unknown_user.id, unknown_household.id, 10000)

    # 수입도 생성
    income = Income(user_id=unknown_user.id, household_id=unknown_household.id, amount=500000, description="급여", date=datetime.now())
    db_session.add(income)
    await db_session.flush()
    await db_session.commit()

    # 2) 대상 유저와 가구 생성
    target_user, target_household = await _create_bot_user_with_household(db_session, "kakao", "target_user")
    await db_session.commit()

    # 3) 이관 실행
    count = await _migrate_unknown_bot_data(db_session, "kakao", target_user, target_household.id)
    await db_session.commit()

    assert count == 1  # 지출 1건

    # 지출이 이관됐는지 확인
    result = await db_session.execute(select(Expense).where(Expense.user_id == target_user.id))
    assert len(result.scalars().all()) == 1

    # 수입도 이관됐는지 확인
    result = await db_session.execute(select(Income).where(Income.user_id == target_user.id))
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_migrate_unknown_data_returns_zero_when_no_data(db_session):
    """kakao_unknown에 데이터가 없으면 0을 반환해야 함"""
    target_user, target_household = await _create_bot_user_with_household(db_session, "kakao", "target")
    await db_session.commit()

    count = await _migrate_unknown_bot_data(db_session, "kakao", target_user, target_household.id)
    assert count == 0

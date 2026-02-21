"""수입 모델 단위 테스트"""

import pytest
from sqlalchemy import select

from app.models.income import Income


@pytest.mark.asyncio
async def test_create_income(db_session):
    """수입 레코드 생성 테스트"""
    from datetime import datetime

    # hash_password removed - use auth_user_id pattern
    from app.models.user import User

    user = User(username="income_test_user", auth_user_id=None, hashed_password=None)  # pragma: allowlist secret
    db_session.add(user)
    await db_session.flush()

    income = Income(
        user_id=user.id,
        amount=3500000,
        description="월급",
        date=datetime(2026, 2, 1, 9, 0, 0),
    )
    db_session.add(income)
    await db_session.commit()

    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 1
    assert incomes[0].amount == 3500000
    assert incomes[0].description == "월급"
    assert incomes[0].user_id == user.id
    assert incomes[0].household_id is None


@pytest.mark.asyncio
async def test_income_with_category(db_session):
    """카테고리가 있는 수입 테스트"""
    from datetime import datetime

    # hash_password removed - use auth_user_id pattern
    from app.models.category import Category
    from app.models.user import User

    user = User(username="income_cat_user", auth_user_id=None, hashed_password=None)  # pragma: allowlist secret
    db_session.add(user)
    await db_session.flush()

    category = Category(name="급여", user_id=user.id)
    db_session.add(category)
    await db_session.flush()

    income = Income(
        user_id=user.id,
        amount=3500000,
        description="2월 월급",
        category_id=category.id,
        date=datetime(2026, 2, 1),
    )
    db_session.add(income)
    await db_session.commit()

    result = await db_session.execute(select(Income).where(Income.category_id == category.id))
    assert result.scalar_one().description == "2월 월급"


@pytest.mark.asyncio
async def test_income_with_household(db_session):
    """가구 공유 수입 테스트"""
    from datetime import datetime

    # hash_password removed - use auth_user_id pattern
    from app.models.household import Household
    from app.models.user import User

    user = User(username="income_hh_user", auth_user_id=None, hashed_password=None)  # pragma: allowlist secret
    db_session.add(user)
    await db_session.flush()

    household = Household(name="우리집")
    db_session.add(household)
    await db_session.flush()

    income = Income(
        user_id=user.id,
        household_id=household.id,
        amount=3500000,
        description="공유 수입",
        date=datetime(2026, 2, 1),
    )
    db_session.add(income)
    await db_session.commit()

    result = await db_session.execute(select(Income).where(Income.household_id == household.id))
    assert result.scalar_one().household_id == household.id

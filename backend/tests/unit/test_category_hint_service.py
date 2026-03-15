"""카테고리 히스토리 기반 추천 서비스 테스트"""

from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.income import Income
from app.models.user import User
from app.services.category_hint_service import get_category_hints, get_user_categories


@pytest.mark.asyncio
async def test_get_user_categories_empty(db_session: AsyncSession, test_user: User):
    """카테고리가 없을 때 빈 목록 반환"""
    categories = await get_user_categories(db_session, test_user.id)
    assert categories == []


@pytest.mark.asyncio
async def test_get_user_categories_system_and_personal(db_session: AsyncSession, test_user: User):
    """시스템 카테고리 + 솔로 개인 카테고리 모두 반환"""
    # 시스템 카테고리 (user_id=None)
    sys_cat = Category(name="식비", description="시스템 카테고리", user_id=None)
    # 솔로 개인 카테고리
    user_cat = Category(name="전기차충전", description="개인 카테고리", user_id=test_user.id)
    db_session.add_all([sys_cat, user_cat])
    await db_session.commit()

    categories = await get_user_categories(db_session, test_user.id)
    assert "식비" in categories
    assert "전기차충전" in categories
    assert len(categories) == 2


@pytest.mark.asyncio
async def test_get_user_categories_excludes_other_users(db_session: AsyncSession, test_user: User, test_user2: User):
    """다른 사용자의 솔로 카테고리는 제외"""
    my_cat = Category(name="내카테고리", user_id=test_user.id)
    other_cat = Category(name="남카테고리", user_id=test_user2.id)
    db_session.add_all([my_cat, other_cat])
    await db_session.commit()

    categories = await get_user_categories(db_session, test_user.id)
    assert "내카테고리" in categories
    assert "남카테고리" not in categories


@pytest.mark.asyncio
async def test_get_user_categories_includes_household(db_session: AsyncSession, test_user: User):
    """household_id가 주어지면 가계 카테고리도 포함"""
    household_id = 42
    hh_cat = Category(name="가계공통", household_id=household_id, user_id=None)
    solo_cat = Category(name="내카테고리", user_id=test_user.id)
    sys_cat = Category(name="시스템", user_id=None, household_id=None)
    db_session.add_all([hh_cat, solo_cat, sys_cat])
    await db_session.commit()

    # household_id 없이 조회 → 가계 카테고리 미포함
    categories_no_hh = await get_user_categories(db_session, test_user.id)
    assert "가계공통" not in categories_no_hh
    assert "내카테고리" in categories_no_hh
    assert "시스템" in categories_no_hh

    # household_id 포함하여 조회 → 가계 카테고리 포함
    categories_with_hh = await get_user_categories(db_session, test_user.id, household_id=household_id)
    assert "가계공통" in categories_with_hh
    assert "내카테고리" in categories_with_hh
    assert "시스템" in categories_with_hh


@pytest.mark.asyncio
async def test_get_user_categories_excludes_other_household(db_session: AsyncSession, test_user: User):
    """다른 가계의 카테고리는 제외"""
    hh1_cat = Category(name="가계1카테고리", household_id=1, user_id=None)
    hh2_cat = Category(name="가계2카테고리", household_id=2, user_id=None)
    db_session.add_all([hh1_cat, hh2_cat])
    await db_session.commit()

    categories = await get_user_categories(db_session, test_user.id, household_id=1)
    assert "가계1카테고리" in categories
    assert "가계2카테고리" not in categories


@pytest.mark.asyncio
async def test_get_category_hints_empty(db_session: AsyncSession, test_user: User):
    """거래 내역이 없을 때 빈 dict 반환"""
    hints = await get_category_hints(db_session, test_user.id)
    assert hints == {}


@pytest.mark.asyncio
async def test_get_category_hints_from_expenses(db_session: AsyncSession, test_user: User, test_household: Household):
    """지출 내역에서 설명→카테고리 패턴 추출"""
    cat = Category(name="교통비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=11680,
        description="전기차충전",
        category_id=cat.id,
        date=datetime(2026, 2, 11),
    )
    db_session.add(expense)
    await db_session.commit()

    hints = await get_category_hints(db_session, test_user.id)
    assert hints == {"전기차충전": "교통비"}


@pytest.mark.asyncio
async def test_get_category_hints_most_recent_wins(db_session: AsyncSession, test_user: User, test_household: Household):
    """동일 설명에 카테고리가 변경된 경우 가장 최신 카테고리 반환"""
    cat1 = Category(name="기타", user_id=test_user.id)
    cat2 = Category(name="식비", user_id=test_user.id)
    db_session.add_all([cat1, cat2])
    await db_session.flush()

    # 오래된 기록: 기타
    old_exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=18100,
        description="쿠팡이츠",
        category_id=cat1.id,
        date=datetime(2026, 1, 1),
    )
    # 최신 기록: 식비
    new_exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=13000,
        description="쿠팡이츠",
        category_id=cat2.id,
        date=datetime(2026, 2, 15),
    )
    db_session.add_all([old_exp, new_exp])
    await db_session.commit()

    hints = await get_category_hints(db_session, test_user.id)
    # 최신(2월 15일) → 식비가 우선
    assert hints.get("쿠팡이츠") == "식비"


@pytest.mark.asyncio
async def test_get_category_hints_includes_income(db_session: AsyncSession, test_user: User, test_household: Household):
    """수입 내역에서도 패턴 추출"""
    cat = Category(name="급여", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    income = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=3500000,
        description="월급",
        category_id=cat.id,
        date=datetime(2026, 2, 25),
    )
    db_session.add(income)
    await db_session.commit()

    hints = await get_category_hints(db_session, test_user.id)
    assert hints.get("월급") == "급여"


@pytest.mark.asyncio
async def test_get_category_hints_no_category_id_excluded(db_session: AsyncSession, test_user: User, test_household: Household):
    """category_id가 없는 거래는 힌트에서 제외"""
    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="미분류지출",
        category_id=None,
        date=datetime(2026, 2, 11),
    )
    db_session.add(expense)
    await db_session.commit()

    hints = await get_category_hints(db_session, test_user.id)
    assert "미분류지출" not in hints

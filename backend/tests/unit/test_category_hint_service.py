"""카테고리 히스토리 기반 추천 서비스 테스트"""

from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.expense import Expense
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
    """시스템 카테고리 + 개인 카테고리 모두 반환"""
    # 시스템 카테고리 (user_id=None)
    sys_cat = Category(name="식비", description="시스템 카테고리", user_id=None)
    # 개인 카테고리
    user_cat = Category(name="전기차충전", description="개인 카테고리", user_id=test_user.id)
    db_session.add_all([sys_cat, user_cat])
    await db_session.commit()

    categories = await get_user_categories(db_session, test_user.id)
    assert "식비" in categories
    assert "전기차충전" in categories
    assert len(categories) == 2


@pytest.mark.asyncio
async def test_get_user_categories_excludes_other_users(db_session: AsyncSession, test_user: User, test_user2: User):
    """다른 사용자의 개인 카테고리는 제외"""
    my_cat = Category(name="내카테고리", user_id=test_user.id)
    other_cat = Category(name="남카테고리", user_id=test_user2.id)
    db_session.add_all([my_cat, other_cat])
    await db_session.commit()

    categories = await get_user_categories(db_session, test_user.id)
    assert "내카테고리" in categories
    assert "남카테고리" not in categories


@pytest.mark.asyncio
async def test_get_category_hints_empty(db_session: AsyncSession, test_user: User):
    """거래 내역이 없을 때 빈 dict 반환"""
    hints = await get_category_hints(db_session, test_user.id)
    assert hints == {}


@pytest.mark.asyncio
async def test_get_category_hints_from_expenses(db_session: AsyncSession, test_user: User):
    """지출 내역에서 설명→카테고리 패턴 추출"""
    cat = Category(name="교통비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    expense = Expense(
        user_id=test_user.id,
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
async def test_get_category_hints_most_recent_wins(db_session: AsyncSession, test_user: User):
    """동일 설명에 카테고리가 변경된 경우 가장 최신 카테고리 반환"""
    cat1 = Category(name="기타", user_id=test_user.id)
    cat2 = Category(name="식비", user_id=test_user.id)
    db_session.add_all([cat1, cat2])
    await db_session.flush()

    # 오래된 기록: 기타
    old_exp = Expense(
        user_id=test_user.id,
        amount=18100,
        description="쿠팡이츠",
        category_id=cat1.id,
        date=datetime(2026, 1, 1),
    )
    # 최신 기록: 식비
    new_exp = Expense(
        user_id=test_user.id,
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
async def test_get_category_hints_includes_income(db_session: AsyncSession, test_user: User):
    """수입 내역에서도 패턴 추출"""
    cat = Category(name="급여", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    income = Income(
        user_id=test_user.id,
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
async def test_get_category_hints_no_category_id_excluded(db_session: AsyncSession, test_user: User):
    """category_id가 없는 거래는 힌트에서 제외"""
    expense = Expense(
        user_id=test_user.id,
        amount=5000,
        description="미분류지출",
        category_id=None,
        date=datetime(2026, 2, 11),
    )
    db_session.add(expense)
    await db_session.commit()

    hints = await get_category_hints(db_session, test_user.id)
    assert "미분류지출" not in hints

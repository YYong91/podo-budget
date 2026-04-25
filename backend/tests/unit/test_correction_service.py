import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.household import Household
from app.services.correction_service import (
    get_corrections_for_household,
    save_correction,
)


@pytest.mark.asyncio
async def test_save_correction_creates_record(db_session: AsyncSession, test_household, test_user):
    """정정 저장 시 DB에 레코드가 생성된다"""
    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    correction = await save_correction(
        db_session,
        input_text="쿠팡 우유",
        category_id=category.id,
        household_id=test_household.id,
        user_id=test_user.id,
        source="edit",
    )

    assert correction.id is not None
    assert correction.input_text == "쿠팡 우유"
    assert correction.category_id == category.id
    assert correction.source == "edit"


@pytest.mark.asyncio
async def test_save_correction_empty_text_skipped(db_session: AsyncSession, test_household, test_user):
    """빈 input_text는 저장하지 않고 None 반환"""
    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    result = await save_correction(
        db_session,
        input_text="",
        category_id=category.id,
        household_id=test_household.id,
    )
    assert result is None


@pytest.mark.asyncio
async def test_get_corrections_for_household(db_session: AsyncSession, test_household, test_user):
    """가구별 정정 데이터를 최신순으로 반환한다"""
    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    for text in ["쿠팡 우유", "마켓컬리 두부", "배민 치킨"]:
        await save_correction(db_session, text, category.id, test_household.id)

    corrections = await get_corrections_for_household(db_session, test_household.id, limit=10)
    assert len(corrections) == 3
    assert corrections[0].input_text == "배민 치킨"  # 최신순


@pytest.mark.asyncio
async def test_corrections_scoped_to_household(db_session: AsyncSession, test_household, test_user):
    """다른 가구의 정정은 조회되지 않는다"""
    other_household = Household(name="다른 가구")
    db_session.add(other_household)
    await db_session.flush()

    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    await save_correction(db_session, "우리 가구 데이터", category.id, test_household.id)
    await save_correction(db_session, "다른 가구 데이터", category.id, other_household.id)

    corrections = await get_corrections_for_household(db_session, test_household.id, limit=10)
    assert len(corrections) == 1
    assert corrections[0].input_text == "우리 가구 데이터"

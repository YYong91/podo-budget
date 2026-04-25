"""자격 검증 서비스 통합 테스트"""

import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.household_profile import HouseholdProfile
from app.services.report_eligibility import (
    MIN_CATEGORIES,
    MIN_TRANSACTIONS,
    check_household_eligibility,
    find_eligible_households,
)


def _make_expense(household_id: int, user_id: int, amount: int, day: int, category_id: int) -> Expense:
    """테스트용 Expense 생성 헬퍼"""
    return Expense(
        household_id=household_id,
        user_id=user_id,
        amount=amount,
        description=f"지출 {day}",
        date=datetime.datetime(2026, 3, day),
        category_id=category_id,
    )


def _make_profile(household_id: int) -> HouseholdProfile:
    """테스트용 HouseholdProfile 생성 헬퍼"""
    return HouseholdProfile(
        household_id=household_id,
        household_type="single",
        housing_type="monthly_rent",
        income_types=["salary"],
        age_range="30s",
    )


# ---------------------------------------------------------------------------
# find_eligible_households 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_eligible_with_sufficient_data(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """프로필 + 거래 15건 + 카테고리 3개 + 지출 20만원 이상이면 자격 통과"""
    db_session.add(_make_profile(test_household.id))

    for i in range(15):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                day=i + 1,
                category_id=(i % 3) + 1,
            )
        )
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id in result


@pytest.mark.asyncio
async def test_ineligible_missing_profile(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """HouseholdProfile이 없으면 자격 미달"""
    for i in range(15):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                day=i + 1,
                category_id=(i % 3) + 1,
            )
        )
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id not in result


@pytest.mark.asyncio
async def test_ineligible_below_transaction_threshold(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """프로필 있어도 거래 14건이면 미달 (임계값 15건)"""
    db_session.add(_make_profile(test_household.id))

    for i in range(14):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                day=i + 1,
                category_id=(i % 4) + 1,
            )
        )
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id not in result


@pytest.mark.asyncio
async def test_ineligible_below_category_threshold(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """거래 15건이지만 카테고리 2개뿐이면 미달 (임계값 3개)"""
    db_session.add(_make_profile(test_household.id))

    for i in range(15):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                day=i + 1,
                category_id=(i % 2) + 1,  # 카테고리 2개만
            )
        )
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id not in result


@pytest.mark.asyncio
async def test_ineligible_below_spend_threshold(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """거래 15건, 카테고리 3개지만 총액 미달이면 자격 실패"""
    db_session.add(_make_profile(test_household.id))

    # 15건 × 1,000원 = 15,000원 (200,000원 미만)
    for i in range(15):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=1000,
                day=i + 1,
                category_id=(i % 3) + 1,
            )
        )
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id not in result


@pytest.mark.asyncio
async def test_exclude_from_stats_ignored(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """exclude_from_stats=True 거래는 집계에서 제외된다"""
    db_session.add(_make_profile(test_household.id))

    # 10건 정상 + 5건 exclude → 정상 거래만 10건, 임계값 15건 미달
    for i in range(10):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                day=i + 1,
                category_id=(i % 3) + 1,
            )
        )
    for i in range(5):
        expense = _make_expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=20000,
            day=15 + i,
            category_id=(i % 3) + 1,
        )
        expense.exclude_from_stats = True
        db_session.add(expense)
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id not in result


@pytest.mark.asyncio
async def test_different_month_not_counted(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """다른 달 거래는 해당 월 집계에 포함되지 않는다"""
    db_session.add(_make_profile(test_household.id))

    # 2월 거래 15건 — 3월 집계에 포함되면 안 됨
    for i in range(15):
        db_session.add(
            Expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                description=f"2월 지출 {i}",
                date=datetime.datetime(2026, 2, i + 1),
                category_id=(i % 3) + 1,
            )
        )
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id not in result


# ---------------------------------------------------------------------------
# check_household_eligibility 테스트
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_household_eligibility_eligible(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """자격 통과 시 is_eligible=True, blocker=None"""
    db_session.add(_make_profile(test_household.id))

    for i in range(15):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                day=i + 1,
                category_id=(i % 3) + 1,
            )
        )
    await db_session.commit()

    result = await check_household_eligibility(db_session, test_household.id, "2026-03")
    assert result.is_eligible is True
    assert result.blocker is None
    assert result.transaction_count == 15
    assert result.category_count == MIN_CATEGORIES
    assert result.total_spend == 300_000.0


@pytest.mark.asyncio
async def test_check_household_eligibility_no_profile(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """프로필 없으면 blocker='profile_missing'"""
    result = await check_household_eligibility(db_session, test_household.id, "2026-03")
    assert result.is_eligible is False
    assert result.blocker == "profile_missing"
    assert result.has_profile is False


@pytest.mark.asyncio
async def test_check_household_eligibility_transactions_short(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """거래 부족 시 blocker='transactions_short'"""
    db_session.add(_make_profile(test_household.id))

    for i in range(10):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                day=i + 1,
                category_id=(i % 3) + 1,
            )
        )
    await db_session.commit()

    result = await check_household_eligibility(db_session, test_household.id, "2026-03")
    assert result.is_eligible is False
    assert result.blocker == "transactions_short"
    assert result.transactions_needed == MIN_TRANSACTIONS - 10


@pytest.mark.asyncio
async def test_check_household_eligibility_categories_short(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """거래 충분하지만 카테고리 부족 시 blocker='categories_short'"""
    db_session.add(_make_profile(test_household.id))

    for i in range(15):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                day=i + 1,
                category_id=(i % 2) + 1,  # 카테고리 2개
            )
        )
    await db_session.commit()

    result = await check_household_eligibility(db_session, test_household.id, "2026-03")
    assert result.is_eligible is False
    assert result.blocker == "categories_short"


@pytest.mark.asyncio
async def test_check_household_eligibility_spend_short(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """거래/카테고리 충분하지만 총액 미달 시 blocker='spend_short'"""
    db_session.add(_make_profile(test_household.id))

    for i in range(15):
        db_session.add(
            _make_expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=1000,  # 총액 = 15,000원
                day=i + 1,
                category_id=(i % 3) + 1,
            )
        )
    await db_session.commit()

    result = await check_household_eligibility(db_session, test_household.id, "2026-03")
    assert result.is_eligible is False
    assert result.blocker == "spend_short"

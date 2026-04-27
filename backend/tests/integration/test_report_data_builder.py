"""report_data_builder 통합 테스트

TDD 방식 — Red → Green → Refactor 순서로 작성.
"""

import datetime as dt

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.income import Income
from app.services.report_data_builder import build_report_data


@pytest.mark.asyncio
async def test_build_report_data_basic(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """기본 집계 — expense_total, income_total, savings_rate"""
    # 지출 3건 (카테고리 각 1, 2, 3)
    for cat_id, amount in [(1, 50000), (2, 30000), (3, 20000)]:
        db_session.add(
            Expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=amount,
                description="지출",
                date=dt.datetime(2026, 3, 1, 12, 0),
                category_id=cat_id,
            )
        )
    # 수입 1건
    db_session.add(
        Income(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=500000,
            description="월급",
            date=dt.datetime(2026, 3, 5, 9, 0),
            category_id=None,
        )
    )
    await db_session.commit()

    data = await build_report_data(db_session, test_household.id, "2026-03")

    assert data["expense_total"] == 100000.0
    assert data["income_total"] == 500000.0
    assert len(data["top_expense_categories"]) == 3
    # 저축률: (500000 - 100000) / 500000 * 100 = 80.0
    assert data["savings_rate"] == pytest.approx(80.0, abs=0.1)


@pytest.mark.asyncio
async def test_build_report_data_excludes_stats_excluded(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """exclude_from_stats=True 거래는 합계에서 제외"""
    db_session.add(
        Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=100000,
            description="일반 지출",
            date=dt.datetime(2026, 3, 1, 12, 0),
            category_id=1,
        )
    )
    db_session.add(
        Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=1000000,
            description="통계 제외",
            date=dt.datetime(2026, 3, 2, 12, 0),
            category_id=1,
            exclude_from_stats=True,
        )
    )
    await db_session.commit()

    data = await build_report_data(db_session, test_household.id, "2026-03")
    assert data["expense_total"] == 100000.0


@pytest.mark.asyncio
async def test_build_report_data_previous_month(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """전월 비교 데이터가 포함된다"""
    # 2월 지출
    db_session.add(
        Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=80000,
            description="2월 지출",
            date=dt.datetime(2026, 2, 10, 12, 0),
            category_id=1,
        )
    )
    # 3월 지출
    db_session.add(
        Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=100000,
            description="3월 지출",
            date=dt.datetime(2026, 3, 10, 12, 0),
            category_id=1,
        )
    )
    await db_session.commit()

    data = await build_report_data(db_session, test_household.id, "2026-03")
    assert data["previous_month_expense"] == 80000.0
    assert data["expense_total"] == 100000.0

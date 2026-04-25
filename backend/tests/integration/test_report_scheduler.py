"""report_scheduler 통합 테스트 (mock LLM)"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.expense import Expense
from app.models.household_profile import HouseholdProfile
from app.models.monthly_report import MonthlyReport
from app.services.report_scheduler import phase1_enqueue_pending, recover_stale_processing


@pytest.mark.asyncio
async def test_phase1_creates_pending_rows(db_session, test_household, test_user):
    """자격 통과 가구에 pending row가 생성된다"""
    profile = HouseholdProfile(
        household_id=test_household.id,
        household_type="single",
        housing_type="monthly_rent",
        income_types=["salary"],
        age_range="30s",
    )
    db_session.add(profile)
    for i in range(15):
        db_session.add(
            Expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                description=f"지출 {i}",
                date=datetime(2026, 3, i + 1),
                category_id=(i % 3) + 1,
            )
        )
    await db_session.commit()

    count = await phase1_enqueue_pending(db_session, "2026-03")
    assert count >= 1

    report = await db_session.scalar(
        select(MonthlyReport).where(
            MonthlyReport.household_id == test_household.id,
            MonthlyReport.month == "2026-03",
        )
    )
    assert report is not None
    assert report.status == "pending"
    assert report.report_data != {}


@pytest.mark.asyncio
async def test_phase1_idempotent(db_session, test_household, test_user):
    """두 번 호출해도 row는 하나만 생성된다"""
    profile = HouseholdProfile(
        household_id=test_household.id,
        household_type="single",
        housing_type="monthly_rent",
        income_types=["salary"],
        age_range="30s",
    )
    db_session.add(profile)
    for i in range(15):
        db_session.add(
            Expense(
                household_id=test_household.id,
                user_id=test_user.id,
                amount=20000,
                description=f"지출 {i}",
                date=datetime(2026, 3, i + 1),
                category_id=(i % 3) + 1,
            )
        )
    await db_session.commit()

    await phase1_enqueue_pending(db_session, "2026-03")
    await phase1_enqueue_pending(db_session, "2026-03")

    rows = (
        await db_session.scalars(
            select(MonthlyReport).where(
                MonthlyReport.household_id == test_household.id,
                MonthlyReport.month == "2026-03",
            )
        )
    ).all()
    assert len(list(rows)) == 1


@pytest.mark.asyncio
async def test_recover_stale_processing(db_session, test_household):
    """processing 좀비 row가 pending으로 복구된다"""
    stale = MonthlyReport(
        household_id=test_household.id,
        month="2026-03",
        status="processing",
        report_data={},
        attempt_count=1,
        started_at=datetime.now(UTC) - timedelta(minutes=30),
    )
    db_session.add(stale)
    await db_session.commit()

    await recover_stale_processing(db_session, threshold_minutes=15)
    await db_session.refresh(stale)

    assert stale.status == "pending"

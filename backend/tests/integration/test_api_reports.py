"""월간 결산 리포트 사용자 조회 API 통합 테스트"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household import Household
from app.models.monthly_report import MonthlyReport


@pytest.mark.asyncio
async def test_get_monthly_report_completed(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_household: Household,
):
    """completed 리포트 조회 시 insights 포함 응답"""
    report = MonthlyReport(
        household_id=test_household.id,
        month="2026-03",
        status="completed",
        report_data={"expense_total": 100000},
        insights={
            "findings": [{"what": "식비가 늘었어요", "so_what": "외식 증가", "now_what": "줄이기"}],
            "action_items": [{"title": "식비 절감", "description": "외식 줄이기"}],
            "encouragement": "수고하셨어요",
        },
        insights_version=1,
    )
    db_session.add(report)
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/reports/monthly",
        params={"month": "2026-03"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["report"]["status"] == "completed"
    assert data["report"]["insights"] is not None
    assert data["eligibility"] is None


@pytest.mark.asyncio
async def test_get_monthly_report_pending_returns_status(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_household: Household,
):
    """pending 리포트 조회 시 status=pending, insights=None 반환"""
    report = MonthlyReport(
        household_id=test_household.id,
        month="2026-03",
        status="pending",
        report_data={},
    )
    db_session.add(report)
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/reports/monthly",
        params={"month": "2026-03"},
    )
    assert resp.status_code == 200
    assert resp.json()["report"]["status"] == "pending"
    assert resp.json()["report"]["insights"] is None


@pytest.mark.asyncio
async def test_get_monthly_report_not_found_returns_eligibility(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_household: Household,
):
    """리포트 없으면 eligibility 정보 반환"""
    resp = await authenticated_client.get(
        "/api/reports/monthly",
        params={"month": "2026-03"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["report"] is None
    assert data["eligibility"] is not None
    assert "blocker" in data["eligibility"]


@pytest.mark.asyncio
async def test_get_monthly_report_invalid_month_format(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_household: Household,
):
    """잘못된 월 형식은 422 반환"""
    resp = await authenticated_client.get(
        "/api/reports/monthly",
        params={"month": "2026-3"},  # YYYY-M (잘못된 형식)
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_latest_report_returns_prev_month_completed(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_household: Household,
):
    """직전 마감 월의 completed 리포트 반환"""
    from app.services.report_month_utils import previous_month_kst

    prev_month = previous_month_kst()
    report = MonthlyReport(
        household_id=test_household.id,
        month=prev_month,
        status="completed",
        report_data={"expense_total": 200000},
        insights={
            "findings": [{"what": "절약 잘 했어요", "so_what": "지출 감소", "now_what": "유지하기"}],
            "action_items": [{"title": "계속 절약", "description": "이 추세 유지"}],
            "encouragement": "훌륭해요",
        },
        insights_version=1,
    )
    db_session.add(report)
    await db_session.commit()

    resp = await authenticated_client.get("/api/reports/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["report"]["status"] == "completed"
    assert data["report"]["month"] == prev_month


@pytest.mark.asyncio
async def test_get_latest_report_no_report_returns_eligibility(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_household: Household,
):
    """직전 달 리포트 없으면 eligibility 반환"""
    resp = await authenticated_client.get("/api/reports/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["report"] is None
    assert data["eligibility"] is not None


@pytest.mark.asyncio
async def test_get_monthly_report_unauthenticated(
    client: AsyncClient,
    db_session: AsyncSession,
    test_household: Household,
):
    """인증 없으면 401 반환"""
    resp = await client.get(
        "/api/reports/monthly",
        params={"month": "2026-03"},
    )
    assert resp.status_code == 401

"""월간 결산 리포트 사용자 조회 API"""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.monthly_report import MonthlyReport
from app.models.user import User
from app.schemas.monthly_report import (
    MonthlyReportEligibility,
    MonthlyReportOrEligibility,
    MonthlyReportResponse,
)
from app.services.report_eligibility import check_household_eligibility
from app.services.report_month_utils import previous_month_kst

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_eligibility(eligibility) -> MonthlyReportEligibility:
    """EligibilityResult → MonthlyReportEligibility 변환 헬퍼"""
    return MonthlyReportEligibility(
        has_profile=eligibility.has_profile,
        transaction_count=eligibility.transaction_count,
        transactions_needed=eligibility.transactions_needed,
        category_count=eligibility.category_count,
        total_spend=eligibility.total_spend,
        is_eligible=eligibility.is_eligible,
        blocker=eligibility.blocker,
    )


@router.get("/monthly", response_model=MonthlyReportOrEligibility)
async def get_monthly_report(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """특정 월의 결산 리포트 조회

    - 리포트가 존재하면 status/insights 포함 반환
    - 리포트가 없으면 eligibility(자격 정보) 반환
    """
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    report = await db.scalar(
        select(MonthlyReport).where(
            MonthlyReport.household_id == household_id,
            MonthlyReport.month == month,
        )
    )

    if report:
        return MonthlyReportOrEligibility(
            report=MonthlyReportResponse.model_validate(report),
            eligibility=None,
        )

    eligibility = await check_household_eligibility(db, household_id, month)
    return MonthlyReportOrEligibility(
        report=None,
        eligibility=_build_eligibility(eligibility),
    )


@router.get("/latest", response_model=MonthlyReportOrEligibility)
async def get_latest_report(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """직전 마감 월의 결산 리포트 조회 (모아보기 상단 카드용)

    KST 기준 직전 월의 completed 리포트를 반환한다.
    리포트가 없으면 직전 월 기준 eligibility를 반환한다.
    """
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    prev_month = previous_month_kst()

    report = await db.scalar(
        select(MonthlyReport).where(
            MonthlyReport.household_id == household_id,
            MonthlyReport.month == prev_month,
            MonthlyReport.status == "completed",
        )
    )

    if report:
        return MonthlyReportOrEligibility(
            report=MonthlyReportResponse.model_validate(report),
            eligibility=None,
        )

    eligibility = await check_household_eligibility(db, household_id, prev_month)
    return MonthlyReportOrEligibility(
        report=None,
        eligibility=_build_eligibility(eligibility),
    )

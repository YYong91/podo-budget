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
from app.services.report_eligibility import EligibilityResult, check_household_eligibility
from app.services.report_month_utils import current_month_kst, previous_month_kst

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_eligibility(eligibility: EligibilityResult) -> MonthlyReportEligibility:
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

    - 전월에 생성 중/완료된 리포트가 있으면 그 상태를 반환
    - 없으면 현재 월 기준 eligibility(다음 달 리포트 자격)를 반환

    Note: eligibility 기준을 전월이 아닌 현재 월로 쓰는 이유 —
    전월 데이터는 이미 확정됐으므로 사용자가 추가 거래를 입력해도 반영되지 않는다.
    현재 월 기준으로 보여야 "이번 달 15건 채우면 다음 달 리포트 생성" 진행 상황이 의미 있다.
    """
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    prev_month = previous_month_kst()

    # 전월 리포트가 생성 중이거나 완료된 경우 해당 상태 반환 (failed는 제외 — 현재 월 progress 표시가 더 유용)
    report = await db.scalar(
        select(MonthlyReport).where(
            MonthlyReport.household_id == household_id,
            MonthlyReport.month == prev_month,
            MonthlyReport.status.in_(["pending", "processing", "completed"]),
        )
    )

    if report:
        return MonthlyReportOrEligibility(
            report=MonthlyReportResponse.model_validate(report),
            eligibility=None,
        )

    # 전월 리포트가 없으면 현재 월 기준 eligibility 반환 (다음 달 리포트를 위한 진행 상황)
    this_month = current_month_kst()
    eligibility = await check_household_eligibility(db, household_id, this_month)
    return MonthlyReportOrEligibility(
        report=None,
        eligibility=_build_eligibility(eligibility),
    )

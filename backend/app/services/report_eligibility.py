"""월간 결산 리포트 자격 검증 서비스

가구가 월간 결산 리포트를 받을 자격이 있는지 판단한다.
자격 조건은 3가지: 거래 건수, 카테고리 다양성, 총 지출액.
HouseholdProfile이 없으면 온보딩 미완료로 간주하여 즉시 미달 처리한다.
"""

import logging
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.household import Household
from app.models.household_profile import HouseholdProfile
from app.services.report_month_utils import month_boundaries

logger = logging.getLogger(__name__)

# 자격 임계값 상수
MIN_TRANSACTIONS = 15
MIN_CATEGORIES = 3
MIN_SPEND = 200_000

# HouseholdProfile 미존재 시 반환되는 blocker 값
_BLOCKER_PROFILE_MISSING = "profile_missing"
_BLOCKER_TRANSACTIONS_SHORT = "transactions_short"
_BLOCKER_CATEGORIES_SHORT = "categories_short"
_BLOCKER_SPEND_SHORT = "spend_short"

BlockerType = Literal[
    "profile_missing",
    "transactions_short",
    "categories_short",
    "spend_short",
    None,
]


@dataclass
class EligibilityResult:
    """단일 가구의 자격 검증 결과

    Attributes:
        has_profile: HouseholdProfile 존재 여부
        transaction_count: 해당 월 통계 포함 지출 건수
        category_count: 해당 월 고유 카테고리 수
        total_spend: 해당 월 총 지출액 (원)
        is_eligible: 모든 조건 통과 여부
        blocker: 첫 번째 미달 조건 (자격 통과 시 None)
    """

    has_profile: bool
    transaction_count: int
    category_count: int
    total_spend: float
    is_eligible: bool
    blocker: BlockerType

    @property
    def transactions_needed(self) -> int:
        """리포트 자격까지 필요한 추가 거래 건수"""
        return max(0, MIN_TRANSACTIONS - self.transaction_count)


def _date_to_datetime(d: date) -> datetime:
    """date → datetime 변환 (Expense.date가 DateTime 컬럼이므로 필요)"""
    return datetime(d.year, d.month, d.day)


async def find_eligible_households(db: AsyncSession, month: str) -> list[int]:
    """자격 통과 가구 ID 목록 반환

    HouseholdProfile이 있고, 해당 월의 통계 포함 지출 거래가
    건수·카테고리·총액 기준을 모두 만족하는 가구를 반환한다.

    Args:
        db: 비동기 DB 세션
        month: 대상 월 (YYYY-MM 형식)

    Returns:
        자격 통과 가구 ID 목록
    """
    start, end = month_boundaries(month)
    start_dt = _date_to_datetime(start)
    end_dt = _date_to_datetime(end)

    # HouseholdProfile JOIN으로 온보딩 미완료 가구를 한 번에 필터
    result = await db.execute(
        select(Household.id)
        .join(HouseholdProfile, HouseholdProfile.household_id == Household.id)
        .outerjoin(
            Expense,
            and_(
                Expense.household_id == Household.id,
                Expense.date >= start_dt,
                Expense.date < end_dt,
                Expense.exclude_from_stats == False,  # noqa: E712
            ),
        )
        .group_by(Household.id)
        .having(
            func.count(Expense.id) >= MIN_TRANSACTIONS,
            func.count(func.distinct(Expense.category_id)) >= MIN_CATEGORIES,
            func.coalesce(func.sum(Expense.amount), 0) >= MIN_SPEND,
        )
    )
    ids = [row[0] for row in result.all()]
    logger.info("[eligibility] 자격 통과 가구 %d개 (월: %s)", len(ids), month)
    return ids


async def check_household_eligibility(db: AsyncSession, household_id: int, month: str) -> EligibilityResult:
    """단일 가구의 자격 상세 정보 반환

    API나 스케줄러에서 특정 가구의 자격 여부와 부족한 조건을 확인할 때 사용한다.

    Args:
        db: 비동기 DB 세션
        household_id: 검증할 가구 ID
        month: 대상 월 (YYYY-MM 형식)

    Returns:
        EligibilityResult (blocker=None이면 자격 통과)
    """
    # HouseholdProfile 존재 여부 먼저 확인
    profile_row = await db.execute(select(HouseholdProfile.id).where(HouseholdProfile.household_id == household_id))
    has_profile = profile_row.scalar_one_or_none() is not None

    if not has_profile:
        return EligibilityResult(
            has_profile=False,
            transaction_count=0,
            category_count=0,
            total_spend=0.0,
            is_eligible=False,
            blocker=_BLOCKER_PROFILE_MISSING,
        )

    # 거래 집계
    start, end = month_boundaries(month)
    start_dt = _date_to_datetime(start)
    end_dt = _date_to_datetime(end)

    row = await db.execute(
        select(
            func.count(Expense.id).label("tx_count"),
            func.count(func.distinct(Expense.category_id)).label("cat_count"),
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        ).where(
            Expense.household_id == household_id,
            Expense.date >= start_dt,
            Expense.date < end_dt,
            Expense.exclude_from_stats == False,  # noqa: E712
        )
    )
    stats = row.one()
    tx_count: int = stats.tx_count
    cat_count: int = stats.cat_count
    total: float = float(stats.total)

    # 우선순위 순으로 blocker 결정 (거래 건수 → 카테고리 → 총액)
    blocker: BlockerType = None
    if tx_count < MIN_TRANSACTIONS:
        blocker = _BLOCKER_TRANSACTIONS_SHORT
    elif cat_count < MIN_CATEGORIES:
        blocker = _BLOCKER_CATEGORIES_SHORT
    elif total < MIN_SPEND:
        blocker = _BLOCKER_SPEND_SHORT

    return EligibilityResult(
        has_profile=True,
        transaction_count=tx_count,
        category_count=cat_count,
        total_spend=total,
        is_eligible=blocker is None,
        blocker=blocker,
    )

"""월간 결산 리포트 Pydantic 스키마"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.insights import StructuredInsightsResponse


class MonthlyReportResponse(BaseModel):
    """사용자 조회 API 응답"""

    id: int
    month: str
    status: Literal["pending", "processing", "completed", "failed"]
    insights: StructuredInsightsResponse | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class MonthlyReportListItem(BaseModel):
    """리스트/카드 그리드용"""

    month: str
    status: Literal["pending", "processing", "completed", "failed"]
    headline: str | None  # insights.findings[0].what 미리보기
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class MonthlyReportEligibility(BaseModel):
    """자격 미달 시 사용자 안내 정보"""

    has_profile: bool
    transaction_count: int
    transactions_needed: int
    category_count: int
    total_spend: float
    is_eligible: bool
    blocker: Literal[
        "profile_missing",
        "transactions_short",
        "categories_short",
        "spend_short",
        "first_month",
        None,
    ]


class MonthlyReportOrEligibility(BaseModel):
    """리포트 없을 때 자격 정보를 함께 반환"""

    report: MonthlyReportResponse | None
    eligibility: MonthlyReportEligibility | None

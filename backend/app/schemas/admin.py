"""Admin 대시보드 관련 Pydantic 스키마

시스템 전체 통계, 사용자 관리 등 관리자 전용 응답 DTO들입니다.
"""

from datetime import datetime

from pydantic import BaseModel

# ── 개요 (사용자 현황) ──


class OverviewStatsResponse(BaseModel):
    """사용자 현황 통계"""

    total_users: int
    active_users: int  # is_active=True
    new_signups_today: int
    new_signups_week: int
    new_signups_month: int
    dau: int  # Daily Active Users (오늘 거래 기록한 유저 수)
    mau: int  # Monthly Active Users (이번달 거래 기록한 유저 수)
    telegram_linked_count: int
    retention_rate: float | None  # 이번달 MAU 중 지난달에도 활성이었던 비율 (%)


# ── 거래 통계 ──


class DailyCount(BaseModel):
    date: str
    expense_count: int
    income_count: int
    expense_amount: float
    income_amount: float


class CategoryDistribution(BaseModel):
    category: str
    amount: float
    count: int
    percentage: float


class TransactionStatsResponse(BaseModel):
    """거래 통계"""

    total_expense_amount: float
    total_income_amount: float
    total_expense_count: int
    total_income_count: int
    avg_expense_amount: float
    avg_income_amount: float
    daily_counts: list[DailyCount]
    expense_by_category: list[CategoryDistribution]
    income_by_category: list[CategoryDistribution]


# ── 가구 현황 ──


class InvitationStats(BaseModel):
    total: int
    pending: int
    accepted: int
    rejected: int
    expired: int


class HouseholdStatsResponse(BaseModel):
    """가구 현황 통계"""

    total_households: int
    total_members: int
    member_distribution: dict[str, int]  # {"1": 3, "2": 5, "3": 2} (멤버 수 별 가구 수)
    invitation_stats: InvitationStats


# ── 피드백 통계 ──


class FeedbackStatsResponse(BaseModel):
    """피드백 통계"""

    total: int
    by_status: dict[str, int]  # {"new": 5, "read": 3, "done": 10}
    by_type: dict[str, int]  # {"feature": 10, "bug": 5}


# ── 사용자 관리 ──


class AdminUserItem(BaseModel):
    """사용자 목록 항목"""

    id: int
    username: str
    email: str | None
    is_active: bool
    created_at: datetime
    expense_count: int
    income_count: int
    last_activity_at: datetime | None
    is_telegram_linked: bool

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    """사용자 목록 응답 (페이지네이션)"""

    users: list[AdminUserItem]
    total: int
    page: int
    page_size: int


class AdminUserDetailResponse(BaseModel):
    """사용자 상세 정보"""

    id: int
    username: str
    email: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    expense_count: int
    income_count: int
    total_spent: float
    total_earned: float
    household_count: int
    is_telegram_linked: bool
    last_activity_at: datetime | None

    class Config:
        from_attributes = True


class AdminUserUpdateRequest(BaseModel):
    """사용자 정보 수정 요청"""

    is_active: bool | None = None

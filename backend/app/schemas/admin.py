"""Admin 대시보드 관련 Pydantic 스키마

운영 중심 대시보드: 현황(헬스카드 + 최근 활동 + 이탈 감지), 사용자 관리
"""

from datetime import datetime

from pydantic import BaseModel

# ── 대시보드 (현황 탭) ──


class RecentActivityItem(BaseModel):
    """최근 활동 피드 항목"""

    type: str  # "expense" | "income" | "signup" | "feedback"
    username: str
    description: str
    amount: float | None = None
    created_at: datetime


class InactiveUserItem(BaseModel):
    """이탈 감지 — 비활동 사용자"""

    id: int
    username: str
    last_activity_at: datetime | None = None
    days_inactive: int


class DashboardStatsResponse(BaseModel):
    """운영 대시보드 통합 응답"""

    # 헬스 카드
    total_users: int
    active_users: int  # is_active=True
    telegram_linked_count: int
    total_households: int
    today_active_users: int  # 오늘 거래 기록한 유저 수
    today_transaction_count: int  # 오늘 총 거래 건수
    pending_feedback_count: int  # status='new' 피드백 수

    # 최근 활동 피드 (최신 20건)
    recent_activity: list[RecentActivityItem]

    # 이탈 감지 (7일+ 비활동, 최대 10명)
    inactive_users: list[InactiveUserItem]


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

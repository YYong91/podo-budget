"""지출 스키마"""

from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import DateTimeCoerceMixin


class ExpenseBase(DateTimeCoerceMixin):
    amount: Decimal = Field(..., gt=0, description="지출 금액 (0보다 커야 함)")
    description: str = Field(..., max_length=500, description="지출 설명 (최대 500자)")
    category_id: int | None = None
    date: datetime


class ExpenseCreate(ExpenseBase):
    raw_input: str | None = None
    memo: str | None = None
    household_id: int | None = None
    exclude_from_stats: bool = False


class ExpenseUpdate(BaseModel):
    amount: Decimal | None = Field(None, gt=0, description="지출 금액 (0보다 커야 함)")
    description: str | None = Field(None, max_length=500, description="지출 설명 (최대 500자)")
    category_id: int | None = None
    date: datetime | None = None
    memo: str | None = None
    exclude_from_stats: bool | None = None


class ExpenseResponse(ExpenseBase):
    # 응답 시 float으로 직렬화 (JSON 호환성) — 입력은 ExpenseBase의 Decimal로 정밀도 보장 (#146)
    amount: float
    id: int
    raw_input: str | None = None
    memo: str | None = None
    household_id: int | None = None
    user_id: int | None = None
    exclude_from_stats: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── 통계 관련 스키마 ──


class StatsPeriod(str, Enum):
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


class CategoryStats(BaseModel):
    """카테고리별 통계"""

    category: str
    amount: float
    count: int
    percentage: float


class TrendPoint(BaseModel):
    """추이 데이터 포인트"""

    label: str
    amount: float


class StatsResponse(BaseModel):
    """기간별 통계 응답"""

    period: str
    label: str
    start_date: str
    end_date: str
    total: float
    count: int
    by_category: list[CategoryStats]
    trend: list[TrendPoint]


class PeriodTotal(BaseModel):
    """기간별 총액"""

    label: str
    total: float


class CategoryChange(BaseModel):
    """카테고리별 변화"""

    category: str
    current: float
    previous: float
    change_amount: float
    change_percentage: float | None


class ChangeInfo(BaseModel):
    """변화량 정보"""

    amount: float
    percentage: float | None


class ComparisonResponse(BaseModel):
    """기간 비교 응답"""

    current: PeriodTotal
    previous: PeriodTotal
    change: ChangeInfo
    trend: list[PeriodTotal]
    by_category_comparison: list[CategoryChange]


# ── 월별 통계 응답 스키마 (#242) ──


class CategoryAmount(BaseModel):
    """카테고리별 금액"""

    category: str
    amount: float


class DailyTrendItem(BaseModel):
    """일별 추이 항목"""

    date: str
    amount: float


class MonthlyStatsResponse(BaseModel):
    """월별 통계 응답"""

    month: str
    total: float
    by_category: list[CategoryAmount]
    daily_trend: list[DailyTrendItem]

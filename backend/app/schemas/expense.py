"""지출 스키마"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class ExpenseBase(BaseModel):
    amount: float = Field(..., gt=0, description="지출 금액 (0보다 커야 함)")
    description: str
    category_id: int | None = None
    date: datetime

    @field_validator("date", mode="before")
    @classmethod
    def coerce_date_to_datetime(cls, v: Any) -> Any:
        """YYYY-MM-DD 형식(시간 없는 날짜)을 datetime으로 변환

        Pydantic v2는 기본적으로 날짜만 있는 문자열을 datetime으로 파싱하지 못함.
        프론트엔드 date input (YYYY-MM-DD) 및 LLM이 반환하는 날짜 형식과 호환되도록
        T00:00:00을 자동으로 추가한다.
        """
        if isinstance(v, str) and len(v) == 10 and "T" not in v and " " not in v:
            return f"{v}T00:00:00"
        return v


class ExpenseCreate(ExpenseBase):
    raw_input: str | None = None
    memo: str | None = None
    household_id: int | None = None


class ExpenseUpdate(BaseModel):
    amount: float | None = Field(None, gt=0, description="지출 금액 (0보다 커야 함)")
    description: str | None = None
    category_id: int | None = None
    date: datetime | None = None
    memo: str | None = None


class ExpenseResponse(ExpenseBase):
    id: int
    raw_input: str | None = None
    memo: str | None = None
    household_id: int | None = None
    user_id: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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

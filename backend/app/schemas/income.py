"""수입 스키마"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import DateTimeCoerceMixin


class IncomeBase(DateTimeCoerceMixin):
    amount: Decimal = Field(..., gt=0, description="수입 금액 (0보다 커야 함)")
    description: str = Field(..., max_length=500, description="수입 설명 (최대 500자)")
    category_id: int | None = None
    date: datetime


class IncomeCreate(IncomeBase):
    raw_input: str | None = None
    memo: str | None = None
    household_id: int | None = None
    exclude_from_stats: bool = False


class IncomeUpdate(BaseModel):
    amount: Decimal | None = Field(None, gt=0, description="수입 금액 (0보다 커야 함)")
    description: str | None = Field(None, max_length=500, description="수입 설명 (최대 500자)")
    category_id: int | None = None
    date: datetime | None = None
    memo: str | None = None
    exclude_from_stats: bool | None = None


class IncomeResponse(IncomeBase):
    # 응답 시 float으로 직렬화 (JSON 호환성) — 입력은 IncomeBase의 Decimal로 정밀도 보장 (#146)
    amount: float
    id: int
    raw_input: str | None = None
    memo: str | None = None
    household_id: int | None = None
    user_id: int
    exclude_from_stats: bool = False
    recurring_transaction_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

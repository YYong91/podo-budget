"""결제수단 스키마

CRUD 요청/응답 + 월별 사용액 통계 스키마.
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

PaymentType = Literal["credit_card", "debit_card", "cash", "transfer"]


class PaymentMethodCreate(BaseModel):
    """결제수단 생성 요청"""

    name: str
    type: PaymentType
    monthly_target: Decimal | None = None
    is_default: bool = False
    household_id: int | None = None


class PaymentMethodUpdate(BaseModel):
    """결제수단 수정 요청"""

    name: str | None = None
    type: PaymentType | None = None
    monthly_target: Decimal | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class PaymentMethodResponse(BaseModel):
    """결제수단 응답"""

    id: int
    household_id: int
    created_by: int
    name: str
    type: str
    monthly_target: float | None
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentMethodUsage(BaseModel):
    """결제수단별 월 사용액 통계"""

    id: int
    name: str
    type: str
    monthly_target: float | None
    spent_amount: float
    usage_percentage: float | None  # spent / target * 100
    remaining: float | None  # target - spent

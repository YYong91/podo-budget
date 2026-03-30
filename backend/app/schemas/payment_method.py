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
    display_order: int = 0
    household_id: int | None = None


class PaymentMethodUpdate(BaseModel):
    """결제수단 수정 요청"""

    name: str | None = None
    type: PaymentType | None = None
    monthly_target: Decimal | None = None
    is_default: bool | None = None
    is_active: bool | None = None
    display_order: int | None = None


class PaymentMethodReorderRequest(BaseModel):
    """결제수단 순서 변경 요청 — 순서대로 정렬된 결제수단 ID 목록"""

    payment_method_ids: list[int]


class PaymentMethodResponse(BaseModel):
    """결제수단 응답"""

    id: int
    household_id: int | None
    created_by: int | None
    name: str
    type: str
    monthly_target: float | None
    is_default: bool
    is_system: bool = False
    is_active: bool
    display_order: int
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

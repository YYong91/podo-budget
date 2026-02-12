"""예산 관련 Pydantic 스키마

예산 설정 및 초과 알림에 사용되는 DTO들입니다.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class BudgetCreate(BaseModel):
    """예산 생성 요청 스키마

    Attributes:
        category_id: 예산을 설정할 카테고리 ID
        amount: 예산 금액
        period: 예산 기간 (monthly: 월간, weekly: 주간, daily: 일간)
        start_date: 예산 시작일
        end_date: 예산 종료일 (None이면 무기한)
        alert_threshold: 알림 임계값 (0.0~1.0, 기본 0.8 = 80% 도달 시 알림)
    """

    category_id: int = Field(..., description="카테고리 ID")
    amount: float = Field(..., gt=0, description="예산 금액 (양수)")
    period: Literal["monthly", "weekly", "daily"] = Field(..., description="예산 기간")
    start_date: datetime = Field(..., description="예산 시작일")
    end_date: datetime | None = Field(None, description="예산 종료일 (None이면 무기한)")
    alert_threshold: float = Field(default=0.8, ge=0.0, le=1.0, description="알림 임계값 (0~1, 기본 0.8)")


class BudgetUpdate(BaseModel):
    """예산 수정 요청 스키마

    모든 필드가 선택사항이며, 제공된 필드만 업데이트됩니다.
    """

    amount: float | None = Field(None, gt=0, description="예산 금액")
    period: Literal["monthly", "weekly", "daily"] | None = Field(None, description="예산 기간")
    start_date: datetime | None = Field(None, description="예산 시작일")
    end_date: datetime | None = Field(None, description="예산 종료일")
    alert_threshold: float | None = Field(None, ge=0.0, le=1.0, description="알림 임계값")


class BudgetResponse(BaseModel):
    """예산 정보 응답 스키마"""

    id: int
    category_id: int
    amount: float
    period: str
    start_date: datetime
    end_date: datetime | None
    alert_threshold: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BudgetAlert(BaseModel):
    """예산 초과/경고 알림 스키마

    각 카테고리별로 예산 대비 지출 상황을 알려줍니다.

    Attributes:
        budget_id: 예산 ID
        category_id: 카테고리 ID
        category_name: 카테고리 이름
        budget_amount: 설정된 예산 금액
        spent_amount: 현재까지 지출 금액
        remaining_amount: 남은 예산 (음수면 초과)
        usage_percentage: 사용률 (0~100+, 100 초과 시 예산 초과)
        is_exceeded: 예산 초과 여부
        is_warning: 경고 임계값 도달 여부 (예: 80% 이상)
    """

    budget_id: int
    category_id: int
    category_name: str
    budget_amount: float
    spent_amount: float
    remaining_amount: float = Field(..., description="남은 예산 (음수면 초과)")
    usage_percentage: float = Field(..., description="사용률 (%)")
    is_exceeded: bool = Field(..., description="예산 초과 여부")
    is_warning: bool = Field(..., description="경고 임계값 도달 여부")

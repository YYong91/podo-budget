"""정기 거래 스키마"""

from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


class RecurringTransactionBase(BaseModel):
    type: str = Field(..., pattern="^(expense|income)$")
    amount: float = Field(..., gt=0, description="금액 (0보다 커야 함)")
    description: str
    category_id: int | None = None
    frequency: str = Field(..., pattern="^(monthly|weekly|yearly|custom)$")
    interval: int | None = Field(None, gt=0, description="custom 빈도일 때 N일 간격")
    day_of_month: int | None = Field(None, ge=1, le=31)
    day_of_week: int | None = Field(None, ge=0, le=6)
    month_of_year: int | None = Field(None, ge=1, le=12)
    start_date: date
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_frequency_fields(self):
        """빈도에 따른 필수 필드 검증"""
        if self.frequency == "monthly" and self.day_of_month is None:
            raise ValueError("monthly 빈도는 day_of_month가 필수입니다")
        if self.frequency == "weekly" and self.day_of_week is None:
            raise ValueError("weekly 빈도는 day_of_week가 필수입니다")
        if self.frequency == "yearly" and (self.month_of_year is None or self.day_of_month is None):
            raise ValueError("yearly 빈도는 month_of_year와 day_of_month가 필수입니다")
        if self.frequency == "custom" and self.interval is None:
            raise ValueError("custom 빈도는 interval이 필수입니다")
        return self


class RecurringTransactionCreate(RecurringTransactionBase):
    household_id: int | None = None


class RecurringTransactionUpdate(BaseModel):
    amount: float | None = Field(None, gt=0)
    description: str | None = None
    category_id: int | None = None
    is_active: bool | None = None
    end_date: date | None = None


class RecurringTransactionResponse(RecurringTransactionBase):
    id: int
    household_id: int | None = None
    user_id: int
    next_due_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExecuteResponse(BaseModel):
    """정기 거래 실행 결과"""

    message: str
    created_id: int
    type: str
    next_due_date: date

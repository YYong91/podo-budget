"""지출 스키마"""

from datetime import datetime

from pydantic import BaseModel, Field


class ExpenseBase(BaseModel):
    amount: float = Field(..., gt=0, description="지출 금액 (0보다 커야 함)")
    description: str
    category_id: int | None = None
    date: datetime


class ExpenseCreate(ExpenseBase):
    raw_input: str | None = None
    household_id: int | None = None


class ExpenseUpdate(BaseModel):
    amount: float | None = Field(None, gt=0, description="지출 금액 (0보다 커야 함)")
    description: str | None = None
    category_id: int | None = None
    date: datetime | None = None


class ExpenseResponse(ExpenseBase):
    id: int
    raw_input: str | None = None
    household_id: int | None = None
    user_id: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

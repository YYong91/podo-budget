"""지출 스키마"""

from datetime import datetime

from pydantic import BaseModel


class ExpenseBase(BaseModel):
    amount: float
    description: str
    category_id: int | None = None
    date: datetime


class ExpenseCreate(ExpenseBase):
    raw_input: str | None = None


class ExpenseUpdate(BaseModel):
    amount: float | None = None
    description: str | None = None
    category_id: int | None = None
    date: datetime | None = None


class ExpenseResponse(ExpenseBase):
    id: int
    raw_input: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

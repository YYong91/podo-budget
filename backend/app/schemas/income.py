"""수입 스키마"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class IncomeBase(BaseModel):
    amount: float = Field(..., gt=0, description="수입 금액 (0보다 커야 함)")
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


class IncomeCreate(IncomeBase):
    raw_input: str | None = None
    memo: str | None = None
    household_id: int | None = None


class IncomeUpdate(BaseModel):
    amount: float | None = Field(None, gt=0, description="수입 금액 (0보다 커야 함)")
    description: str | None = None
    category_id: int | None = None
    date: datetime | None = None
    memo: str | None = None


class IncomeResponse(IncomeBase):
    id: int
    raw_input: str | None = None
    memo: str | None = None
    household_id: int | None = None
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

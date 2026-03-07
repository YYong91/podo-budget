from datetime import datetime

from pydantic import BaseModel, Field


class AccountBase(BaseModel):
    name: str
    type: str = Field(..., pattern="^(brokerage|bank|crypto_exchange|other)$")
    institution: str | None = None
    memo: str | None = None


class AccountCreate(AccountBase):
    household_id: int | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    type: str | None = Field(None, pattern="^(brokerage|bank|crypto_exchange|other)$")
    institution: str | None = None
    memo: str | None = None


class AccountResponse(AccountBase):
    id: int
    household_id: int | None = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

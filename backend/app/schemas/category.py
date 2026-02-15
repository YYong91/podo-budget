"""카테고리 스키마"""

from datetime import datetime

from pydantic import BaseModel


class CategoryBase(BaseModel):
    name: str
    description: str | None = None


class CategoryCreate(CategoryBase):
    type: str = "expense"


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    type: str | None = None


class CategoryResponse(CategoryBase):
    id: int
    type: str = "expense"
    created_at: datetime

    class Config:
        from_attributes = True

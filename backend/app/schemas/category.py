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


class CategoryReorderRequest(BaseModel):
    """카테고리 순서 변경 요청 - 순서대로 정렬된 카테고리 ID 목록"""

    category_ids: list[int]


class CategoryResponse(CategoryBase):
    id: int
    type: str = "expense"
    sort_order: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

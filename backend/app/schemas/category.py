"""카테고리 스키마"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    name: str = Field(..., max_length=100, description="카테고리 이름 (최대 100자)")
    description: str | None = Field(None, max_length=500, description="카테고리 설명 (최대 500자)")


class CategoryCreate(CategoryBase):
    type: str = "expense"


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, max_length=100, description="카테고리 이름 (최대 100자)")
    description: str | None = Field(None, max_length=500, description="카테고리 설명 (최대 500자)")
    type: str | None = None


class CategoryReorderRequest(BaseModel):
    """카테고리 순서 변경 요청 - 순서대로 정렬된 카테고리 ID 목록"""

    category_ids: list[int]


class CategoryResponse(CategoryBase):
    id: int
    type: str = "expense"
    sort_order: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

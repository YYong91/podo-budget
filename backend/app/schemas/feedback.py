"""피드백 스키마"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    type: Literal["feature", "bug"]
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=5000)


class FeedbackResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    content: str
    status: str
    username: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FeedbackStatusUpdate(BaseModel):
    status: Literal["new", "read", "done"]

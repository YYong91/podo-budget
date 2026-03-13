"""순자산 목표 스키마"""

from datetime import date, datetime

from pydantic import BaseModel, Field


class AssetGoalCreate(BaseModel):
    target_net_worth: float = Field(..., gt=0)
    target_date: date
    household_id: int | None = None


class AssetGoalResponse(BaseModel):
    id: int
    target_net_worth: float
    target_date: date
    household_id: int | None = None
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssetGoalWithInsight(AssetGoalResponse):
    """목표 + 페이스 인사이트"""

    progress_pct: float
    monthly_required: float | None
    estimated_date: date | None
    pace_status: str  # "ahead" | "on_track" | "behind"
    pace_message: str

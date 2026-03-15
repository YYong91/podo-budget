"""온보딩 관련 스키마"""

from pydantic import BaseModel


class OnboardingStatus(BaseModel):
    """온보딩 상태 응답"""

    has_household: bool
    household_count: int


class CreateDefaultHousehold(BaseModel):
    """기본 가구 생성 요청"""

    name: str | None = None

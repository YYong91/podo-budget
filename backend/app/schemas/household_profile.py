from datetime import date, datetime

from pydantic import BaseModel, Field

# 유효한 선택지 상수 (DB 저장값 검증용)
VALID_HOUSEHOLD_TYPES = {"single", "dual_income", "single_income", "retired"}
VALID_HOUSING_TYPES = {"own_no_loan", "own_with_loan", "jeonse", "monthly_rent", "with_parents"}
VALID_INCOME_TYPES = {"salary", "freelance", "business", "pension", "investment", "side_job"}
VALID_AGE_RANGES = {"20s", "30s", "40s", "50s_plus"}
VALID_FINANCIAL_GOALS = {"emergency_fund", "debt_payoff", "home_purchase", "investment", "retirement", "travel", "none"}
VALID_PRIMARY_CONCERNS = {"overspending", "no_savings", "too_much_debt", "irregular_income", "none"}


class HouseholdProfileCreate(BaseModel):
    # Step 1 (필수)
    household_type: str = Field(..., description="가구 유형")
    housing_type: str = Field(..., description="주거 유형")
    income_types: list[str] = Field(..., min_length=1, description="소득 유형 (복수 선택)")
    age_range: str = Field(..., description="연령대")

    # Step 2 (선택)
    financial_goal: str | None = None
    goal_amount: int | None = Field(None, ge=0)
    goal_deadline: date | None = None
    primary_concern: str | None = None


class HouseholdProfileResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    household_id: int
    household_type: str
    housing_type: str
    income_types: list[str]
    age_range: str
    financial_goal: str | None = None
    goal_amount: int | None = None
    goal_deadline: date | None = None
    primary_concern: str | None = None
    created_at: datetime
    updated_at: datetime

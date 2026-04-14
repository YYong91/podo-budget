from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

# 타입 별칭 — API 문서 및 프론트 연동 시 참조용
HouseholdType = Literal["single", "dual_income", "single_income", "retired"]
HousingType = Literal["own_no_loan", "own_with_loan", "jeonse", "monthly_rent", "with_parents"]
IncomeType = Literal["salary", "freelance", "business", "pension", "investment", "side_job"]
AgeRange = Literal["20s", "30s", "40s", "50s_plus"]
FinancialGoal = Literal["emergency_fund", "debt_payoff", "home_purchase", "investment", "retirement", "travel", "none"]
PrimaryConcern = Literal["overspending", "no_savings", "too_much_debt", "irregular_income", "none"]


class HouseholdProfileCreate(BaseModel):
    # Step 1 (필수)
    household_type: HouseholdType = Field(..., description="가구 유형")
    housing_type: HousingType = Field(..., description="주거 유형")
    income_types: list[IncomeType] = Field(..., min_length=1, description="소득 유형 (복수 선택)")
    age_range: AgeRange = Field(..., description="연령대")

    # Step 2 (선택)
    financial_goal: FinancialGoal | None = None
    goal_amount: int | None = Field(None, ge=0)
    goal_deadline: date | None = None
    primary_concern: PrimaryConcern | None = None


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

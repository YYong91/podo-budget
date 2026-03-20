"""종합 재무 인사이트 요청/응답 스키마"""

from pydantic import BaseModel, Field


class InsightsGenerateResponse(BaseModel):
    """월별 인사이트 생성 API 응답 (#242)"""

    month: str
    insights: str


# ── 요청: 프론트엔드가 사전 계산하여 전송 ──


class CategorySummary(BaseModel):
    name: str
    amount: float
    percentage: float


class BudgetSummary(BaseModel):
    total_budget: float
    total_spent: float
    over_categories: list[str] = []


class AssetBreakdown(BaseModel):
    total_assets: float
    total_liabilities: float
    net_worth: float
    breakdown: dict[str, float] = {}
    monthly_change_amount: float = 0
    monthly_change_rate: float = 0


class LoanInfo(BaseModel):
    name: str
    balance: float
    rate: float
    monthly_payment: float = 0


class DebtSummary(BaseModel):
    loans: list[LoanInfo] = []
    total_interest_monthly: float = 0


class HealthScoreBreakdown(BaseModel):
    savings: int
    spending: int
    debt: int
    overall: int
    grade: str


class ComprehensiveInsightsRequest(BaseModel):
    """프론트엔드가 사전 계산한 종합 재무 데이터

    금액 필드는 ge=0 제약을 적용하여 조작된 음수 데이터로 LLM rate limit이 소모되는 것을 방지. (#158)
    """

    month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    income_total: float = Field(..., ge=0)
    expense_total: float = Field(..., ge=0)
    top_expense_categories: list[CategorySummary] = []
    budget: BudgetSummary | None = None
    assets: AssetBreakdown | None = None
    debt: DebtSummary | None = None
    savings_rate: float = Field(0, ge=0, le=100)
    health_score: HealthScoreBreakdown | None = None
    previous_month_expense: float | None = Field(None, ge=0)
    previous_month_income: float | None = Field(None, ge=0)


# ── 응답: LLM이 생성하는 구조화된 인사이트 ──


class Finding(BaseModel):
    """핵심 발견 (What → So What → Now What)"""

    what: str
    so_what: str
    now_what: str


class AssetAnalysis(BaseModel):
    """자산 분석"""

    summary: str
    allocation_analysis: str
    diversification_tip: str


class ActionItem(BaseModel):
    """액션 아이템"""

    title: str
    description: str


class StructuredInsightsResponse(BaseModel):
    """LLM이 생성하는 구조화된 인사이트"""

    findings: list[Finding] = Field(..., min_length=1, max_length=3)
    asset_analysis: AssetAnalysis | None = None
    action_items: list[ActionItem] = Field(..., min_length=1, max_length=3)
    encouragement: str = ""


class ComprehensiveInsightsResponse(BaseModel):
    """종합 인사이트 API 응답"""

    month: str
    insights: StructuredInsightsResponse

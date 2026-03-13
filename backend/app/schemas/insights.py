"""종합 재무 인사이트 요청/응답 스키마"""

from pydantic import BaseModel, Field

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
    """프론트엔드가 사전 계산한 종합 재무 데이터"""

    month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    income_total: float
    expense_total: float
    top_expense_categories: list[CategorySummary] = []
    budget: BudgetSummary | None = None
    assets: AssetBreakdown | None = None
    debt: DebtSummary | None = None
    savings_rate: float = 0
    health_score: HealthScoreBreakdown | None = None
    previous_month_expense: float | None = None
    previous_month_income: float | None = None


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

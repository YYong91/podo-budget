from datetime import date, datetime

from pydantic import BaseModel, Field


class AssetBase(BaseModel):
    name: str
    type: str = Field(..., pattern="^(stock_kr|stock_us|crypto|deposit|real_estate|other|loan|insurance|vehicle)$")
    is_liability: bool = False
    ticker: str | None = None
    quantity: float | None = None
    avg_buy_price: float | None = None
    manual_value: float | None = None
    interest_rate: float | None = Field(None, ge=0, le=100)
    maturity_date: date | None = None
    repayment_type: str | None = None
    monthly_payment: float | None = None
    original_amount: float | None = None  # 대출 원금 (상환 진척도용)
    account_id: int | None = None
    memo: str | None = None


class AssetCreate(AssetBase):
    household_id: int | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    type: str | None = Field(None, pattern="^(stock_kr|stock_us|crypto|deposit|real_estate|other|loan|insurance|vehicle)$")
    is_liability: bool | None = None
    ticker: str | None = None
    quantity: float | None = None
    avg_buy_price: float | None = None
    manual_value: float | None = None
    interest_rate: float | None = None
    maturity_date: date | None = None
    repayment_type: str | None = None
    monthly_payment: float | None = None
    original_amount: float | None = None  # 대출 원금 (상환 진척도용)
    memo: str | None = None


class AssetResponse(AssetBase):
    id: int
    household_id: int | None = None
    account_id: int | None = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssetWithPrice(AssetResponse):
    """시세 정보가 포함된 응답"""

    current_price: float | None = None  # 현재가 (투자형만)
    current_value: float | None = None  # 현재 평가액
    profit_loss: float | None = None  # 손익 금액
    profit_loss_pct: float | None = None  # 수익률 %


class AssetSummary(BaseModel):
    """순자산 요약"""

    total_assets: float
    total_liabilities: float
    net_worth: float
    breakdown: dict[str, float]  # 유형별 합산 {"stock_kr": 5000000, ...}
    total_profit_loss: float
    total_profit_loss_pct: float | None


class AssetSnapshotResponse(BaseModel):
    snapshot_date: date
    total_assets: float
    total_liabilities: float
    net_worth: float
    breakdown: dict[str, float] | None = None

    model_config = {"from_attributes": True}


class AssetParseRequest(BaseModel):
    """자연어 입력"""

    text: str = Field(..., max_length=2000)  # 프롬프트 인젝션 방어 — 길이 제한 (#138)


class AssetParseResponse(BaseModel):
    """자연어 파싱 결과"""

    items: list[AssetCreate]


class MonthlySavingsResponse(BaseModel):
    """이번 달 저축액"""

    month: str
    savings: float

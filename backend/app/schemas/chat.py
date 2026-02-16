"""채팅 API 스키마

preview 모드: LLM 파싱 결과만 반환 (저장하지 않음)
일반 모드: 파싱 후 DB에 저장
"""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.expense import ExpenseResponse
from app.schemas.income import IncomeResponse


class ChatRequest(BaseModel):
    message: str
    household_id: int | None = None
    preview: bool = False


class ParsedExpenseItem(BaseModel):
    """LLM이 파싱한 개별 항목 (저장 전 프리뷰용)"""

    amount: float
    description: str
    category: str
    date: str
    memo: str = ""
    household_id: int | None = None  # 공유/개인 구분용 (None이면 개인)
    type: str = "expense"  # "expense" | "income"
    currency: str | None = None  # 외화 통화 코드 (예: "USD", "JPY")
    original_amount: float | None = None  # 외화 원래 금액
    exchange_rate: float | None = None  # 적용된 환율 (1 외화 = ? KRW)


class ChatResponse(BaseModel):
    message: str
    expenses_created: list[ExpenseResponse] | None = None
    incomes_created: list[IncomeResponse] | None = None
    parsed_items: list[ParsedExpenseItem] | None = None
    # 하위 호환
    parsed_expenses: list[ParsedExpenseItem] | None = None
    insights: str | None = None

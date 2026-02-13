"""채팅 API 스키마

preview 모드: LLM 파싱 결과만 반환 (저장하지 않음)
일반 모드: 파싱 후 DB에 저장
"""

from pydantic import BaseModel

from app.schemas.expense import ExpenseResponse


class ChatRequest(BaseModel):
    message: str
    household_id: int | None = None
    preview: bool = False


class ParsedExpenseItem(BaseModel):
    """LLM이 파싱한 개별 지출 항목 (저장 전 프리뷰용)"""

    amount: float
    description: str
    category: str
    date: str
    memo: str = ""


class ChatResponse(BaseModel):
    message: str
    expenses_created: list[ExpenseResponse] | None = None
    parsed_expenses: list[ParsedExpenseItem] | None = None
    insights: str | None = None

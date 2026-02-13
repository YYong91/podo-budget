from pydantic import BaseModel

from app.schemas.expense import ExpenseResponse


class ChatRequest(BaseModel):
    message: str
    household_id: int | None = None


class ChatResponse(BaseModel):
    message: str
    expenses_created: list[ExpenseResponse] | None = None
    insights: str | None = None

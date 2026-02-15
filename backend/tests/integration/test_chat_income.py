"""채팅 수입 분류 테스트"""

import pytest
from sqlalchemy import select

from app.models.income import Income
from app.models.user import User


@pytest.mark.asyncio
async def test_chat_income_preview(authenticated_client, mock_llm_parse_expense):
    """수입 프리뷰 — LLM이 type=income을 반환"""
    mock_llm_parse_expense.return_value = {
        "amount": 3500000,
        "category": "급여",
        "description": "월급",
        "date": "2026-02-01",
        "memo": "",
        "type": "income",
    }

    response = await authenticated_client.post("/api/chat/", json={"message": "월급 350만원 들어왔어", "preview": True})
    assert response.status_code == 201
    data = response.json()
    assert data["parsed_items"] is not None
    assert len(data["parsed_items"]) == 1
    assert data["parsed_items"][0]["type"] == "income"
    assert data["parsed_items"][0]["amount"] == 3500000


@pytest.mark.asyncio
async def test_chat_income_save(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """수입 저장 — type=income이면 Income 모델에 저장"""
    mock_llm_parse_expense.return_value = {
        "amount": 3500000,
        "category": "급여",
        "description": "월급",
        "date": "2026-02-01",
        "memo": "",
        "type": "income",
    }

    response = await authenticated_client.post("/api/chat/", json={"message": "월급 350만원"})
    assert response.status_code == 201
    data = response.json()
    assert "수입" in data["message"] or "기록" in data["message"]

    # Income 테이블에 저장 확인
    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 1
    assert incomes[0].amount == 3500000


@pytest.mark.asyncio
async def test_chat_expense_still_works(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """기존 지출 파싱 기능이 여전히 동작"""
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-02-15",
        "memo": "",
    }

    response = await authenticated_client.post("/api/chat/", json={"message": "점심 김치찌개 8000원"})
    assert response.status_code == 201

    # Expense 테이블에 저장 확인 (type 필드 없으면 지출)
    from app.models.expense import Expense

    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1

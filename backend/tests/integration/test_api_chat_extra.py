"""채팅 API 추가 통합 테스트

기존 test_api_chat.py에서 커버하지 않는 경로를 테스트합니다:
- 다건 지출 입력 (list 반환)
- preview 모드에서 다건 지출
- 유효하지 않은 LLM 응답 형식
"""

import pytest
from sqlalchemy import select

from app.models.expense import Expense
from app.models.user import User


@pytest.mark.asyncio
async def test_chat_multiple_expenses(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """다건 지출 입력 (LLM이 list를 반환하는 경우)"""
    mock_llm_parse_expense.return_value = [
        {
            "amount": 5000,
            "category": "식비",
            "description": "점심",
            "date": "2026-02-14",
            "memo": "",
        },
        {
            "amount": 4500,
            "category": "카페",
            "description": "커피",
            "date": "2026-02-14",
            "memo": "",
        },
    ]

    payload = {"message": "점심 5천원, 커피 4500원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201
    data = response.json()

    # 다건 메시지 형식 확인
    assert "2건" in data["message"]
    assert "9,500" in data["message"]
    assert data["expenses_created"] is not None
    assert len(data["expenses_created"]) == 2

    # DB에 2건 저장 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 2


@pytest.mark.asyncio
async def test_chat_preview_multiple_expenses(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """preview 모드에서 다건 지출"""
    mock_llm_parse_expense.return_value = [
        {
            "amount": 10000,
            "category": "식비",
            "description": "저녁",
            "date": "2026-02-14",
            "memo": "",
        },
        {
            "amount": 3000,
            "category": "카페",
            "description": "커피",
            "date": "2026-02-14",
            "memo": "",
        },
    ]

    payload = {"message": "저녁 1만원, 커피 3천원", "preview": True}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201
    data = response.json()

    assert "2건" in data["message"]
    assert "₩13,000" in data["message"]
    assert data["parsed_expenses"] is not None
    assert len(data["parsed_expenses"]) == 2
    assert data["expenses_created"] is None

    # DB에 저장되지 않음
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_chat_invalid_llm_response(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """유효하지 않은 LLM 응답 형식 → 에러 메시지 반환"""
    # LLM이 문자열을 반환하는 비정상 케이스
    mock_llm_parse_expense.return_value = "invalid response"

    payload = {"message": "테스트 입력"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert "알 수 없는 응답 형식" in data["message"]
    assert data["expenses_created"] is None

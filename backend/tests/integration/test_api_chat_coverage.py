"""채팅 API 커버리지 테스트

api/chat.py 미커버 라인: 54-58, 98-100, 130-170, 200, 225-230
"""

import pytest

from app.models.category import Category


@pytest.mark.asyncio
async def test_chat_parse_error(authenticated_client, test_user, test_household, db_session, mock_llm_parse_expense):
    """LLM 파싱 에러 응답"""
    mock_llm_parse_expense.return_value = {"error": "금액을 찾을 수 없습니다"}

    resp = await authenticated_client.post(
        "/api/chat",
        json={"message": "뭔가 이상한 입력"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "금액을 찾을 수 없습니다" in data["message"]


@pytest.mark.asyncio
async def test_chat_invalid_response(authenticated_client, test_user, test_household, db_session, mock_llm_parse_expense):
    """LLM 유효하지 않은 응답 형식"""
    mock_llm_parse_expense.return_value = "invalid_string"

    resp = await authenticated_client.post(
        "/api/chat",
        json={"message": "테스트"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "알 수 없는 응답 형식" in data["message"]


@pytest.mark.asyncio
async def test_chat_preview_mode(authenticated_client, test_user, test_household, db_session, mock_llm_parse_expense):
    """프리뷰 모드: DB 저장 안 함"""
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-03-25",
        "memo": "",
    }

    resp = await authenticated_client.post(
        "/api/chat",
        json={"message": "오늘 점심 김치찌개 8000원", "preview": True},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "인식했습니다" in data["message"]
    assert data["parsed_items"] is not None
    assert data["expenses_created"] is None


@pytest.mark.asyncio
async def test_chat_preview_with_income(authenticated_client, test_user, test_household, db_session, mock_llm_parse_expense):
    """프리뷰 모드: 수입 + 지출 혼합"""
    mock_llm_parse_expense.return_value = [
        {"amount": 8000, "category": "식비", "description": "점심", "date": "2026-03-25", "type": "expense"},
        {"amount": 3000000, "category": "급여", "description": "월급", "date": "2026-03-25", "type": "income"},
    ]

    resp = await authenticated_client.post(
        "/api/chat",
        json={"message": "점심 8000원, 월급 300만원", "preview": True},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "지출" in data["message"]
    assert "수입" in data["message"]


@pytest.mark.asyncio
async def test_chat_save_mode(authenticated_client, test_user, test_household, db_session, mock_llm_parse_expense):
    """저장 모드: DB에 저장"""
    # 카테고리 생성
    cat = Category(name="식비", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-03-25",
        "memo": "",
    }

    resp = await authenticated_client.post(
        "/api/chat",
        json={"message": "오늘 점심 김치찌개 8000원", "preview": False},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "기록되었습니다" in data["message"]
    assert data["expenses_created"] is not None


@pytest.mark.asyncio
async def test_chat_save_multiple(authenticated_client, test_user, test_household, db_session, mock_llm_parse_expense):
    """저장 모드: 여러 건 동시 저장"""
    cat = Category(name="식비", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.commit()

    mock_llm_parse_expense.return_value = [
        {"amount": 8000, "category": "식비", "description": "점심", "date": "2026-03-25", "type": "expense"},
        {"amount": 5000, "category": "식비", "description": "간식", "date": "2026-03-25", "type": "expense"},
    ]

    resp = await authenticated_client.post(
        "/api/chat",
        json={"message": "점심 8000원 간식 5000원"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "기록되었습니다" in data["message"]
    assert data["expenses_created"] is not None
    assert len(data["expenses_created"]) == 2


@pytest.mark.asyncio
async def test_chat_save_income(authenticated_client, test_user, test_household, db_session, mock_llm_parse_expense):
    """저장 모드: 수입 저장"""
    cat = Category(name="급여", type="income", household_id=test_household.id)
    db_session.add(cat)
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 3000000,
        "category": "급여",
        "description": "월급",
        "date": "2026-03-25",
        "type": "income",
        "memo": "",
    }

    resp = await authenticated_client.post(
        "/api/chat",
        json={"message": "월급 300만원"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "수입" in data["message"]
    assert data["incomes_created"] is not None

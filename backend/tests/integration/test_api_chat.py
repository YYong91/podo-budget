"""
채팅 API 통합 테스트 (인증 적용)

- POST /api/chat/ - 자연어 지출 입력 처리
- LLM 파싱 결과에 따라 지출 생성 또는 에러 응답

모든 엔드포인트는 JWT 인증이 필요합니다.
"""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User


@pytest.mark.asyncio
async def test_chat_parse_expense_success(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """채팅으로 지출 입력 성공 케이스"""
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "점심에 김치찌개 8000원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert "기록되었습니다" in data["message"]
    assert "₩8,000" in data["message"]
    assert data["expenses_created"] is not None
    assert len(data["expenses_created"]) == 1
    assert data["expenses_created"][0]["amount"] == 8000.0
    assert data["expenses_created"][0]["description"] == "김치찌개"

    # DB에 지출이 생성되었는지 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 8000.0
    assert expenses[0].raw_input == "점심에 김치찌개 8000원"

    # 카테고리가 자동 생성되었는지 확인
    cat_result = await db_session.execute(select(Category).where(Category.name == "식비"))
    category = cat_result.scalar_one()
    assert category.name == "식비"
    assert "자동 생성" in category.description


@pytest.mark.asyncio
async def test_chat_parse_expense_with_existing_category(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """기존 카테고리가 있으면 재사용"""
    # 기존 카테고리 생성
    existing_cat = Category(user_id=test_user.id, name="교통비", description="대중교통")
    db_session.add(existing_cat)
    await db_session.commit()
    await db_session.refresh(existing_cat)

    mock_llm_parse_expense.return_value = {
        "amount": 15000,
        "category": "교통비",
        "description": "택시",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "택시 15000원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # 카테고리가 중복 생성되지 않았는지 확인
    cat_result = await db_session.execute(select(Category).where(Category.name == "교통비"))
    categories = cat_result.scalars().all()
    assert len(categories) == 1
    assert categories[0].id == existing_cat.id


@pytest.mark.asyncio
async def test_chat_parse_expense_error(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """LLM 파싱 실패 시 에러 응답"""
    mock_llm_parse_expense.return_value = {"error": "금액을 찾을 수 없습니다"}

    payload = {"message": "그냥 텍스트"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert data["message"] == "금액을 찾을 수 없습니다"
    assert data["expenses_created"] is None
    assert data["insights"] is None

    # DB에 지출이 생성되지 않았는지 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 0


@pytest.mark.asyncio
async def test_chat_with_date_parsing(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """날짜 파싱이 포함된 지출 입력"""
    mock_llm_parse_expense.return_value = {
        "amount": 15000,
        "category": "교통비",
        "description": "택시",
        "date": "2026-02-10",
        "memo": "회식 후",
    }

    payload = {"message": "어제 택시 15000원 회식 후"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert data["expenses_created"] is not None
    expense = data["expenses_created"][0]
    assert "2026-02-10" in expense["date"]

    # DB에서 날짜 확인
    result = await db_session.execute(select(Expense))
    db_expense = result.scalar_one()
    assert db_expense.date.date() == datetime(2026, 2, 10).date()


@pytest.mark.asyncio
async def test_chat_with_memo(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """메모가 포함된 지출 입력"""
    mock_llm_parse_expense.return_value = {
        "amount": 13500,
        "category": "문화생활",
        "description": "넷플릭스 구독",
        "date": "2026-02-11",
        "memo": "월 구독료",
    }

    payload = {"message": "넷플릭스 13500 월 구독료"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201
    assert response.json()["expenses_created"] is not None


@pytest.mark.asyncio
async def test_chat_category_default_to_other(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """카테고리가 명시되지 않으면 '기타'로 분류"""
    mock_llm_parse_expense.return_value = {
        "amount": 5000,
        "description": "알 수 없는 지출",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "5000원 사용"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # '기타' 카테고리가 생성되었는지 확인
    cat_result = await db_session.execute(select(Category).where(Category.name == "기타"))
    category = cat_result.scalar_one()
    assert category.name == "기타"


@pytest.mark.asyncio
async def test_chat_large_amount_formatting(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """큰 금액도 천단위 콤마로 포맷팅"""
    mock_llm_parse_expense.return_value = {
        "amount": 1500000,
        "category": "쇼핑",
        "description": "노트북",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "노트북 150만원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert "₩1,500,000" in data["message"]


@pytest.mark.asyncio
async def test_chat_without_description(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """설명이 없으면 원본 메시지를 사용"""
    mock_llm_parse_expense.return_value = {
        "amount": 3000,
        "category": "기타",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "3000원 지출"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # DB에서 원본 메시지가 description으로 사용되었는지 확인
    result = await db_session.execute(select(Expense))
    expense = result.scalar_one()
    assert expense.description == "3000원 지출"
    assert expense.raw_input == "3000원 지출"

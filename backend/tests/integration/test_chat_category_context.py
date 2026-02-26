"""채팅 API 카테고리 컨텍스트 주입 통합 테스트

LLM 파싱 시 사용자의 카테고리 목록과 히스토리 패턴이 전달되는지 검증합니다.
"""

from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User


@pytest.mark.asyncio
async def test_chat_passes_categories_to_llm(
    authenticated_client,
    test_user: User,
    db_session: AsyncSession,
    mock_llm_parse_expense,
):
    """채팅 API가 사용자 카테고리 목록을 LLM에 전달하는지 확인"""
    # 사용자 카테고리 생성
    cat1 = Category(name="전기차충전", user_id=test_user.id)
    cat2 = Category(name="쿠팡이츠", user_id=test_user.id)
    db_session.add_all([cat1, cat2])
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 11680,
        "category": "전기차충전",
        "description": "전기차충전",
        "date": "2026-02-11T00:00:00",
        "memo": "",
    }

    payload = {"message": "2월11일 전기차충전 11680원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # parse_expense가 categories 파라미터와 함께 호출되었는지 확인
    assert mock_llm_parse_expense.called
    call_kwargs = mock_llm_parse_expense.call_args
    # 위치 인수 또는 키워드 인수로 전달된 categories 확인
    categories = call_kwargs.kwargs.get("categories") or (call_kwargs.args[1] if len(call_kwargs.args) > 1 else None)
    assert categories is not None
    assert "전기차충전" in categories
    assert "쿠팡이츠" in categories


@pytest.mark.asyncio
async def test_chat_passes_history_hints_to_llm(
    authenticated_client,
    test_user: User,
    db_session: AsyncSession,
    mock_llm_parse_expense,
):
    """채팅 API가 과거 거래 패턴을 LLM에 전달하는지 확인"""
    # 카테고리 및 기존 지출 기록 생성
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    past_expense = Expense(
        user_id=test_user.id,
        amount=18100,
        description="쿠팡이츠",
        category_id=cat.id,
        date=datetime(2026, 1, 15),
    )
    db_session.add(past_expense)
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 13000,
        "category": "식비",
        "description": "쿠팡이츠",
        "date": "2026-02-20T00:00:00",
        "memo": "",
    }

    payload = {"message": "쿠팡이츠 13000원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # parse_expense가 history_hints 파라미터와 함께 호출되었는지 확인
    assert mock_llm_parse_expense.called
    call_kwargs = mock_llm_parse_expense.call_args
    history_hints = call_kwargs.kwargs.get("history_hints")
    assert history_hints is not None
    # 과거 지출 패턴이 포함되어야 함
    assert history_hints.get("쿠팡이츠") == "식비"


@pytest.mark.asyncio
async def test_chat_no_categories_passes_none(
    authenticated_client,
    test_user: User,
    db_session: AsyncSession,
    mock_llm_parse_expense,
):
    """카테고리가 없을 때 categories=None으로 전달"""
    mock_llm_parse_expense.return_value = {
        "amount": 5000,
        "category": "식비",
        "description": "점심",
        "date": "2026-02-11T00:00:00",
        "memo": "",
    }

    payload = {"message": "점심 5천원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # 카테고리가 없으면 None으로 전달 (빈 리스트 아님)
    call_kwargs = mock_llm_parse_expense.call_args
    categories = call_kwargs.kwargs.get("categories")
    assert categories is None  # 빈 리스트가 None으로 변환됨

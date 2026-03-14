"""
텔레그램 카테고리 확인 플로우 테스트

LLM이 기존에 없는 카테고리를 제안했을 때:
1. 기존 카테고리 목록을 보여주고 선택하게 함
2. 새 카테고리로 등록도 가능
3. 선택한 매핑을 기억하여 다음부터 자동 적용
"""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.category_mapping import CategoryMapping
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember


async def setup_bot_user_with_household_and_categories(db_session, chat_id: int):
    """봇 사용자 + 가구 + 기존 카테고리를 설정하는 헬퍼"""
    from app.services.bot_user_service import get_or_create_bot_user

    bot_user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id=str(chat_id))
    household = Household(name=f"테스트 가구 {chat_id}")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)

    # 기존 카테고리 생성 (가구 스코프)
    for name in ["외식비", "교통비", "카페/간식", "생활용품"]:
        cat = Category(name=name, household_id=household.id, type="expense")
        db_session.add(cat)

    await db_session.commit()
    return bot_user, household


@pytest.mark.asyncio
async def test_unknown_category_shows_confirmation(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """LLM이 기존에 없는 카테고리를 제안하면 확인 메시지 표시"""
    bot_user, household = await setup_bot_user_with_household_and_categories(db_session, chat_id=50001)

    # LLM이 "식비"를 제안 (사용자의 카테고리에 "식비"는 없고 "외식비"만 있음)
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-03-12",
        "memo": "",
    }

    payload = {"message": {"chat": {"id": 50001}, "text": "점심에 김치찌개 8000원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # 확인 메시지가 전송되어야 함
    mock_telegram_send.assert_called_once()
    call_args = mock_telegram_send.call_args
    sent_message = call_args[0][1]
    assert "식비" in sent_message
    assert "없어요" in sent_message
    assert "카테고리" in sent_message

    # 인라인 키보드에 기존 카테고리들이 포함되어야 함
    reply_markup = call_args[1]["reply_markup"]
    assert "inline_keyboard" in reply_markup
    button_texts = [btn["text"] for row in reply_markup["inline_keyboard"] for btn in row]
    assert "외식비" in button_texts
    # "새로 등록" 버튼도 있어야 함
    assert any("새로 등록" in text for text in button_texts)

    # 임시 지출이 "기타" 카테고리로 생성되어 있어야 함
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1


@pytest.mark.asyncio
async def test_known_category_saves_directly(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """LLM이 기존 카테고리를 제안하면 바로 저장"""
    bot_user, household = await setup_bot_user_with_household_and_categories(db_session, chat_id=50002)

    # LLM이 "외식비"를 제안 (사용자의 기존 카테고리에 있음)
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "외식비",
        "description": "김치찌개",
        "date": "2026-03-12",
        "memo": "",
    }

    payload = {"message": {"chat": {"id": 50002}, "text": "점심에 김치찌개 8000원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # 바로 저장 성공 메시지
    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "기록" in sent_message
    assert "8,000" in sent_message

    # DB에 저장 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 8000


@pytest.mark.asyncio
async def test_confirm_cat_callback_saves_and_maps(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """사용자가 기존 카테고리를 선택하면 저장 + 매핑 기억"""
    bot_user, household = await setup_bot_user_with_household_and_categories(db_session, chat_id=50003)

    # 먼저 확인 요청 트리거 (LLM이 "식비" 제안)
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-03-12",
        "memo": "",
    }

    payload = {"message": {"chat": {"id": 50003}, "text": "점심에 김치찌개 8000원"}}
    await client.post("/api/telegram/webhook", json=payload)

    # 임시 지출 조회
    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None

    # "외식비" 카테고리 조회
    cat_result = await db_session.execute(select(Category).where(Category.name == "외식비", Category.household_id == household.id))
    target_category = cat_result.scalar_one()

    # confirm_cat 콜백: 사용자가 "외식비"를 선택
    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_confirm_cat",
                "message": {"chat": {"id": 50003}},
                "data": f"confirm_cat:{expense.id}:{target_category.id}:식비",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 카테고리가 "외식비"로 변경되었는지 확인
    await db_session.refresh(expense)
    assert expense.category_id == target_category.id

    # 매핑이 저장되었는지 확인 ("식비" → "외식비")
    mapping_result = await db_session.execute(select(CategoryMapping).where(CategoryMapping.source_name == "식비"))
    mapping = mapping_result.scalar_one_or_none()
    assert mapping is not None
    assert mapping.target_category_id == target_category.id

    # 저장 완료 메시지 확인
    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "외식비" in sent_message


@pytest.mark.asyncio
async def test_new_cat_callback_creates_category(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """사용자가 '새로 등록'을 선택하면 새 카테고리 생성"""
    bot_user, household = await setup_bot_user_with_household_and_categories(db_session, chat_id=50004)

    # 확인 요청 트리거
    mock_llm_parse_expense.return_value = {
        "amount": 5000,
        "category": "간식비",
        "description": "아이스크림",
        "date": "2026-03-12",
        "memo": "",
    }

    payload = {"message": {"chat": {"id": 50004}, "text": "아이스크림 5천원"}}
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None

    # new_cat 콜백: 사용자가 "간식비" 새로 등록 선택
    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_new_cat",
                "message": {"chat": {"id": 50004}},
                "data": f"new_cat:{expense.id}:간식비",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 새 카테고리가 생성되었는지 확인
    cat_result = await db_session.execute(select(Category).where(Category.name == "간식비"))
    new_cat = cat_result.scalar_one_or_none()
    assert new_cat is not None

    # 지출의 카테고리가 새 카테고리로 변경
    await db_session.refresh(expense)
    assert expense.category_id == new_cat.id

    # 완료 메시지 확인
    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "간식비" in sent_message or "기록" in sent_message


@pytest.mark.asyncio
async def test_mapping_applied_on_next_input(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """매핑이 저장된 후 같은 카테고리가 다시 나오면 자동 적용"""
    bot_user, household = await setup_bot_user_with_household_and_categories(db_session, chat_id=50005)

    # "외식비" 카테고리 조회
    cat_result = await db_session.execute(select(Category).where(Category.name == "외식비", Category.household_id == household.id))
    target_category = cat_result.scalar_one()

    # 미리 매핑 저장: "식비" → "외식비"
    mapping = CategoryMapping(
        household_id=household.id,
        source_name="식비",
        target_category_id=target_category.id,
    )
    db_session.add(mapping)
    await db_session.commit()

    # LLM이 또 "식비"를 제안
    mock_llm_parse_expense.return_value = {
        "amount": 12000,
        "category": "식비",
        "description": "된장찌개",
        "date": "2026-03-12",
        "memo": "",
    }

    payload = {"message": {"chat": {"id": 50005}, "text": "된장찌개 12000원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # 확인 없이 바로 저장되어야 함 (매핑이 적용됨)
    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "기록" in sent_message

    # DB에서 "외식비" 카테고리로 저장되었는지 확인
    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None
    assert expense.category_id == target_category.id

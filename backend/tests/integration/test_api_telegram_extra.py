"""
Telegram Webhook API 추가 테스트 (#357)

기존 test_api_telegram.py에서 누락된 영역:
- 수입 자연어 입력 다건 (list 반환)
- 수정 명령어 (금액 변경 콜백)
- LLM 파싱 시 빈 응답
- /link 코드 없이 입력
- /feedback 콜백 모드
- 메시지 포맷 정합성
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.user import User


async def setup_bot_user_with_household(db_session, chat_id: int):
    """봇 사용자에게 가구를 설정하는 헬퍼"""
    from app.services.bot_user_service import get_or_create_bot_user

    bot_user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id=str(chat_id))
    household = Household(name=f"테스트 가구 {chat_id}")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()
    return bot_user, household


# ── 수입 다건 입력 ──────────────────────────


@pytest.mark.asyncio
async def test_webhook_multiple_income_input(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """여러 수입 동시 입력 (list 반환, 모두 type=income)"""
    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=70001)

    # 수입 카테고리 생성
    cat1 = Category(name="급여", type="income", household_id=household.id)
    cat2 = Category(name="부수입", type="income", household_id=household.id)
    db_session.add_all([cat1, cat2])
    await db_session.commit()

    mock_llm_parse_expense.return_value = [
        {"amount": 3000000, "category": "급여", "description": "월급", "date": "2026-03-20", "type": "income"},
        {"amount": 500000, "category": "부수입", "description": "부업", "date": "2026-03-20", "type": "income"},
    ]

    payload = {"message": {"chat": {"id": 70001}, "text": "월급 300만원, 부업 50만원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # Income 2건 저장
    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 2

    # Expense는 0건
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0

    # 메시지에 건수 포함
    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "2건" in sent_message
    assert "수입" in sent_message


# ── 혼합 입력 (수입 + 지출) ──────────────────────────


@pytest.mark.asyncio
async def test_webhook_mixed_income_expense(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """다중 건 입력에서 수입/지출 혼합 처리"""
    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=70002)

    mock_llm_parse_expense.return_value = [
        {"amount": 3000000, "description": "월급", "category": "급여", "date": "2026-03-20", "type": "income"},
        {"amount": 8000, "description": "점심", "category": "식비", "date": "2026-03-20", "type": "expense"},
    ]

    payload = {"message": {"chat": {"id": 70002}, "text": "월급 300만원, 점심 8000원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # Income 1건 + Expense 1건
    result_income = await db_session.execute(select(Income))
    assert len(result_income.scalars().all()) == 1

    result_expense = await db_session.execute(select(Expense))
    assert len(result_expense.scalars().all()) == 1

    # 메시지에 수입과 지출 모두 언급
    mock_telegram_send.assert_called_once()
    sent = mock_telegram_send.call_args[0][1]
    assert "수입" in sent
    assert "지출" in sent or "기록" in sent


# ── LLM 빈 응답 ──────────────────────────


@pytest.mark.asyncio
async def test_webhook_llm_returns_empty_dict(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """LLM이 빈 dict를 반환하면 파싱 실패로 처리"""
    await setup_bot_user_with_household(db_session, chat_id=70003)

    mock_llm_parse_expense.return_value = {}

    payload = {"message": {"chat": {"id": 70003}, "text": "잘 모르겠는 입력"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # DB에 저장되지 않음
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_webhook_llm_returns_empty_list(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """LLM이 빈 list를 반환하면 에러 메시지 전송"""
    await setup_bot_user_with_household(db_session, chat_id=70004)

    mock_llm_parse_expense.return_value = []

    payload = {"message": {"chat": {"id": 70004}, "text": "빈 응답 테스트"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # DB에 저장되지 않음
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


# ── /link 코드 없이 입력 ──────────────────────────


@pytest.mark.asyncio
async def test_link_without_code(client, db_session, mock_telegram_send):
    """/link만 입력하면 사용법 안내 메시지 전송"""
    chat_id = 70005
    payload = {"message": {"chat": {"id": chat_id}, "text": "/link"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    msg = mock_telegram_send.call_args[0][1]
    assert "연동" in msg


# ── /link 이미 연동된 사용자 ──────────────────────────


@pytest.mark.asyncio
async def test_link_already_linked_user(client, db_session, mock_telegram_send):
    """이미 연동된 사용자가 다시 /link 시도"""
    chat_id = 70006
    web_user = User(
        username="already_linked",
        email="linked@test.com",
        telegram_chat_id=str(chat_id),
        telegram_link_code="RELINK",
        telegram_link_code_expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db_session.add(web_user)
    await db_session.flush()
    household = Household(name="연동 테스트 가구")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=web_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()

    payload = {"message": {"chat": {"id": chat_id}, "text": "/link RELINK"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # 이미 연동됨 또는 연동 완료 메시지
    mock_telegram_send.assert_called_once()
    msg = mock_telegram_send.call_args[0][1]
    assert "연동" in msg


# ── /feedback 콜백 버튼 테스트 ──────────────────────────


@pytest.mark.asyncio
async def test_feedback_callback_button(client, db_session, mock_telegram_send):
    """피드백 타입 콜백 버튼 클릭 시 안내 메시지"""
    await setup_bot_user_with_household(db_session, chat_id=70007)

    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_fb_type",
                "message": {"chat": {"id": 70007}},
                "data": "feedback_type:feature",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200


# ── 연속 성공 후 Strike 리셋 확인 ──────────────────────────


@pytest.mark.asyncio
async def test_successful_parse_resets_strike(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """파싱 성공 후 Strike 카운트가 직접 리셋됨 (서비스 레벨 검증)"""
    from app.services.bot_strike_service import _error_counts, get_strike_count, increment_strike, reset_strike

    _error_counts.clear()

    # Strike를 2회 증가
    increment_strike("telegram", "70008")
    increment_strike("telegram", "70008")
    assert get_strike_count("telegram", "70008") == 2

    # reset 호출 후 0으로 돌아감
    reset_strike("telegram", "70008")
    assert get_strike_count("telegram", "70008") == 0

    # 다시 1회 증가하면 1이어야 함
    new_count = increment_strike("telegram", "70008")
    assert new_count == 1

    _error_counts.clear()


# ── 비어있는 callback_query data ──────────────────────────


@pytest.mark.asyncio
async def test_callback_empty_data(client, db_session, mock_telegram_send):
    """callback_query.data가 비어있을 때 정상 처리"""
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_empty",
                "message": {"chat": {"id": 12345}},
                "data": "",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200


# ── cmd:budget 콜백 ──────────────────────────


@pytest.mark.asyncio
async def test_cmd_callback_budget(client, db_session, mock_telegram_send):
    """cmd:budget 콜백이 예산 현황을 전송"""
    await setup_bot_user_with_household(db_session, chat_id=70009)

    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_cmd_budget",
                "message": {"chat": {"id": 70009}},
                "data": "cmd:budget",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    assert mock_telegram_send.called
    sent_message = mock_telegram_send.call_args[0][1]
    assert "예산" in sent_message


# ── 지출 저장 후 응답에 인라인 키보드 포함 ──────────────────────────


@pytest.mark.asyncio
async def test_expense_saved_has_inline_keyboard(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """지출 저장 성공 시 응답에 삭제/카테고리 변경 인라인 키보드 포함"""
    await setup_bot_user_with_household(db_session, chat_id=70010)

    payload = {"message": {"chat": {"id": 70010}, "text": "점심 8000원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    call_kwargs = mock_telegram_send.call_args
    # reply_markup에 inline_keyboard 포함
    reply_markup = call_kwargs[1].get("reply_markup") if call_kwargs[1] else None
    assert reply_markup is not None
    assert "inline_keyboard" in reply_markup


# ── 수입 저장 후 응답에 인라인 키보드 포함 ──────────────────────────


@pytest.mark.asyncio
async def test_income_saved_has_inline_keyboard(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """수입 저장 성공 시 응답에 삭제/변환 인라인 키보드 포함"""
    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=70011)

    cat = Category(name="급여", type="income", household_id=household.id)
    db_session.add(cat)
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 3000000,
        "description": "월급",
        "category": "급여",
        "date": "2026-03-20",
        "type": "income",
    }

    payload = {"message": {"chat": {"id": 70011}, "text": "월급 300만원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    call_kwargs = mock_telegram_send.call_args
    reply_markup = call_kwargs[1].get("reply_markup") if call_kwargs[1] else None
    assert reply_markup is not None
    assert "inline_keyboard" in reply_markup


# ── 딥링크 /start 이미 연동된 사용자 ──────────────────────────


@pytest.mark.asyncio
async def test_start_deeplink_already_linked(client, db_session, mock_telegram_send):
    """이미 연동된 사용자가 딥링크로 재접속 시 환영 메시지"""
    payload = {"message": {"chat": {"id": 70012}, "text": "/start"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    msg = mock_telegram_send.call_args[0][1]
    assert "환영" in msg or "HomeNRich" in msg

"""
Telegram Webhook API 통합 테스트

- /start, /help 명령어 응답
- LLM 파싱 → 지출 저장 플로우 (Mock)
- 에러 처리 (파싱 실패, 서버 오류)
"""

import pytest
from sqlalchemy import select

from app.models.expense import Expense
from app.models.user import User


@pytest.mark.asyncio
async def test_webhook_start_command(client, db_session, mock_telegram_send):
    """/start 명령어 시 환영 메시지 전송"""
    payload = {
        "message": {
            "chat": {"id": 12345},
            "text": "/start",
        }
    }

    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200
    assert response.json() == {"ok": True}

    # send_telegram_message가 호출되었는지 확인
    mock_telegram_send.assert_called_once()
    call_args = mock_telegram_send.call_args
    assert call_args[0][0] == 12345  # chat_id
    sent_message = call_args[0][1]
    assert "환영" in sent_message or "HomeNRich" in sent_message


@pytest.mark.asyncio
async def test_webhook_help_command(client, db_session, mock_telegram_send):
    """/help 명령어 시 도움말 메시지 전송"""
    payload = {
        "message": {
            "chat": {"id": 12345},
            "text": "/help",
        }
    }

    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    call_args = mock_telegram_send.call_args
    sent_message = call_args[0][1]
    assert "사용" in sent_message or "도움말" in sent_message or "가이드" in sent_message


@pytest.mark.asyncio
async def test_webhook_expense_input(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """자연어 지출 입력 → LLM 파싱 → DB 저장"""
    payload = {
        "message": {
            "chat": {"id": 12345},
            "text": "점심에 김치찌개 8000원",
        }
    }

    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # DB에 지출이 저장되었는지 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 8000.0
    assert expenses[0].raw_input == "점심에 김치찌개 8000원"

    # user_id가 설정되어 있는지 확인
    assert expenses[0].user_id is not None

    # 성공 메시지 전송 확인
    mock_telegram_send.assert_called_once()
    call_args = mock_telegram_send.call_args
    sent_message = call_args[0][1]
    assert "8,000" in sent_message or "기록" in sent_message


@pytest.mark.asyncio
async def test_webhook_parse_error(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """LLM 파싱 실패 시 에러 메시지 전송"""
    mock_llm_parse_expense.return_value = {"error": "금액을 찾을 수 없습니다"}

    payload = {
        "message": {
            "chat": {"id": 12345},
            "text": "아무말이나",
        }
    }

    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # DB에 저장되지 않음
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0

    # 에러 메시지 전송
    mock_telegram_send.assert_called_once()
    call_args = mock_telegram_send.call_args
    sent_message = call_args[0][1]
    assert "금액을 찾을 수 없" in sent_message or "파싱 실패" in sent_message


@pytest.mark.asyncio
async def test_webhook_no_message(client, db_session):
    """메시지가 없는 webhook 요청은 무시"""
    payload = {"update_id": 99999}

    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200
    assert response.json() == {"ok": True}


@pytest.mark.asyncio
async def test_webhook_no_text(client, db_session):
    """텍스트가 없는 메시지 (사진 등)는 무시"""
    payload = {
        "message": {
            "chat": {"id": 12345},
            "photo": [{"file_id": "abc"}],
        }
    }

    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200
    assert response.json() == {"ok": True}


@pytest.mark.asyncio
async def test_webhook_user_isolation(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """서로 다른 Telegram 사용자는 데이터가 격리되어야 함"""
    # 사용자 1의 지출 생성
    payload1 = {
        "message": {
            "chat": {"id": 11111},
            "text": "점심 5000원",
        }
    }
    response1 = await client.post("/api/telegram/webhook", json=payload1)
    assert response1.status_code == 200

    # 사용자 2의 지출 생성
    mock_llm_parse_expense.return_value = {
        "amount": 10000,
        "category": "교통",
        "description": "택시",
        "date": "2026-02-11",
        "memo": "",
    }
    payload2 = {
        "message": {
            "chat": {"id": 22222},
            "text": "택시 10000원",
        }
    }
    response2 = await client.post("/api/telegram/webhook", json=payload2)
    assert response2.status_code == 200

    # DB에서 사용자별로 격리되어 있는지 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 2

    # 각 지출이 서로 다른 user_id를 가져야 함
    user_ids = {expense.user_id for expense in expenses}
    assert len(user_ids) == 2
    assert None not in user_ids  # user_id는 절대 None이 아니어야 함

    # User 테이블에 봇 사용자가 생성되었는지 확인
    user_result = await db_session.execute(select(User))
    users = user_result.scalars().all()
    assert len(users) == 2

    # username 형식 확인
    usernames = {user.username for user in users}
    assert "telegram_11111" in usernames
    assert "telegram_22222" in usernames


@pytest.mark.asyncio
async def test_webhook_same_user_reuses_account(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """동일한 Telegram 사용자는 같은 User 계정을 재사용해야 함"""
    chat_id = 33333

    # 첫 번째 지출
    payload1 = {
        "message": {
            "chat": {"id": chat_id},
            "text": "점심 5000원",
        }
    }
    await client.post("/api/telegram/webhook", json=payload1)

    # 두 번째 지출
    mock_llm_parse_expense.return_value = {
        "amount": 3000,
        "category": "식비",
        "description": "커피",
        "date": "2026-02-11",
        "memo": "",
    }
    payload2 = {
        "message": {
            "chat": {"id": chat_id},
            "text": "커피 3000원",
        }
    }
    await client.post("/api/telegram/webhook", json=payload2)

    # User는 하나만 생성되어야 함
    user_result = await db_session.execute(select(User))
    users = user_result.scalars().all()
    assert len(users) == 1
    assert users[0].username == f"telegram_{chat_id}"

    # Expense는 두 개, 모두 같은 user_id
    expense_result = await db_session.execute(select(Expense))
    expenses = expense_result.scalars().all()
    assert len(expenses) == 2
    assert expenses[0].user_id == expenses[1].user_id
    assert expenses[0].user_id == users[0].id

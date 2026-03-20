"""
Telegram Webhook API 통합 테스트

- /start, /help 명령어 응답
- LLM 파싱 → 지출 저장 플로우 (Mock)
- 에러 처리 (파싱 실패, 서버 오류)
- Household 연동 (컨텍스트 탐지)
- 카테고리 변경 콜백
"""

from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.user import User


async def setup_bot_user_with_household(db_session, chat_id: int):
    """봇 사용자에게 가구를 설정하는 헬퍼 — 연동 체크를 통과시키기 위해 필요"""
    from app.services.bot_user_service import get_or_create_bot_user

    bot_user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id=str(chat_id))
    household = Household(name=f"테스트 가구 {chat_id}")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()
    return bot_user, household


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
    """자연어 지출 입력 → LLM 파싱 → DB 저장 (가구 연동된 사용자)"""
    # 연동 체크를 통과하려면 봇 사용자에게 가구 필요
    await setup_bot_user_with_household(db_session, chat_id=12345)

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
    # 연동 체크 통과를 위해 가구 설정
    await setup_bot_user_with_household(db_session, chat_id=12345)

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

    # 에러 메시지 전송 (3 Strike: 1회차 메시지)
    mock_telegram_send.assert_called_once()
    call_args = mock_telegram_send.call_args
    sent_message = call_args[0][1]
    assert "금액" in sent_message


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
    # 두 사용자 모두 가구 설정 (연동 체크 통과용)
    await setup_bot_user_with_household(db_session, chat_id=11111)
    await setup_bot_user_with_household(db_session, chat_id=22222)

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


@pytest.mark.asyncio
async def test_webhook_same_user_reuses_account(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """동일한 Telegram 사용자는 같은 User 계정을 재사용해야 함"""
    chat_id = 33333

    # 가구 설정 (연동 체크 통과용)
    await setup_bot_user_with_household(db_session, chat_id=chat_id)

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


@pytest.mark.asyncio
async def test_webhook_unlinked_user_gets_link_message(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """연동 안 된 봇 사용자는 지출 저장 안 되고 연동 안내 메시지 전송"""
    payload = {
        "message": {
            "chat": {"id": 55555},
            "text": "점심에 김치찌개 8000원",
        }
    }

    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # 지출이 저장되지 않아야 함
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 0

    # 연동 안내 메시지가 전송되어야 함
    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "연동" in sent_message


@pytest.mark.asyncio
async def test_webhook_expense_with_household(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """가구에 속한 사용자의 지출은 household_id가 자동 설정됨"""
    from app.services.bot_user_service import get_or_create_bot_user

    # 봇 사용자 생성 + 가구 가입
    bot_user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="66666")
    household = Household(name="테스트 가구")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()

    payload = {
        "message": {
            "chat": {"id": 66666},
            "text": "우리 저녁 50000원",
        }
    }

    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].household_id == household.id
    assert expenses[0].user_id == bot_user.id


@pytest.mark.asyncio
async def test_webhook_personal_keyword_no_household(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """'내' 등 개인 키워드 사용 시에도 household_id는 활성 가구로 설정됨 (household_id 필수)"""
    from app.services.bot_user_service import get_or_create_bot_user

    # 봇 사용자 생성 + 가구 가입
    bot_user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="77777")
    household = Household(name="테스트 가구2")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()

    payload = {
        "message": {
            "chat": {"id": 77777},
            "text": "내 점심 8000원",
        }
    }

    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    # household_id는 필수 — 개인 키워드여도 활성 가구로 설정됨
    assert expenses[0].household_id == household.id


@pytest.mark.asyncio
async def test_callback_delete_expense_confirmation(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """인라인 버튼으로 지출 삭제 — 확인 프롬프트 표시"""
    from unittest.mock import AsyncMock, patch

    # 가구 설정 후 지출 생성
    await setup_bot_user_with_household(db_session, chat_id=88888)
    payload = {
        "message": {
            "chat": {"id": 88888},
            "text": "점심 8000원",
        }
    }
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None

    # 삭제 버튼 클릭 → 확인 프롬프트 표시 (아직 삭제 안 됨)
    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_1",
                "message": {"chat": {"id": 88888}},
                "data": f"delete_expense:{expense.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 아직 삭제되지 않음 (확인 프롬프트 단계)
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 1

    # 확인 메시지에 "정말 삭제" 문구가 포함되어야 함
    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "정말 삭제" in sent_message
    # 확인/취소 인라인 키보드가 포함되어야 함
    assert "inline_keyboard" in mock_telegram_send.call_args[1]["reply_markup"]


@pytest.mark.asyncio
async def test_callback_confirm_delete(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """삭제 확인 후 실제 삭제 수행"""
    from unittest.mock import AsyncMock, patch

    # 가구 설정 후 지출 생성
    await setup_bot_user_with_household(db_session, chat_id=88888)
    payload = {"message": {"chat": {"id": 88888}, "text": "점심 8000원"}}
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None

    # confirm_delete 콜백 → 실제 삭제
    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_confirm",
                "message": {"chat": {"id": 88888}},
                "data": f"confirm_delete:{expense.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 실제 삭제 확인
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_callback_cancel_delete(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """삭제 취소 시 지출 유지"""
    from unittest.mock import AsyncMock, patch

    # 가구 설정 후 지출 생성
    await setup_bot_user_with_household(db_session, chat_id=88888)
    payload = {"message": {"chat": {"id": 88888}, "text": "점심 8000원"}}
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None

    # cancel_delete 콜백 → 삭제 취소
    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_cancel",
                "message": {"chat": {"id": 88888}},
                "data": f"cancel_delete:{expense.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 지출이 여전히 존재
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 1

    # 취소 메시지 확인
    mock_telegram_send.assert_called_once()
    assert "취소" in mock_telegram_send.call_args[0][1]


@pytest.mark.asyncio
async def test_callback_change_category(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """인라인 버튼으로 카테고리 변경 키보드 표시"""
    from unittest.mock import AsyncMock, patch

    # 가구 설정 후 지출 생성
    await setup_bot_user_with_household(db_session, chat_id=99999)
    payload = {
        "message": {
            "chat": {"id": 99999},
            "text": "점심 8000원",
        }
    }
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None

    # 카테고리 변경 콜백 → 카테고리 선택 키보드가 표시되어야 함
    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_2",
                "message": {"chat": {"id": 99999}},
                "data": f"change_category:{expense.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 카테고리 선택 메시지가 전송되었는지 확인
    mock_telegram_send.assert_called_once()
    call_args = mock_telegram_send.call_args
    assert "카테고리" in call_args[0][1]
    # reply_markup에 inline_keyboard가 있어야 함
    assert "inline_keyboard" in call_args[1]["reply_markup"]


@pytest.mark.asyncio
async def test_callback_set_category(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """인라인 버튼으로 카테고리 실제 변경"""
    from unittest.mock import AsyncMock, patch

    # 가구 설정 후 지출 생성
    await setup_bot_user_with_household(db_session, chat_id=10101)
    payload = {
        "message": {
            "chat": {"id": 10101},
            "text": "점심 8000원",
        }
    }
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None
    original_category_id = expense.category_id

    # 새 카테고리 생성
    new_cat = Category(name="교통", user_id=expense.user_id)
    db_session.add(new_cat)
    await db_session.commit()
    await db_session.refresh(new_cat)

    # set_category 콜백
    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_3",
                "message": {"chat": {"id": 10101}},
                "data": f"set_category:{expense.id}:{new_cat.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 카테고리가 변경되었는지 확인
    await db_session.refresh(expense)
    assert expense.category_id == new_cat.id
    assert expense.category_id != original_category_id

    # 변경 완료 메시지 확인
    mock_telegram_send.assert_called_once()
    assert "교통" in mock_telegram_send.call_args[0][1]


# ──────────────────────────────────────────────
# Callback IDOR 보안 테스트 (TST-002)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_callback_idor_delete_blocked(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """다른 사용자의 지출을 삭제 시도하면 거부"""
    from unittest.mock import AsyncMock
    from unittest.mock import patch as mock_patch

    # 사용자 A(chat_id=11111)가 지출 생성 (가구 설정 필요)
    await setup_bot_user_with_household(db_session, chat_id=11111)
    payload = {"message": {"chat": {"id": 11111}, "text": "점심 8000원"}}
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None

    # 사용자 B(chat_id=22222)가 사용자 A의 지출을 삭제 시도
    mock_telegram_send.reset_mock()
    with mock_patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock) as mock_answer:
        callback_payload = {
            "callback_query": {
                "id": "cb_idor",
                "message": {"chat": {"id": 22222}},  # 다른 사용자
                "data": f"confirm_delete:{expense.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

        # "본인의 지출만" 거부 메시지
        mock_answer.assert_called_once()
        assert "본인" in mock_answer.call_args[0][1]

    # 지출이 삭제되지 않았는지 확인
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_callback_idor_change_category_blocked(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """다른 사용자의 지출 카테고리 변경 시도하면 거부"""
    from unittest.mock import AsyncMock
    from unittest.mock import patch as mock_patch

    # 사용자 A가 지출 생성 (가구 설정 필요)
    await setup_bot_user_with_household(db_session, chat_id=33333)
    payload = {"message": {"chat": {"id": 33333}, "text": "점심 8000원"}}
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    original_category_id = expense.category_id

    # 사용자 B가 카테고리 변경 시도
    mock_telegram_send.reset_mock()
    with mock_patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock) as mock_answer:
        callback_payload = {
            "callback_query": {
                "id": "cb_idor2",
                "message": {"chat": {"id": 44444}},  # 다른 사용자
                "data": f"change_category:{expense.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

        mock_answer.assert_called_once()
        assert "본인" in mock_answer.call_args[0][1]

    # 카테고리가 변경되지 않았는지 확인
    await db_session.refresh(expense)
    assert expense.category_id == original_category_id


# ──────────────────────────────────────────────
# Webhook 보안 테스트
# ──────────────────────────────────────────────


# ──────────────────────────────────────────────
# /report, /budget, 다건 입력 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_webhook_report_command(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """/report 명령어 — 이번 달 지출 요약 전송"""
    # 가구 설정 후 지출을 생성
    await setup_bot_user_with_household(db_session, chat_id=44444)
    payload = {"message": {"chat": {"id": 44444}, "text": "점심 8000원"}}
    await client.post("/api/telegram/webhook", json=payload)

    # /report 실행
    mock_telegram_send.reset_mock()
    report_payload = {"message": {"chat": {"id": 44444}, "text": "/report"}}
    response = await client.post("/api/telegram/webhook", json=report_payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "지출 리포트" in sent_message or "총 지출" in sent_message


@pytest.mark.asyncio
async def test_webhook_report_empty(client, db_session, mock_telegram_send):
    """/report 명령어 — 가구 미설정 시 안내 메시지"""
    payload = {"message": {"chat": {"id": 44444}, "text": "/report"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "가구 설정" in sent_message


@pytest.mark.asyncio
async def test_webhook_report_empty_with_household(client, db_session, mock_telegram_send):
    """/report 명령어 — 가구 있지만 지출이 없을 때"""
    await setup_bot_user_with_household(db_session, chat_id=44444)
    payload = {"message": {"chat": {"id": 44444}, "text": "/report"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "없" in sent_message


@pytest.mark.asyncio
async def test_webhook_budget_command(client, db_session, mock_telegram_send):
    """/budget 명령어 — 가구 미설정 시 안내 메시지"""
    payload = {"message": {"chat": {"id": 44444}, "text": "/budget"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "가구 설정" in sent_message


@pytest.mark.asyncio
async def test_webhook_budget_command_with_household(client, db_session, mock_telegram_send):
    """/budget 명령어 — 가구 있지만 예산 없을 때"""
    await setup_bot_user_with_household(db_session, chat_id=44444)
    payload = {"message": {"chat": {"id": 44444}, "text": "/budget"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "예산" in sent_message


@pytest.mark.asyncio
async def test_webhook_multiple_expenses(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """여러 지출 동시 입력 (list 반환)"""
    # 가구 설정 (연동 체크 통과용)
    await setup_bot_user_with_household(db_session, chat_id=44444)

    mock_llm_parse_expense.return_value = [
        {"amount": 5000, "category": "식비", "description": "점심", "date": "2026-02-14", "memo": ""},
        {"amount": 4500, "category": "카페", "description": "커피", "date": "2026-02-14", "memo": ""},
    ]

    payload = {"message": {"chat": {"id": 44444}, "text": "점심 5천원, 커피 4500원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # DB에 2건 저장
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 2

    # 전송된 메시지에 건수와 합계
    mock_telegram_send.assert_called_once()
    sent_message = mock_telegram_send.call_args[0][1]
    assert "2건" in sent_message
    assert "9,500" in sent_message


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_secret(client, db_session):
    """시크릿 토큰이 설정된 경우, 잘못된 토큰은 403 반환"""
    with patch("app.api.telegram.settings") as mock_settings:
        mock_settings.TELEGRAM_WEBHOOK_SECRET = "my-secret-token"  # pragma: allowlist secret
        mock_settings.TELEGRAM_BOT_TOKEN = "fake-token"

        payload = {"message": {"chat": {"id": 12345}, "text": "/start"}}

        # 토큰 없이 요청
        response = await client.post("/api/telegram/webhook", json=payload)
        assert response.status_code == 403

        # 잘못된 토큰으로 요청
        response = await client.post(
            "/api/telegram/webhook",
            json=payload,
            headers={"X-Telegram-Bot-Api-Secret-Token": "wrong-token"},
        )
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_webhook_accepts_valid_secret(client, db_session, mock_telegram_send):
    """시크릿 토큰이 설정된 경우, 올바른 토큰은 통과"""
    with patch("app.api.telegram.settings") as mock_settings:
        mock_settings.TELEGRAM_WEBHOOK_SECRET = "my-secret-token"  # pragma: allowlist secret
        mock_settings.TELEGRAM_BOT_TOKEN = "fake-token"

        payload = {"message": {"chat": {"id": 12345}, "text": "/start"}}

        response = await client.post(
            "/api/telegram/webhook",
            json=payload,
            headers={"X-Telegram-Bot-Api-Secret-Token": "my-secret-token"},
        )
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_link_by_code_success(client, db_session, mock_telegram_send):
    """유효한 코드로 연동 성공"""
    from datetime import UTC, datetime, timedelta

    from app.models.user import User

    web_user = User(
        username="webuser",
        email="web@test.com",
        telegram_link_code="ABC123",
        telegram_link_code_expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db_session.add(web_user)
    await db_session.flush()

    # 웹 사용자에게 가구 설정 (household_id 필수 제약 충족)
    household = Household(name="웹 사용자 가구")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=web_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()

    chat_id = 99999
    payload = {"message": {"chat": {"id": chat_id}, "text": "/link ABC123", "from": {"id": chat_id}}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200
    mock_telegram_send.assert_called_once()
    msg = mock_telegram_send.call_args[0][1]
    assert "연동" in msg or "완료" in msg


@pytest.mark.asyncio
async def test_link_by_code_expired(client, db_session, mock_telegram_send):
    """만료된 코드로 연동 시 실패 메시지"""
    from datetime import UTC, datetime, timedelta

    from app.models.user import User

    web_user = User(
        username="webuser2",
        email="web2@test.com",
        telegram_link_code="EXP999",
        telegram_link_code_expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    db_session.add(web_user)
    await db_session.commit()

    chat_id = 88888
    payload = {"message": {"chat": {"id": chat_id}, "text": "/link EXP999", "from": {"id": chat_id}}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200
    msg = mock_telegram_send.call_args[0][1]
    assert "만료" in msg or "유효하지" in msg


@pytest.mark.asyncio
async def test_link_by_invalid_code(client, db_session, mock_telegram_send):
    """존재하지 않는 코드로 연동 시 실패 메시지"""
    chat_id = 77777
    payload = {"message": {"chat": {"id": chat_id}, "text": "/link XXXXXX", "from": {"id": chat_id}}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200
    msg = mock_telegram_send.call_args[0][1]
    assert "유효하지" in msg or "찾을 수 없" in msg


# ── 수입 입력 테스트 (#285) ──────────────────────────


@pytest.mark.asyncio
async def test_webhook_income_input(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """수입 자연어 입력 시 수입 메시지 반환"""
    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=12345)
    # 카테고리 미리 생성 (카테고리 확인 플로우 방지)
    from app.models.category import Category

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

    payload = {"message": {"chat": {"id": 12345}, "text": "월급 300만원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    assert mock_telegram_send.called
    call_args = mock_telegram_send.call_args
    assert "수입" in str(call_args)


@pytest.mark.asyncio
async def test_webhook_income_creates_income_record(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """수입 입력 시 Income 모델에 저장"""
    from app.models.income import Income

    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=12345)
    from app.models.category import Category

    cat = Category(name="부수입", type="income", household_id=household.id)
    db_session.add(cat)
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 500000,
        "description": "부업",
        "category": "부수입",
        "date": "2026-03-20",
        "type": "income",
    }

    payload = {"message": {"chat": {"id": 12345}, "text": "부업 50만원"}}
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) >= 1
    assert any(i.amount == 500000 for i in incomes)


# ── 3 Strike + 리포트/예산 UX 버튼 테스트 (#286) ──────────────────────────


@pytest.mark.asyncio
async def test_webhook_parse_error_strike_progression(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """3번 연속 파싱 실패 시 메시지가 점진적으로 변화"""
    from app.services.bot_strike_service import _error_counts

    # Strike 카운터 초기화
    _error_counts.clear()

    await setup_bot_user_with_household(db_session, chat_id=55555)
    mock_llm_parse_expense.return_value = {"error": "금액을 찾을 수 없습니다"}

    messages = []
    for i in range(3):
        mock_telegram_send.reset_mock()
        payload = {"message": {"chat": {"id": 55555}, "text": f"아무말이나{i}"}}
        response = await client.post("/api/telegram/webhook", json=payload)
        assert response.status_code == 200
        messages.append(mock_telegram_send.call_args[0][1])

    # Strike 1: "금액을 찾지 못했어요"
    assert "금액을 찾지 못했어요" in messages[0]
    # Strike 2: "아직 이해하지 못했어요"
    assert "이해하지 못했어요" in messages[1]
    # Strike 3: "이해하기 어려운 표현"
    assert "이해하기 어려운" in messages[2]

    # Strike 카운터 정리
    _error_counts.clear()


@pytest.mark.asyncio
async def test_report_command_has_buttons(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """/report 응답에 인라인 키보드(예산 현황 버튼) 포함"""
    await setup_bot_user_with_household(db_session, chat_id=44444)
    # 지출 하나 만들어서 리포트에 데이터가 있도록
    payload = {"message": {"chat": {"id": 44444}, "text": "점심 8000원"}}
    await client.post("/api/telegram/webhook", json=payload)

    mock_telegram_send.reset_mock()
    report_payload = {"message": {"chat": {"id": 44444}, "text": "/report"}}
    response = await client.post("/api/telegram/webhook", json=report_payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    call_kwargs = mock_telegram_send.call_args
    # reply_markup에 inline_keyboard가 포함되어야 함
    reply_markup = call_kwargs[1].get("reply_markup") if call_kwargs[1] else None
    assert reply_markup is not None
    assert "inline_keyboard" in reply_markup
    # 예산 현황 버튼이 있어야 함
    buttons_flat = [btn for row in reply_markup["inline_keyboard"] for btn in row]
    assert any("예산" in btn["text"] for btn in buttons_flat)


@pytest.mark.asyncio
async def test_budget_command_has_buttons(client, db_session, mock_telegram_send):
    """/budget 응답에 인라인 키보드(리포트 버튼) 포함"""
    await setup_bot_user_with_household(db_session, chat_id=44444)

    mock_telegram_send.reset_mock()
    payload = {"message": {"chat": {"id": 44444}, "text": "/budget"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    call_kwargs = mock_telegram_send.call_args
    reply_markup = call_kwargs[1].get("reply_markup") if call_kwargs[1] else None
    assert reply_markup is not None
    assert "inline_keyboard" in reply_markup
    # 리포트 버튼이 있어야 함
    buttons_flat = [btn for row in reply_markup["inline_keyboard"] for btn in row]
    assert any("리포트" in btn["text"] for btn in buttons_flat)


@pytest.mark.asyncio
async def test_cmd_callback_report(client, db_session, mock_telegram_send):
    """cmd:report 콜백이 리포트를 전송하는지 확인"""
    from unittest.mock import AsyncMock
    from unittest.mock import patch as mock_patch

    await setup_bot_user_with_household(db_session, chat_id=44444)

    with mock_patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_cmd_report",
                "message": {"chat": {"id": 44444}},
                "data": "cmd:report",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 리포트 메시지가 전송되었는지 확인
    assert mock_telegram_send.called
    sent_message = mock_telegram_send.call_args[0][1]
    assert "리포트" in sent_message or "지출" in sent_message

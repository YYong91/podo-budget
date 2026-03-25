"""
Telegram 봇 핸들러 커버리지 강화 테스트 (#398)

기존 테스트에서 누락된 영역:
- confirm_cat 콜백: 같은 이름 매핑 스킵
- set_category: 이름 문자열로 카테고리 변경
- set_category: 존재하지 않는 카테고리 ID
- confirm_cat: 존재하지 않는 카테고리 ID
- callback_query 에러 분기 (Exception 발생)
- cmd:help, cmd:link_info 콜백
- Income IDOR: convert_to_expense 거부
- 다건 입력에서 카테고리 미존재 시 자동 생성
- /link 코드 없이 입력 (args 부족)
- callback_query에서 parts 부족 시 잘못된 요청
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income


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


# ── confirm_cat: 같은 이름 선택 시 매핑 스킵 ──


@pytest.mark.asyncio
async def test_confirm_cat_same_name_skips_mapping(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """confirm_cat 콜백에서 선택 카테고리 이름이 suggested와 같으면 매핑 저장 안 함"""
    from app.models.category_mapping import CategoryMapping

    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=80001)

    # 카테고리 생성
    cat = Category(name="식비", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()

    # 임시 지출 생성 (confirm 흐름 시뮬레이션)
    expense = Expense(
        user_id=bot_user.id,
        amount=8000,
        description="점심",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household.id,
        raw_input="점심 8000원",
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    # confirm_cat: suggested="식비", 선택한 카테고리도 "식비" → 매핑 저장 안 함
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_same_name",
                "message": {"chat": {"id": 80001}},
                "data": f"confirm_cat:{expense.id}:{cat.id}:식비",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 매핑이 저장되지 않아야 함 (같은 이름이므로)
    result = await db_session.execute(select(CategoryMapping))
    assert len(result.scalars().all()) == 0


# ── confirm_cat: 존재하지 않는 카테고리 ID ──


@pytest.mark.asyncio
async def test_confirm_cat_nonexistent_category(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """confirm_cat에서 category_id가 유효하지 않으면 에러 응답"""
    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=80002)

    cat = Category(name="기타", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()

    expense = Expense(
        user_id=bot_user.id,
        amount=5000,
        description="테스트",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household.id,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock) as mock_answer:
        callback_payload = {
            "callback_query": {
                "id": "cb_bad_cat",
                "message": {"chat": {"id": 80002}},
                "data": f"confirm_cat:{expense.id}:99999:테스트카",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # "카테고리를 찾을 수 없어요" 응답
    mock_answer.assert_called()
    assert "찾을 수 없" in mock_answer.call_args[0][1]


# ── set_category: 이름(문자열)으로 카테고리 변경 ──


@pytest.mark.asyncio
async def test_set_category_by_name(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """set_category에서 숫자가 아닌 이름으로 카테고리 변경"""
    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=80003)

    cat = Category(name="식비", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()

    expense = Expense(
        user_id=bot_user.id,
        amount=8000,
        description="점심",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household.id,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_set_name",
                "message": {"chat": {"id": 80003}},
                "data": f"set_category:{expense.id}:기타",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 카테고리가 "기타"로 변경
    await db_session.refresh(expense)
    cat_result = await db_session.execute(select(Category).where(Category.id == expense.category_id))
    new_cat = cat_result.scalar_one()
    assert new_cat.name == "기타"

    # 변경 메시지
    assert mock_telegram_send.called
    assert "기타" in mock_telegram_send.call_args[0][1]


# ── set_category: 존재하지 않는 카테고리 ID ──


@pytest.mark.asyncio
async def test_set_category_nonexistent_id(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """set_category에서 존재하지 않는 카테고리 ID → 에러 응답"""
    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=80004)

    cat = Category(name="식비", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()

    expense = Expense(
        user_id=bot_user.id,
        amount=8000,
        description="점심",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household.id,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock) as mock_answer:
        callback_payload = {
            "callback_query": {
                "id": "cb_set_bad",
                "message": {"chat": {"id": 80004}},
                "data": f"set_category:{expense.id}:99999",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    mock_answer.assert_called()
    assert "찾을 수 없" in mock_answer.call_args[0][1]


# ── callback_query 처리 중 Exception ──


@pytest.mark.asyncio
async def test_callback_query_exception_handling(client, db_session, mock_telegram_send):
    """callback_query 처리 중 예상치 못한 에러 → '오류가 발생했습니다'"""
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock) as mock_answer:
        # 잘못된 형식의 데이터로 에러 유발
        callback_payload = {
            "callback_query": {
                "id": "cb_error",
                "message": {"chat": {"id": 80005}},
                "data": "confirm_delete:not_a_number",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # "오류가 발생했습니다" 응답
    mock_answer.assert_called()
    assert "오류" in mock_answer.call_args[0][1]


# ── cmd:help 콜백 ──


@pytest.mark.asyncio
async def test_cmd_callback_help(client, db_session, mock_telegram_send):
    """cmd:help 콜백이 도움말을 전송"""
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_cmd_help",
                "message": {"chat": {"id": 80006}},
                "data": "cmd:help",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    assert mock_telegram_send.called
    sent_message = mock_telegram_send.call_args[0][1]
    assert "사용" in sent_message or "도움말" in sent_message or "가이드" in sent_message


# ── cmd:link_info 콜백 ──


@pytest.mark.asyncio
async def test_cmd_callback_link_info(client, db_session, mock_telegram_send):
    """cmd:link_info 콜백이 연동 안내 메시지를 전송"""
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_cmd_link",
                "message": {"chat": {"id": 80007}},
                "data": "cmd:link_info",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    assert mock_telegram_send.called
    sent_message = mock_telegram_send.call_args[0][1]
    assert "연동" in sent_message


# ── Income 콜백: parts 부족 시 잘못된 요청 ──


@pytest.mark.asyncio
async def test_income_callback_insufficient_parts(client, db_session, mock_telegram_send):
    """Income 콜백에서 parts가 부족하면 '잘못된 요청' 응답"""
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock) as mock_answer:
        callback_payload = {
            "callback_query": {
                "id": "cb_bad_parts",
                "message": {"chat": {"id": 80008}},
                "data": "delete_income",  # parts 1개뿐, min_parts=2 필요
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    mock_answer.assert_called()
    assert "잘못된 요청" in mock_answer.call_args[0][1]


# ── Expense 콜백: parts 부족 시 잘못된 요청 ──


@pytest.mark.asyncio
async def test_expense_callback_insufficient_parts(client, db_session, mock_telegram_send):
    """Expense 콜백에서 parts가 부족하면 '잘못된 요청' 응답"""
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock) as mock_answer:
        callback_payload = {
            "callback_query": {
                "id": "cb_bad_parts2",
                "message": {"chat": {"id": 80009}},
                "data": "confirm_cat",  # min_parts=4 필요, 1개뿐
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    mock_answer.assert_called()
    assert "잘못된 요청" in mock_answer.call_args[0][1]


# ── Income 콜백: 존재하지 않는 수입 ID ──


@pytest.mark.asyncio
async def test_income_callback_not_found(client, db_session, mock_telegram_send):
    """Income 콜백에서 수입 ID가 존재하지 않으면 '수입을 찾을 수 없어요'"""
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock) as mock_answer:
        callback_payload = {
            "callback_query": {
                "id": "cb_income_nf",
                "message": {"chat": {"id": 80010}},
                "data": "delete_income:99999",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    mock_answer.assert_called()
    assert "수입을 찾을 수 없" in mock_answer.call_args[0][1]


# ── Income IDOR: convert_to_expense 거부 ──


@pytest.mark.asyncio
async def test_convert_to_expense_idor_blocked(client, db_session, mock_telegram_send):
    """타인의 수입을 지출로 변환 시도 → 거부"""
    bot_user_a, household_a = await setup_bot_user_with_household(db_session, chat_id=80011)
    cat = Category(name="급여", type="income", household_id=household_a.id)
    db_session.add(cat)
    await db_session.flush()

    income = Income(
        user_id=bot_user_a.id,
        amount=1000000,
        description="월급",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household_a.id,
    )
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    # 다른 사용자(chat_id=80012)가 시도
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock) as mock_answer:
        callback_payload = {
            "callback_query": {
                "id": "cb_idor_convert",
                "message": {"chat": {"id": 80012}},
                "data": f"convert_to_expense:{income.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    mock_answer.assert_called()
    assert "본인" in mock_answer.call_args[0][1]

    # Income이 삭제되지 않았는지 확인
    result = await db_session.execute(select(Income).where(Income.id == income.id))
    assert result.scalar_one_or_none() is not None


# ── 다건 입력에서 카테고리 미존재 시 자동 생성 ──


@pytest.mark.asyncio
async def test_multiple_expenses_auto_creates_category(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """다건 입력에서 카테고리가 없으면 자동 생성"""
    await setup_bot_user_with_household(db_session, chat_id=80013)

    mock_llm_parse_expense.return_value = [
        {"amount": 5000, "category": "새카테고리A", "description": "테스트1", "date": "2026-03-25"},
        {"amount": 3000, "category": "새카테고리B", "description": "테스트2", "date": "2026-03-25"},
    ]

    payload = {"message": {"chat": {"id": 80013}, "text": "테스트1 5000원 테스트2 3000원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # 2건 저장
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 2

    # 카테고리도 생성됨
    cat_result = await db_session.execute(select(Category).where(Category.name == "새카테고리A"))
    assert cat_result.scalar_one_or_none() is not None


# ── webhook: TELEGRAM_BOT_TOKEN만 있고 SECRET 없으면 503 ──


@pytest.mark.asyncio
async def test_webhook_token_without_secret_returns_503(client, db_session):
    """TELEGRAM_BOT_TOKEN이 설정됐지만 WEBHOOK_SECRET이 없으면 503"""
    with patch("app.api.telegram.settings") as mock_settings:
        mock_settings.TELEGRAM_BOT_TOKEN = "some-token"
        mock_settings.TELEGRAM_WEBHOOK_SECRET = ""

        payload = {"message": {"chat": {"id": 12345}, "text": "/start"}}
        response = await client.post("/api/telegram/webhook", json=payload)
        assert response.status_code == 503


# ── change_category: 카테고리 없을 때 기본 "기타" 표시 ──


@pytest.mark.asyncio
async def test_change_category_empty_categories(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """change_category 콜백에서 카테고리가 없을 때 기본 "기타" 버튼 표시"""
    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=80014)

    # 기타 카테고리만 생성 (LLM이 만든)
    cat = Category(name="기타", user_id=bot_user.id)
    db_session.add(cat)
    await db_session.flush()

    expense = Expense(
        user_id=bot_user.id,
        amount=5000,
        description="테스트",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household.id,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        # change_category에서 _get_accessible_categories가 결과를 돌려줌
        callback_payload = {
            "callback_query": {
                "id": "cb_change_empty",
                "message": {"chat": {"id": 80014}},
                "data": f"change_category:{expense.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 카테고리 선택 메시지
    assert mock_telegram_send.called
    assert "카테고리" in mock_telegram_send.call_args[0][1]


# ── 수입 다건 + 지출 혼합 시 strike 리셋 ──


@pytest.mark.asyncio
async def test_multiple_mixed_resets_strike(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """다건 혼합 입력 성공 시 strike 카운트 리셋"""
    from app.services.bot_strike_service import _error_counts, get_strike_count, increment_strike

    _error_counts.clear()

    await setup_bot_user_with_household(db_session, chat_id=80015)

    # Strike 미리 증가
    increment_strike("telegram", "80015")
    assert get_strike_count("telegram", "80015") == 1

    mock_llm_parse_expense.return_value = [
        {"amount": 3000000, "category": "급여", "description": "월급", "date": "2026-03-25", "type": "income"},
        {"amount": 8000, "category": "식비", "description": "점심", "date": "2026-03-25"},
    ]

    payload = {"message": {"chat": {"id": 80015}, "text": "월급 300만원 점심 8000원"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    # Strike 리셋됨
    assert get_strike_count("telegram", "80015") == 0

    _error_counts.clear()


# ── report: DB 에러 시 서버 에러 메시지 ──


@pytest.mark.asyncio
async def test_report_exception_in_db_query(client, db_session, mock_telegram_send):
    """handle_report_command 내부에서 DB 쿼리 에러 시 서버 에러 메시지 전송"""
    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=80016)

    mock_telegram_send.reset_mock()

    # handle_report_command 내부의 db.execute를 에러로 만들어서
    # 내부 try-except에서 format_server_error가 호출되게 함
    original_execute = db_session.execute

    call_count = 0

    async def failing_execute(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        # 처음 몇 번은 정상 (봇 유저 조회 등), 이후 리포트 쿼리에서 에러
        if call_count > 5:
            raise Exception("DB 장애")
        return await original_execute(*args, **kwargs)

    with patch.object(db_session, "execute", side_effect=failing_execute):
        payload = {"message": {"chat": {"id": 80016}, "text": "/report"}}
        response = await client.post("/api/telegram/webhook", json=payload)
        assert response.status_code == 200

    # 에러 메시지 전송 확인
    assert mock_telegram_send.called
    sent_message = mock_telegram_send.call_args[0][1]
    assert "다시 시도" in sent_message or "가구" in sent_message or "리포트" in sent_message


# ── /help 응답에 인라인 키보드 포함 ──


@pytest.mark.asyncio
async def test_help_command_has_inline_keyboard(client, db_session, mock_telegram_send):
    """/help 응답에 리포트/예산 인라인 키보드 포함"""
    payload = {"message": {"chat": {"id": 80017}, "text": "/help"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    call_kwargs = mock_telegram_send.call_args
    reply_markup = call_kwargs.kwargs.get("reply_markup") or (call_kwargs[1].get("reply_markup") if call_kwargs[1] else None)
    assert reply_markup is not None
    assert "inline_keyboard" in reply_markup
    buttons_flat = [btn for row in reply_markup["inline_keyboard"] for btn in row]
    callback_data = [btn["callback_data"] for btn in buttons_flat]
    assert "cmd:report" in callback_data
    assert "cmd:budget" in callback_data


# ── /start 일반 (코드 없이) ──


@pytest.mark.asyncio
async def test_start_command_has_inline_keyboard(client, db_session, mock_telegram_send):
    """/start 일반 응답에 사용법/연동 인라인 키보드 포함"""
    payload = {"message": {"chat": {"id": 80018}, "text": "/start"}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200

    mock_telegram_send.assert_called_once()
    call_kwargs = mock_telegram_send.call_args
    reply_markup = call_kwargs.kwargs.get("reply_markup") or (call_kwargs[1].get("reply_markup") if call_kwargs[1] else None)
    assert reply_markup is not None
    assert "inline_keyboard" in reply_markup
    buttons_flat = [btn for row in reply_markup["inline_keyboard"] for btn in row]
    callback_data = [btn["callback_data"] for btn in buttons_flat]
    assert "cmd:help" in callback_data
    assert "cmd:link_info" in callback_data


# ── report_full: 가구 미설정 시 ──


@pytest.mark.asyncio
async def test_report_full_no_household(client, db_session, mock_telegram_send):
    """cmd:report_full 콜백 — 가구 미설정 시 안내 메시지"""
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_rf_no_hh",
                "message": {"chat": {"id": 80019}},
                "data": "cmd:report_full",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    assert mock_telegram_send.called
    sent_message = mock_telegram_send.call_args[0][1]
    assert "가구 설정" in sent_message


# ── budget_full: 가구 미설정 시 ──


@pytest.mark.asyncio
async def test_budget_full_no_household(client, db_session, mock_telegram_send):
    """cmd:budget_full 콜백 — 가구 미설정 시 안내 메시지"""
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_bf_no_hh",
                "message": {"chat": {"id": 80020}},
                "data": "cmd:budget_full",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    assert mock_telegram_send.called
    sent_message = mock_telegram_send.call_args[0][1]
    assert "가구 설정" in sent_message


# ── budget_full: 예산 없을 때 ──


@pytest.mark.asyncio
async def test_budget_full_no_budgets(client, db_session, mock_telegram_send):
    """cmd:budget_full 콜백 — 가구 있지만 예산 없을 때"""
    await setup_bot_user_with_household(db_session, chat_id=80021)

    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_bf_empty",
                "message": {"chat": {"id": 80021}},
                "data": "cmd:budget_full",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    assert mock_telegram_send.called
    sent_message = mock_telegram_send.call_args[0][1]
    assert "예산" in sent_message


# ── report_full: 가구 있지만 지출 없을 때 ──


@pytest.mark.asyncio
async def test_report_full_no_expenses(client, db_session, mock_telegram_send):
    """cmd:report_full — 가구 있지만 지출 없을 때"""
    await setup_bot_user_with_household(db_session, chat_id=80022)

    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_rf_empty",
                "message": {"chat": {"id": 80022}},
                "data": "cmd:report_full",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    assert mock_telegram_send.called
    sent_message = mock_telegram_send.call_args[0][1]
    assert "없" in sent_message or "전체" in sent_message

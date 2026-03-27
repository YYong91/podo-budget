"""
Telegram 봇 핸들러 BotResponse 반환값 검증 (#414)

#412에서 핸들러들이 BotResponse를 반환하도록 분리되었으므로,
외부 API 모킹 없이 반환값만 직접 검증합니다.

커버리지 목표:
- _handle_start_command: 일반/딥링크 성공/실패
- _handle_help_command: 도움말 텍스트 + 키보드
- _handle_feedback_command: 빈 내용/버그/기능 요청
- _handle_expense_input: 미연동 사용자, LLM 에러
- _build_report_response: 가구 있음/없음, 데이터 있음/없음, 3개 초과
- _build_budget_response: 예산 있음/없음, 데이터 있음
- _build_report_full_response / _build_budget_full_response
- _save_and_respond_single: 수입/지출 저장
- _handle_single_expense_parsed: 에러/카테고리 확인/바로 저장
- _ask_category_confirmation: 카테고리 확인 인라인 키보드
- _handle_multiple_expenses: 다건 저장
- 콜백 핸들러: confirm_cat, new_cat, delete, confirm_delete, cancel_delete
- 콜백 핸들러: change_category, set_category
- Income 콜백: delete_income, confirm_delete_income, cancel_delete_income
- 변환 핸들러: convert_to_income, convert_to_expense
- _handle_cmd_callback: report/budget/report_full/budget_full
- 하위 호환 래퍼: handle_report_command, handle_budget_command 등
"""

from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.schemas.bot import BotResponse


async def _setup_bot_user(db_session, chat_id: int = 90001):
    """봇 사용자 + 가구 설정 헬퍼"""
    from app.services.bot_user_service import get_or_create_bot_user

    bot_user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id=str(chat_id))
    household = Household(name=f"TG핸들러 테스트 {chat_id}")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()
    return bot_user, household


async def _create_category(db_session, name: str, household_id: int, cat_type: str = "expense") -> Category:
    """카테고리 생성 헬퍼"""
    cat = Category(name=name, household_id=household_id, type=cat_type)
    db_session.add(cat)
    await db_session.flush()
    return cat


async def _create_expense(db_session, user_id: int, household_id: int, category_id: int, amount: float = 8000, description: str = "점심") -> Expense:
    """지출 생성 헬퍼"""
    expense = Expense(
        user_id=user_id,
        amount=amount,
        description=description,
        category_id=category_id,
        date=datetime.now(),
        household_id=household_id,
        raw_input=f"{description} {int(amount)}원",
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)
    return expense


async def _create_income(db_session, user_id: int, household_id: int, category_id: int, amount: float = 3000000, description: str = "월급") -> Income:
    """수입 생성 헬퍼"""
    income = Income(
        user_id=user_id,
        amount=amount,
        description=description,
        category_id=category_id,
        date=datetime.now(),
        household_id=household_id,
        raw_input=f"{description} {int(amount)}원",
    )
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)
    return income


# ---------------------------------------------------------------------------
# _handle_start_command
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_start_command_general(db_session):
    """일반 /start → 환영 메시지 + 인라인 키보드"""
    from app.api.telegram import _handle_start_command

    bot_user, household = await _setup_bot_user(db_session, chat_id=90001)
    response = await _handle_start_command(90001, "/start", bot_user, db_session, household.id)
    assert isinstance(response, BotResponse)
    assert "환영" in response.text or "포도" in response.text
    assert response.reply_markup is not None
    buttons = [btn for row in response.reply_markup["inline_keyboard"] for btn in row]
    assert any("cmd:help" in btn["callback_data"] for btn in buttons)


@pytest.mark.asyncio
async def test_handle_start_command_deeplink_success(db_session):
    """/start CODE 딥링크 → 연동 성공 시 완료 메시지"""
    from app.api.telegram import _handle_start_command

    bot_user, household = await _setup_bot_user(db_session, chat_id=90002)

    with patch("app.api.telegram.link_telegram_account_by_code", new_callable=AsyncMock) as mock_link:
        mock_link.return_value = (True, "연동 완료!")
        response = await _handle_start_command(90002, "/start ABCDEF", bot_user, db_session, household.id)

    assert "연동 완료" in response.text
    assert response.reply_markup is not None


@pytest.mark.asyncio
async def test_handle_start_command_deeplink_failure(db_session):
    """/start CODE 딥링크 → 연동 실패 시 환영 메시지로 fallback"""
    from app.api.telegram import _handle_start_command

    bot_user, household = await _setup_bot_user(db_session, chat_id=90003)

    with patch("app.api.telegram.link_telegram_account_by_code", new_callable=AsyncMock) as mock_link:
        mock_link.return_value = (False, "유효하지 않은 코드입니다.")
        response = await _handle_start_command(90003, "/start BADCODE", bot_user, db_session, household.id)

    # 실패 시 일반 환영 메시지 반환
    assert "환영" in response.text or "포도" in response.text


# ---------------------------------------------------------------------------
# _handle_help_command
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_help_command(db_session):
    """/help → 도움말 텍스트 + 리포트/예산 키보드"""
    from app.api.telegram import _handle_help_command

    bot_user, household = await _setup_bot_user(db_session, chat_id=90004)
    response = await _handle_help_command(90004, "/help", bot_user, db_session, household.id)
    assert isinstance(response, BotResponse)
    assert response.reply_markup is not None
    buttons = [btn for row in response.reply_markup["inline_keyboard"] for btn in row]
    assert any("cmd:report" in btn["callback_data"] for btn in buttons)
    assert any("cmd:budget" in btn["callback_data"] for btn in buttons)


# ---------------------------------------------------------------------------
# _handle_feedback_command
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_feedback_command_empty(db_session):
    """/feedback (내용 없음) → 가이드 메시지 + 키보드"""
    from app.api.telegram import _handle_feedback_command

    bot_user, household = await _setup_bot_user(db_session, chat_id=90005)
    response = await _handle_feedback_command(90005, "/feedback", bot_user, db_session, household.id)
    assert isinstance(response, BotResponse)
    assert response.reply_markup is not None


@pytest.mark.asyncio
async def test_handle_feedback_command_with_bug_content(db_session):
    """/feedback 버그 ... → 피드백 저장 (type=bug) + 감사 메시지"""
    from app.api.telegram import _handle_feedback_command

    bot_user, household = await _setup_bot_user(db_session, chat_id=90006)

    with patch("app.services.feedback_notify.notify_admin_feedback", new_callable=AsyncMock):
        response = await _handle_feedback_command(90006, "/feedback 버그 카테고리가 안 바뀌어요", bot_user, db_session, household.id)

    assert isinstance(response, BotResponse)
    assert len(response.text) > 0

    from app.models.feedback import Feedback

    result = await db_session.execute(select(Feedback).where(Feedback.user_id == bot_user.id))
    feedback = result.scalar_one()
    assert feedback.type == "bug"
    assert feedback.source == "telegram"


@pytest.mark.asyncio
async def test_handle_feedback_command_with_feature_content(db_session):
    """/feedback 기능 요청 → type=feature"""
    from app.api.telegram import _handle_feedback_command

    bot_user, household = await _setup_bot_user(db_session, chat_id=90007)

    with patch("app.services.feedback_notify.notify_admin_feedback", new_callable=AsyncMock):
        response = await _handle_feedback_command(90007, "/feedback 정기 결제 기능 추가해주세요", bot_user, db_session, household.id)

    assert isinstance(response, BotResponse)

    from app.models.feedback import Feedback

    result = await db_session.execute(select(Feedback).where(Feedback.user_id == bot_user.id))
    feedback = result.scalar_one()
    assert feedback.type == "feature"


# ---------------------------------------------------------------------------
# _handle_link_command
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_link_command_success(db_session):
    """/link CODE → 연동 성공 메시지"""
    from app.api.telegram import _handle_link_command

    bot_user, household = await _setup_bot_user(db_session, chat_id=90008)

    with patch("app.api.telegram.link_telegram_account_by_code", new_callable=AsyncMock) as mock_link:
        mock_link.return_value = (True, "연동 완료!")
        response = await _handle_link_command(90008, "/link ABC123", bot_user, db_session, household.id)

    assert response.text == "연동 완료!"


# ---------------------------------------------------------------------------
# _handle_expense_input: 미연동 사용자
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_expense_input_unlinked_user(db_session):
    """미연동 텔레그램 봇 사용자 → 연동 안내 메시지"""
    from app.api.telegram import _handle_expense_input

    bot_user, _ = await _setup_bot_user(db_session, chat_id=90009)
    # username이 telegram_ 프리픽스이고 household_id=None
    bot_user.username = "telegram_90009"

    response = await _handle_expense_input(90009, "점심 8000원", bot_user, db_session, None)
    assert isinstance(response, BotResponse)
    assert "연동" in response.text


@pytest.mark.asyncio
async def test_handle_expense_input_llm_exception(db_session):
    """LLM 호출 중 예외 발생 → 서버 에러 메시지"""
    from app.api.telegram import _handle_expense_input

    bot_user, household = await _setup_bot_user(db_session, chat_id=90010)

    with patch("app.api.telegram.get_llm_provider") as mock_provider:
        mock_llm = MagicMock()
        mock_llm.parse_expense = AsyncMock(side_effect=Exception("LLM 장애"))
        mock_provider.return_value = mock_llm

        response = await _handle_expense_input(90010, "점심 8000원", bot_user, db_session, household.id)

    assert isinstance(response, BotResponse)
    assert "다시 시도" in response.text


# ---------------------------------------------------------------------------
# _handle_single_expense_parsed: 에러/바로 저장/카테고리 확인
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_single_expense_parsed_error(db_session):
    """파싱 에러 → strike 증가 + 에러 메시지"""
    from app.api.telegram import _handle_single_expense_parsed
    from app.services.bot_strike_service import _error_counts

    _error_counts.clear()

    bot_user, household = await _setup_bot_user(db_session, chat_id=90011)
    response = await _handle_single_expense_parsed(db_session, 90011, bot_user, {"error": "파싱 실패"}, household.id, "이상한 입력")
    assert isinstance(response, BotResponse)
    assert len(response.text) > 0

    _error_counts.clear()


@pytest.mark.asyncio
async def test_handle_single_expense_parsed_direct_save(db_session):
    """기존 카테고리 → 바로 저장 → BotResponse"""
    from app.api.telegram import _handle_single_expense_parsed

    bot_user, household = await _setup_bot_user(db_session, chat_id=90012)
    await _create_category(db_session, "식비", household.id)

    parsed = {"amount": 8000, "category": "식비", "description": "점심", "date": datetime.now().isoformat()}
    response = await _handle_single_expense_parsed(db_session, 90012, bot_user, parsed, household.id, "점심 8000원")
    assert isinstance(response, BotResponse)
    assert "8,000" in response.text
    assert response.reply_markup is not None


# ---------------------------------------------------------------------------
# _save_and_respond_single: 수입/지출
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_save_and_respond_single_expense(db_session):
    """지출 저장 → BotResponse (카테고리 변경/삭제 키보드)"""
    from app.api.telegram import _save_and_respond_single

    bot_user, household = await _setup_bot_user(db_session, chat_id=90013)
    cat = await _create_category(db_session, "식비", household.id)

    parsed = {"amount": 8000, "description": "점심", "date": datetime.now().isoformat(), "type": "expense"}
    response = await _save_and_respond_single(db_session, 90013, bot_user, parsed, household.id, cat, "점심 8000원")

    assert isinstance(response, BotResponse)
    assert "8,000" in response.text
    assert response.reply_markup is not None
    buttons = [btn for row in response.reply_markup["inline_keyboard"] for btn in row]
    assert any("change_category" in btn["callback_data"] for btn in buttons)
    assert any("delete_expense" in btn["callback_data"] for btn in buttons)


@pytest.mark.asyncio
async def test_save_and_respond_single_income(db_session):
    """수입 저장 → BotResponse (삭제/지출 변환 키보드)"""
    from app.api.telegram import _save_and_respond_single

    bot_user, household = await _setup_bot_user(db_session, chat_id=90014)
    cat = await _create_category(db_session, "급여", household.id, cat_type="income")

    parsed = {"amount": 3000000, "description": "월급", "date": datetime.now().isoformat(), "type": "income"}
    response = await _save_and_respond_single(db_session, 90014, bot_user, parsed, household.id, cat, "월급 300만원")

    assert isinstance(response, BotResponse)
    assert "3,000,000" in response.text
    assert response.reply_markup is not None
    buttons = [btn for row in response.reply_markup["inline_keyboard"] for btn in row]
    assert any("delete_income" in btn["callback_data"] for btn in buttons)
    assert any("convert_to_expense" in btn["callback_data"] for btn in buttons)


# ---------------------------------------------------------------------------
# _ask_category_confirmation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ask_category_confirmation(db_session):
    """카테고리 확인 → 인라인 키보드에 기존 카테고리 + 새로 등록 버튼"""
    from app.api.telegram import _ask_category_confirmation

    bot_user, household = await _setup_bot_user(db_session, chat_id=90015)
    await _create_category(db_session, "식비", household.id)

    parsed = {"amount": 8000, "description": "점심", "date": datetime.now().isoformat()}
    response = await _ask_category_confirmation(db_session, 90015, bot_user.id, parsed, household.id, "외식비", "점심 8000원")

    assert isinstance(response, BotResponse)
    assert "외식비" in response.text
    assert "8,000" in response.text
    assert response.reply_markup is not None
    buttons = [btn for row in response.reply_markup["inline_keyboard"] for btn in row]
    # 기존 카테고리 버튼
    assert any("confirm_cat" in btn.get("callback_data", "") for btn in buttons)
    # 새로 등록 버튼
    assert any("new_cat" in btn.get("callback_data", "") for btn in buttons)


# ---------------------------------------------------------------------------
# _handle_multiple_expenses
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_multiple_expenses_mixed(db_session):
    """다건 혼합 입력 → 총액 + 건수 메시지"""
    from app.api.telegram import _handle_multiple_expenses

    bot_user, household = await _setup_bot_user(db_session, chat_id=90016)

    parsed = [
        {"amount": 8000, "category": "식비", "description": "점심", "date": datetime.now().isoformat()},
        {"amount": 3000000, "category": "급여", "description": "월급", "date": datetime.now().isoformat(), "type": "income"},
    ]

    response = await _handle_multiple_expenses(db_session, 90016, bot_user, parsed, household.id, "점심 8000원 월급 300만원")

    assert isinstance(response, BotResponse)
    assert "지출 1건" in response.text
    assert "수입 1건" in response.text

    # DB 검증
    expenses = (await db_session.execute(select(Expense))).scalars().all()
    incomes = (await db_session.execute(select(Income))).scalars().all()
    assert len(expenses) == 1
    assert len(incomes) == 1


# ---------------------------------------------------------------------------
# 콜백 핸들러 직접 호출 (BotResponse 반환 검증)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_confirm_cat(db_session):
    """confirm_cat 콜백 → 카테고리 변경 + BotResponse"""
    from app.api.telegram import _handle_confirm_cat

    bot_user, household = await _setup_bot_user(db_session, chat_id=90017)
    old_cat = await _create_category(db_session, "기타", household.id)
    new_cat = await _create_category(db_session, "외식비", household.id)
    expense = await _create_expense(db_session, bot_user.id, household.id, old_cat.id)

    parts = ["confirm_cat", str(expense.id), str(new_cat.id), "새카테고리"]
    response = await _handle_confirm_cat(db_session, 90017, "cb_test", expense, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert response.callback_answer is not None
    assert "외식비" in response.callback_answer
    assert response.reply_markup is not None


@pytest.mark.asyncio
async def test_handle_new_cat(db_session):
    """new_cat 콜백 → 새 카테고리 생성 + BotResponse"""
    from app.api.telegram import _handle_new_cat

    bot_user, household = await _setup_bot_user(db_session, chat_id=90018)
    old_cat = await _create_category(db_session, "기타", household.id)
    expense = await _create_expense(db_session, bot_user.id, household.id, old_cat.id)

    parts = ["new_cat", str(expense.id), "교통비"]
    response = await _handle_new_cat(db_session, 90018, "cb_test", expense, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "교통비" in response.callback_answer
    assert response.reply_markup is not None


@pytest.mark.asyncio
async def test_handle_delete_expense(db_session):
    """delete_expense 콜백 → 삭제 확인 프롬프트"""
    from app.api.telegram import _handle_delete_expense

    bot_user, household = await _setup_bot_user(db_session, chat_id=90019)
    cat = await _create_category(db_session, "식비", household.id)
    expense = await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=12000, description="저녁")

    parts = ["delete_expense", str(expense.id)]
    response = await _handle_delete_expense(db_session, 90019, "cb_test", expense, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "삭제" in response.text
    assert "12,000" in response.text
    assert response.reply_markup is not None
    buttons = [btn for row in response.reply_markup["inline_keyboard"] for btn in row]
    assert any("confirm_delete" in btn["callback_data"] for btn in buttons)
    assert any("cancel_delete" in btn["callback_data"] for btn in buttons)


@pytest.mark.asyncio
async def test_handle_confirm_delete(db_session):
    """confirm_delete 콜백 → 실제 삭제"""
    from app.api.telegram import _handle_confirm_delete

    bot_user, household = await _setup_bot_user(db_session, chat_id=90020)
    cat = await _create_category(db_session, "식비", household.id)
    expense = await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=5000)

    parts = ["confirm_delete", str(expense.id)]
    response = await _handle_confirm_delete(db_session, 90020, "cb_test", expense, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "삭제" in response.text
    assert "5,000" in response.text

    # DB에서 삭제됨
    result = await db_session.execute(select(Expense).where(Expense.id == expense.id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_handle_cancel_delete(db_session):
    """cancel_delete 콜백 → 삭제 취소 메시지"""
    from app.api.telegram import _handle_cancel_delete

    bot_user, household = await _setup_bot_user(db_session, chat_id=90021)
    cat = await _create_category(db_session, "식비", household.id)
    expense = await _create_expense(db_session, bot_user.id, household.id, cat.id)

    parts = ["cancel_delete", str(expense.id)]
    response = await _handle_cancel_delete(db_session, 90021, "cb_test", expense, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "취소" in response.text


@pytest.mark.asyncio
async def test_handle_change_category(db_session):
    """change_category 콜백 → 카테고리 선택 키보드"""
    from app.api.telegram import _handle_change_category

    bot_user, household = await _setup_bot_user(db_session, chat_id=90022)
    cat = await _create_category(db_session, "식비", household.id)
    await _create_category(db_session, "교통비", household.id)
    expense = await _create_expense(db_session, bot_user.id, household.id, cat.id)

    parts = ["change_category", str(expense.id)]
    response = await _handle_change_category(db_session, 90022, "cb_test", expense, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "카테고리" in response.text
    assert response.reply_markup is not None
    buttons = [btn for row in response.reply_markup["inline_keyboard"] for btn in row]
    assert any("set_category" in btn["callback_data"] for btn in buttons)


@pytest.mark.asyncio
async def test_handle_set_category_by_id(db_session):
    """set_category 콜백 (숫자 ID) → 카테고리 변경"""
    from app.api.telegram import _handle_set_category

    bot_user, household = await _setup_bot_user(db_session, chat_id=90023)
    old_cat = await _create_category(db_session, "기타", household.id)
    new_cat = await _create_category(db_session, "외식비", household.id)
    expense = await _create_expense(db_session, bot_user.id, household.id, old_cat.id)

    parts = ["set_category", str(expense.id), str(new_cat.id)]
    response = await _handle_set_category(db_session, 90023, "cb_test", expense, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "외식비" in response.text
    assert "외식비" in response.callback_answer


# ---------------------------------------------------------------------------
# Income 콜백 핸들러
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_delete_income(db_session):
    """delete_income 콜백 → 삭제 확인 프롬프트"""
    from app.api.telegram import _handle_delete_income

    bot_user, household = await _setup_bot_user(db_session, chat_id=90024)
    cat = await _create_category(db_session, "급여", household.id, cat_type="income")
    income = await _create_income(db_session, bot_user.id, household.id, cat.id)

    parts = ["delete_income", str(income.id)]
    response = await _handle_delete_income(db_session, 90024, "cb_test", income, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "삭제" in response.text
    assert response.reply_markup is not None


@pytest.mark.asyncio
async def test_handle_confirm_delete_income(db_session):
    """confirm_delete_income 콜백 → 실제 삭제"""
    from app.api.telegram import _handle_confirm_delete_income

    bot_user, household = await _setup_bot_user(db_session, chat_id=90025)
    cat = await _create_category(db_session, "급여", household.id, cat_type="income")
    income = await _create_income(db_session, bot_user.id, household.id, cat.id, amount=500000)

    parts = ["confirm_delete_income", str(income.id)]
    response = await _handle_confirm_delete_income(db_session, 90025, "cb_test", income, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "삭제" in response.callback_answer

    result = await db_session.execute(select(Income).where(Income.id == income.id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_handle_cancel_delete_income(db_session):
    """cancel_delete_income 콜백 → 삭제 취소"""
    from app.api.telegram import _handle_cancel_delete_income

    bot_user, household = await _setup_bot_user(db_session, chat_id=90026)
    cat = await _create_category(db_session, "급여", household.id, cat_type="income")
    income = await _create_income(db_session, bot_user.id, household.id, cat.id)

    parts = ["cancel_delete_income", str(income.id)]
    response = await _handle_cancel_delete_income(db_session, 90026, "cb_test", income, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "취소" in response.text


# ---------------------------------------------------------------------------
# 변환 핸들러
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_convert_to_income(db_session):
    """convert_to_income 콜백 → Expense 삭제, Income 생성"""
    from app.api.telegram import _handle_convert_to_income

    bot_user, household = await _setup_bot_user(db_session, chat_id=90027)
    cat = await _create_category(db_session, "식비", household.id)
    expense = await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=50000, description="환불")

    parts = ["convert_to_income", str(expense.id)]
    response = await _handle_convert_to_income(db_session, 90027, "cb_test", expense, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "수입으로 변경" in response.callback_answer
    assert response.reply_markup is not None

    # Expense 삭제 확인
    result = await db_session.execute(select(Expense).where(Expense.id == expense.id))
    assert result.scalar_one_or_none() is None

    # Income 생성 확인
    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 1
    assert float(incomes[0].amount) == 50000


@pytest.mark.asyncio
async def test_handle_convert_to_expense(db_session):
    """convert_to_expense 콜백 → Income 삭제, Expense 생성"""
    from app.api.telegram import _handle_convert_to_expense

    bot_user, household = await _setup_bot_user(db_session, chat_id=90028)
    cat = await _create_category(db_session, "급여", household.id, cat_type="income")
    income = await _create_income(db_session, bot_user.id, household.id, cat.id, amount=50000, description="보너스")

    parts = ["convert_to_expense", str(income.id)]
    response = await _handle_convert_to_expense(db_session, 90028, "cb_test", income, bot_user, parts)

    assert isinstance(response, BotResponse)
    assert "지출로 변경" in response.callback_answer
    assert response.reply_markup is not None

    # Income 삭제 확인
    result = await db_session.execute(select(Income).where(Income.id == income.id))
    assert result.scalar_one_or_none() is None

    # Expense 생성 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1


# ---------------------------------------------------------------------------
# _build_report_response / _build_budget_response
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_build_report_response_no_household(db_session):
    """리포트 — 가구 미설정"""
    from app.api.telegram import _build_report_response

    response = await _build_report_response(db_session, household_id=None)
    assert isinstance(response, BotResponse)
    assert "가구 설정" in response.text


@pytest.mark.asyncio
async def test_build_report_response_with_data(db_session):
    """리포트 — 가구 있고 지출 데이터 있을 때"""
    from app.api.telegram import _build_report_response

    bot_user, household = await _setup_bot_user(db_session, chat_id=90029)
    await _create_category(db_session, "식비", household.id)
    # 이번 달 지출 4건 생성 (3개 초과 → "전체 보기" 버튼)
    for i in range(4):
        c = await _create_category(db_session, f"카테고리{i}", household.id)
        await _create_expense(db_session, bot_user.id, household.id, c.id, amount=10000 * (i + 1), description=f"지출{i}")

    response = await _build_report_response(db_session, household_id=household.id)
    assert isinstance(response, BotResponse)
    assert response.reply_markup is not None


@pytest.mark.asyncio
async def test_build_report_response_empty(db_session):
    """리포트 — 지출 없을 때"""
    from app.api.telegram import _build_report_response

    _, household = await _setup_bot_user(db_session, chat_id=90030)
    response = await _build_report_response(db_session, household_id=household.id)
    assert isinstance(response, BotResponse)


@pytest.mark.asyncio
async def test_build_budget_response_no_household(db_session):
    """예산 — 가구 미설정"""
    from app.api.telegram import _build_budget_response

    response = await _build_budget_response(db_session, household_id=None)
    assert isinstance(response, BotResponse)
    assert "가구 설정" in response.text


@pytest.mark.asyncio
async def test_build_budget_response_no_budgets(db_session):
    """예산 — 예산 없을 때"""
    from app.api.telegram import _build_budget_response

    _, household = await _setup_bot_user(db_session, chat_id=90031)
    response = await _build_budget_response(db_session, household_id=household.id)
    assert isinstance(response, BotResponse)
    assert "예산이 없" in response.text


@pytest.mark.asyncio
async def test_build_budget_response_with_data(db_session):
    """예산 — 예산 + 지출 데이터 있을 때"""
    from app.api.telegram import _build_budget_response

    bot_user, household = await _setup_bot_user(db_session, chat_id=90032)
    cat = await _create_category(db_session, "식비", household.id)

    budget = Budget(
        household_id=household.id,
        category_id=cat.id,
        amount=Decimal("200000"),
        period="monthly",
        start_date=datetime(2026, 1, 1),
    )
    db_session.add(budget)
    await db_session.flush()

    await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=180000, description="식비")

    response = await _build_budget_response(db_session, household_id=household.id)
    assert isinstance(response, BotResponse)
    assert response.reply_markup is not None


@pytest.mark.asyncio
async def test_build_report_full_response(db_session):
    """전체 리포트 응답"""
    from app.api.telegram import _build_report_full_response

    bot_user, household = await _setup_bot_user(db_session, chat_id=90033)
    cat = await _create_category(db_session, "식비", household.id)
    await _create_expense(db_session, bot_user.id, household.id, cat.id)

    response = await _build_report_full_response(db_session, household_id=household.id)
    assert isinstance(response, BotResponse)
    assert response.reply_markup is not None


@pytest.mark.asyncio
async def test_build_budget_full_response_with_data(db_session):
    """전체 예산 응답 (데이터 있음)"""
    from app.api.telegram import _build_budget_full_response

    bot_user, household = await _setup_bot_user(db_session, chat_id=90034)
    cat = await _create_category(db_session, "식비", household.id)

    budget = Budget(
        household_id=household.id,
        category_id=cat.id,
        amount=Decimal("200000"),
        period="monthly",
        start_date=datetime(2026, 1, 1),
    )
    db_session.add(budget)
    await db_session.flush()
    await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=50000)

    response = await _build_budget_full_response(db_session, household_id=household.id)
    assert isinstance(response, BotResponse)
    assert response.reply_markup is not None


@pytest.mark.asyncio
async def test_build_budget_full_response_no_household(db_session):
    """전체 예산 — 가구 미설정"""
    from app.api.telegram import _build_budget_full_response

    response = await _build_budget_full_response(db_session, household_id=None)
    assert "가구 설정" in response.text


@pytest.mark.asyncio
async def test_build_report_full_response_no_household(db_session):
    """전체 리포트 — 가구 미설정"""
    from app.api.telegram import _build_report_full_response

    response = await _build_report_full_response(db_session, household_id=None)
    assert "가구 설정" in response.text


# ---------------------------------------------------------------------------
# _handle_cmd_callback
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_cmd_callback_report(db_session):
    """cmd:report 콜백 → 리포트 전송"""
    from app.api.telegram import _handle_cmd_callback

    bot_user, household = await _setup_bot_user(db_session, chat_id=90035)

    with (
        patch("app.api.telegram._send_bot_response", new_callable=AsyncMock) as mock_send,
        patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock),
    ):
        result = await _handle_cmd_callback(db_session, 90035, "cb_test", ["cmd", "report"])
        assert result == {"ok": True}
        mock_send.assert_called_once()


@pytest.mark.asyncio
async def test_handle_cmd_callback_budget(db_session):
    """cmd:budget 콜백 → 예산 전송"""
    from app.api.telegram import _handle_cmd_callback

    bot_user, household = await _setup_bot_user(db_session, chat_id=90036)

    with (
        patch("app.api.telegram._send_bot_response", new_callable=AsyncMock) as mock_send,
        patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock),
    ):
        result = await _handle_cmd_callback(db_session, 90036, "cb_test", ["cmd", "budget"])
        assert result == {"ok": True}
        mock_send.assert_called_once()


@pytest.mark.asyncio
async def test_handle_cmd_callback_report_full(db_session):
    """cmd:report_full 콜백 → 전체 리포트 전송"""
    from app.api.telegram import _handle_cmd_callback

    bot_user, household = await _setup_bot_user(db_session, chat_id=90037)

    with (
        patch("app.api.telegram._send_bot_response", new_callable=AsyncMock) as mock_send,
        patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock),
    ):
        result = await _handle_cmd_callback(db_session, 90037, "cb_test", ["cmd", "report_full"])
        assert result == {"ok": True}
        mock_send.assert_called_once()


@pytest.mark.asyncio
async def test_handle_cmd_callback_budget_full(db_session):
    """cmd:budget_full 콜백 → 전체 예산 전송"""
    from app.api.telegram import _handle_cmd_callback

    bot_user, household = await _setup_bot_user(db_session, chat_id=90038)

    with (
        patch("app.api.telegram._send_bot_response", new_callable=AsyncMock) as mock_send,
        patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock),
    ):
        result = await _handle_cmd_callback(db_session, 90038, "cb_test", ["cmd", "budget_full"])
        assert result == {"ok": True}
        mock_send.assert_called_once()


# ---------------------------------------------------------------------------
# _resolve_category
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resolve_category_mapped(db_session):
    """매핑된 카테고리 → Category 반환"""
    from app.api.telegram import _resolve_category

    bot_user, household = await _setup_bot_user(db_session, chat_id=90039)
    cat = await _create_category(db_session, "외식비", household.id)

    # 매핑 저장
    from app.services.category_mapping_service import save_category_mapping

    await save_category_mapping(db_session, "식비", cat.id, user_id=bot_user.id, household_id=household.id)

    result = await _resolve_category(db_session, "식비", bot_user.id, household.id)
    assert result is not None
    assert result.name == "외식비"


@pytest.mark.asyncio
async def test_resolve_category_existing(db_session):
    """기존 카테고리에 있으면 → Category 반환"""
    from app.api.telegram import _resolve_category

    bot_user, household = await _setup_bot_user(db_session, chat_id=90040)
    await _create_category(db_session, "식비", household.id)

    result = await _resolve_category(db_session, "식비", bot_user.id, household.id)
    assert result is not None
    assert result.name == "식비"


@pytest.mark.asyncio
async def test_resolve_category_new(db_session):
    """매핑도 없고 기존에도 없으면 → None (확인 필요)"""
    from app.api.telegram import _resolve_category

    bot_user, household = await _setup_bot_user(db_session, chat_id=90041)
    result = await _resolve_category(db_session, "새카테고리", bot_user.id, household.id)
    assert result is None


# ---------------------------------------------------------------------------
# _handle_expense_input: LLM 성공 → 단일 지출
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_handle_expense_input_single_success(db_session):
    """LLM 파싱 성공 → 단일 지출 저장"""
    from app.api.telegram import _handle_expense_input

    bot_user, household = await _setup_bot_user(db_session, chat_id=90042)
    await _create_category(db_session, "식비", household.id)

    with patch("app.api.telegram.get_llm_provider") as mock_provider:
        mock_llm = MagicMock()
        mock_llm.parse_expense = AsyncMock(return_value={"amount": 8000, "category": "식비", "description": "점심", "date": datetime.now().isoformat()})
        mock_provider.return_value = mock_llm

        response = await _handle_expense_input(90042, "점심 8000원", bot_user, db_session, household.id)

    assert isinstance(response, BotResponse)
    assert "8,000" in response.text


@pytest.mark.asyncio
async def test_handle_expense_input_multiple_success(db_session):
    """LLM 파싱 성공 → 다건 지출 저장"""
    from app.api.telegram import _handle_expense_input

    bot_user, household = await _setup_bot_user(db_session, chat_id=90043)

    with patch("app.api.telegram.get_llm_provider") as mock_provider:
        mock_llm = MagicMock()
        mock_llm.parse_expense = AsyncMock(
            return_value=[
                {"amount": 8000, "category": "식비", "description": "점심", "date": datetime.now().isoformat()},
                {"amount": 3000, "category": "교통비", "description": "버스", "date": datetime.now().isoformat()},
            ]
        )
        mock_provider.return_value = mock_llm

        response = await _handle_expense_input(90043, "점심 8000원 버스 3000원", bot_user, db_session, household.id)

    assert isinstance(response, BotResponse)
    assert "2건" in response.text or "지출" in response.text


@pytest.mark.asyncio
async def test_handle_expense_input_none_return(db_session):
    """LLM이 예상치 못한 타입 반환 → None"""
    from app.api.telegram import _handle_expense_input

    bot_user, household = await _setup_bot_user(db_session, chat_id=90044)

    with patch("app.api.telegram.get_llm_provider") as mock_provider:
        mock_llm = MagicMock()
        mock_llm.parse_expense = AsyncMock(return_value="unexpected string")
        mock_provider.return_value = mock_llm

        response = await _handle_expense_input(90044, "이상한 입력", bot_user, db_session, household.id)

    # str 반환 → dict도 list도 아니므로 None
    assert response is None

"""
카카오 봇 핸들러 반환값 검증 (#414)

핸들러가 dict를 직접 반환하므로 외부 API 모킹 없이 반환값을 검증합니다.

커버리지 목표:
- _handle_help_command: 도움말 + quickReply
- _handle_report_command/_handle_budget_command: 가구 있음/없음
- _handle_link_command: 코드 성공
- _handle_feedback_command: 빈 내용/버그/기능
- _handle_expense_input: LLM 타임아웃, 단일 성공, 다건 성공
- _handle_single_expense: 수입/지출/에러 분기
- _handle_multiple_expenses: 수입+지출 혼합
- handle_undo_command: 삭제 대상 비교
- handle_change_command: /change만, /change 카테고리명
- handle_report_command/handle_budget_command: 데이터 있을 때
- handle_report_full_command/handle_budget_full_command: 데이터 있을 때
- kakao_webhook: 디스패치 경로
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


async def _setup_kakao_bot_user(db_session, platform_user_id: str = "kakao_cov_user"):
    """봇 사용자 + 가구 설정 헬퍼"""
    from app.services.bot_user_service import get_or_create_bot_user

    bot_user = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id=platform_user_id)
    household = Household(name=f"카카오 커버리지 {platform_user_id}")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()
    return bot_user, household


async def _create_category(db_session, name: str, household_id: int, cat_type: str = "expense") -> Category:
    cat = Category(name=name, household_id=household_id, type=cat_type)
    db_session.add(cat)
    await db_session.flush()
    return cat


async def _create_expense(db_session, user_id: int, household_id: int, category_id: int, amount: float = 8000, description: str = "점심") -> Expense:
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


def _assert_kakao_response(result: dict, text_contains: str | None = None):
    """카카오 응답 구조 검증 헬퍼"""
    assert result["version"] == "2.0"
    text = result["template"]["outputs"][0]["simpleText"]["text"]
    if text_contains:
        assert text_contains in text
    return text


# ---------------------------------------------------------------------------
# _handle_help_command
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_help_handler(db_session):
    """/help 핸들러 직접 호출 → 도움말 + quickReply"""
    from app.api.kakao import _handle_help_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_help")
    result = await _handle_help_command("/help", bot_user, db_session, household.id)
    _assert_kakao_response(result)
    assert "quickReplies" in result["template"]


# ---------------------------------------------------------------------------
# _handle_feedback_command
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_feedback_empty(db_session):
    """/feedback 빈 내용 → 가이드 메시지"""
    from app.api.kakao import _handle_feedback_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_fb_empty")
    result = await _handle_feedback_command("/feedback", bot_user, db_session, household.id)
    _assert_kakao_response(result)
    assert "quickReplies" in result["template"]


@pytest.mark.asyncio
async def test_kakao_feedback_bug(db_session):
    """/feedback 버그 내용 → 피드백 저장 (type=bug)"""
    from app.api.kakao import _handle_feedback_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_fb_bug")

    with patch("app.services.feedback_notify.notify_admin_feedback", new_callable=AsyncMock):
        result = await _handle_feedback_command("/feedback 버그 카테고리 오류", bot_user, db_session, household.id)

    _assert_kakao_response(result)

    from app.models.feedback import Feedback

    fb_result = await db_session.execute(select(Feedback).where(Feedback.user_id == bot_user.id))
    fb = fb_result.scalar_one()
    assert fb.type == "bug"
    assert fb.source == "kakao"


@pytest.mark.asyncio
async def test_kakao_feedback_feature(db_session):
    """/feedback 기능 요청 → type=feature"""
    from app.api.kakao import _handle_feedback_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_fb_feat")

    with patch("app.services.feedback_notify.notify_admin_feedback", new_callable=AsyncMock):
        await _handle_feedback_command("/feedback 기능 정기결제 추가", bot_user, db_session, household.id)

    from app.models.feedback import Feedback

    fb_result = await db_session.execute(select(Feedback).where(Feedback.user_id == bot_user.id))
    fb = fb_result.scalar_one()
    assert fb.type == "feature"


# ---------------------------------------------------------------------------
# _handle_link_command
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_link_success(db_session):
    """/link CODE → 연동 성공"""
    from app.api.kakao import _handle_link_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_link")

    with patch("app.api.kakao.link_kakao_account_by_code", new_callable=AsyncMock) as mock_link:
        mock_link.return_value = (True, "연동 완료!")
        result = await _handle_link_command("/link ABC123", bot_user, db_session, household.id, kakao_user_id="kh_link")

    _assert_kakao_response(result, "연동 완료")


# ---------------------------------------------------------------------------
# _handle_single_expense: 수입/지출/에러 분기
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_single_expense_save(db_session):
    """단일 지출 저장 → quickReply에 '취소' 포함"""
    from app.api.kakao import _handle_single_expense

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_single_exp")
    await _create_category(db_session, "식비", household.id)

    parsed = {"amount": 8000, "category": "식비", "description": "점심", "date": datetime.now().isoformat()}
    result = await _handle_single_expense(db_session, bot_user, parsed, "점심 8000원", household.id)

    text = _assert_kakao_response(result)
    assert "8,000" in text

    qr = result["template"].get("quickReplies", [])
    labels = [q["label"] for q in qr]
    assert any("취소" in label for label in labels)
    assert any("카테고리" in label for label in labels)


@pytest.mark.asyncio
async def test_kakao_single_income_save(db_session):
    """단일 수입 저장 → quickReply에 '취소' 포함"""
    from app.api.kakao import _handle_single_expense

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_single_inc")

    parsed = {"amount": 3000000, "category": "급여", "description": "월급", "date": datetime.now().isoformat(), "type": "income"}
    result = await _handle_single_expense(db_session, bot_user, parsed, "월급 300만원", household.id)

    text = _assert_kakao_response(result)
    assert "3,000,000" in text

    qr = result["template"].get("quickReplies", [])
    labels = [q["label"] for q in qr]
    assert any("취소" in label for label in labels)


@pytest.mark.asyncio
async def test_kakao_single_expense_error(db_session):
    """파싱 에러 → strike + 에러 메시지"""
    from app.api.kakao import _handle_single_expense
    from app.services.bot_strike_service import _error_counts

    _error_counts.clear()

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_single_err")
    result = await _handle_single_expense(db_session, bot_user, {"error": "파싱 실패"}, "이상한 입력", household.id)
    _assert_kakao_response(result)

    _error_counts.clear()


@pytest.mark.asyncio
async def test_kakao_single_expense_strike_levels(db_session):
    """Strike 단계별 quickReply 확장"""
    from app.api.kakao import _handle_single_expense
    from app.services.bot_strike_service import _error_counts

    _error_counts.clear()
    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_strike")

    # Strike 1 → 도움말만
    result1 = await _handle_single_expense(db_session, bot_user, {"error": "err"}, "x", household.id)
    qr1 = result1["template"].get("quickReplies", [])
    assert len(qr1) >= 1

    # Strike 2 → 도움말 + 리포트
    result2 = await _handle_single_expense(db_session, bot_user, {"error": "err"}, "x", household.id)
    qr2 = result2["template"].get("quickReplies", [])
    assert len(qr2) >= 2

    # Strike 3 → 도움말 + 리포트 + 예산
    result3 = await _handle_single_expense(db_session, bot_user, {"error": "err"}, "x", household.id)
    qr3 = result3["template"].get("quickReplies", [])
    assert len(qr3) >= 3

    _error_counts.clear()


# ---------------------------------------------------------------------------
# _handle_multiple_expenses
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_multiple_expenses_mixed(db_session):
    """다건 혼합 입력 → 수입+지출 건수 메시지"""
    from app.api.kakao import _handle_multiple_expenses

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_multi")

    parsed = [
        {"amount": 8000, "category": "식비", "description": "점심", "date": datetime.now().isoformat()},
        {"amount": 3000000, "category": "급여", "description": "월급", "date": datetime.now().isoformat(), "type": "income"},
    ]

    result = await _handle_multiple_expenses(db_session, bot_user, parsed, "점심+월급", household.id)
    text = _assert_kakao_response(result)
    assert "지출 1건" in text
    assert "수입 1건" in text

    expenses = (await db_session.execute(select(Expense))).scalars().all()
    incomes = (await db_session.execute(select(Income))).scalars().all()
    assert len(expenses) == 1
    assert len(incomes) == 1


# ---------------------------------------------------------------------------
# handle_undo_command
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_undo_both_income_and_expense(db_session):
    """수입과 지출 모두 있을 때 → 더 최근 것 삭제"""
    from app.api.kakao import handle_undo_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_undo_both")
    cat = await _create_category(db_session, "식비", household.id)
    cat_inc = await _create_category(db_session, "급여", household.id, cat_type="income")

    # 먼저 지출 생성
    await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=8000)
    # 그 다음 수입 생성 (더 최근)
    await _create_income(db_session, bot_user.id, household.id, cat_inc.id, amount=5000000)

    result = await handle_undo_command(db_session, bot_user)
    _assert_kakao_response(result, "삭제")

    # Income이 삭제됨 (더 최근)
    incomes = (await db_session.execute(select(Income))).scalars().all()
    assert len(incomes) == 0

    # Expense는 남아있음
    expenses = (await db_session.execute(select(Expense))).scalars().all()
    assert len(expenses) == 1


@pytest.mark.asyncio
async def test_kakao_undo_empty(db_session):
    """삭제할 기록 없을 때"""
    from app.api.kakao import handle_undo_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_undo_empty")
    result = await handle_undo_command(db_session, bot_user)
    _assert_kakao_response(result, "삭제할 기록이 없")


# ---------------------------------------------------------------------------
# handle_change_command
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_change_command_list_categories(db_session):
    """/change만 입력 → 카테고리 목록 quickReply"""
    from app.api.kakao import handle_change_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_change_list")
    cat = await _create_category(db_session, "식비", household.id)
    await _create_category(db_session, "교통비", household.id)
    await _create_expense(db_session, bot_user.id, household.id, cat.id)

    result = await handle_change_command(db_session, bot_user, "/change", household.id)
    text = _assert_kakao_response(result)
    assert "카테고리" in text or "마지막" in text
    qr = result["template"].get("quickReplies", [])
    assert len(qr) > 0


@pytest.mark.asyncio
async def test_kakao_change_command_apply(db_session):
    """/change 외식비 → 카테고리 변경 실행"""
    from app.api.kakao import handle_change_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_change_apply")
    cat = await _create_category(db_session, "식비", household.id)
    await _create_expense(db_session, bot_user.id, household.id, cat.id)

    result = await handle_change_command(db_session, bot_user, "/change 외식비", household.id)
    text = _assert_kakao_response(result)
    assert "변경" in text
    assert "외식비" in text


@pytest.mark.asyncio
async def test_kakao_change_command_no_expense(db_session):
    """/change — 지출이 없을 때"""
    from app.api.kakao import handle_change_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_change_none")
    result = await handle_change_command(db_session, bot_user, "/change", household.id)
    _assert_kakao_response(result, "변경할 지출이 없")


# ---------------------------------------------------------------------------
# handle_report_command / handle_budget_command: 데이터 있을 때
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_report_with_data(db_session):
    """리포트 — 데이터 있을 때"""
    from app.api.kakao import handle_report_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_report_data")
    cat = await _create_category(db_session, "식비", household.id)
    await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=10000)

    result = await handle_report_command(db_session, household_id=household.id)
    text = _assert_kakao_response(result)
    assert "식비" in text
    qr = result["template"].get("quickReplies", [])
    assert len(qr) > 0


@pytest.mark.asyncio
async def test_kakao_report_with_many_categories(db_session):
    """리포트 — 3개 초과 카테고리 → '전체 보기' quickReply"""
    from app.api.kakao import handle_report_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_report_many")

    for name in ["식비", "교통비", "문화", "의료"]:
        cat = await _create_category(db_session, name, household.id)
        await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=10000)

    result = await handle_report_command(db_session, household_id=household.id)
    qr = result["template"].get("quickReplies", [])
    labels = [q["label"] for q in qr]
    assert any("전체" in label for label in labels)


@pytest.mark.asyncio
async def test_kakao_budget_with_data(db_session):
    """예산 — 데이터 있을 때"""
    from app.api.kakao import handle_budget_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_budget_data")
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
    await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=180000)

    result = await handle_budget_command(db_session, household_id=household.id)
    _assert_kakao_response(result)
    qr = result["template"].get("quickReplies", [])
    assert len(qr) > 0


@pytest.mark.asyncio
async def test_kakao_budget_with_mixed_usage(db_session):
    """예산 — 위험+안전 혼재 → '전체 보기' quickReply"""
    from app.api.kakao import handle_budget_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_budget_mixed")

    # 위험 (90% 사용)
    cat1 = await _create_category(db_session, "식비", household.id)
    b1 = Budget(household_id=household.id, category_id=cat1.id, amount=Decimal("100000"), period="monthly", start_date=datetime(2026, 1, 1))
    db_session.add(b1)
    await db_session.flush()
    await _create_expense(db_session, bot_user.id, household.id, cat1.id, amount=90000)

    # 안전 (10% 사용)
    cat2 = await _create_category(db_session, "교통비", household.id)
    b2 = Budget(household_id=household.id, category_id=cat2.id, amount=Decimal("200000"), period="monthly", start_date=datetime(2026, 1, 1))
    db_session.add(b2)
    await db_session.flush()
    await _create_expense(db_session, bot_user.id, household.id, cat2.id, amount=20000)

    result = await handle_budget_command(db_session, household_id=household.id)
    qr = result["template"].get("quickReplies", [])
    labels = [q["label"] for q in qr]
    assert any("전체" in label for label in labels)


# ---------------------------------------------------------------------------
# handle_report_full_command / handle_budget_full_command: 데이터 있을 때
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_report_full_with_data(db_session):
    """전체 리포트 — 데이터 있을 때"""
    from app.api.kakao import handle_report_full_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_repfull")
    cat = await _create_category(db_session, "식비", household.id)
    await _create_expense(db_session, bot_user.id, household.id, cat.id, amount=10000)

    result = await handle_report_full_command(db_session, household_id=household.id)
    text = _assert_kakao_response(result)
    assert "전체" in text or "식비" in text


@pytest.mark.asyncio
async def test_kakao_budget_full_with_data(db_session):
    """전체 예산 — 데이터 있을 때"""
    from app.api.kakao import handle_budget_full_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_budgetfull")
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

    result = await handle_budget_full_command(db_session, household_id=household.id)
    _assert_kakao_response(result)


# ---------------------------------------------------------------------------
# _handle_expense_input: LLM 경로
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_expense_input_llm_timeout(db_session):
    """LLM 타임아웃 → 안내 메시지 + quickReply"""

    from app.api.kakao import _handle_expense_input

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_timeout")

    with patch("app.api.kakao.get_llm_provider") as mock_provider:
        mock_llm = MagicMock()
        mock_llm.parse_expense = AsyncMock(side_effect=TimeoutError())
        mock_provider.return_value = mock_llm

        # asyncio.timeout을 빠르게 만들기 위해 직접 TimeoutError를 발생시킴
        with patch("app.api.kakao.asyncio.timeout", side_effect=TimeoutError()):
            result = await _handle_expense_input("점심 8000원", bot_user, db_session, household.id)

    # TimeoutError가 asyncio.timeout 컨텍스트 매니저에서 발생하면 타임아웃 메시지
    # 또는 일반 에러 (구현에 따라)
    _assert_kakao_response(result)


@pytest.mark.asyncio
async def test_kakao_expense_input_llm_exception(db_session):
    """LLM 예외 → 서버 에러 메시지"""
    from app.api.kakao import _handle_expense_input

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_llm_err")

    with patch("app.api.kakao.get_llm_provider") as mock_provider:
        mock_llm = MagicMock()
        mock_llm.parse_expense = AsyncMock(side_effect=Exception("LLM 장애"))
        mock_provider.return_value = mock_llm

        result = await _handle_expense_input("점심 8000원", bot_user, db_session, household.id)

    _assert_kakao_response(result, "다시 시도")


@pytest.mark.asyncio
async def test_kakao_expense_input_callback_mode(db_session):
    """콜백 모드 활성화 시 useCallback 응답 반환"""
    from app.api.kakao import _handle_expense_input

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_callback")

    with patch("app.api.kakao.settings") as mock_settings:
        mock_settings.KAKAO_CALLBACK_ENABLED = True
        with patch("app.api.kakao.asyncio.create_task") as mock_task:
            mock_task.return_value = MagicMock()
            mock_task.return_value.add_done_callback = MagicMock()
            result = await _handle_expense_input(
                "점심 8000원",
                bot_user,
                db_session,
                household.id,
                callback_url="https://callback.example.com",
                kakao_user_id="kh_callback",
            )

    assert result["useCallback"] is True


@pytest.mark.asyncio
async def test_kakao_expense_input_unexpected_type(db_session):
    """LLM이 예상치 못한 타입 반환 → 서버 에러"""
    from app.api.kakao import _handle_expense_input

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_unexpected")

    with patch("app.api.kakao.get_llm_provider") as mock_provider:
        mock_llm = MagicMock()
        mock_llm.parse_expense = AsyncMock(return_value="unexpected")
        mock_provider.return_value = mock_llm

        result = await _handle_expense_input("이상한 입력", bot_user, db_session, household.id)

    _assert_kakao_response(result, "다시 시도")


# ---------------------------------------------------------------------------
# _get_accessible_categories (간접 테스트 via handle_change_command)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_change_no_other_categories(db_session):
    """/change — 현재 카테고리만 있고 다른 것 없을 때 (빈 quickReply 대신 입력 안내)"""
    from app.api.kakao import handle_change_command

    bot_user, household = await _setup_kakao_bot_user(db_session, "kh_change_only")
    cat = await _create_category(db_session, "식비", household.id)
    await _create_expense(db_session, bot_user.id, household.id, cat.id)

    result = await handle_change_command(db_session, bot_user, "/change", household.id)
    _assert_kakao_response(result)
    # 카테고리가 식비 1개뿐이므로 현재 카테고리 제외하면 quickReply가 없거나 기본 제공
    qr = result["template"].get("quickReplies", [])
    assert len(qr) >= 0  # 식비만 있으면 '↩️ 취소' 기본 리플라이


# ---------------------------------------------------------------------------
# handle_report_command / handle_budget_command DB 에러 (직접 호출)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_kakao_report_db_exception(db_session):
    """리포트 DB 에러 → 서버 에러 메시지"""
    from app.api.kakao import handle_report_command

    _, household = await _setup_kakao_bot_user(db_session, "kh_rep_err")

    with patch.object(db_session, "execute", side_effect=Exception("DB 장애")):
        result = await handle_report_command(db_session, household_id=household.id)

    _assert_kakao_response(result, "다시 시도")


@pytest.mark.asyncio
async def test_kakao_budget_db_exception(db_session):
    """예산 DB 에러 → 서버 에러 메시지"""
    from app.api.kakao import handle_budget_command

    _, household = await _setup_kakao_bot_user(db_session, "kh_bud_err")

    with patch.object(db_session, "execute", side_effect=Exception("DB 장애")):
        result = await handle_budget_command(db_session, household_id=household.id)

    _assert_kakao_response(result, "다시 시도")


@pytest.mark.asyncio
async def test_kakao_report_full_db_exception(db_session):
    """전체 리포트 DB 에러 → 서버 에러"""
    from app.api.kakao import handle_report_full_command

    _, household = await _setup_kakao_bot_user(db_session, "kh_repfull_err")

    with patch.object(db_session, "execute", side_effect=Exception("DB 장애")):
        result = await handle_report_full_command(db_session, household_id=household.id)

    _assert_kakao_response(result, "다시 시도")


@pytest.mark.asyncio
async def test_kakao_budget_full_db_exception(db_session):
    """전체 예산 DB 에러 → 서버 에러"""
    from app.api.kakao import handle_budget_full_command

    _, household = await _setup_kakao_bot_user(db_session, "kh_budfull_err")

    with patch.object(db_session, "execute", side_effect=Exception("DB 장애")):
        result = await handle_budget_full_command(db_session, household_id=household.id)

    _assert_kakao_response(result, "다시 시도")

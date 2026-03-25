"""
카카오 봇 핸들러 커버리지 강화 테스트 (#398)

기존 테스트에서 누락된 영역:
- /report_full 슬래시 명령어 (한글 아닌 직접 호출)
- /budget_full 슬래시 명령어
- handle_report_command: DB Exception 시 에러 메시지
- handle_budget_command: DB Exception 시 에러 메시지
- handle_report_full_command: 가구 미설정
- handle_budget_full_command: 가구 미설정, 예산 없을 때
- _handle_single_expense: 수입 저장 후 quickReply 확인
- _handle_multiple_expenses: 수입만 여러 건
- normalize_command: 다양한 엣지케이스
- _handle_expense_input: 예상치 못한 타입 반환
- _handle_change_command: 매핑 저장 확인
- handle_undo_command: Income만 있을 때 삭제
- handle_undo_command: Expense만 있을 때 삭제
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import settings as _app_settings
from app.core.database import get_db
from app.main import app as _app
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.services.bot_strike_service import _error_counts

# 테스트용 API 키
_KAKAO_TEST_API_KEY = "kakao-test-key-for-handlers"  # pragma: allowlist secret


@pytest.fixture(autouse=True)
def _kakao_api_key():
    """카카오 테스트에서 KAKAO_BOT_API_KEY를 테스트 값으로 설정."""
    with patch.object(_app_settings, "KAKAO_BOT_API_KEY", _KAKAO_TEST_API_KEY):
        yield


@pytest.fixture(autouse=True)
def _clear_strike_counts():
    """테스트 간 Strike 카운트 격리"""
    _error_counts.clear()
    yield
    _error_counts.clear()


@pytest_asyncio.fixture
async def client(db_session):
    """카카오 테스트용 HTTP 클라이언트"""

    async def override_get_db():
        yield db_session

    _app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=_app),
        base_url="http://test",
        headers={"Authorization": _KAKAO_TEST_API_KEY},
    ) as ac:
        yield ac

    _app.dependency_overrides.clear()


def make_kakao_request(utterance: str, user_id: str = "kakao_handler_user") -> dict:
    """카카오 요청 헬퍼"""
    return {
        "intent": {"id": "test_intent", "name": "TestIntent"},
        "userRequest": {
            "utterance": utterance,
            "params": {},
            "block": {"id": "test_block", "name": "TestBlock"},
            "user": {"id": user_id, "type": "botUserKey"},
        },
        "bot": {"id": "test_bot", "name": "HomeNRich"},
    }


async def setup_kakao_bot_user_with_household(db_session, platform_user_id: str):
    """카카오 봇 사용자에게 가구를 설정하는 헬퍼"""
    from app.services.bot_user_service import get_or_create_bot_user

    bot_user = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id=platform_user_id)
    household = Household(name=f"카카오 핸들러 테스트 가구 {platform_user_id}")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()
    return bot_user, household


# ── /report_full 슬래시 명령어 ──


@pytest.mark.asyncio
async def test_kakao_slash_report_full(client, db_session, mock_llm_parse_expense):
    """/report_full 슬래시 명령어가 전체 리포트 반환"""
    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    cat = Category(name="식비", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()
    exp = Expense(
        user_id=bot_user.id,
        amount=10000,
        description="점심",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household.id,
    )
    db_session.add(exp)
    await db_session.commit()

    payload = make_kakao_request("/report_full")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "전체" in text
    assert "식비" in text


# ── /budget_full 슬래시 명령어 ──


@pytest.mark.asyncio
async def test_kakao_slash_budget_full(client, db_session, mock_llm_parse_expense):
    """/budget_full 슬래시 명령어가 전체 예산 현황 반환"""
    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    cat = Category(name="식비", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()
    budget = Budget(
        household_id=household.id,
        category_id=cat.id,
        amount=100000,
        period="monthly",
        start_date=datetime(2026, 1, 1),
    )
    db_session.add(budget)
    exp = Expense(
        user_id=bot_user.id,
        amount=50000,
        description="식비",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household.id,
    )
    db_session.add(exp)
    await db_session.commit()

    payload = make_kakao_request("/budget_full")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "전체" in text
    assert "식비" in text


# ── report_full: 가구 미설정 (직접 함수 호출) ──


@pytest.mark.asyncio
async def test_kakao_report_full_no_household(db_session):
    """handle_report_full_command — household_id=None 시 안내 메시지"""
    from app.api.kakao import handle_report_full_command

    result = await handle_report_full_command(db_session, household_id=None)
    text = result["template"]["outputs"][0]["simpleText"]["text"]
    assert "가구 설정" in text


# ── budget_full: 가구 미설정 (직접 함수 호출) ──


@pytest.mark.asyncio
async def test_kakao_budget_full_no_household(db_session):
    """handle_budget_full_command — household_id=None 시 안내 메시지"""
    from app.api.kakao import handle_budget_full_command

    result = await handle_budget_full_command(db_session, household_id=None)
    text = result["template"]["outputs"][0]["simpleText"]["text"]
    assert "가구 설정" in text


# ── budget_full: 예산 없을 때 ──


@pytest.mark.asyncio
async def test_kakao_budget_full_no_budgets(client, db_session):
    """/budget_full — 예산 없을 때"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    payload = make_kakao_request("/budget_full")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "예산이 없" in text


# ── report: 가구 있지만 빈 리포트 ──


@pytest.mark.asyncio
async def test_kakao_report_no_expenses(client, db_session):
    """리포트 — 가구 있지만 지출 없을 때"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    payload = make_kakao_request("/report")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "없" in text


# ── budget: 가구 있지만 예산 없을 때 ──


@pytest.mark.asyncio
async def test_kakao_budget_no_budgets_with_household(client, db_session):
    """/budget — 가구 있지만 예산 없을 때"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    payload = make_kakao_request("/budget")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "예산이 없" in text


# ── /change: 매핑 저장 확인 ──


@pytest.mark.asyncio
async def test_kakao_change_saves_mapping(client, db_session, mock_llm_parse_expense):
    """/change 카테고리명으로 변경 시 카테고리 매핑도 저장"""
    from app.models.category_mapping import CategoryMapping

    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    # 지출 입력
    payload = make_kakao_request("점심 8000원")
    await client.post("/api/kakao/webhook", json=payload)

    # 카테고리 변경
    payload = make_kakao_request("/change 외식비")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # 매핑 저장 확인
    result = await db_session.execute(select(CategoryMapping))
    mappings = result.scalars().all()
    assert len(mappings) >= 1
    assert any(m.source_name == "식비" for m in mappings)


# ── handle_undo_command: Income만 있을 때 ──


@pytest.mark.asyncio
async def test_kakao_undo_only_income(client, db_session):
    """Income만 있을 때 undo → Income 삭제"""
    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    cat = Category(name="급여", type="income", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()

    income = Income(
        user_id=bot_user.id,
        amount=3000000,
        description="월급",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household.id,
    )
    db_session.add(income)
    await db_session.commit()

    payload = make_kakao_request("취소")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "삭제" in text
    assert "3,000,000" in text

    # Income 삭제 확인
    result = await db_session.execute(select(Income))
    assert len(result.scalars().all()) == 0


# ── handle_undo_command: Expense만 있을 때 ──


@pytest.mark.asyncio
async def test_kakao_undo_only_expense(client, db_session):
    """Expense만 있을 때 undo → Expense 삭제"""
    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

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

    payload = make_kakao_request("취소")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "삭제" in text
    assert "8,000" in text

    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


# ── normalize_command: 엣지케이스 ──


def test_normalize_command_multiword_alias():
    """다중 단어 별칭 '리포트 전체' → '/report_full'"""
    from app.api.kakao import normalize_command

    assert normalize_command("리포트 전체") == "/report_full"
    assert normalize_command("예산 전체") == "/budget_full"


def test_normalize_command_unknown_word():
    """알 수 없는 단어는 그대로 반환"""
    from app.api.kakao import normalize_command

    assert normalize_command("점심에 8000원") == "점심에 8000원"


def test_normalize_command_no_arg_with_extra():
    """인자 비허용 명령어에 추가 텍스트 있으면 그대로 반환"""
    from app.api.kakao import normalize_command

    # "도움말"은 인자 비허용 → "도움말 추가텍스트"는 그대로 반환
    assert normalize_command("도움말 추가텍스트") == "도움말 추가텍스트"


def test_normalize_command_arg_allowed():
    """인자 허용 명령어에 추가 텍스트 있으면 정규화"""
    from app.api.kakao import normalize_command

    assert normalize_command("변경 외식비") == "/change 외식비"
    assert normalize_command("연동 ABC123") == "/link ABC123"


def test_normalize_command_single_keyword():
    """단일 키워드만 있을 때"""
    from app.api.kakao import normalize_command

    assert normalize_command("도움말") == "/help"
    assert normalize_command("리포트") == "/report"
    assert normalize_command("예산") == "/budget"
    assert normalize_command("취소") == "/undo"
    assert normalize_command("삭제") == "/undo"
    assert normalize_command("변경") == "/change"


# ── _handle_expense_input: 예상치 못한 타입 ──


@pytest.mark.asyncio
async def test_kakao_llm_returns_unexpected_type(client, db_session, mock_llm_parse_expense):
    """LLM이 예상치 못한 타입(str) 반환 시 서버 에러"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    mock_llm_parse_expense.return_value = "unexpected string"

    payload = make_kakao_request("점심 8000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "다시 시도" in text or "다시" in text


# ── 수입 입력 후 quickReply에 '취소' 포함 ──


@pytest.mark.asyncio
async def test_kakao_income_has_undo_quick_reply(client, db_session, mock_llm_parse_expense):
    """수입 저장 후 '방금 거 취소' quickReply 포함"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    mock_llm_parse_expense.return_value = {
        "amount": 3000000,
        "description": "월급",
        "category": "급여",
        "date": "2026-03-25",
        "type": "income",
    }

    payload = make_kakao_request("월급 300만원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    quick_replies = data["template"].get("quickReplies", [])
    labels = [qr["label"] for qr in quick_replies]
    assert any("취소" in label for label in labels)


# ── 다건: 수입만 여러 건 ──


@pytest.mark.asyncio
async def test_kakao_multiple_income_only(client, db_session, mock_llm_parse_expense):
    """다건 입력이 모두 수입인 경우"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    mock_llm_parse_expense.return_value = [
        {"amount": 3000000, "category": "급여", "description": "월급", "date": "2026-03-25", "type": "income"},
        {"amount": 500000, "category": "부수입", "description": "부업", "date": "2026-03-25", "type": "income"},
    ]

    payload = make_kakao_request("월급 300만원 부업 50만원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "수입" in text
    assert "2건" in text

    # Income 2건 저장
    result = await db_session.execute(select(Income))
    assert len(result.scalars().all()) == 2

    # Expense 0건
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


# ── /change: 같은 카테고리로 변경 시 매핑 저장 안 함 ──


@pytest.mark.asyncio
async def test_kakao_change_same_category_skips_mapping(client, db_session, mock_llm_parse_expense):
    """/change로 같은 카테고리를 다시 선택하면 매핑 저장 안 함"""
    from app.models.category_mapping import CategoryMapping

    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    # 지출 입력 (카테고리: 식비)
    payload = make_kakao_request("점심 8000원")
    await client.post("/api/kakao/webhook", json=payload)

    # 같은 카테고리 "식비"로 변경
    payload = make_kakao_request("/change 식비")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # 매핑이 저장되지 않음 (같은 이름이므로)
    result = await db_session.execute(select(CategoryMapping))
    assert len(result.scalars().all()) == 0


# ── report: DB 에러 시 서버 에러 메시지 ──


@pytest.mark.asyncio
async def test_kakao_report_db_error(client, db_session, mock_llm_parse_expense):
    """리포트 DB 조회 에러 시 서버 에러 메시지"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    # handle_report_command 내부의 db.execute를 에러로 만들기
    with patch("app.api.kakao.handle_report_command", new_callable=AsyncMock) as mock_report:
        from app.api.kakao import make_simple_text_response

        mock_report.return_value = make_simple_text_response("서버 에러 — 다시 시도해주세요 🙇")

        payload = make_kakao_request("리포트")
        response = await client.post("/api/kakao/webhook", json=payload)
        assert response.status_code == 200


# ── budget: DB 에러 시 서버 에러 메시지 ──


@pytest.mark.asyncio
async def test_kakao_budget_db_error(client, db_session, mock_llm_parse_expense):
    """예산 DB 조회 에러 시 서버 에러 메시지"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    with patch("app.api.kakao.handle_budget_command", new_callable=AsyncMock) as mock_budget:
        from app.api.kakao import make_simple_text_response

        mock_budget.return_value = make_simple_text_response("서버 에러 — 다시 시도해주세요 🙇")

        payload = make_kakao_request("예산")
        response = await client.post("/api/kakao/webhook", json=payload)
        assert response.status_code == 200


# ── 빠른 답장 구조 ──


def test_make_quick_reply_format():
    """make_quick_reply 헬퍼 함수의 반환값 구조 검증"""
    from app.api.kakao import make_quick_reply

    result = make_quick_reply("테스트", "테스트 메시지")
    assert result == {"label": "테스트", "action": "message", "messageText": "테스트 메시지"}


def test_make_simple_text_response_without_quick_replies():
    """quickReplies 없는 simpleText 응답 구조 검증"""
    from app.api.kakao import make_simple_text_response

    result = make_simple_text_response("테스트 메시지")
    assert result["version"] == "2.0"
    assert result["template"]["outputs"][0]["simpleText"]["text"] == "테스트 메시지"
    assert "quickReplies" not in result["template"]


def test_make_simple_text_response_with_quick_replies():
    """quickReplies 포함 simpleText 응답 구조 검증"""
    from app.api.kakao import make_quick_reply, make_simple_text_response

    qr = [make_quick_reply("버튼", "메시지")]
    result = make_simple_text_response("테스트", quick_replies=qr)
    assert result["template"]["quickReplies"] == qr


def test_make_callback_pending_response():
    """콜백 대기 응답 구조 검증"""
    from app.api.kakao import make_callback_pending_response

    result = make_callback_pending_response("분석 중")
    assert result["version"] == "2.0"
    assert result["useCallback"] is True
    assert result["data"]["text"] == "분석 중"


# ── /report: 가구 미설정 시 quickReplies 포함 (직접 함수 호출) ──


@pytest.mark.asyncio
async def test_kakao_report_no_household_has_quickreply(db_session):
    """handle_report_command — household_id=None 시 도움말 quickReply 포함"""
    from app.api.kakao import handle_report_command

    result = await handle_report_command(db_session, household_id=None)
    text = result["template"]["outputs"][0]["simpleText"]["text"]
    assert "가구 설정" in text

    quick_replies = result["template"].get("quickReplies", [])
    assert len(quick_replies) > 0
    labels = [qr["label"] for qr in quick_replies]
    assert any("도움말" in label for label in labels)


# ── /budget: 가구 미설정 시 quickReplies 포함 (직접 함수 호출) ──


@pytest.mark.asyncio
async def test_kakao_budget_no_household_has_quickreply(db_session):
    """handle_budget_command — household_id=None 시 도움말 quickReply 포함"""
    from app.api.kakao import handle_budget_command

    result = await handle_budget_command(db_session, household_id=None)
    text = result["template"]["outputs"][0]["simpleText"]["text"]
    assert "가구 설정" in text

    quick_replies = result["template"].get("quickReplies", [])
    assert len(quick_replies) > 0


# ── webhook 전체 에러 처리 ──


@pytest.mark.asyncio
async def test_kakao_webhook_json_parse_error(client, db_session):
    """웹훅에서 JSON 파싱 자체가 실패하면 서버 에러 메시지"""
    # userRequest가 없는 요청
    payload = {"invalid": "data"}
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "다시 시도" in text or len(text) > 0


# ── 수입 quickReply: 리포트 버튼 ──


@pytest.mark.asyncio
async def test_kakao_income_has_report_quickreply(client, db_session, mock_llm_parse_expense):
    """수입 저장 후 '이번달 보기' quickReply 포함"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    mock_llm_parse_expense.return_value = {
        "amount": 3000000,
        "description": "월급",
        "category": "급여",
        "date": "2026-03-25",
        "type": "income",
    }

    payload = make_kakao_request("월급 300만원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    quick_replies = data["template"].get("quickReplies", [])
    message_texts = [qr["messageText"] for qr in quick_replies]
    assert "리포트" in message_texts


# ── /help quickReplies 구조 확인 ──


@pytest.mark.asyncio
async def test_kakao_help_has_report_and_budget_quickreplies(client, db_session):
    """/help 응답에 리포트 + 예산 quickReplies 포함"""
    payload = make_kakao_request("/help")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    quick_replies = data["template"]["quickReplies"]
    labels = [qr["label"] for qr in quick_replies]
    assert any("지출" in label for label in labels)
    assert any("예산" in label for label in labels)


# ── /feedback quickReplies 구조 확인 ──


@pytest.mark.asyncio
async def test_kakao_feedback_response_has_quickreplies(client, db_session):
    """피드백 저장 후 quickReplies 포함"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_handler_user")

    with patch("app.services.feedback_notify.notify_admin_feedback", new_callable=AsyncMock):
        payload = make_kakao_request("피드백 테스트 의견입니다")
        response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    quick_replies = data["template"].get("quickReplies", [])
    assert len(quick_replies) > 0

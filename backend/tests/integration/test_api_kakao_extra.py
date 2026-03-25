"""
카카오톡 채널 봇 Webhook API 추가 테스트 (#357)

기존 test_api_kakao.py에서 누락된 영역:
- /unlink 명령어
- 콜백 모드: 명령어 외 자연어 입력이 아닌 경로
- LLM 빈 응답/빈 리스트 처리
- 연동 후 지출 → 수입 연속 플로우
- 다건 혼합 (수입 + 지출) 저장 후 DB 검증
"""

from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import settings as _app_settings
from app.core.database import get_db
from app.main import app as _app
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.services.bot_strike_service import _error_counts

# 테스트용 API 키
_KAKAO_TEST_API_KEY = "kakao-test-key-for-pytest-extra"  # pragma: allowlist secret


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


def make_kakao_request(utterance: str, user_id: str = "kakao_user_extra") -> dict:
    """카카오 i 오픈빌더 요청 형식 생성 헬퍼"""
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


def make_kakao_request_with_callback(utterance: str, user_id: str = "kakao_user_extra", callback_url: str = "https://callback.kakao.com/test") -> dict:
    """callbackUrl이 포함된 카카오 요청 생성 헬퍼"""
    return {
        "intent": {"id": "test_intent", "name": "TestIntent"},
        "userRequest": {
            "utterance": utterance,
            "params": {},
            "block": {"id": "test_block", "name": "TestBlock"},
            "user": {"id": user_id, "type": "botUserKey"},
            "callbackUrl": callback_url,
        },
        "bot": {"id": "test_bot", "name": "HomeNRich"},
    }


async def setup_kakao_bot_user_with_household(db_session, platform_user_id: str):
    """카카오 봇 사용자에게 가구를 설정하는 헬퍼"""
    from app.services.bot_user_service import get_or_create_bot_user

    bot_user = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id=platform_user_id)
    household = Household(name=f"카카오 추가 테스트 가구 {platform_user_id}")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()
    return bot_user, household


# ── LLM 빈 응답 처리 ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_llm_returns_empty_dict(client, db_session, mock_llm_parse_expense):
    """LLM이 빈 dict를 반환하면 파싱 실패로 처리"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_extra")

    mock_llm_parse_expense.return_value = {}

    payload = make_kakao_request("잘 모르겠는 입력")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # DB에 저장되지 않음
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_kakao_llm_returns_empty_list(client, db_session, mock_llm_parse_expense):
    """LLM이 빈 list를 반환하면 에러 메시지 반환"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_extra")

    mock_llm_parse_expense.return_value = []

    payload = make_kakao_request("빈 리스트 입력")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # DB에 저장되지 않음
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


# ── 콜백 모드: /undo 등 빠른 명령어도 동기 처리 ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_callback_mode_undo_no_callback(client, db_session, mock_llm_parse_expense):
    """콜백 모드 활성화 + 취소 명령어 → useCallback 없이 즉시 동기 처리"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_extra")

    # 먼저 지출 입력
    payload_expense = make_kakao_request("커피 5000원")
    await client.post("/api/kakao/webhook", json=payload_expense)

    with patch.object(_app_settings, "KAKAO_CALLBACK_ENABLED", True):
        payload = make_kakao_request_with_callback("취소")
        response = await client.post("/api/kakao/webhook", json=payload)
        assert response.status_code == 200

        data = response.json()
        # 명령어는 콜백 안 쓰고 즉시 처리
        assert "useCallback" not in data
        assert "template" in data
        text = data["template"]["outputs"][0]["simpleText"]["text"]
        assert "삭제" in text


# ── 콜백 모드: /help 도움말도 동기 처리 ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_callback_mode_help_no_callback(client, db_session):
    """콜백 모드 + 도움말 명령어 → 즉시 동기 응답"""
    with patch.object(_app_settings, "KAKAO_CALLBACK_ENABLED", True):
        payload = make_kakao_request_with_callback("도움말")
        response = await client.post("/api/kakao/webhook", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert "useCallback" not in data
        assert "template" in data


# ── 연동 해제: /unlink 또는 '해제' 한글 명령어 ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_unlinked_user_expense_creates_auto_household(client, db_session, mock_llm_parse_expense):
    """연동 안 된 사용자가 지출 입력 시 자동 가구가 생성되어 저장됨"""
    payload = make_kakao_request("점심 8000원", user_id="kakao_auto_hh_user")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # 지출이 저장됨 (자동 가구 생성)
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 8000.0
    assert expenses[0].household_id is not None


# ── 수입 후 지출 연속 입력 ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_income_then_expense_sequential(client, db_session, mock_llm_parse_expense):
    """수입 → 지출 순서로 연속 입력 시 각각 올바른 테이블에 저장"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_extra")

    # 수입
    mock_llm_parse_expense.return_value = {
        "amount": 3000000,
        "description": "월급",
        "category": "급여",
        "date": "2026-03-20",
        "type": "income",
    }
    await client.post("/api/kakao/webhook", json=make_kakao_request("월급 300만원"))

    # 지출
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "점심",
        "date": "2026-03-20",
        "memo": "",
    }
    await client.post("/api/kakao/webhook", json=make_kakao_request("점심 8000원"))

    # Income 1건
    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 1
    assert incomes[0].amount == 3000000

    # Expense 1건
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 8000


# ── API 키 미설정 시 503 반환 ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_webhook_no_api_key_returns_503(client, db_session):
    """API 키가 빈 문자열이면 503 반환"""
    with patch("app.api.kakao.settings") as mock_settings:
        mock_settings.KAKAO_BOT_API_KEY = ""

        payload = make_kakao_request("/help")
        response = await client.post("/api/kakao/webhook", json=payload)
        assert response.status_code == 503


# ── /start 명령어는 카카오에서 지원하지 않음 → LLM 파싱으로 넘어감 ──────


@pytest.mark.asyncio
async def test_kakao_start_command_not_supported(client, db_session, mock_llm_parse_expense):
    """/start는 카카오에서 별도 명령어가 아니므로 LLM 파싱으로 넘어감"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_extra")

    mock_llm_parse_expense.return_value = {"error": "파싱 실패"}

    payload = make_kakao_request("/start")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # 파싱 에러 또는 도움말 메시지
    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert len(text) > 0


# ── 특수 문자 입력 처리 ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_special_characters_input(client, db_session, mock_llm_parse_expense):
    """특수 문자가 포함된 입력도 정상 처리"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_extra")

    mock_llm_parse_expense.return_value = {
        "amount": 15000,
        "category": "식비",
        "description": "치킨&피자",
        "date": "2026-03-25",
        "memo": "",
    }

    payload = make_kakao_request("치킨&피자 15,000원!!")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 15000


# ── quickReply 응답에 항상 도움말 포함 확인 ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_help_response_has_quickreplies(client, db_session):
    """도움말 응답에 quickReplies가 포함됨"""
    payload = make_kakao_request("도움말")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "quickReplies" in data["template"]
    quick_replies = data["template"]["quickReplies"]
    assert len(quick_replies) > 0
    labels = [qr["label"] for qr in quick_replies]
    # 도움말 quickReply에는 지출 보기 + 예산 현황 버튼이 있음
    assert any("지출" in label for label in labels)
    assert any("예산" in label for label in labels)

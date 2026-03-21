"""
카카오톡 채널 봇 Webhook API 통합 테스트

- /help, /report, /budget 명령어 응답
- /link 명령어 (웹 계정 연동)
- LLM 파싱 → 지출 저장 플로우 (Mock)
- 에러 처리 (파싱 실패, utterance 없음)
- 카카오 응답 형식 검증
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

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
from app.models.user import User
from app.services.bot_strike_service import _error_counts

# 테스트용 API 키 (실제 운영 키와 완전히 다른 값)
_KAKAO_TEST_API_KEY = "kakao-test-key-for-pytest"  # pragma: allowlist secret


@pytest.fixture(autouse=True)
def _kakao_api_key():
    """모든 카카오 테스트에서 KAKAO_BOT_API_KEY를 테스트 값으로 설정.

    #131 보안 패치: API 키 미설정 시 503을 반환하므로 테스트 환경에서도 설정 필요.
    """
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
    """카카오 테스트용 HTTP 클라이언트 (Authorization 헤더 자동 포함).

    #131 보안 패치: API 키 검증이 필수화되었으므로 모든 요청에 올바른 키를 전송.
    기존 보안 테스트는 patch("app.api.kakao.settings")로 키를 직접 제어하므로 영향 없음.
    """

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


def make_kakao_request(utterance: str, user_id: str = "kakao_user_123") -> dict:
    """카카오 i 오픈빌더 요청 형식 생성 헬퍼

    Args:
        utterance: 사용자가 입력한 텍스트
        user_id: 카카오 사용자 ID

    Returns:
        카카오 요청 페이로드
    """
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
    household = Household(name=f"카카오 테스트 가구 {platform_user_id}")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=bot_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()
    return bot_user, household


@pytest.mark.asyncio
async def test_kakao_webhook_help_command(client, db_session):
    """/help 명령어 시 도움말 메시지 반환"""
    payload = make_kakao_request("/help")

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["version"] == "2.0"
    assert "template" in data
    assert "outputs" in data["template"]
    assert len(data["template"]["outputs"]) > 0

    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "사용" in text or "도움말" in text or "가이드" in text

    # quickReplies 확인
    assert "quickReplies" in data["template"]
    quick_replies = data["template"]["quickReplies"]
    assert len(quick_replies) > 0


@pytest.mark.asyncio
async def test_kakao_webhook_expense_input(client, db_session, mock_llm_parse_expense):
    """자연어 지출 입력 → LLM 파싱 → DB 저장 → 성공 응답"""
    # 봇 사용자에게 가구 설정 (household_id 필수)
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    payload = make_kakao_request("점심에 김치찌개 8000원")

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # DB에 지출이 저장되었는지 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 8000.0
    assert expenses[0].raw_input == "점심에 김치찌개 8000원"

    # user_id가 설정되어 있는지 확인
    assert expenses[0].user_id is not None

    # 성공 응답 검증
    data = response.json()
    assert data["version"] == "2.0"
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "8,000" in text or "기록" in text


@pytest.mark.asyncio
async def test_kakao_webhook_parse_error(client, db_session, mock_llm_parse_expense):
    """LLM 파싱 실패 시 에러 메시지 반환"""
    mock_llm_parse_expense.return_value = {"error": "금액을 찾을 수 없습니다"}

    payload = make_kakao_request("아무말이나")

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # DB에 저장되지 않음
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0

    # 에러 메시지 검증 (Strike 1 기본 안내)
    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "금액을 찾지 못했어요" in text


@pytest.mark.asyncio
async def test_kakao_webhook_report_command(client, db_session, mock_llm_parse_expense):
    """/report 명령어 시 지출 요약 반환"""
    # 먼저 봇 사용자에게 가구 설정 후 지출을 하나 생성
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")
    payload1 = make_kakao_request("점심 5000원")
    await client.post("/api/kakao/webhook", json=payload1)

    # /report 실행
    payload2 = make_kakao_request("/report")
    response = await client.post("/api/kakao/webhook", json=payload2)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "지출 리포트" in text or "총 지출" in text


@pytest.mark.asyncio
async def test_kakao_webhook_budget_command(client, db_session):
    """/budget 명령어 시 예산 현황 반환"""
    payload = make_kakao_request("/budget")

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "예산 현황" in text or "예산이 없" in text


@pytest.mark.asyncio
async def test_kakao_webhook_no_utterance(client, db_session):
    """utterance가 없으면 에러 응답"""
    payload = {
        "intent": {"id": "test_intent", "name": "TestIntent"},
        "userRequest": {
            "utterance": "",  # 빈 문자열
            "params": {},
            "block": {"id": "test_block", "name": "TestBlock"},
            "user": {"id": "kakao_user_123", "type": "botUserKey"},
        },
        "bot": {"id": "test_bot", "name": "HomeNRich"},
    }

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "메시지" in text or "입력" in text


@pytest.mark.asyncio
async def test_kakao_webhook_response_format(client, db_session, mock_llm_parse_expense):
    """카카오 응답 형식 (version, template, outputs) 검증"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")
    payload = make_kakao_request("커피 4500원")

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()

    # 필수 필드 검증
    assert "version" in data
    assert data["version"] == "2.0"
    assert "template" in data
    assert "outputs" in data["template"]
    assert len(data["template"]["outputs"]) > 0

    # simpleText 형식 검증
    output = data["template"]["outputs"][0]
    assert "simpleText" in output
    assert "text" in output["simpleText"]
    assert isinstance(output["simpleText"]["text"], str)


@pytest.mark.asyncio
async def test_kakao_webhook_expense_with_quick_replies(client, db_session, mock_llm_parse_expense):
    """지출 저장 성공 시 quickReplies 포함 여부 검증"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")
    payload = make_kakao_request("택시비 15000원")

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()

    # quickReplies 존재 확인
    assert "quickReplies" in data["template"]
    quick_replies = data["template"]["quickReplies"]
    assert len(quick_replies) > 0

    # quickReply 구조 검증
    first_reply = quick_replies[0]
    assert "label" in first_reply
    assert "action" in first_reply
    assert "messageText" in first_reply
    assert first_reply["action"] == "message"


@pytest.mark.asyncio
async def test_kakao_webhook_multiple_expenses(client, db_session, mock_llm_parse_expense):
    """여러 지출 동시 입력 처리 (list 반환)"""
    # 봇 사용자에게 가구 설정
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    # LLM이 여러 지출을 파싱한 경우
    mock_llm_parse_expense.return_value = [
        {"amount": 5000, "category": "식비", "description": "점심", "date": "2026-02-11", "memo": ""},
        {"amount": 4500, "category": "식비", "description": "커피", "date": "2026-02-11", "memo": ""},
    ]

    payload = make_kakao_request("점심 5천원, 커피 4500원")

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # DB에 2건의 지출이 저장되었는지 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 2

    # 응답 메시지 검증
    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "2건" in text or "총" in text


@pytest.mark.asyncio
async def test_kakao_webhook_user_isolation(client, db_session, mock_llm_parse_expense):
    """서로 다른 Kakao 사용자는 데이터가 격리되어야 함"""
    # 두 사용자 모두 가구 설정
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_111")

    # 사용자 1의 지출 생성
    payload1 = make_kakao_request("점심 5000원", user_id="kakao_user_111")
    response1 = await client.post("/api/kakao/webhook", json=payload1)
    assert response1.status_code == 200

    # 사용자 2의 지출 생성
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_222")
    mock_llm_parse_expense.return_value = {
        "amount": 10000,
        "category": "교통",
        "description": "택시",
        "date": "2026-02-11",
        "memo": "",
    }
    payload2 = make_kakao_request("택시 10000원", user_id="kakao_user_222")
    response2 = await client.post("/api/kakao/webhook", json=payload2)
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
    assert "kakao_kakao_user_111" in usernames
    assert "kakao_kakao_user_222" in usernames


@pytest.mark.asyncio
async def test_kakao_webhook_same_user_reuses_account(client, db_session, mock_llm_parse_expense):
    """동일한 Kakao 사용자는 같은 User 계정을 재사용해야 함"""
    kakao_user_id = "kakao_user_333"

    # 봇 사용자에게 가구 설정
    await setup_kakao_bot_user_with_household(db_session, kakao_user_id)

    # 첫 번째 지출
    payload1 = make_kakao_request("점심 5000원", user_id=kakao_user_id)
    await client.post("/api/kakao/webhook", json=payload1)

    # 두 번째 지출
    mock_llm_parse_expense.return_value = {
        "amount": 3000,
        "category": "식비",
        "description": "커피",
        "date": "2026-02-11",
        "memo": "",
    }
    payload2 = make_kakao_request("커피 3000원", user_id=kakao_user_id)
    await client.post("/api/kakao/webhook", json=payload2)

    # User는 하나만 생성되어야 함
    user_result = await db_session.execute(select(User))
    users = user_result.scalars().all()
    assert len(users) == 1
    assert users[0].username == f"kakao_{kakao_user_id}"

    # Expense는 두 개, 모두 같은 user_id
    expense_result = await db_session.execute(select(Expense))
    expenses = expense_result.scalars().all()
    assert len(expenses) == 2
    assert expenses[0].user_id == expenses[1].user_id
    assert expenses[0].user_id == users[0].id


# ──────────────────────────────────────────────
# Webhook 보안 테스트
# ──────────────────────────────────────────────


# ──────────────────────────────────────────────
# Household 컨텍스트 통합 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_kakao_webhook_expense_with_household(client, db_session, mock_llm_parse_expense):
    """가구에 속한 사용자의 공유 키워드 지출 — 자동 생성된 기본 가구에 저장"""
    from app.services.bot_user_service import get_or_create_bot_user

    # 봇 사용자 생성 (기본 가구 자동 생성됨)
    bot_user = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id="kakao_hh_111", auto_create_household=True)
    await db_session.commit()

    # 자동 생성된 가구 ID 조회
    result = await db_session.execute(select(HouseholdMember.household_id).where(HouseholdMember.user_id == bot_user.id))
    auto_household_id = result.scalar_one()

    payload = make_kakao_request("우리 저녁 50000원", user_id="kakao_hh_111")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].household_id == auto_household_id


@pytest.mark.asyncio
async def test_kakao_webhook_personal_keyword_no_household(client, db_session, mock_llm_parse_expense):
    """개인 키워드여도 household_id는 활성 가구로 설정됨 (household_id 필수)"""
    from app.services.bot_user_service import get_or_create_bot_user

    # 봇 사용자 생성 (기본 가구 자동 생성됨)
    bot_user = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id="kakao_hh_222", auto_create_household=True)
    await db_session.commit()

    # 자동 생성된 가구 ID 조회
    result = await db_session.execute(select(HouseholdMember.household_id).where(HouseholdMember.user_id == bot_user.id))
    auto_household_id = result.scalar_one()

    payload = make_kakao_request("내 커피 5000원", user_id="kakao_hh_222")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    # household_id는 필수 — 개인 키워드여도 활성 가구로 설정됨
    assert expenses[0].household_id == auto_household_id


# ──────────────────────────────────────────────
# Webhook 보안 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_kakao_webhook_rejects_invalid_api_key(client, db_session):
    """API 키가 설정된 경우, 잘못된 키는 403 반환"""
    with patch("app.api.kakao.settings") as mock_settings:
        mock_settings.KAKAO_BOT_API_KEY = "valid-api-key"  # pragma: allowlist secret

        payload = make_kakao_request("/help")

        # 키 없이 요청
        response = await client.post("/api/kakao/webhook", json=payload)
        assert response.status_code == 403

        # 잘못된 키로 요청
        response = await client.post(
            "/api/kakao/webhook",
            json=payload,
            headers={"Authorization": "wrong-key"},
        )
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_kakao_webhook_accepts_valid_api_key(client, db_session):
    """API 키가 설정된 경우, 올바른 키는 통과"""
    with patch("app.api.kakao.settings") as mock_settings:
        mock_settings.KAKAO_BOT_API_KEY = "valid-api-key"  # pragma: allowlist secret

        payload = make_kakao_request("/help")

        response = await client.post(
            "/api/kakao/webhook",
            json=payload,
            headers={"Authorization": "valid-api-key"},
        )
        assert response.status_code == 200


# ──────────────────────────────────────────────
# 타임아웃 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_kakao_webhook_llm_timeout(client, db_session, mock_llm_parse_expense):
    """LLM 파싱이 4.5초 초과 시 타임아웃 안내 메시지 반환"""
    import asyncio

    async def slow_parse(_):
        await asyncio.sleep(10)
        return {"amount": 8000, "category": "식비", "description": "김치찌개", "date": "2026-02-14", "memo": ""}

    mock_llm_parse_expense.side_effect = slow_parse

    payload = make_kakao_request("점심 8000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "시간" in text or "다시" in text

    # DB에 저장되지 않아야 함
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


# ──────────────────────────────────────────────
# /link 명령어 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_kakao_webhook_link_without_code(client, db_session):
    """/link 코드 없이 입력하면 사용법 안내 반환"""
    payload = make_kakao_request("/link")

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "카카오톡" in text and "연동" in text


@pytest.mark.asyncio
async def test_kakao_webhook_link_invalid_code(client, db_session):
    """/link 유효하지 않은 코드는 에러 메시지 반환"""
    payload = make_kakao_request("/link INVALID")

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "유효하지 않은" in text


@pytest.mark.asyncio
async def test_kakao_webhook_link_valid_code(client, db_session):
    """/link 유효한 코드로 연동 성공"""
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # 웹 사용자 생성 + 코드 발급
    web_user = User(
        username="web_user_kakao",
        email="kakao@test.com",
        hashed_password=pwd_context.hash("test"),
        is_active=True,
        kakao_link_code="ABC123",
        kakao_link_code_expires_at=datetime.now(UTC) + timedelta(minutes=15),
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

    payload = make_kakao_request("/link ABC123", user_id="kakao_linker_001")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "연동 완료" in text

    # DB에서 연동 확인
    await db_session.refresh(web_user)
    assert web_user.kakao_user_id == "kakao_linker_001"
    assert web_user.kakao_link_code is None


@pytest.mark.asyncio
async def test_kakao_webhook_link_expired_code(client, db_session):
    """/link 만료된 코드는 만료 메시지 반환"""
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    web_user = User(
        username="web_user_kakao_exp",
        email="kakao_exp@test.com",
        hashed_password=pwd_context.hash("test"),
        is_active=True,
        kakao_link_code="EXP123",
        kakao_link_code_expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    db_session.add(web_user)
    await db_session.commit()

    payload = make_kakao_request("/link EXP123", user_id="kakao_linker_002")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "만료" in text


# ──────────────────────────────────────────────
# /undo 명령어 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_kakao_webhook_undo_deletes_last_expense(client, db_session, mock_llm_parse_expense):
    """/undo 명령어로 마지막 지출이 삭제됨"""
    # 먼저 지출 입력
    payload = make_kakao_request("점심 8000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # 지출이 저장됐는지 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1

    # /undo로 삭제
    payload = make_kakao_request("/undo")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "삭제" in text
    assert "8,000" in text

    # quickReply 검증
    qr = data["template"].get("quickReplies", [])
    message_texts = [r["messageText"] for r in qr]
    assert "리포트" in message_texts
    assert "도움말" in message_texts

    # DB에서 삭제 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 0


@pytest.mark.asyncio
async def test_kakao_webhook_undo_no_expenses(client, db_session):
    """/undo 기록이 없으면 안내 메시지 반환"""
    payload = make_kakao_request("/undo")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "삭제할 기록이 없어요" in text


@pytest.mark.asyncio
async def test_kakao_webhook_expense_has_undo_quick_reply(client, db_session, mock_llm_parse_expense):
    """지출 저장 후 '방금 거 취소' 빠른 답장 버튼이 포함됨"""
    payload = make_kakao_request("커피 5000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    quick_replies = data["template"].get("quickReplies", [])
    labels = [qr["label"] for qr in quick_replies]
    assert any("취소" in label for label in labels)


# ──────────────────────────────────────────────
# /change 명령어 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_kakao_webhook_change_shows_categories(client, db_session, mock_llm_parse_expense):
    """/change 입력 시 카테고리 목록이 quickReply로 표시됨"""
    # 먼저 지출 입력
    payload = make_kakao_request("점심 8000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # /change로 카테고리 목록 요청
    payload = make_kakao_request("/change")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "8,000" in text
    assert "카테고리" in text


@pytest.mark.asyncio
async def test_kakao_webhook_change_category(client, db_session, mock_llm_parse_expense):
    """/change 카테고리명으로 마지막 지출의 카테고리가 변경됨"""
    # 먼저 지출 입력 (카테고리: 식비)
    payload = make_kakao_request("점심 8000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # 카테고리 변경
    payload = make_kakao_request("/change 외식비")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "변경" in text
    assert "외식비" in text

    # DB에서 카테고리 변경 확인
    from app.models.category import Category

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    cat_result = await db_session.execute(select(Category).where(Category.id == expense.category_id))
    category = cat_result.scalar_one()
    assert category.name == "외식비"


@pytest.mark.asyncio
async def test_kakao_webhook_change_no_expenses(client, db_session):
    """/change 지출이 없으면 안내 메시지 반환"""
    payload = make_kakao_request("/change")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "없" in text


@pytest.mark.asyncio
async def test_kakao_webhook_expense_has_change_quick_reply(client, db_session, mock_llm_parse_expense):
    """지출 저장 후 '카테고리 변경' quickReply 포함됨"""
    payload = make_kakao_request("커피 5000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    quick_replies = data["template"].get("quickReplies", [])
    labels = [qr["label"] for qr in quick_replies]
    assert any("카테고리" in label for label in labels)


# ──────────────────────────────────────────────
# 한글 명령어 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_kakao_korean_command_help(client, db_session):
    """'도움말' 한글 명령어가 /help과 동일하게 동작"""
    payload = make_kakao_request("도움말")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "사용" in text or "도움말" in text or "가이드" in text
    assert "quickReplies" in data["template"]


@pytest.mark.asyncio
async def test_kakao_korean_command_help_alias(client, db_session):
    """'도움' 한글 명령어도 /help과 동일하게 동작"""
    payload = make_kakao_request("도움")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "사용" in text or "도움말" in text or "가이드" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_report(client, db_session, mock_llm_parse_expense):
    """'리포트' 한글 명령어가 /report와 동일하게 동작"""
    payload = make_kakao_request("리포트")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "지출 리포트" in text or "총 지출" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_report_alias(client, db_session, mock_llm_parse_expense):
    """'요약' 한글 명령어가 /report와 동일하게 동작"""
    payload = make_kakao_request("요약")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "지출 리포트" in text or "총 지출" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_budget(client, db_session):
    """'예산' 한글 명령어가 /budget과 동일하게 동작"""
    payload = make_kakao_request("예산")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "예산 현황" in text or "예산이 없" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_undo(client, db_session, mock_llm_parse_expense):
    """'취소' 한글 명령어가 /undo와 동일하게 동작"""
    # 먼저 지출 입력
    payload = make_kakao_request("점심 8000원")
    await client.post("/api/kakao/webhook", json=payload)

    # 한글 '취소'로 삭제
    payload = make_kakao_request("취소")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "삭제" in text

    # DB에서 삭제 확인
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_kakao_korean_command_undo_alias(client, db_session, mock_llm_parse_expense):
    """'삭제' 한글 명령어가 /undo와 동일하게 동작"""
    payload = make_kakao_request("점심 8000원")
    await client.post("/api/kakao/webhook", json=payload)

    payload = make_kakao_request("삭제")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "삭제" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_change_shows_categories(client, db_session, mock_llm_parse_expense):
    """'변경' 한글 명령어가 /change와 동일하게 카테고리 목록 표시"""
    payload = make_kakao_request("점심 8000원")
    await client.post("/api/kakao/webhook", json=payload)

    payload = make_kakao_request("변경")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "8,000" in text
    assert "카테고리" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_change_with_category(client, db_session, mock_llm_parse_expense):
    """'변경 외식비' 한글 명령어가 /change 외식비와 동일하게 카테고리 변경"""
    payload = make_kakao_request("점심 8000원")
    await client.post("/api/kakao/webhook", json=payload)

    payload = make_kakao_request("변경 외식비")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "변경" in text
    assert "외식비" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_change_alias(client, db_session, mock_llm_parse_expense):
    """'바꿔' 한글 명령어가 /change와 동일하게 동작"""
    payload = make_kakao_request("점심 8000원")
    await client.post("/api/kakao/webhook", json=payload)

    payload = make_kakao_request("바꿔")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "8,000" in text
    assert "카테고리" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_link_without_code(client, db_session):
    """'연동' 한글 명령어가 /link과 동일하게 사용법 안내"""
    payload = make_kakao_request("연동")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "카카오톡" in text and "연동" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_link_with_code(client, db_session):
    """'연동 코드' 한글 명령어가 /link 코드와 동일하게 동작"""
    payload = make_kakao_request("연동 INVALID")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "유효하지 않은" in text


@pytest.mark.asyncio
async def test_kakao_korean_command_no_false_positive(client, db_session, mock_llm_parse_expense):
    """'취소해줘' 같은 부분 매칭은 명령어로 처리하지 않고 LLM 파싱으로 넘어감"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    payload = make_kakao_request("취소해줘")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # LLM 파싱으로 넘어가므로 지출 저장 또는 파싱 에러 응답이어야 함
    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    # /undo의 삭제 확인 메시지가 아니어야 함
    assert "삭제했어요" not in text


@pytest.mark.asyncio
async def test_kakao_korean_command_no_false_positive_with_suffix(client, db_session, mock_llm_parse_expense):
    """'예산 현황 보여줘' 같은 인자 있는 입력은 명령어로 처리하지 않음 (인자 비허용 명령어)"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    # "예산"은 인자 비허용이므로 "예산 현황 보여줘"는 LLM 파싱으로 넘어감
    payload = make_kakao_request("예산 현황 보여줘")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    # LLM 파싱으로 처리됨 (예산 현황 메시지가 아님)
    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "예산 현황" not in text


@pytest.mark.asyncio
async def test_kakao_quickreply_uses_korean_commands(client, db_session, mock_llm_parse_expense):
    """quickReply 버튼의 messageText가 한글 명령어로 전송됨"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    payload = make_kakao_request("커피 5000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    quick_replies = data["template"].get("quickReplies", [])
    message_texts = [qr["messageText"] for qr in quick_replies]

    # 슬래시 명령어 대신 한글 명령어가 사용되어야 함
    assert "취소" in message_texts
    assert "변경" in message_texts
    assert "리포트" in message_texts


# ── 수입 입력 테스트 (#285) ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_webhook_income_input(client, db_session, mock_llm_parse_expense):
    """수입 자연어 입력 시 수입 저장 메시지 반환"""
    # 봇 사용자에게 가구 설정
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    mock_llm_parse_expense.return_value = {
        "amount": 3000000,
        "description": "월급",
        "category": "급여",
        "date": "2026-03-20",
        "type": "income",
    }

    payload = make_kakao_request("월급 300만원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "수입" in text
    assert "3,000,000" in text


@pytest.mark.asyncio
async def test_kakao_webhook_income_creates_income_record(client, db_session, mock_llm_parse_expense):
    """수입 입력 시 Income 모델에 저장되는지 확인"""
    from app.models.income import Income

    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    mock_llm_parse_expense.return_value = {
        "amount": 500000,
        "description": "부업 수입",
        "category": "부수입",
        "date": "2026-03-20",
        "type": "income",
    }

    payload = make_kakao_request("부업 수입 50만원")
    await client.post("/api/kakao/webhook", json=payload)

    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) >= 1
    assert any(i.amount == 500000 for i in incomes)

    # Expense에는 저장 안 됨
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    income_amounts = [i.amount for i in incomes]
    assert 500000 not in [e.amount for e in expenses if e.amount in income_amounts]


@pytest.mark.asyncio
async def test_kakao_webhook_mixed_income_expense(client, db_session, mock_llm_parse_expense):
    """다중 건 입력에서 수입/지출 혼합 처리"""

    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    mock_llm_parse_expense.return_value = [
        {"amount": 3000000, "description": "월급", "category": "급여", "date": "2026-03-20", "type": "income"},
        {"amount": 8000, "description": "점심", "category": "식비", "date": "2026-03-20", "type": "expense"},
    ]

    payload = make_kakao_request("월급 300만원, 점심 8000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "수입" in text
    assert "지출" in text


# ── 3 Strike 에러 테스트 (#286) ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_parse_error_strike_progression(client, db_session, mock_llm_parse_expense):
    """파싱 실패 시 Strike 1→2→3으로 메시지가 점진적으로 변화"""
    mock_llm_parse_expense.return_value = {"error": "파싱 실패"}

    # Strike 1: 기본 안내
    response = await client.post("/api/kakao/webhook", json=make_kakao_request("아무말"))
    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "금액을 찾지 못했어요" in text

    # Strike 2: 다른 방식 제안
    response = await client.post("/api/kakao/webhook", json=make_kakao_request("또 아무말"))
    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "이해하지 못했어요" in text

    # Strike 3+: 도움말 안내
    response = await client.post("/api/kakao/webhook", json=make_kakao_request("세번째"))
    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "도움말을 확인" in text

    # quickReply도 Strike에 따라 달라짐
    qr = response.json()["template"].get("quickReplies", [])
    labels = [r["label"] for r in qr]
    assert any("도움말" in label for label in labels)
    assert any("리포트" in label for label in labels)
    assert any("예산" in label for label in labels)


@pytest.mark.asyncio
async def test_kakao_successful_parse_resets_strike(client, db_session, mock_llm_parse_expense):
    """성공적 파싱 후 Strike 카운트가 초기화됨"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    # 먼저 2번 파싱 실패 (Strike 2)
    mock_llm_parse_expense.return_value = {"error": "파싱 실패"}
    await client.post("/api/kakao/webhook", json=make_kakao_request("아무말1"))
    await client.post("/api/kakao/webhook", json=make_kakao_request("아무말2"))

    # 성공 → Strike 리셋
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "점심",
        "date": "2026-03-20",
        "memo": "",
    }
    await client.post("/api/kakao/webhook", json=make_kakao_request("점심 8000원"))

    # 다시 실패 → Strike 1부터 시작해야 함
    mock_llm_parse_expense.return_value = {"error": "파싱 실패"}
    response = await client.post("/api/kakao/webhook", json=make_kakao_request("또아무말"))
    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "금액을 찾지 못했어요" in text  # Strike 1 메시지


# ── undo 수입 삭제 테스트 (#286) ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_undo_deletes_latest_income(client, db_session, mock_llm_parse_expense):
    """Income이 더 최근이면 Income을 삭제"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    # 지출 먼저 입력
    mock_llm_parse_expense.return_value = {
        "amount": 5000,
        "category": "식비",
        "description": "점심",
        "date": "2026-03-20",
        "memo": "",
    }
    await client.post("/api/kakao/webhook", json=make_kakao_request("점심 5000원"))

    # 수입 입력 (더 최근)
    mock_llm_parse_expense.return_value = {
        "amount": 3000000,
        "category": "급여",
        "description": "월급",
        "date": "2026-03-20",
        "type": "income",
    }
    await client.post("/api/kakao/webhook", json=make_kakao_request("월급 300만원"))

    # Income이 1건 있어야 함
    result = await db_session.execute(select(Income))
    assert len(result.scalars().all()) == 1

    # undo → Income이 삭제되어야 함
    response = await client.post("/api/kakao/webhook", json=make_kakao_request("취소"))
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "삭제" in text
    assert "3,000,000" in text

    # Income은 삭제됨
    result = await db_session.execute(select(Income))
    assert len(result.scalars().all()) == 0

    # Expense는 남아있음
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_kakao_undo_deletes_latest_expense(client, db_session, mock_llm_parse_expense):
    """Expense가 더 최근이면 Expense를 삭제"""
    from app.models.category import Category

    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    category = Category(name="식비", user_id=bot_user.id, household_id=household.id)
    db_session.add(category)
    await db_session.flush()

    # 수입 (더 오래됨 — created_at 명시)
    older_time = datetime(2026, 3, 20, 10, 0, 0)
    income = Income(
        user_id=bot_user.id,
        amount=3000000,
        description="월급",
        category_id=category.id,
        date=datetime(2026, 3, 20),
        household_id=household.id,
        created_at=older_time,
    )
    db_session.add(income)

    # 지출 (더 최근 — created_at 명시)
    newer_time = datetime(2026, 3, 20, 11, 0, 0)
    expense = Expense(
        user_id=bot_user.id,
        amount=8000,
        description="점심",
        category_id=category.id,
        date=datetime(2026, 3, 20),
        household_id=household.id,
        created_at=newer_time,
    )
    db_session.add(expense)
    await db_session.commit()

    # undo → Expense가 삭제되어야 함 (created_at이 더 최근)
    response = await client.post("/api/kakao/webhook", json=make_kakao_request("취소"))
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "삭제" in text
    assert "8,000" in text

    # Expense는 삭제됨
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0

    # Income은 남아있음
    result = await db_session.execute(select(Income))
    assert len(result.scalars().all()) == 1


# ── 보강 테스트 (#289) ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_llm_exception_returns_server_error(client, db_session, mock_llm_parse_expense):
    """LLM 파싱 중 Exception 시 서버 에러 메시지 + 도움말 quick reply"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    mock_llm_parse_expense.side_effect = Exception("LLM 서비스 장애")
    payload = make_kakao_request("점심 8000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "다시 시도" in text or "다시" in text

    # quick reply 포함 확인
    quick_replies = data["template"].get("quickReplies", [])
    assert len(quick_replies) > 0


@pytest.mark.asyncio
async def test_kakao_timeout_has_retry_quickreply(client, db_session, mock_llm_parse_expense):
    """LLM 타임아웃 시 '다시 시도' quick reply 포함"""

    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    mock_llm_parse_expense.side_effect = TimeoutError()
    payload = make_kakao_request("점심 8000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "다시" in text

    quick_replies = data["template"].get("quickReplies", [])
    labels = [qr["label"] for qr in quick_replies]
    assert any("다시" in label or "시도" in label for label in labels)


@pytest.mark.asyncio
async def test_kakao_link_then_expense_saves_to_household(client, db_session, mock_llm_parse_expense):
    """카카오 연동 후 지출이 웹 사용자의 household에 저장"""
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # 웹 사용자 + 가구 + 카카오 연동 코드
    web_user = User(
        username="web_kakao_link",
        email="kakao_link@test.com",
        hashed_password=pwd_context.hash("test"),
        is_active=True,
        kakao_link_code="KK1234",
        kakao_link_code_expires_at=datetime.now(UTC) + timedelta(minutes=10),
    )
    db_session.add(web_user)
    await db_session.flush()
    household = Household(name="카카오 연동 테스트")
    db_session.add(household)
    await db_session.flush()
    member = HouseholdMember(household_id=household.id, user_id=web_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()

    # 연동
    link_user_id = "kakao_linker_hh_001"
    payload = make_kakao_request("/link KK1234", user_id=link_user_id)
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200
    assert "연동 완료" in response.json()["template"]["outputs"][0]["simpleText"]["text"]

    # 지출 입력
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-03-21",
        "memo": "",
    }
    payload2 = make_kakao_request("김치찌개 8000원", user_id=link_user_id)
    await client.post("/api/kakao/webhook", json=payload2)

    # 웹 사용자 household에 저장 확인
    result = await db_session.execute(select(Expense).where(Expense.household_id == household.id))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 8000


# ── 리포트/예산 전체 보기 명령어 테스트 (#287) ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_report_full_command(client, db_session, mock_llm_parse_expense):
    """'리포트 전체' → 전체 카테고리 리포트 반환"""
    from app.models.category import Category

    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    # 4개 카테고리에 지출 생성
    for cat_name in ["식비", "교통", "카페", "문화"]:
        cat = Category(name=cat_name, user_id=bot_user.id, household_id=household.id)
        db_session.add(cat)
        await db_session.flush()
        exp = Expense(
            user_id=bot_user.id,
            amount=10000,
            description=f"{cat_name} 지출",
            category_id=cat.id,
            date=datetime.now(),
            household_id=household.id,
        )
        db_session.add(exp)
    await db_session.commit()

    payload = make_kakao_request("리포트 전체")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    # 전체 리포트이므로 모든 카테고리가 표시되어야 함
    assert "식비" in text
    assert "교통" in text
    assert "카페" in text
    assert "문화" in text


@pytest.mark.asyncio
async def test_kakao_report_has_full_quickreply(client, db_session, mock_llm_parse_expense):
    """리포트에 4개+ 카테고리 시 '전체 보기' 퀵리플라이 포함"""
    from app.models.category import Category

    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    # 4개 카테고리에 지출 생성 (3개 초과 시 전체 보기 버튼 노출)
    for cat_name in ["식비", "교통", "카페", "문화"]:
        cat = Category(name=cat_name, user_id=bot_user.id, household_id=household.id)
        db_session.add(cat)
        await db_session.flush()
        exp = Expense(
            user_id=bot_user.id,
            amount=10000,
            description=f"{cat_name} 지출",
            category_id=cat.id,
            date=datetime.now(),
            household_id=household.id,
        )
        db_session.add(exp)
    await db_session.commit()

    payload = make_kakao_request("리포트")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    quick_replies = data["template"].get("quickReplies", [])
    labels = [qr["label"] for qr in quick_replies]
    assert any("전체" in label for label in labels)


@pytest.mark.asyncio
async def test_kakao_budget_full_command(client, db_session, mock_llm_parse_expense):
    """'예산 전체' → 전체 예산 현황 반환"""
    from app.models.budget import Budget
    from app.models.category import Category

    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    now = datetime.now()
    start = datetime(now.year, now.month, 1)

    # 위험 예산 (사용률 80%+) + 안전 예산 생성
    cat_food = Category(name="식비", user_id=bot_user.id, household_id=household.id)
    db_session.add(cat_food)
    await db_session.flush()

    budget_food = Budget(
        household_id=household.id,
        category_id=cat_food.id,
        amount=100000,
        period="monthly",
        start_date=start,
    )
    db_session.add(budget_food)
    # 식비 지출 90,000 (90%)
    exp = Expense(
        user_id=bot_user.id,
        amount=90000,
        description="식비",
        category_id=cat_food.id,
        date=now,
        household_id=household.id,
    )
    db_session.add(exp)

    cat_transport = Category(name="교통", user_id=bot_user.id, household_id=household.id)
    db_session.add(cat_transport)
    await db_session.flush()

    budget_transport = Budget(
        household_id=household.id,
        category_id=cat_transport.id,
        amount=100000,
        period="monthly",
        start_date=start,
    )
    db_session.add(budget_transport)
    # 교통 지출 10,000 (10%) — 안전
    exp2 = Expense(
        user_id=bot_user.id,
        amount=10000,
        description="교통",
        category_id=cat_transport.id,
        date=now,
        household_id=household.id,
    )
    db_session.add(exp2)
    await db_session.commit()

    payload = make_kakao_request("예산 전체")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    # 전체이므로 안전 예산(교통)도 표시되어야 함
    assert "식비" in text
    assert "교통" in text


@pytest.mark.asyncio
async def test_kakao_budget_has_full_quickreply(client, db_session, mock_llm_parse_expense):
    """예산에 접혀진 항목 있을 때 '전체 보기' 퀵리플라이 포함"""
    from app.models.budget import Budget
    from app.models.category import Category

    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    now = datetime.now()
    start = datetime(now.year, now.month, 1)

    # 위험 예산 (80%+)
    cat_food = Category(name="식비", user_id=bot_user.id, household_id=household.id)
    db_session.add(cat_food)
    await db_session.flush()
    budget_food = Budget(household_id=household.id, category_id=cat_food.id, amount=100000, period="monthly", start_date=start)
    db_session.add(budget_food)
    exp = Expense(user_id=bot_user.id, amount=90000, description="식비", category_id=cat_food.id, date=now, household_id=household.id)
    db_session.add(exp)

    # 안전 예산 (10%)
    cat_transport = Category(name="교통", user_id=bot_user.id, household_id=household.id)
    db_session.add(cat_transport)
    await db_session.flush()
    budget_transport = Budget(household_id=household.id, category_id=cat_transport.id, amount=100000, period="monthly", start_date=start)
    db_session.add(budget_transport)
    exp2 = Expense(user_id=bot_user.id, amount=10000, description="교통", category_id=cat_transport.id, date=now, household_id=household.id)
    db_session.add(exp2)
    await db_session.commit()

    payload = make_kakao_request("예산")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    quick_replies = data["template"].get("quickReplies", [])
    labels = [qr["label"] for qr in quick_replies]
    assert any("전체" in label for label in labels)


# ── 카카오 콜백 모드 테스트 (#288) ──────────────────────────


def make_kakao_request_with_callback(utterance: str, user_id: str = "kakao_user_123", callback_url: str = "https://callback.kakao.com/test") -> dict:
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


@pytest.mark.asyncio
async def test_kakao_callback_mode_returns_pending(client, db_session, mock_llm_parse_expense):
    """콜백 모드 활성화 시 즉시 'useCallback: true' + '분석 중' 응답 반환"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    with (
        patch.object(_app_settings, "KAKAO_CALLBACK_ENABLED", True),
        patch("app.api.kakao._process_expense_callback", new_callable=AsyncMock),
    ):
        payload = make_kakao_request_with_callback("점심 8000원")
        response = await client.post("/api/kakao/webhook", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data.get("useCallback") is True
        assert "분석 중" in data.get("data", {}).get("text", "")
        # template은 없어야 함 (콜백 대기 응답 형식)
        assert "template" not in data


@pytest.mark.asyncio
async def test_kakao_callback_disabled_uses_existing_flow(client, db_session, mock_llm_parse_expense):
    """콜백 비활성화(기본값) 시 기존 동기 처리 — useCallback 없음"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    # KAKAO_CALLBACK_ENABLED=False (기본값)
    payload = make_kakao_request_with_callback("점심 8000원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "useCallback" not in data
    # 기존 방식: template 응답
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "8,000" in text or "기록" in text


@pytest.mark.asyncio
async def test_kakao_callback_sends_result_to_callback_url(client, db_session, mock_llm_parse_expense):
    """콜백 모드에서 백그라운드 태스크가 디스패치되는지 확인"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    with (
        patch.object(_app_settings, "KAKAO_CALLBACK_ENABLED", True),
        patch("app.api.kakao._process_expense_callback", new_callable=AsyncMock) as mock_process,
    ):
        payload = make_kakao_request_with_callback("점심 8000원")
        response = await client.post("/api/kakao/webhook", json=payload)

        # 즉시 응답은 useCallback
        assert response.json().get("useCallback") is True

        # 백그라운드 태스크가 디스패치되었는지 확인
        mock_process.assert_called_once()
        call_args = mock_process.call_args
        assert call_args[0][0] == "점심 8000원"  # utterance
        assert call_args[0][2] == "https://callback.kakao.com/test"  # callback_url


@pytest.mark.asyncio
async def test_kakao_callback_background_error_sends_error(client, db_session, mock_llm_parse_expense):
    """콜백 백그라운드 처리 중 에러 발생 시 콜백으로 에러 메시지 전송"""

    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    mock_llm_parse_expense.side_effect = RuntimeError("LLM 서비스 장애")

    with (
        patch.object(_app_settings, "KAKAO_CALLBACK_ENABLED", True),
        patch("app.api.kakao._process_expense_callback", new_callable=AsyncMock) as mock_process,
    ):
        payload = make_kakao_request_with_callback("점심 8000원")
        response = await client.post("/api/kakao/webhook", json=payload)

        assert response.json().get("useCallback") is True
        mock_process.assert_called_once()


@pytest.mark.asyncio
async def test_kakao_command_no_callback(client, db_session, mock_llm_parse_expense):
    """명령어(리포트 등)는 콜백 모드에서도 즉시 응답 — useCallback 없음"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    with patch.object(_app_settings, "KAKAO_CALLBACK_ENABLED", True):
        payload = make_kakao_request_with_callback("리포트")
        response = await client.post("/api/kakao/webhook", json=payload)
        assert response.status_code == 200

        data = response.json()
        # 명령어는 콜백 안 쓰고 즉시 응답
        assert "useCallback" not in data
        assert "template" in data


@pytest.mark.asyncio
async def test_kakao_callback_no_callback_url_uses_existing_flow(client, db_session, mock_llm_parse_expense):
    """callbackUrl이 없는 요청은 콜백 모드 활성화해도 기존 동기 처리"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    with patch.object(_app_settings, "KAKAO_CALLBACK_ENABLED", True):
        # callbackUrl 없는 일반 요청
        payload = make_kakao_request("점심 8000원")
        response = await client.post("/api/kakao/webhook", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert "useCallback" not in data
        assert "template" in data


# ── #289 봇 테스트 강화 ──────────────────────────


@pytest.mark.asyncio
async def test_kakao_report_with_data(client, db_session, mock_llm_parse_expense):
    """지출 데이터 있을 때 리포트에 카테고리별 금액 표시"""
    from app.models.category import Category

    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    cat = Category(name="식비", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()
    exp = Expense(
        user_id=bot_user.id,
        amount=50000,
        description="회식",
        category_id=cat.id,
        date=datetime.now(),
        household_id=household.id,
    )
    db_session.add(exp)
    await db_session.commit()

    payload = make_kakao_request("리포트")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "식비" in text
    assert "50,000" in text


@pytest.mark.asyncio
async def test_kakao_budget_with_data(client, db_session):
    """예산 데이터 있을 때 예산 현황에 카테고리/금액/사용량 표시"""
    from app.models.budget import Budget
    from app.models.category import Category

    bot_user, household = await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    cat = Category(name="식비", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()

    budget = Budget(
        user_id=bot_user.id,
        household_id=household.id,
        category_id=cat.id,
        amount=300000,
        period="monthly",
        start_date=datetime(2026, 3, 1),
        end_date=datetime(2026, 3, 31),
    )
    db_session.add(budget)

    # 지출도 추가 (사용량 표시 확인)
    exp = Expense(
        user_id=bot_user.id,
        amount=100000,
        description="회식",
        category_id=cat.id,
        date=datetime(2026, 3, 15),
        household_id=household.id,
    )
    db_session.add(exp)
    await db_session.commit()

    payload = make_kakao_request("예산")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "식비" in text
    assert "300,000" in text or "100,000" in text


@pytest.mark.asyncio
async def test_kakao_very_long_input(client, db_session, mock_llm_parse_expense):
    """매우 긴 입력(1000자+)도 정상 처리"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    mock_llm_parse_expense.return_value = {"error": "파싱 실패"}
    long_text = "점심에 " + "김치찌개 " * 200  # ~1200 chars
    payload = make_kakao_request(long_text)
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert len(text) > 0  # 빈 응답이 아님


@pytest.mark.asyncio
async def test_kakao_multiple_income_input(client, db_session, mock_llm_parse_expense):
    """여러 수입 동시 입력"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    mock_llm_parse_expense.return_value = [
        {"amount": 3000000, "category": "급여", "description": "월급", "date": "2026-03-21", "type": "income"},
        {"amount": 500000, "category": "부수입", "description": "부업", "date": "2026-03-21", "type": "income"},
    ]
    payload = make_kakao_request("월급 300만원, 부업 50만원")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "수입" in text
    assert "2건" in text

    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 2


@pytest.mark.asyncio
async def test_kakao_empty_then_normal_input(client, db_session, mock_llm_parse_expense):
    """빈 입력 후 정상 입력이 제대로 처리"""
    await setup_kakao_bot_user_with_household(db_session, "kakao_user_123")

    # 빈 입력
    payload_empty = make_kakao_request("")
    response1 = await client.post("/api/kakao/webhook", json=payload_empty)
    assert response1.status_code == 200

    # 정상 입력
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "점심",
        "date": "2026-03-21",
        "memo": "",
    }
    payload_normal = make_kakao_request("점심 8000원")
    response2 = await client.post("/api/kakao/webhook", json=payload_normal)
    assert response2.status_code == 200

    text = response2.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "8,000" in text or "기록" in text

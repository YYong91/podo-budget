"""
카카오톡 채널 봇 Webhook API 통합 테스트

- /help, /report, /budget 명령어 응답
- /link 명령어 (웹 계정 연동)
- LLM 파싱 → 지출 저장 플로우 (Mock)
- 에러 처리 (파싱 실패, utterance 없음)
- 카카오 응답 형식 검증
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.user import User


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

    # 에러 메시지 검증
    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "금액을 찾을 수 없" in text or "파싱" in text


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

    # DB에서 삭제 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 0


@pytest.mark.asyncio
async def test_kakao_webhook_undo_no_expenses(client, db_session):
    """/undo 지출이 없으면 안내 메시지 반환"""
    payload = make_kakao_request("/undo")
    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "없" in text


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
    # /undo의 "삭제되었어요" 메시지가 아니어야 함
    assert "마지막 지출이 삭제되었어요" not in text


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

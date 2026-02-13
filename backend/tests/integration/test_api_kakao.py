"""
카카오톡 채널 봇 Webhook API 통합 테스트

- /help, /report, /budget 명령어 응답
- LLM 파싱 → 지출 저장 플로우 (Mock)
- 에러 처리 (파싱 실패, utterance 없음)
- 카카오 응답 형식 검증
"""

import pytest
from sqlalchemy import select

from app.models.expense import Expense
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
        "userRequest": {"utterance": utterance, "params": {}, "block": {"id": "test_block", "name": "TestBlock"}},
        "bot": {"id": "test_bot", "name": "HomeNRich"},
        "user": {"id": user_id, "type": "accountId"},
    }


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
    # 먼저 지출을 하나 생성
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
        },
        "bot": {"id": "test_bot", "name": "HomeNRich"},
        "user": {"id": "kakao_user_123", "type": "accountId"},
    }

    response = await client.post("/api/kakao/webhook", json=payload)
    assert response.status_code == 200

    data = response.json()
    text = data["template"]["outputs"][0]["simpleText"]["text"]
    assert "메시지" in text or "입력" in text


@pytest.mark.asyncio
async def test_kakao_webhook_response_format(client, db_session, mock_llm_parse_expense):
    """카카오 응답 형식 (version, template, outputs) 검증"""
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
    # 사용자 1의 지출 생성
    payload1 = make_kakao_request("점심 5000원", user_id="kakao_user_111")
    response1 = await client.post("/api/kakao/webhook", json=payload1)
    assert response1.status_code == 200

    # 사용자 2의 지출 생성
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

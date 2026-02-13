"""
채팅 API 통합 테스트 (인증 적용)

- POST /api/chat/ - 자연어 지출 입력 처리
- LLM 파싱 결과에 따라 지출 생성 또는 에러 응답
- Preview 모드: 파싱 결과만 반환 (저장 안 함)
- 가구 컨텍스트: 자연어 키워드로 공유/개인 지출 자동 분류

모든 엔드포인트는 JWT 인증이 필요합니다.
"""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.user import User


@pytest.mark.asyncio
async def test_chat_parse_expense_success(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """채팅으로 지출 입력 성공 케이스"""
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "점심에 김치찌개 8000원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert "기록되었습니다" in data["message"]
    assert "₩8,000" in data["message"]
    assert data["expenses_created"] is not None
    assert len(data["expenses_created"]) == 1
    assert data["expenses_created"][0]["amount"] == 8000.0
    assert data["expenses_created"][0]["description"] == "김치찌개"

    # DB에 지출이 생성되었는지 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 8000.0
    assert expenses[0].raw_input == "점심에 김치찌개 8000원"

    # 카테고리가 자동 생성되었는지 확인
    cat_result = await db_session.execute(select(Category).where(Category.name == "식비"))
    category = cat_result.scalar_one()
    assert category.name == "식비"
    assert "자동 생성" in category.description


@pytest.mark.asyncio
async def test_chat_parse_expense_with_existing_category(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """기존 카테고리가 있으면 재사용"""
    # 기존 카테고리 생성
    existing_cat = Category(user_id=test_user.id, name="교통비", description="대중교통")
    db_session.add(existing_cat)
    await db_session.commit()
    await db_session.refresh(existing_cat)

    mock_llm_parse_expense.return_value = {
        "amount": 15000,
        "category": "교통비",
        "description": "택시",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "택시 15000원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # 카테고리가 중복 생성되지 않았는지 확인
    cat_result = await db_session.execute(select(Category).where(Category.name == "교통비"))
    categories = cat_result.scalars().all()
    assert len(categories) == 1
    assert categories[0].id == existing_cat.id


@pytest.mark.asyncio
async def test_chat_parse_expense_error(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """LLM 파싱 실패 시 에러 응답"""
    mock_llm_parse_expense.return_value = {"error": "금액을 찾을 수 없습니다"}

    payload = {"message": "그냥 텍스트"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert data["message"] == "금액을 찾을 수 없습니다"
    assert data["expenses_created"] is None
    assert data["insights"] is None

    # DB에 지출이 생성되지 않았는지 확인
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 0


@pytest.mark.asyncio
async def test_chat_with_date_parsing(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """날짜 파싱이 포함된 지출 입력"""
    mock_llm_parse_expense.return_value = {
        "amount": 15000,
        "category": "교통비",
        "description": "택시",
        "date": "2026-02-10",
        "memo": "회식 후",
    }

    payload = {"message": "어제 택시 15000원 회식 후"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert data["expenses_created"] is not None
    expense = data["expenses_created"][0]
    assert "2026-02-10" in expense["date"]

    # DB에서 날짜 확인
    result = await db_session.execute(select(Expense))
    db_expense = result.scalar_one()
    assert db_expense.date.date() == datetime(2026, 2, 10).date()


@pytest.mark.asyncio
async def test_chat_with_memo(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """메모가 포함된 지출 입력"""
    mock_llm_parse_expense.return_value = {
        "amount": 13500,
        "category": "문화생활",
        "description": "넷플릭스 구독",
        "date": "2026-02-11",
        "memo": "월 구독료",
    }

    payload = {"message": "넷플릭스 13500 월 구독료"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201
    assert response.json()["expenses_created"] is not None


@pytest.mark.asyncio
async def test_chat_category_default_to_other(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """카테고리가 명시되지 않으면 '기타'로 분류"""
    mock_llm_parse_expense.return_value = {
        "amount": 5000,
        "description": "알 수 없는 지출",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "5000원 사용"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # '기타' 카테고리가 생성되었는지 확인
    cat_result = await db_session.execute(select(Category).where(Category.name == "기타"))
    category = cat_result.scalar_one()
    assert category.name == "기타"


@pytest.mark.asyncio
async def test_chat_large_amount_formatting(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """큰 금액도 천단위 콤마로 포맷팅"""
    mock_llm_parse_expense.return_value = {
        "amount": 1500000,
        "category": "쇼핑",
        "description": "노트북",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "노트북 150만원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert "₩1,500,000" in data["message"]


@pytest.mark.asyncio
async def test_chat_without_description(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """설명이 없으면 원본 메시지를 사용"""
    mock_llm_parse_expense.return_value = {
        "amount": 3000,
        "category": "기타",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "3000원 지출"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # DB에서 원본 메시지가 description으로 사용되었는지 확인
    result = await db_session.execute(select(Expense))
    expense = result.scalar_one()
    assert expense.description == "3000원 지출"
    assert expense.raw_input == "3000원 지출"


# ──────────────────────────────────────────────
# Preview 모드 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_chat_preview_mode_returns_parsed_items(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """Preview 모드: 파싱 결과만 반환하고 DB에 저장하지 않음"""
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-02-11",
        "memo": "",
    }

    payload = {"message": "점심 김치찌개 8000원", "preview": True}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    data = response.json()
    assert "인식했습니다" in data["message"]
    assert data["parsed_expenses"] is not None
    assert len(data["parsed_expenses"]) == 1
    assert data["parsed_expenses"][0]["amount"] == 8000.0
    assert data["parsed_expenses"][0]["category"] == "식비"
    assert data["expenses_created"] is None  # 저장 안 됨

    # DB에 아무것도 생성되지 않았는지 확인
    result = await db_session.execute(select(Expense))
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_chat_preview_includes_household_id(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """Preview 모드에서 household_id가 응답에 포함됨"""
    # 가구 생성
    household = Household(name="테스트 가구")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)

    member = HouseholdMember(household_id=household.id, user_id=test_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 50000,
        "category": "식비",
        "description": "저녁",
        "date": "2026-02-14",
        "memo": "",
    }

    payload = {"message": "우리 저녁 5만원", "preview": True}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["parsed_expenses"] is not None
    assert data["parsed_expenses"][0]["household_id"] == household.id


# ──────────────────────────────────────────────
# 가구 컨텍스트 통합 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_chat_shared_keyword_sets_household_id(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """'우리' 키워드 → 활성 가구의 공유 지출로 기록"""
    # 가구 생성 + 멤버 등록
    household = Household(name="우리 가족")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)

    member = HouseholdMember(household_id=household.id, user_id=test_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 80000,
        "category": "식비",
        "description": "외식",
        "date": "2026-02-14",
        "memo": "",
    }

    payload = {"message": "우리 가족 외식 8만원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    # DB에서 household_id가 설정되었는지 확인
    result = await db_session.execute(select(Expense))
    expense = result.scalar_one()
    assert expense.household_id == household.id


@pytest.mark.asyncio
async def test_chat_personal_keyword_no_household_id(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """'내' 키워드 → 개인 지출 (household_id=None)"""
    # 가구가 있어도 '내' 키워드면 개인으로 분류
    household = Household(name="우리 가족")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)

    member = HouseholdMember(household_id=household.id, user_id=test_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 5000,
        "category": "카페",
        "description": "커피",
        "date": "2026-02-14",
        "memo": "",
    }

    payload = {"message": "내 커피 5000원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    result = await db_session.execute(select(Expense))
    expense = result.scalar_one()
    assert expense.household_id is None


@pytest.mark.asyncio
async def test_chat_explicit_household_id_overrides_context(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """명시적 household_id가 자연어 컨텍스트보다 우선"""
    household = Household(name="우리 가족")
    db_session.add(household)
    await db_session.commit()
    await db_session.refresh(household)

    member = HouseholdMember(household_id=household.id, user_id=test_user.id, role="owner")
    db_session.add(member)
    await db_session.commit()

    mock_llm_parse_expense.return_value = {
        "amount": 10000,
        "category": "식비",
        "description": "점심",
        "date": "2026-02-14",
        "memo": "",
    }

    # '내' 키워드인데 household_id를 명시적으로 지정
    payload = {"message": "내 점심 10000원", "household_id": household.id}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    result = await db_session.execute(select(Expense))
    expense = result.scalar_one()
    assert expense.household_id == household.id  # 명시적 ID 우선


@pytest.mark.asyncio
async def test_chat_no_household_defaults_to_personal(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """가구 없는 사용자 → 항상 개인 지출"""
    mock_llm_parse_expense.return_value = {
        "amount": 3000,
        "category": "카페",
        "description": "아메리카노",
        "date": "2026-02-14",
        "memo": "",
    }

    payload = {"message": "아메리카노 3000원"}
    response = await authenticated_client.post("/api/chat/", json=payload)

    assert response.status_code == 201

    result = await db_session.execute(select(Expense))
    expense = result.scalar_one()
    assert expense.household_id is None

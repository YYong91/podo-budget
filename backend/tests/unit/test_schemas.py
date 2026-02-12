"""
Pydantic 스키마 단위 테스트

- ExpenseCreate, ExpenseUpdate, ExpenseResponse
- CategoryCreate, CategoryUpdate, CategoryResponse
- ChatRequest, ChatResponse
- 유효성 검증 및 직렬화/역직렬화 테스트
"""

from datetime import datetime

import pytest
from pydantic import ValidationError

from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate


def test_expense_create_schema_valid():
    """ExpenseCreate 스키마 정상 생성 테스트"""
    data = {
        "amount": 8000.0,
        "description": "김치찌개",
        "category_id": 1,
        "date": datetime(2026, 2, 11, 12, 0, 0),
        "raw_input": "점심에 김치찌개 8000원",
    }
    expense = ExpenseCreate(**data)

    assert expense.amount == 8000.0
    assert expense.description == "김치찌개"
    assert expense.category_id == 1
    assert expense.raw_input == "점심에 김치찌개 8000원"


def test_expense_create_without_optional_fields():
    """ExpenseCreate 선택 필드 없이 생성 테스트"""
    data = {
        "amount": 5000.0,
        "description": "택시",
        "date": datetime.now(),
    }
    expense = ExpenseCreate(**data)

    assert expense.amount == 5000.0
    assert expense.category_id is None
    assert expense.raw_input is None


def test_expense_create_missing_required_field():
    """ExpenseCreate 필수 필드 누락 시 ValidationError 발생"""
    with pytest.raises(ValidationError):
        ExpenseCreate(description="테스트")  # amount와 date 누락


def test_expense_update_schema():
    """ExpenseUpdate 스키마 테스트 (모든 필드 선택)"""
    # 일부 필드만 업데이트
    update = ExpenseUpdate(amount=9000.0)
    assert update.amount == 9000.0
    assert update.description is None

    # 여러 필드 업데이트
    update2 = ExpenseUpdate(amount=10000.0, description="수정된 설명", category_id=2)
    assert update2.amount == 10000.0
    assert update2.description == "수정된 설명"


def test_expense_response_from_orm():
    """ExpenseResponse가 ORM 모델에서 생성 가능한지 테스트"""
    # ORM 모델을 흉내낸 dict
    orm_data = {
        "id": 1,
        "amount": 8000.0,
        "description": "김치찌개",
        "category_id": 1,
        "date": datetime(2026, 2, 11),
        "raw_input": "점심 8000원",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }

    response = ExpenseResponse(**orm_data)
    assert response.id == 1
    assert response.amount == 8000.0


def test_category_create_schema():
    """CategoryCreate 스키마 테스트"""
    category = CategoryCreate(name="식비", description="음식 관련 지출")
    assert category.name == "식비"
    assert category.description == "음식 관련 지출"

    # description 생략 가능
    category2 = CategoryCreate(name="교통비")
    assert category2.description is None


def test_category_update_schema():
    """CategoryUpdate 스키마 테스트 (모든 필드 선택)"""
    update = CategoryUpdate(name="새 이름")
    assert update.name == "새 이름"
    assert update.description is None


def test_category_response_schema():
    """CategoryResponse 스키마 테스트"""
    data = {
        "id": 1,
        "name": "식비",
        "description": "음식",
        "created_at": datetime.now(),
    }
    response = CategoryResponse(**data)
    assert response.id == 1
    assert response.name == "식비"


def test_chat_request_schema():
    """ChatRequest 스키마 테스트"""
    request = ChatRequest(message="점심에 김치찌개 8000원")
    assert request.message == "점심에 김치찌개 8000원"


def test_chat_request_empty_message():
    """ChatRequest 빈 메시지 검증"""
    # Pydantic은 빈 문자열도 허용하지만, 실제 로직에서는 처리 필요
    request = ChatRequest(message="")
    assert request.message == ""


def test_chat_response_schema():
    """ChatResponse 스키마 테스트"""
    expense_data = {
        "id": 1,
        "amount": 8000.0,
        "description": "김치찌개",
        "category_id": 1,
        "date": datetime.now(),
        "raw_input": "점심 8000원",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }

    response = ChatResponse(
        message="기록 완료!",
        expenses_created=[ExpenseResponse(**expense_data)],
        insights=None,
    )

    assert response.message == "기록 완료!"
    assert len(response.expenses_created) == 1
    assert response.expenses_created[0].amount == 8000.0
    assert response.insights is None


def test_chat_response_with_insights():
    """인사이트가 포함된 ChatResponse 테스트"""
    response = ChatResponse(
        message="분석 완료",
        expenses_created=None,
        insights="# 2월 분석\n총 지출: 50,000원",
    )

    assert response.message == "분석 완료"
    assert response.expenses_created is None
    assert "총 지출" in response.insights

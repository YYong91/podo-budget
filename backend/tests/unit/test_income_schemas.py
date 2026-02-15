"""수입 스키마 유효성 테스트"""

from datetime import datetime

import pytest
from pydantic import ValidationError

from app.schemas.income import IncomeCreate, IncomeResponse, IncomeUpdate


def test_income_create_valid():
    """유효한 수입 생성 스키마"""
    income = IncomeCreate(
        amount=3500000,
        description="월급",
        date=datetime(2026, 2, 1),
    )
    assert income.amount == 3500000
    assert income.description == "월급"


def test_income_create_with_optional_fields():
    """선택 필드 포함 수입 생성"""
    income = IncomeCreate(
        amount=500000,
        description="보너스",
        date=datetime(2026, 2, 15),
        category_id=1,
        raw_input="보너스 50만원",
        household_id=1,
    )
    assert income.category_id == 1
    assert income.household_id == 1


def test_income_create_invalid_amount():
    """금액 0 이하 검증"""
    with pytest.raises(ValidationError):
        IncomeCreate(amount=0, description="무효", date=datetime(2026, 2, 1))

    with pytest.raises(ValidationError):
        IncomeCreate(amount=-1000, description="무효", date=datetime(2026, 2, 1))


def test_income_update_partial():
    """부분 수정 스키마"""
    update = IncomeUpdate(amount=4000000)
    assert update.amount == 4000000
    assert update.description is None
    assert update.date is None


def test_income_response_from_attributes():
    """응답 스키마 from_attributes"""
    data = {
        "id": 1,
        "user_id": 1,
        "household_id": None,
        "amount": 3500000,
        "description": "월급",
        "category_id": None,
        "raw_input": None,
        "date": datetime(2026, 2, 1),
        "created_at": datetime(2026, 2, 1),
        "updated_at": datetime(2026, 2, 1),
    }
    response = IncomeResponse(**data)
    assert response.id == 1
    assert response.amount == 3500000

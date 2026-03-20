"""입력 길이 제한 유효성 테스트 (#236)

Pydantic 스키마의 max_length 제한이 올바르게 동작하는지 검증.
"""

from datetime import datetime

import pytest
from pydantic import ValidationError

from app.schemas.category import CategoryCreate, CategoryUpdate
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.schemas.income import IncomeCreate, IncomeUpdate


# ===== ExpenseBase.description =====


def test_expense_description_max_length_허용():
    """500자 description은 허용"""
    expense = ExpenseCreate(
        amount=8000,
        description="a" * 500,
        date=datetime(2026, 1, 1),
    )
    assert len(expense.description) == 500


def test_expense_description_max_length_초과_거부():
    """501자 description은 ValidationError"""
    with pytest.raises(ValidationError):
        ExpenseCreate(
            amount=8000,
            description="a" * 501,
            date=datetime(2026, 1, 1),
        )


def test_expense_update_description_max_length_초과_거부():
    """ExpenseUpdate에서도 501자 description은 ValidationError"""
    with pytest.raises(ValidationError):
        ExpenseUpdate(description="a" * 501)


# ===== IncomeBase.description =====


def test_income_description_max_length_허용():
    """500자 description은 허용"""
    income = IncomeCreate(
        amount=3000000,
        description="b" * 500,
        date=datetime(2026, 1, 1),
    )
    assert len(income.description) == 500


def test_income_description_max_length_초과_거부():
    """501자 description은 ValidationError"""
    with pytest.raises(ValidationError):
        IncomeCreate(
            amount=3000000,
            description="b" * 501,
            date=datetime(2026, 1, 1),
        )


def test_income_update_description_max_length_초과_거부():
    """IncomeUpdate에서도 501자 description은 ValidationError"""
    with pytest.raises(ValidationError):
        IncomeUpdate(description="b" * 501)


# ===== CategoryBase.name =====


def test_category_name_max_length_허용():
    """100자 name은 허용"""
    cat = CategoryCreate(name="c" * 100, type="expense")
    assert len(cat.name) == 100


def test_category_name_max_length_초과_거부():
    """101자 name은 ValidationError"""
    with pytest.raises(ValidationError):
        CategoryCreate(name="c" * 101, type="expense")


def test_category_update_name_max_length_초과_거부():
    """CategoryUpdate에서도 101자 name은 ValidationError"""
    with pytest.raises(ValidationError):
        CategoryUpdate(name="c" * 101)


# ===== CategoryBase.description =====


def test_category_description_max_length_허용():
    """500자 description은 허용"""
    cat = CategoryCreate(name="식비", description="d" * 500, type="expense")
    assert len(cat.description) == 500


def test_category_description_max_length_초과_거부():
    """501자 description은 ValidationError"""
    with pytest.raises(ValidationError):
        CategoryCreate(name="식비", description="d" * 501, type="expense")

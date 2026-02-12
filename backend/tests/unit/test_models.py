"""
ORM 모델 단위 테스트

- Expense, Category, Budget 모델의 생성 및 관계 검증
- SQLAlchemy relationship과 기본값 테스트
"""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense


@pytest.mark.asyncio
async def test_create_category(db_session):
    """카테고리 생성 테스트"""
    category = Category(name="식비", description="음식 관련 지출")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    assert category.id is not None
    assert category.name == "식비"
    assert category.description == "음식 관련 지출"
    assert category.created_at is not None


@pytest.mark.asyncio
async def test_create_expense_with_category(db_session):
    """카테고리와 연결된 지출 생성 테스트"""
    # 카테고리 생성
    category = Category(name="교통비", description="대중교통 및 택시")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 지출 생성
    expense = Expense(
        amount=15000.0,
        description="택시",
        category_id=category.id,
        raw_input="택시 15000원",
        date=datetime(2026, 2, 11, 12, 0, 0),
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    # 검증
    assert expense.id is not None
    assert expense.amount == 15000.0
    assert expense.description == "택시"
    assert expense.category_id == category.id
    assert expense.raw_input == "택시 15000원"
    assert expense.created_at is not None
    assert expense.updated_at is not None

    # Relationship 검증
    result = await db_session.execute(select(Expense).where(Expense.id == expense.id))
    loaded_expense = result.scalar_one()
    await db_session.refresh(loaded_expense, ["category"])
    assert loaded_expense.category.name == "교통비"


@pytest.mark.asyncio
async def test_expense_without_category(db_session):
    """카테고리 없는 지출 생성 테스트 (nullable=True)"""
    expense = Expense(
        amount=5000.0,
        description="기타 지출",
        category_id=None,
        date=datetime.now(),
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    assert expense.id is not None
    assert expense.category_id is None


@pytest.mark.asyncio
async def test_budget_creation(db_session):
    """예산 생성 테스트"""
    # 카테고리 생성
    category = Category(name="문화생활", description="여가 및 취미")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 예산 생성
    budget = Budget(
        category_id=category.id,
        amount=100000.0,
        period="monthly",
        start_date=datetime(2026, 2, 1),
        end_date=datetime(2026, 2, 28),
        alert_threshold=0.8,
    )
    db_session.add(budget)
    await db_session.commit()
    await db_session.refresh(budget)

    # 검증
    assert budget.id is not None
    assert budget.amount == 100000.0
    assert budget.period == "monthly"
    assert budget.alert_threshold == 0.8
    assert budget.created_at is not None


@pytest.mark.asyncio
async def test_category_expense_relationship(db_session):
    """카테고리-지출 관계(1:N) 테스트"""
    # 카테고리 생성
    category = Category(name="쇼핑")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 여러 지출 생성
    expense1 = Expense(amount=20000, description="옷", category_id=category.id, date=datetime.now())
    expense2 = Expense(amount=15000, description="신발", category_id=category.id, date=datetime.now())
    db_session.add_all([expense1, expense2])
    await db_session.commit()

    # Relationship 조회
    result = await db_session.execute(select(Category).where(Category.id == category.id))
    loaded_category = result.scalar_one()
    await db_session.refresh(loaded_category, ["expenses"])

    assert len(loaded_category.expenses) == 2
    assert loaded_category.expenses[0].description in ["옷", "신발"]


@pytest.mark.asyncio
async def test_expense_default_date(db_session):
    """지출의 기본 날짜(now) 테스트"""
    expense = Expense(amount=3000, description="테스트")
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    # date는 기본값으로 현재 시간이 설정됨
    assert expense.date is not None
    assert isinstance(expense.date, datetime)

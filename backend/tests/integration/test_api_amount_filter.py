"""
금액 범위 필터 통합 테스트 — TDD (RED → GREEN)

GET /api/expenses?min_amount=N&max_amount=M
GET /api/expenses/search/summary?min_amount=N&max_amount=M
GET /api/income?min_amount=N&max_amount=M
GET /api/income/search/summary?min_amount=N&max_amount=M
"""

from datetime import datetime

import pytest

from app.models.expense import Expense
from app.models.household import Household
from app.models.income import Income
from app.models.user import User

# ── 공통 fixture ──


@pytest.fixture
async def expenses_with_amounts(authenticated_client, test_user: User, test_household: Household, db_session):
    """3000 / 8000 / 30000원 지출 3건 생성"""
    items = [
        Expense(user_id=test_user.id, household_id=test_household.id, amount=3000, description="커피", date=datetime(2026, 2, 1)),
        Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심", date=datetime(2026, 2, 2)),
        Expense(user_id=test_user.id, household_id=test_household.id, amount=30000, description="저녁", date=datetime(2026, 2, 3)),
    ]
    db_session.add_all(items)
    await db_session.commit()
    return items


@pytest.fixture
async def incomes_with_amounts(authenticated_client, test_user: User, test_household: Household, db_session):
    """500000 / 3000000 / 5000000원 수입 3건 생성"""
    items = [
        Income(user_id=test_user.id, household_id=test_household.id, amount=500000, description="부업", date=datetime(2026, 2, 1)),
        Income(user_id=test_user.id, household_id=test_household.id, amount=3000000, description="월급", date=datetime(2026, 2, 2)),
        Income(user_id=test_user.id, household_id=test_household.id, amount=5000000, description="보너스", date=datetime(2026, 2, 3)),
    ]
    db_session.add_all(items)
    await db_session.commit()
    return items


# ── 지출 금액 필터 ──


@pytest.mark.asyncio
async def test_expenses_min_amount_filter(authenticated_client, expenses_with_amounts):
    """min_amount 필터 — 기준 이상만 반환"""
    response = await authenticated_client.get("/api/expenses?min_amount=8000")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    amounts = {int(d["amount"]) for d in data}
    assert amounts == {8000, 30000}


@pytest.mark.asyncio
async def test_expenses_max_amount_filter(authenticated_client, expenses_with_amounts):
    """max_amount 필터 — 기준 이하만 반환"""
    response = await authenticated_client.get("/api/expenses?max_amount=8000")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    amounts = {int(d["amount"]) for d in data}
    assert amounts == {3000, 8000}


@pytest.mark.asyncio
async def test_expenses_amount_range_filter(authenticated_client, expenses_with_amounts):
    """min + max 범위 필터"""
    response = await authenticated_client.get("/api/expenses?min_amount=5000&max_amount=20000")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert int(data[0]["amount"]) == 8000


@pytest.mark.asyncio
async def test_expenses_amount_filter_no_result(authenticated_client, expenses_with_amounts):
    """범위 밖 데이터 — 빈 배열 반환"""
    response = await authenticated_client.get("/api/expenses?min_amount=100000")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_expenses_search_summary_with_amount_filter(authenticated_client, expenses_with_amounts):
    """search/summary 엔드포인트에도 금액 필터 적용"""
    response = await authenticated_client.get("/api/expenses/search/summary?min_amount=8000")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 2
    assert int(data["total_amount"]) == 38000


# ── 수입 금액 필터 ──


@pytest.mark.asyncio
async def test_income_min_amount_filter(authenticated_client, incomes_with_amounts):
    """min_amount 필터 — 기준 이상만 반환"""
    response = await authenticated_client.get("/api/income?min_amount=3000000")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    amounts = {int(d["amount"]) for d in data}
    assert amounts == {3000000, 5000000}


@pytest.mark.asyncio
async def test_income_max_amount_filter(authenticated_client, incomes_with_amounts):
    """max_amount 필터 — 기준 이하만 반환"""
    response = await authenticated_client.get("/api/income?max_amount=3000000")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    amounts = {int(d["amount"]) for d in data}
    assert amounts == {500000, 3000000}


@pytest.mark.asyncio
async def test_income_amount_range_filter(authenticated_client, incomes_with_amounts):
    """min + max 범위 필터"""
    response = await authenticated_client.get("/api/income?min_amount=1000000&max_amount=4000000")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert int(data[0]["amount"]) == 3000000


@pytest.mark.asyncio
async def test_income_amount_filter_no_result(authenticated_client, incomes_with_amounts):
    """범위 밖 데이터 — 빈 배열 반환"""
    response = await authenticated_client.get("/api/income?max_amount=1000")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_income_search_summary_with_amount_filter(authenticated_client, incomes_with_amounts):
    """search/summary 엔드포인트에도 금액 필터 적용"""
    response = await authenticated_client.get("/api/income/search/summary?min_amount=3000000")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 2
    assert int(data["total_amount"]) == 8000000

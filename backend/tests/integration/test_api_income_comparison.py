"""수입 기간 비교 API 통합 테스트"""

from datetime import datetime

import pytest

from app.models.category import Category
from app.models.household import Household
from app.models.income import Income
from app.models.user import User


@pytest.mark.asyncio
async def test_income_comparison_monthly(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 수입 비교 — 이번 달 vs 전월"""
    db_session.add_all(
        [
            # 2026년 2월 (현재)
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="2월 월급", date=datetime(2026, 2, 1)),
            Income(user_id=test_user.id, household_id=test_household.id, amount=500000, description="2월 보너스", date=datetime(2026, 2, 15)),
            # 2026년 1월 (전월)
            Income(user_id=test_user.id, household_id=test_household.id, amount=3000000, description="1월 월급", date=datetime(2026, 1, 10)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats/comparison?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()

    # 응답 구조
    assert "current" in data
    assert "previous" in data
    assert "change" in data
    assert "trend" in data
    assert "by_category_comparison" in data

    # 금액 검증
    assert data["current"]["total"] == 4000000
    assert data["previous"]["total"] == 3000000

    # 변화량
    assert data["change"]["amount"] == 1000000
    assert data["change"]["percentage"] == pytest.approx(33.3, abs=0.1)

    # 트렌드 (기본 3개월)
    assert len(data["trend"]) == 3


@pytest.mark.asyncio
async def test_income_comparison_monthly_no_previous(authenticated_client, test_user: User, test_household: Household, db_session):
    """전월 수입이 없는 경우"""
    db_session.add(Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="월급", date=datetime(2026, 2, 1)))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats/comparison?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()

    assert data["current"]["total"] == 3500000
    assert data["previous"]["total"] == 0
    assert data["change"]["percentage"] is None  # 0으로 나눌 수 없음


@pytest.mark.asyncio
async def test_income_comparison_yearly(authenticated_client, test_user: User, test_household: Household, db_session):
    """연간 수입 비교"""
    db_session.add_all(
        [
            Income(user_id=test_user.id, household_id=test_household.id, amount=40000000, description="2026 연봉", date=datetime(2026, 6, 1)),
            Income(user_id=test_user.id, household_id=test_household.id, amount=36000000, description="2025 연봉", date=datetime(2025, 6, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats/comparison?period=yearly&date=2026-06-15")
    assert response.status_code == 200
    data = response.json()

    assert data["current"]["total"] == 40000000
    assert data["previous"]["total"] == 36000000
    assert data["change"]["amount"] == 4000000


@pytest.mark.asyncio
async def test_income_comparison_with_categories(authenticated_client, test_user: User, test_household: Household, db_session):
    """카테고리별 수입 비교"""
    cat = Category(name="급여", type="income", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="2월 월급", category_id=cat.id, date=datetime(2026, 2, 1)),
            Income(user_id=test_user.id, household_id=test_household.id, amount=3000000, description="1월 월급", category_id=cat.id, date=datetime(2026, 1, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats/comparison?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()

    assert len(data["by_category_comparison"]) >= 1
    salary_cat = next(c for c in data["by_category_comparison"] if c["category"] == "급여")
    assert salary_cat["current"] == 3500000
    assert salary_cat["previous"] == 3000000
    assert salary_cat["change_amount"] == 500000


@pytest.mark.asyncio
async def test_income_comparison_empty(authenticated_client):
    """수입이 전혀 없는 경우"""
    response = await authenticated_client.get("/api/income/stats/comparison?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()
    assert data["current"]["total"] == 0
    assert data["previous"]["total"] == 0
    assert data["change"]["amount"] == 0
    assert data["change"]["percentage"] is None


@pytest.mark.asyncio
async def test_income_comparison_invalid_period(authenticated_client):
    """잘못된 period 값 → 422"""
    response = await authenticated_client.get("/api/income/stats/comparison?period=daily")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_income_comparison_custom_months(authenticated_client, test_user: User, test_household: Household, db_session):
    """months 파라미터로 트렌드 기간 조절"""
    db_session.add(Income(user_id=test_user.id, household_id=test_household.id, amount=1000000, description="수입", date=datetime(2026, 2, 1)))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats/comparison?period=monthly&date=2026-02-15&months=6")
    assert response.status_code == 200
    data = response.json()
    assert len(data["trend"]) == 6


@pytest.mark.asyncio
async def test_income_comparison_excludes_stats_excluded(authenticated_client, test_user: User, test_household: Household, db_session):
    """exclude_from_stats=True 수입은 비교에서 제외"""
    db_session.add_all(
        [
            Income(
                user_id=test_user.id, household_id=test_household.id, amount=3500000, description="월급", date=datetime(2026, 2, 1), exclude_from_stats=False
            ),
            Income(
                user_id=test_user.id, household_id=test_household.id, amount=50000000, description="퇴직금", date=datetime(2026, 2, 15), exclude_from_stats=True
            ),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats/comparison?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()
    assert data["current"]["total"] == 3500000  # 퇴직금 제외

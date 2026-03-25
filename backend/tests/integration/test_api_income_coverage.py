"""수입 API 커버리지 강화 테스트 (#397)

미커버 영역:
- GET /api/income/stats — 연간 통계 (yearly trend 12포인트)
- GET /api/income/stats — exclude_from_stats 제외
- GET /api/income/stats — 일별 trend 라벨 형식
- GET /api/income — member_user_id 필터
- GET /api/income — member_user_id + query 복합 필터
- GET /api/income — member_user_id + category_id 복합 필터
- GET /api/income — member_user_id + date 복합 필터
- GET /api/income/search/summary — member_user_id 필터
- GET /api/income/search/summary — date + category 복합 필터
- GET /api/income — YYYY-MM-DD 형식 날짜 필터 (end_date 자동 23:59:59)
- GET /api/income — category_id 필터
"""

from datetime import datetime

import pytest

from app.models.category import Category
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.user import User

# ── income/stats yearly ──────────────────


@pytest.mark.asyncio
async def test_income_stats_yearly(authenticated_client, test_user: User, test_household: Household, db_session):
    """연간 수입 통계 — 12포인트 월별 트렌드"""
    cat = Category(name="급여", type="income", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="1월 월급", category_id=cat.id, date=datetime(2026, 1, 1)),
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="3월 월급", category_id=cat.id, date=datetime(2026, 3, 1)),
            Income(
                user_id=test_user.id, household_id=test_household.id, amount=500000, description="3월 보너스", category_id=cat.id, date=datetime(2026, 3, 15)
            ),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=yearly&date=2026-06-01")
    assert response.status_code == 200

    data = response.json()
    assert data["period"] == "yearly"
    assert data["total"] == 7500000.0
    assert data["count"] == 3
    assert len(data["trend"]) == 12

    trend_map = {t["label"]: t["amount"] for t in data["trend"]}
    assert trend_map["1월"] == 3500000.0
    assert trend_map["3월"] == 4000000.0  # 3500000 + 500000
    assert trend_map["2월"] == 0.0
    assert trend_map["12월"] == 0.0


# ── income/stats exclude_from_stats ──────────────────


@pytest.mark.asyncio
async def test_income_stats_excludes_flagged(authenticated_client, test_user: User, test_household: Household, db_session):
    """exclude_from_stats=True 수입은 통계에서 제외"""
    db_session.add_all(
        [
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="월급", date=datetime(2026, 2, 1)),
            Income(
                user_id=test_user.id, household_id=test_household.id, amount=50000000, description="퇴직금", date=datetime(2026, 2, 15), exclude_from_stats=True
            ),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-02-15")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 3500000.0
    assert data["count"] == 1


# ── income/stats daily trend 라벨 형식 ──────────────────


@pytest.mark.asyncio
async def test_income_stats_daily_trend_label(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 수입 통계 — 일별 트렌드 라벨 형식 (MM/DD)"""
    db_session.add(Income(user_id=test_user.id, household_id=test_household.id, amount=100000, description="용돈", date=datetime(2026, 3, 5)))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-03-15")
    assert response.status_code == 200

    data = response.json()
    assert len(data["trend"]) >= 1
    assert data["trend"][0]["label"] == "03/05"


# ── income 목록 — member_user_id 필터 ──────────────────


@pytest.mark.asyncio
async def test_incomes_member_user_id_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """member_user_id로 특정 멤버의 수입만 필터링"""
    user2 = User(auth_user_id="inc-cov-0001-0000-0000-000000000001", username="inc_member", email="inc_member@test.com", is_active=True)
    db_session.add(user2)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=user2.id, role="member"))
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="내 월급", date=datetime(2026, 3, 1)),
            Income(user_id=user2.id, household_id=test_household.id, amount=2000000, description="멤버 월급", date=datetime(2026, 3, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/income?member_user_id={user2.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "멤버 월급"


# ── income 목록 — member_user_id + query 복합 ──────────────────


@pytest.mark.asyncio
async def test_incomes_member_and_query_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """member_user_id + query 복합 필터"""
    user2 = User(auth_user_id="inc-cov-0002-0000-0000-000000000002", username="inc_member2", email="inc_member2@test.com", is_active=True)
    db_session.add(user2)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=user2.id, role="member"))
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=user2.id, household_id=test_household.id, amount=3500000, description="월급", date=datetime(2026, 3, 1)),
            Income(user_id=user2.id, household_id=test_household.id, amount=500000, description="보너스", date=datetime(2026, 3, 15)),
            Income(user_id=test_user.id, household_id=test_household.id, amount=100000, description="월급 추가", date=datetime(2026, 3, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/income?member_user_id={user2.id}&query=월급")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "월급"
    assert data[0]["user_id"] == user2.id


# ── income 목록 — member_user_id + category_id 복합 ──────────────────


@pytest.mark.asyncio
async def test_incomes_member_and_category_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """member_user_id + category_id 복합 필터"""
    cat = Category(name="급여", type="income", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    user2 = User(auth_user_id="inc-cov-0003-0000-0000-000000000003", username="inc_member3", email="inc_member3@test.com", is_active=True)
    db_session.add(user2)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=user2.id, role="member"))
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=user2.id, household_id=test_household.id, amount=3500000, description="월급", category_id=cat.id, date=datetime(2026, 3, 1)),
            Income(user_id=user2.id, household_id=test_household.id, amount=200000, description="용돈", category_id=None, date=datetime(2026, 3, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/income?member_user_id={user2.id}&category_id={cat.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "월급"


# ── income 목록 — member_user_id + date 복합 ──────────────────


@pytest.mark.asyncio
async def test_incomes_member_and_date_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """member_user_id + 날짜 필터 조합"""
    user2 = User(auth_user_id="inc-cov-0004-0000-0000-000000000004", username="inc_member4", email="inc_member4@test.com", is_active=True)
    db_session.add(user2)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=user2.id, role="member"))
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=user2.id, household_id=test_household.id, amount=3500000, description="2월 월급", date=datetime(2026, 2, 1)),
            Income(user_id=user2.id, household_id=test_household.id, amount=3500000, description="3월 월급", date=datetime(2026, 3, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/income?member_user_id={user2.id}&start_date=2026-03-01&end_date=2026-03-31")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "3월 월급"


# ── search/summary — member_user_id 필터 ──────────────────


@pytest.mark.asyncio
async def test_income_search_summary_member_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """수입 search/summary — member_user_id 필터"""
    user2 = User(auth_user_id="inc-cov-0005-0000-0000-000000000005", username="inc_member5", email="inc_member5@test.com", is_active=True)
    db_session.add(user2)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=user2.id, role="member"))
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="내 월급", date=datetime(2026, 3, 1)),
            Income(user_id=user2.id, household_id=test_household.id, amount=2000000, description="멤버 월급", date=datetime(2026, 3, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/income/search/summary?member_user_id={user2.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 1
    assert data["total_amount"] == 2000000.0


# ── search/summary — date + category 복합 ──────────────────


@pytest.mark.asyncio
async def test_income_search_summary_date_and_category(authenticated_client, test_user: User, test_household: Household, db_session):
    """수입 search/summary — 날짜 + 카테고리 복합 필터"""
    cat = Category(name="급여", type="income", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="3월 월급", category_id=cat.id, date=datetime(2026, 3, 1)),
            Income(user_id=test_user.id, household_id=test_household.id, amount=200000, description="3월 용돈", category_id=None, date=datetime(2026, 3, 15)),
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="2월 월급", category_id=cat.id, date=datetime(2026, 2, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/income/search/summary?category_id={cat.id}&start_date=2026-03-01&end_date=2026-03-31")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 1
    assert data["total_amount"] == 3500000.0


# ── income 목록 — YYYY-MM-DD end_date 자동 23:59:59 ──────────────────


@pytest.mark.asyncio
async def test_incomes_date_only_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """YYYY-MM-DD 형식 end_date — 자동 23:59:59 처리"""
    db_session.add_all(
        [
            Income(user_id=test_user.id, household_id=test_household.id, amount=100000, description="3월 15일 저녁 수입", date=datetime(2026, 3, 15, 23, 0, 0)),
            Income(user_id=test_user.id, household_id=test_household.id, amount=200000, description="3월 16일 수입", date=datetime(2026, 3, 16, 10, 0, 0)),
        ]
    )
    await db_session.commit()

    # end_date=2026-03-15 (YYYY-MM-DD) → 자동 23:59:59로 변환되어 15일 23시 수입 포함
    response = await authenticated_client.get("/api/income?start_date=2026-03-15&end_date=2026-03-15")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "3월 15일 저녁 수입"


# ── income 목록 — category_id 필터 ──────────────────


@pytest.mark.asyncio
async def test_incomes_category_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """category_id 필터"""
    cat1 = Category(name="급여", type="income", user_id=test_user.id)
    cat2 = Category(name="부수입", type="income", user_id=test_user.id)
    db_session.add_all([cat1, cat2])
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=test_user.id, household_id=test_household.id, amount=3500000, description="월급", category_id=cat1.id, date=datetime(2026, 3, 1)),
            Income(user_id=test_user.id, household_id=test_household.id, amount=200000, description="프리랜스", category_id=cat2.id, date=datetime(2026, 3, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/income?category_id={cat1.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "월급"


# ── income stats — 미분류 카테고리 ──────────────────


@pytest.mark.asyncio
async def test_income_stats_uncategorized(authenticated_client, test_user: User, test_household: Household, db_session):
    """카테고리 없는 수입은 통계에서 '미분류'로 표시"""
    db_session.add(
        Income(user_id=test_user.id, household_id=test_household.id, amount=100000, description="미분류 수입", category_id=None, date=datetime(2026, 3, 15))
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-03-15")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 100000.0
    assert len(data["by_category"]) == 1
    assert data["by_category"][0]["category"] == "미분류"
    assert data["by_category"][0]["percentage"] == 100.0

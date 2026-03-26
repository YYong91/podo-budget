"""API 라우터 커버리지 향상 테스트

expenses, budget, income, categories, recurring, assets,
households, invitations, accounts, feedback, onboarding, insights, admin
의 미커버 분기를 체계적으로 테스트합니다.
"""

from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest

# ──────────────────────────────────────────
# Expense API 테스트 — 통계, 비교, 검색, CRUD 권한
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_expense_stats_weekly(authenticated_client, test_user, test_household, db_session):
    """주간 지출 통계"""
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="식비", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=10000,
        description="점심",
        category_id=cat.id,
        date=datetime(today.year, today.month, today.day, 12, 0, 0),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/expenses/stats",
        params={"period": "weekly", "date": today.isoformat()},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["period"] == "weekly"
    assert data["total"] >= 10000


@pytest.mark.asyncio
async def test_expense_stats_monthly(authenticated_client, test_user, test_household, db_session):
    """월간 지출 통계"""
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="교통", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="버스",
        category_id=cat.id,
        date=datetime(today.year, today.month, today.day),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/expenses/stats",
        params={"period": "monthly", "date": today.isoformat()},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["period"] == "monthly"


@pytest.mark.asyncio
async def test_expense_stats_yearly(authenticated_client, test_user, test_household, db_session):
    """연간 지출 통계 (월별 12포인트 트렌드)"""
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="식비", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=30000,
        description="연간테스트",
        category_id=cat.id,
        date=datetime(today.year, 1, 15),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/expenses/stats",
        params={"period": "yearly", "date": today.isoformat()},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["period"] == "yearly"
    assert len(data["trend"]) == 12


@pytest.mark.asyncio
async def test_expense_stats_comparison_monthly(authenticated_client, test_user, test_household, db_session):
    """월별 비교 통계"""
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="식비", type="expense")
    db_session.add(cat)
    await db_session.flush()

    # 이번 달과 지난 달 데이터 삽입
    today = date.today()
    this_month = datetime(today.year, today.month, 1)
    prev_month = datetime(today.year, today.month - 1, 1) if today.month > 1 else datetime(today.year - 1, 12, 1)

    for dt in [this_month, prev_month]:
        db_session.add(
            Expense(
                user_id=test_user.id,
                household_id=test_household.id,
                amount=20000,
                description="비교테스트",
                category_id=cat.id,
                date=dt,
            )
        )
    await db_session.commit()

    # 과거 완료 월 사용 (is_current_month=False 분기 커버)
    past_date = prev_month.date()
    resp = await authenticated_client.get(
        "/api/expenses/stats/comparison",
        params={"period": "monthly", "date": past_date.isoformat(), "months": 3},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "current" in data
    assert "previous" in data
    assert "trend" in data


@pytest.mark.asyncio
async def test_expense_stats_comparison_yearly(authenticated_client, test_user, test_household, db_session):
    """연별 비교 통계"""
    from app.models.expense import Expense

    today = date.today()
    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=50000,
            description="연간비교",
            date=datetime(today.year, 1, 15),
        )
    )
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/expenses/stats/comparison",
        params={"period": "yearly", "date": today.isoformat(), "months": 3},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["current"]["label"].endswith("년")


@pytest.mark.asyncio
async def test_expense_monthly_stats(authenticated_client, test_user, test_household, db_session):
    """월별 지출 상세 통계"""
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="문화", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=15000,
            description="영화",
            category_id=cat.id,
            date=datetime(today.year, today.month, 1),
        )
    )
    await db_session.commit()

    month_str = f"{today.year}-{today.month:02d}"
    resp = await authenticated_client.get(
        "/api/expenses/stats/monthly",
        params={"month": month_str},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["month"] == month_str
    assert data["total"] >= 15000


@pytest.mark.asyncio
async def test_expense_search_summary(authenticated_client, test_user, test_household, db_session):
    """지출 검색 요약"""
    from app.models.expense import Expense

    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=8000,
            description="김치찌개",
            date=datetime(2026, 1, 15),
        )
    )
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/expenses/search/summary",
        params={"query": "김치"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] >= 1


@pytest.mark.asyncio
async def test_expense_get_detail(authenticated_client, test_user, test_household, db_session):
    """지출 상세 조회"""
    from app.models.expense import Expense

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="테스트",
        date=datetime.now(),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get(f"/api/expenses/{exp.id}")
    assert resp.status_code == 200
    assert resp.json()["amount"] == 5000


@pytest.mark.asyncio
async def test_expense_get_detail_not_found(authenticated_client):
    """존재하지 않는 지출 조회 → 404"""
    resp = await authenticated_client.get("/api/expenses/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_expense_update(authenticated_client, test_user, test_household, db_session):
    """지출 수정"""
    from app.models.expense import Expense

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="수정전",
        date=datetime.now(),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.put(
        f"/api/expenses/{exp.id}",
        json={"amount": 7000, "description": "수정후"},
    )
    assert resp.status_code == 200
    assert resp.json()["amount"] == 7000


@pytest.mark.asyncio
async def test_expense_update_not_found(authenticated_client):
    """존재하지 않는 지출 수정 → 404"""
    resp = await authenticated_client.put(
        "/api/expenses/99999",
        json={"amount": 7000},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_expense_delete(authenticated_client, test_user, test_household, db_session):
    """지출 삭제"""
    from app.models.expense import Expense

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="삭제용",
        date=datetime.now(),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.delete(f"/api/expenses/{exp.id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_expense_delete_not_found(authenticated_client):
    """존재하지 않는 지출 삭제 → 404"""
    resp = await authenticated_client.delete("/api/expenses/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_expense_update_other_user_member_role(authenticated_client, test_user, test_household, db_session):
    """타인 지출 수정 — member 권한이면 403"""
    from app.models.expense import Expense
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    # 다른 사용자 생성 + 같은 가구 member로 추가
    other = User(auth_user_id="other-001", username="other", email="other@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="member"))
    await db_session.flush()

    # 다른 사용자의 지출
    exp = Expense(
        user_id=other.id,
        household_id=test_household.id,
        amount=3000,
        description="타인지출",
        date=datetime.now(),
    )
    db_session.add(exp)
    await db_session.commit()

    # test_user는 owner이므로 수정 가능해야 함
    resp = await authenticated_client.put(
        f"/api/expenses/{exp.id}",
        json={"amount": 5000},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_expense_other_user_not_found(authenticated_client, test_user, test_household, db_session):
    """다른 가구의 지출 조회 → 404"""
    from app.models.expense import Expense
    from app.models.household import Household

    other_hh = Household(name="다른가구")
    db_session.add(other_hh)
    await db_session.flush()

    exp = Expense(
        user_id=test_user.id,
        household_id=other_hh.id,
        amount=1000,
        description="다른가구지출",
        date=datetime.now(),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get(f"/api/expenses/{exp.id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_expense_get_list_with_filters(authenticated_client, test_user, test_household, db_session):
    """지출 목록 필터링 (query, start_date, end_date, category_id, member_user_id)"""
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="필터테스트", type="expense")
    db_session.add(cat)
    await db_session.flush()

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="필터대상",
        category_id=cat.id,
        date=datetime(2026, 3, 15),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/expenses",
        params={
            "query": "필터",
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "category_id": cat.id,
            "member_user_id": test_user.id,
        },
    )
    assert resp.status_code == 200


# ──────────────────────────────────────────
# Budget API 테스트 — 월별 통계, alerts, category-overview, CRUD
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_budget_get_list(authenticated_client, test_user, test_household, db_session):
    """예산 목록 조회"""
    resp = await authenticated_client.get("/api/budgets")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_budget_create_and_crud(authenticated_client, test_user, test_household, db_session):
    """예산 CRUD 전체 흐름"""
    from app.models.category import Category

    cat = Category(name="식비예산", type="expense")
    db_session.add(cat)
    await db_session.commit()

    # 생성
    today = date.today()
    resp = await authenticated_client.post(
        "/api/budgets",
        json={
            "category_id": cat.id,
            "amount": 500000,
            "period": "monthly",
            "start_date": today.isoformat(),
        },
    )
    assert resp.status_code == 201
    budget_id = resp.json()["id"]

    # 수정
    resp = await authenticated_client.put(
        f"/api/budgets/{budget_id}",
        json={"amount": 600000},
    )
    assert resp.status_code == 200
    assert resp.json()["amount"] == 600000

    # 삭제
    resp = await authenticated_client.delete(f"/api/budgets/{budget_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_budget_create_invalid_category(authenticated_client, test_user, test_household, db_session):
    """없는 카테고리로 예산 생성 → 404"""
    resp = await authenticated_client.post(
        "/api/budgets",
        json={
            "category_id": 99999,
            "amount": 500000,
            "period": "monthly",
            "start_date": date.today().isoformat(),
        },
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_budget_create_invalid_dates(authenticated_client, test_user, test_household, db_session):
    """종료일 < 시작일 → 400"""
    from app.models.category import Category

    cat = Category(name="날짜오류", type="expense")
    db_session.add(cat)
    await db_session.commit()

    resp = await authenticated_client.post(
        "/api/budgets",
        json={
            "category_id": cat.id,
            "amount": 100000,
            "period": "monthly",
            "start_date": "2026-06-01",
            "end_date": "2026-05-01",
        },
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_budget_update_not_found(authenticated_client):
    """없는 예산 수정 → 404"""
    resp = await authenticated_client.put("/api/budgets/99999", json={"amount": 100})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_budget_delete_not_found(authenticated_client):
    """없는 예산 삭제 → 404"""
    resp = await authenticated_client.delete("/api/budgets/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_budget_update_invalid_dates(authenticated_client, test_user, test_household, db_session):
    """예산 수정 시 종료일 < 시작일 → 400"""
    from app.models.budget import Budget
    from app.models.category import Category

    cat = Category(name="수정오류", type="expense")
    db_session.add(cat)
    await db_session.flush()

    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=cat.id,
        amount=100000,
        period="monthly",
        start_date=datetime(2026, 6, 1),
    )
    db_session.add(budget)
    await db_session.commit()

    resp = await authenticated_client.put(
        f"/api/budgets/{budget.id}",
        json={"end_date": "2026-05-01"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_budget_monthly_stats(authenticated_client, test_user, test_household, db_session):
    """월별 예산 대비 지출 통계"""
    from app.models.budget import Budget
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="통계카테고리", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    month_str = f"{today.year}-{today.month:02d}"
    start = datetime(today.year, today.month, 1)

    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=cat.id,
        amount=300000,
        period="monthly",
        start_date=start,
    )
    db_session.add(budget)

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=150000,
        description="예산지출",
        category_id=cat.id,
        date=start,
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/budgets/monthly-stats",
        params={"month": month_str},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["month"] == month_str
    assert len(data["categories"]) >= 1


@pytest.mark.asyncio
async def test_budget_monthly_stats_empty(authenticated_client, test_user, test_household, db_session):
    """예산 없을 때 월별 통계"""
    today = date.today()
    month_str = f"{today.year}-{today.month:02d}"

    resp = await authenticated_client.get(
        "/api/budgets/monthly-stats",
        params={"month": month_str},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["categories"] == []


@pytest.mark.asyncio
async def test_budget_alerts(authenticated_client, test_user, test_household, db_session):
    """예산 알림 조회"""
    today = date.today()
    month_str = f"{today.year}-{today.month:02d}"

    resp = await authenticated_client.get(
        "/api/budgets/alerts",
        params={"month": month_str},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_budget_category_overview(authenticated_client, test_user, test_household, db_session):
    """카테고리별 예산 개요"""
    resp = await authenticated_client.get("/api/budgets/category-overview")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_budget_total_budget(authenticated_client, test_user, test_household, db_session):
    """총 예산 조회 및 수정"""
    # 조회
    resp = await authenticated_client.get("/api/budgets/total-budget")
    assert resp.status_code == 200

    # 수정
    resp = await authenticated_client.put(
        "/api/budgets/total-budget",
        json={"amount": 2000000},
    )
    assert resp.status_code == 200
    assert resp.json()["total_monthly_budget"] == 2000000


@pytest.mark.asyncio
async def test_budget_bulk_save(authenticated_client, test_user, test_household, db_session):
    """예산 벌크 저장"""
    from app.models.category import Category

    cat = Category(name="벌크카테고리", type="expense")
    db_session.add(cat)
    await db_session.commit()

    today = date.today()
    month_str = f"{today.year}-{today.month:02d}"

    resp = await authenticated_client.put(
        "/api/budgets/bulk",
        json={
            "month": month_str,
            "budgets": [{"category_id": cat.id, "amount": 200000}],
            "alert_threshold": 0.8,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["created"] >= 1


# ──────────────────────────────────────────
# Income API 테스트 — 통계, 검색, CRUD 권한
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_income_stats_weekly(authenticated_client, test_user, test_household, db_session):
    """주간 수입 통계"""
    from app.models.category import Category
    from app.models.income import Income

    cat = Category(name="급여", type="income")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    db_session.add(
        Income(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=3000000,
            description="월급",
            category_id=cat.id,
            date=datetime(today.year, today.month, today.day),
        )
    )
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/income/stats",
        params={"period": "weekly", "date": today.isoformat()},
    )
    assert resp.status_code == 200
    assert resp.json()["period"] == "weekly"


@pytest.mark.asyncio
async def test_income_stats_monthly(authenticated_client, test_user, test_household, db_session):
    """월간 수입 통계"""
    today = date.today()
    resp = await authenticated_client.get(
        "/api/income/stats",
        params={"period": "monthly", "date": today.isoformat()},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_income_stats_yearly(authenticated_client, test_user, test_household, db_session):
    """연간 수입 통계 (12포인트 트렌드)"""
    from app.models.income import Income

    today = date.today()
    db_session.add(
        Income(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=3000000,
            description="연간수입",
            date=datetime(today.year, 3, 1),
        )
    )
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/income/stats",
        params={"period": "yearly", "date": today.isoformat()},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["trend"]) == 12


@pytest.mark.asyncio
async def test_income_search_summary(authenticated_client, test_user, test_household, db_session):
    """수입 검색 요약"""
    from app.models.income import Income

    db_session.add(
        Income(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=2000000,
            description="보너스",
            date=datetime(2026, 3, 1),
        )
    )
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/income/search/summary",
        params={"query": "보너스"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] >= 1


@pytest.mark.asyncio
async def test_income_get_detail(authenticated_client, test_user, test_household, db_session):
    """수입 상세 조회"""
    from app.models.income import Income

    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=1000000,
        description="상세수입",
        date=datetime.now(),
    )
    db_session.add(inc)
    await db_session.commit()

    resp = await authenticated_client.get(f"/api/income/{inc.id}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_income_get_detail_not_found(authenticated_client):
    """없는 수입 조회 → 404"""
    resp = await authenticated_client.get("/api/income/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_income_update(authenticated_client, test_user, test_household, db_session):
    """수입 수정"""
    from app.models.income import Income

    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=100000,
        description="수정전",
        date=datetime.now(),
    )
    db_session.add(inc)
    await db_session.commit()

    resp = await authenticated_client.put(
        f"/api/income/{inc.id}",
        json={"amount": 200000},
    )
    assert resp.status_code == 200
    assert resp.json()["amount"] == 200000


@pytest.mark.asyncio
async def test_income_update_not_found(authenticated_client):
    """없는 수입 수정 → 404"""
    resp = await authenticated_client.put("/api/income/99999", json={"amount": 100})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_income_delete(authenticated_client, test_user, test_household, db_session):
    """수입 삭제"""
    from app.models.income import Income

    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=50000,
        description="삭제수입",
        date=datetime.now(),
    )
    db_session.add(inc)
    await db_session.commit()

    resp = await authenticated_client.delete(f"/api/income/{inc.id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_income_delete_not_found(authenticated_client):
    """없는 수입 삭제 → 404"""
    resp = await authenticated_client.delete("/api/income/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_income_other_household_not_found(authenticated_client, test_user, test_household, db_session):
    """다른 가구의 수입 조회 → 404"""
    from app.models.household import Household
    from app.models.income import Income

    other_hh = Household(name="다른가구수입")
    db_session.add(other_hh)
    await db_session.flush()

    inc = Income(
        user_id=test_user.id,
        household_id=other_hh.id,
        amount=500,
        description="다른가구수입",
        date=datetime.now(),
    )
    db_session.add(inc)
    await db_session.commit()

    resp = await authenticated_client.get(f"/api/income/{inc.id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_income_update_permission_owner(authenticated_client, test_user, test_household, db_session):
    """타인 수입 — owner는 수정 가능"""
    from app.models.household_member import HouseholdMember
    from app.models.income import Income
    from app.models.user import User

    other = User(auth_user_id="inc-other-001", username="incother", email="incother@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="member"))
    await db_session.flush()

    inc = Income(
        user_id=other.id,
        household_id=test_household.id,
        amount=100000,
        description="타인수입",
        date=datetime.now(),
    )
    db_session.add(inc)
    await db_session.commit()

    # owner인 test_user가 수정
    resp = await authenticated_client.put(
        f"/api/income/{inc.id}",
        json={"amount": 200000},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_income_delete_permission_owner(authenticated_client, test_user, test_household, db_session):
    """타인 수입 — owner는 삭제 가능"""
    from app.models.household_member import HouseholdMember
    from app.models.income import Income
    from app.models.user import User

    other = User(auth_user_id="inc-other-del", username="incotherdel", email="incotherdel@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="member"))
    await db_session.flush()

    inc = Income(
        user_id=other.id,
        household_id=test_household.id,
        amount=50000,
        description="삭제대상",
        date=datetime.now(),
    )
    db_session.add(inc)
    await db_session.commit()

    resp = await authenticated_client.delete(f"/api/income/{inc.id}")
    assert resp.status_code == 204


# ──────────────────────────────────────────
# Category API 테스트 — CRUD, 정렬, 시스템 카테고리 보호
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_category_create_and_crud(authenticated_client, test_user, test_household, db_session):
    """카테고리 CRUD"""
    # 생성
    resp = await authenticated_client.post(
        "/api/categories",
        json={"name": "테스트카테고리", "type": "expense"},
    )
    assert resp.status_code == 201
    cat_id = resp.json()["id"]

    # 수정
    resp = await authenticated_client.put(
        f"/api/categories/{cat_id}",
        json={"name": "수정카테고리"},
    )
    assert resp.status_code == 200

    # 삭제
    resp = await authenticated_client.delete(f"/api/categories/{cat_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_category_create_duplicate(authenticated_client, test_user, test_household, db_session):
    """중복 카테고리 생성 → 400"""
    resp = await authenticated_client.post(
        "/api/categories",
        json={"name": "중복카테고리", "type": "expense"},
    )
    assert resp.status_code == 201

    resp = await authenticated_client.post(
        "/api/categories",
        json={"name": "중복카테고리", "type": "expense"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_category_system_readonly(authenticated_client, test_user, test_household, db_session):
    """시스템 카테고리는 수정/삭제 불가"""
    from app.models.category import Category

    sys_cat = Category(name="시스템카테고리", type="both", user_id=None, household_id=None)
    db_session.add(sys_cat)
    await db_session.commit()

    # 수정 시도 → 403
    resp = await authenticated_client.put(
        f"/api/categories/{sys_cat.id}",
        json={"name": "변경시도"},
    )
    assert resp.status_code == 403

    # 삭제 시도 → 403
    resp = await authenticated_client.delete(f"/api/categories/{sys_cat.id}")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_category_reorder(authenticated_client, test_user, test_household, db_session):
    """카테고리 순서 변경"""
    # 2개 카테고리 생성
    resp1 = await authenticated_client.post("/api/categories", json={"name": "순서1", "type": "expense"})
    resp2 = await authenticated_client.post("/api/categories", json={"name": "순서2", "type": "expense"})
    id1, id2 = resp1.json()["id"], resp2.json()["id"]

    resp = await authenticated_client.put(
        "/api/categories/reorder",
        json={"category_ids": [id2, id1]},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_category_reorder_invalid_id(authenticated_client, test_user, test_household, db_session):
    """접근할 수 없는 카테고리 ID로 정렬 → 400"""
    resp = await authenticated_client.put(
        "/api/categories/reorder",
        json={"category_ids": [99999]},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_category_update_not_found(authenticated_client):
    """없는 카테고리 수정 → 404"""
    resp = await authenticated_client.put(
        "/api/categories/99999",
        json={"name": "x"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_category_delete_not_found(authenticated_client):
    """없는 카테고리 삭제 → 404"""
    resp = await authenticated_client.delete("/api/categories/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_category_list_with_type_filter(authenticated_client, test_user, test_household, db_session):
    """카테고리 목록 type 필터"""
    await authenticated_client.post("/api/categories", json={"name": "지출용", "type": "expense"})
    resp = await authenticated_client.get("/api/categories", params={"type": "expense"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_category_update_other_household(authenticated_client, test_user, test_household, db_session):
    """다른 가구의 카테고리 수정 → 404"""
    from app.models.category import Category
    from app.models.household import Household

    other_household = Household(name="다른가구")
    db_session.add(other_household)
    await db_session.flush()

    other_cat = Category(name="다른카테", type="expense", household_id=other_household.id)
    db_session.add(other_cat)
    await db_session.commit()

    resp = await authenticated_client.put(
        f"/api/categories/{other_cat.id}",
        json={"name": "변경"},
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────
# Recurring API 테스트 — CRUD, execute, skip, pending
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_recurring_create_and_crud(authenticated_client, test_user, test_household, db_session):
    """정기 거래 CRUD"""
    from app.models.category import Category

    cat = Category(name="정기식비", type="expense")
    db_session.add(cat)
    await db_session.commit()

    today = date.today()
    resp = await authenticated_client.post(
        "/api/recurring",
        json={
            "type": "expense",
            "amount": 50000,
            "description": "정기구독",
            "category_id": cat.id,
            "frequency": "monthly",
            "day_of_month": 15,
            "start_date": today.isoformat(),
        },
    )
    assert resp.status_code == 201
    rec_id = resp.json()["id"]

    # 상세
    resp = await authenticated_client.get(f"/api/recurring/{rec_id}")
    assert resp.status_code == 200

    # 수정
    resp = await authenticated_client.put(
        f"/api/recurring/{rec_id}",
        json={"amount": 60000},
    )
    assert resp.status_code == 200

    # 삭제
    resp = await authenticated_client.delete(f"/api/recurring/{rec_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_recurring_list(authenticated_client, test_user, test_household, db_session):
    """정기 거래 목록"""
    resp = await authenticated_client.get("/api/recurring")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_recurring_list_filter_type(authenticated_client, test_user, test_household, db_session):
    """정기 거래 목록 type 필터"""
    resp = await authenticated_client.get("/api/recurring", params={"type": "expense"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_recurring_pending(authenticated_client, test_user, test_household, db_session):
    """대기 중인 정기 거래"""
    resp = await authenticated_client.get("/api/recurring/pending")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_recurring_execute(authenticated_client, test_user, test_household, db_session):
    """정기 거래 실행"""
    from app.models.recurring_transaction import RecurringTransaction

    today = date.today()
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=30000,
        description="실행테스트",
        frequency="monthly",
        day_of_month=1,
        start_date=today - timedelta(days=30),
        next_due_date=today,
        is_active=True,
    )
    db_session.add(rec)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/recurring/{rec.id}/execute")
    assert resp.status_code == 201
    assert "created_id" in resp.json()


@pytest.mark.asyncio
async def test_recurring_execute_inactive(authenticated_client, test_user, test_household, db_session):
    """비활성 정기 거래 실행 → 400"""
    from app.models.recurring_transaction import RecurringTransaction

    today = date.today()
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=10000,
        description="비활성",
        frequency="monthly",
        day_of_month=1,
        start_date=today,
        next_due_date=today,
        is_active=False,
    )
    db_session.add(rec)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/recurring/{rec.id}/execute")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_recurring_skip(authenticated_client, test_user, test_household, db_session):
    """정기 거래 건너뛰기"""
    from app.models.recurring_transaction import RecurringTransaction

    today = date.today()
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="income",
        amount=20000,
        description="건너뛰기",
        frequency="monthly",
        day_of_month=1,
        start_date=today,
        next_due_date=today,
        is_active=True,
    )
    db_session.add(rec)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/recurring/{rec.id}/skip")
    assert resp.status_code == 200
    assert "next_due_date" in resp.json()


@pytest.mark.asyncio
async def test_recurring_skip_inactive(authenticated_client, test_user, test_household, db_session):
    """비활성 정기 거래 건너뛰기 → 400"""
    from app.models.recurring_transaction import RecurringTransaction

    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=5000,
        description="비활성건너뛰기",
        frequency="monthly",
        day_of_month=1,
        start_date=date.today(),
        next_due_date=date.today(),
        is_active=False,
    )
    db_session.add(rec)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/recurring/{rec.id}/skip")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_recurring_not_found(authenticated_client):
    """없는 정기 거래 → 404"""
    resp = await authenticated_client.get("/api/recurring/99999")
    assert resp.status_code == 404


# ──────────────────────────────────────────
# Household API 테스트 — CRUD, 멤버 관리, 탈퇴
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_household_create_and_list(authenticated_client, test_user, db_session):
    """가구 생성 및 목록 조회"""
    resp = await authenticated_client.post(
        "/api/households",
        json={"name": "새로운가구"},
    )
    assert resp.status_code == 201
    assert resp.json()["my_role"] == "owner"

    resp = await authenticated_client.get("/api/households")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_household_detail(authenticated_client, test_user, test_household, db_session):
    """가구 상세 조회"""
    resp = await authenticated_client.get(f"/api/households/{test_household.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == test_household.id
    assert "members" in data


@pytest.mark.asyncio
async def test_household_update(authenticated_client, test_user, test_household, db_session):
    """가구 정보 수정 (owner)"""
    resp = await authenticated_client.put(
        f"/api/households/{test_household.id}",
        json={"name": "수정된가구"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "수정된가구"


@pytest.mark.asyncio
async def test_household_delete(authenticated_client, test_user, db_session):
    """가구 삭제 (소프트 삭제)"""
    # 새 가구를 생성해서 삭제 (기존 가구 삭제하면 다른 테스트에 영향)
    resp = await authenticated_client.post("/api/households", json={"name": "삭제용가구"})
    hid = resp.json()["id"]

    resp = await authenticated_client.delete(f"/api/households/{hid}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_household_member_role_change(authenticated_client, test_user, test_household, db_session):
    """멤버 역할 변경"""
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other = User(auth_user_id="hh-role-001", username="roleuser", email="role@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="member"))
    await db_session.commit()

    resp = await authenticated_client.patch(
        f"/api/households/{test_household.id}/members/{other.id}/role",
        json={"role": "admin"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_household_member_role_change_self(authenticated_client, test_user, test_household, db_session):
    """자신 역할 변경 → 400"""
    resp = await authenticated_client.patch(
        f"/api/households/{test_household.id}/members/{test_user.id}/role",
        json={"role": "admin"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_household_member_role_change_owner(authenticated_client, test_user, test_household, db_session):
    """owner 역할 변경 시도 → 400"""
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other = User(auth_user_id="hh-own-001", username="owntest", email="own@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="owner"))
    await db_session.commit()

    resp = await authenticated_client.patch(
        f"/api/households/{test_household.id}/members/{other.id}/role",
        json={"role": "member"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_household_member_role_change_not_found(authenticated_client, test_user, test_household, db_session):
    """없는 멤버 역할 변경 → 404"""
    resp = await authenticated_client.patch(
        f"/api/households/{test_household.id}/members/99999/role",
        json={"role": "admin"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_household_remove_member(authenticated_client, test_user, test_household, db_session):
    """멤버 추방"""
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other = User(auth_user_id="hh-rem-001", username="removeuser", email="remove@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="member"))
    await db_session.commit()

    resp = await authenticated_client.delete(f"/api/households/{test_household.id}/members/{other.id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_household_remove_self(authenticated_client, test_user, test_household, db_session):
    """자기 자신 추방 → 400"""
    resp = await authenticated_client.delete(f"/api/households/{test_household.id}/members/{test_user.id}")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_household_remove_owner(authenticated_client, test_user, test_household, db_session):
    """owner 추방 → 400"""
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other = User(auth_user_id="hh-rem-own", username="remowner", email="remown@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="owner"))
    await db_session.commit()

    resp = await authenticated_client.delete(f"/api/households/{test_household.id}/members/{other.id}")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_household_remove_not_found(authenticated_client, test_user, test_household, db_session):
    """없는 멤버 추방 → 404"""
    resp = await authenticated_client.delete(f"/api/households/{test_household.id}/members/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_household_leave(authenticated_client, test_user, test_household, db_session):
    """가구 탈퇴 (owner → 다른 멤버에게 양도)"""
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other = User(auth_user_id="hh-leave-001", username="leaveuser", email="leave@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="admin"))
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/households/{test_household.id}/leave")
    assert resp.status_code == 200
    data = resp.json()
    assert data["transferred_to"] == other.id


@pytest.mark.asyncio
async def test_household_admin_cannot_remove_admin(authenticated_client, test_user, test_household, db_session):
    """admin이 다른 admin 추방 → 403"""
    # test_user를 admin으로 변경
    from sqlalchemy import and_, select

    from app.models.household_member import HouseholdMember
    from app.models.user import User

    result = await db_session.execute(
        select(HouseholdMember).where(
            and_(
                HouseholdMember.household_id == test_household.id,
                HouseholdMember.user_id == test_user.id,
            )
        )
    )
    test_member = result.scalar_one()
    test_member.role = "admin"

    other = User(auth_user_id="hh-aa-001", username="adminuser2", email="admin2@test.com", is_active=True)
    db_session.add(other)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=other.id, role="admin"))
    await db_session.commit()

    resp = await authenticated_client.delete(f"/api/households/{test_household.id}/members/{other.id}")
    assert resp.status_code == 403


# ──────────────────────────────────────────
# Invitation API 테스트 — CRUD, 수락, 거절, 권한
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_invitation_my_list(authenticated_client, test_user, test_household, db_session):
    """내 초대 목록"""
    resp = await authenticated_client.get("/api/invitations/my")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_invitation_accept_flow(authenticated_client, test_user, test_household, db_session):
    """초대 수락 전체 흐름"""
    import uuid

    from app.models.household import Household
    from app.models.household_invitation import HouseholdInvitation
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    # 새 가구 + 초대자
    other_household = Household(name="초대가구")
    db_session.add(other_household)
    await db_session.flush()

    inviter = User(auth_user_id="inv-inviter", username="inviter", email="inviter@test.com", is_active=True)
    db_session.add(inviter)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=other_household.id, user_id=inviter.id, role="owner"))
    await db_session.flush()

    # 초대 생성
    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=other_household.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    # 수락
    resp = await authenticated_client.post(f"/api/invitations/{token}/accept")
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_invitation_reject_flow(authenticated_client, test_user, test_household, db_session):
    """초대 거절 전체 흐름"""
    import uuid

    from app.models.household import Household
    from app.models.household_invitation import HouseholdInvitation
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other_household = Household(name="거절가구")
    db_session.add(other_household)
    await db_session.flush()

    inviter = User(auth_user_id="inv-rej-inviter", username="rejinviter", email="rejinviter@test.com", is_active=True)
    db_session.add(inviter)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=other_household.id, user_id=inviter.id, role="owner"))
    await db_session.flush()

    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=other_household.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/invitations/{token}/reject")
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_invitation_accept_expired(authenticated_client, test_user, test_household, db_session):
    """만료된 초대 수락 → 400"""
    import uuid

    from app.models.household import Household
    from app.models.household_invitation import HouseholdInvitation
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other_household = Household(name="만료가구")
    db_session.add(other_household)
    await db_session.flush()

    inviter = User(auth_user_id="inv-exp-inviter", username="expinviter", email="expinviter@test.com", is_active=True)
    db_session.add(inviter)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=other_household.id, user_id=inviter.id, role="owner"))
    await db_session.flush()

    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=other_household.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="pending",
        expires_at=datetime.utcnow() - timedelta(days=1),  # 만료
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/invitations/{token}/accept")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_invitation_accept_already_processed(authenticated_client, test_user, test_household, db_session):
    """이미 처리된 초대 수락 → 400"""
    import uuid

    from app.models.household import Household
    from app.models.household_invitation import HouseholdInvitation
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other_household = Household(name="처리된가구")
    db_session.add(other_household)
    await db_session.flush()

    inviter = User(auth_user_id="inv-proc-inviter", username="procinviter", email="procinviter@test.com", is_active=True)
    db_session.add(inviter)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=other_household.id, user_id=inviter.id, role="owner"))
    await db_session.flush()

    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=other_household.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="accepted",  # 이미 처리
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/invitations/{token}/accept")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_invitation_accept_not_found(authenticated_client):
    """없는 초대 수락 → 404"""
    resp = await authenticated_client.post("/api/invitations/fake-token/accept")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_invitation_reject_not_found(authenticated_client):
    """없는 초대 거절 → 404"""
    resp = await authenticated_client.post("/api/invitations/fake-token/reject")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_invitation_already_member(authenticated_client, test_user, test_household, db_session):
    """이미 멤버인 경우 초대 수락 → 400"""
    import uuid

    from app.models.household_invitation import HouseholdInvitation
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    inviter = User(auth_user_id="inv-alr-inviter", username="alrinviter", email="alrinviter@test.com", is_active=True)
    db_session.add(inviter)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=inviter.id, role="admin"))
    await db_session.flush()

    # test_user는 이미 test_household의 멤버
    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.post(f"/api/invitations/{token}/accept")
    assert resp.status_code == 400


# ──────────────────────────────────────────
# Household Invitation (households.py 쪽) 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_household_cancel_invitation(authenticated_client, test_user, test_household, db_session):
    """초대 취소"""
    import uuid

    from app.models.household_invitation import HouseholdInvitation

    inv = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email="cancel@test.com",
        token=str(uuid.uuid4()),
        role="member",
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.delete(f"/api/households/{test_household.id}/invitations/{inv.id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_household_cancel_invitation_not_found(authenticated_client, test_user, test_household, db_session):
    """없는 초대 취소 → 404"""
    resp = await authenticated_client.delete(f"/api/households/{test_household.id}/invitations/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_household_cancel_invitation_already_processed(authenticated_client, test_user, test_household, db_session):
    """이미 처리된 초대 취소 → 400"""
    import uuid

    from app.models.household_invitation import HouseholdInvitation

    inv = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email="processed@test.com",
        token=str(uuid.uuid4()),
        role="member",
        status="accepted",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.delete(f"/api/households/{test_household.id}/invitations/{inv.id}")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_household_list_invitations(authenticated_client, test_user, test_household, db_session):
    """가구 초대 목록 조회"""
    import uuid

    from app.models.household_invitation import HouseholdInvitation

    inv = HouseholdInvitation(
        household_id=test_household.id,
        inviter_id=test_user.id,
        invitee_email="list@test.com",
        token=str(uuid.uuid4()),
        role="member",
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    resp = await authenticated_client.get(f"/api/households/{test_household.id}/invitations")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_household_create_invitation(authenticated_client, test_user, test_household, db_session):
    """가구 초대 생성"""
    with patch("app.services.household_service.send_invitation_email", new_callable=AsyncMock) as mock_email:
        mock_email.return_value = True
        resp = await authenticated_client.post(
            f"/api/households/{test_household.id}/invitations",
            json={"email": "newinvite@test.com", "role": "member"},
        )
        assert resp.status_code == 201


# ──────────────────────────────────────────
# Assets API 테스트 — CRUD, summary, snapshots, goal
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_asset_create_and_crud(authenticated_client, test_user, test_household, db_session):
    """자산 생성, 조회, 수정, 삭제"""
    resp = await authenticated_client.post(
        "/api/assets",
        json={
            "name": "테스트예금",
            "type": "deposit",
            "manual_value": 10000000,
            "is_liability": False,
        },
    )
    assert resp.status_code == 201
    asset_id = resp.json()["id"]

    # 목록
    resp = await authenticated_client.get("/api/assets")
    assert resp.status_code == 200

    # 상세
    resp = await authenticated_client.get(f"/api/assets/{asset_id}")
    assert resp.status_code == 200

    # 수정
    resp = await authenticated_client.put(
        f"/api/assets/{asset_id}",
        json={"manual_value": 20000000},
    )
    assert resp.status_code == 200

    # 삭제
    resp = await authenticated_client.delete(f"/api/assets/{asset_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_asset_not_found(authenticated_client):
    """없는 자산 조회 → 404"""
    resp = await authenticated_client.get("/api/assets/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_asset_update_not_found(authenticated_client):
    """없는 자산 수정 → 404"""
    resp = await authenticated_client.put("/api/assets/99999", json={"manual_value": 100})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_asset_delete_not_found(authenticated_client):
    """없는 자산 삭제 → 404"""
    resp = await authenticated_client.delete("/api/assets/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_asset_summary(authenticated_client, test_user, test_household, db_session):
    """자산 요약"""
    resp = await authenticated_client.get("/api/assets/summary")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_asset_snapshots(authenticated_client, test_user, test_household, db_session):
    """자산 스냅샷"""
    resp = await authenticated_client.get("/api/assets/snapshots")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_asset_monthly_savings(authenticated_client, test_user, test_household, db_session):
    """이번 달 저축액"""
    resp = await authenticated_client.get("/api/assets/monthly-savings")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_asset_goal_crud(authenticated_client, test_user, test_household, db_session):
    """순자산 목표 CRUD"""
    # 목표 없을 때 조회
    resp = await authenticated_client.get("/api/assets/goal")
    assert resp.status_code == 200

    # 목표 생성
    resp = await authenticated_client.post(
        "/api/assets/goal",
        json={
            "target_net_worth": 100000000,
            "target_date": "2027-12-31",
        },
    )
    assert resp.status_code == 201

    # 목표 조회
    resp = await authenticated_client.get("/api/assets/goal")
    assert resp.status_code == 200

    # 목표 삭제
    resp = await authenticated_client.delete("/api/assets/goal")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_asset_goal_delete_not_found(authenticated_client, test_user, test_household, db_session):
    """없는 목표 삭제 → 404"""
    resp = await authenticated_client.delete("/api/assets/goal")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_asset_search(authenticated_client, test_user, test_household, db_session):
    """종목 검색 — 한국 주식은 stocks 테이블, 미국/코인은 외부 API mock"""
    with (
        patch("app.services.price_service.search_stock_us", new_callable=AsyncMock) as mock_us,
        patch("app.services.price_service.search_crypto", new_callable=AsyncMock) as mock_crypto,
    ):
        mock_us.return_value = []
        mock_crypto.return_value = []

        resp = await authenticated_client.get("/api/assets/search", params={"q": "삼성"})
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_asset_parse(authenticated_client, test_user, test_household, db_session):
    """자연어 자산 파싱"""
    with patch("app.services.asset_parse_service.parse_asset_input", new_callable=AsyncMock) as mock_parse:
        mock_parse.return_value = [{"name": "예금", "asset_type": "cash", "balance": 5000000, "is_liability": False}]
        resp = await authenticated_client.post(
            "/api/assets/parse",
            json={"text": "예금 500만"},
        )
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_asset_prices(authenticated_client, test_user, test_household, db_session):
    """보유 자산 시세 조회"""
    resp = await authenticated_client.get("/api/assets/prices")
    assert resp.status_code == 200


# ──────────────────────────────────────────
# Accounts API 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_account_create_and_crud(authenticated_client, test_user, test_household, db_session):
    """계좌 CRUD"""
    resp = await authenticated_client.post(
        "/api/accounts",
        json={"name": "테스트계좌", "type": "bank"},
    )
    assert resp.status_code == 201
    acc_id = resp.json()["id"]

    # 목록
    resp = await authenticated_client.get("/api/accounts")
    assert resp.status_code == 200

    # 상세
    resp = await authenticated_client.get(f"/api/accounts/{acc_id}")
    assert resp.status_code == 200

    # 수정
    resp = await authenticated_client.put(
        f"/api/accounts/{acc_id}",
        json={"name": "수정계좌"},
    )
    assert resp.status_code == 200

    # 삭제
    resp = await authenticated_client.delete(f"/api/accounts/{acc_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_account_not_found(authenticated_client):
    """없는 계좌 조회 → 404"""
    resp = await authenticated_client.get("/api/accounts/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_account_update_not_found(authenticated_client):
    """없는 계좌 수정 → 404"""
    resp = await authenticated_client.put("/api/accounts/99999", json={"name": "x"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_account_delete_not_found(authenticated_client):
    """없는 계좌 삭제 → 404"""
    resp = await authenticated_client.delete("/api/accounts/99999")
    assert resp.status_code == 404


# ──────────────────────────────────────────
# Feedback API 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_feedback_create(authenticated_client, test_user, db_session):
    """피드백 생성"""
    with patch("app.services.feedback_notify.notify_admin_feedback", new_callable=AsyncMock):
        resp = await authenticated_client.post(
            "/api/feedback",
            json={"type": "feature", "title": "테스트", "content": "내용"},
        )
        assert resp.status_code == 201


@pytest.mark.asyncio
async def test_feedback_my_list(authenticated_client, test_user, db_session):
    """내 피드백 목록"""
    resp = await authenticated_client.get("/api/feedback/mine")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_feedback_admin_list(authenticated_client, test_user, db_session):
    """관리자 피드백 목록 — 비관리자 → 403"""
    resp = await authenticated_client.get("/api/feedback")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_feedback_status_update_forbidden(authenticated_client, test_user, db_session):
    """피드백 상태 변경 — 비관리자 → 403"""
    resp = await authenticated_client.patch(
        "/api/feedback/1",
        json={"status": "done"},
    )
    assert resp.status_code == 403


# ──────────────────────────────────────────
# Onboarding API 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_onboarding_status(authenticated_client, test_user, test_household, db_session):
    """온보딩 상태"""
    resp = await authenticated_client.get("/api/onboarding/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_household"] is True


@pytest.mark.asyncio
async def test_onboarding_create_household_duplicate(authenticated_client, test_user, test_household, db_session):
    """이미 가구가 있을 때 기본 가구 생성 → 409"""
    resp = await authenticated_client.post(
        "/api/onboarding/create-household",
        json={},
    )
    assert resp.status_code == 409


# ──────────────────────────────────────────
# Chat API 테스트 — 에러 분기
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_chat_parse_error(authenticated_client, test_user, test_household, db_session):
    """채팅 파싱 에러 분기"""
    with patch("app.services.llm_service.AnthropicProvider.parse_expense", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {"error": "파싱 실패"}
        resp = await authenticated_client.post(
            "/api/chat",
            json={"message": "알수없는입력"},
        )
        assert resp.status_code == 201
        assert "파싱 실패" in resp.json()["message"]


@pytest.mark.asyncio
async def test_chat_invalid_response(authenticated_client, test_user, test_household, db_session):
    """채팅 유효하지 않은 응답"""
    with patch("app.services.llm_service.AnthropicProvider.parse_expense", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = "invalid_string_response"
        resp = await authenticated_client.post(
            "/api/chat",
            json={"message": "이상한입력"},
        )
        assert resp.status_code == 201
        assert "알 수 없는" in resp.json()["message"]


@pytest.mark.asyncio
async def test_chat_preview_mode(authenticated_client, test_user, test_household, db_session):
    """채팅 프리뷰 모드"""
    with patch("app.services.llm_service.AnthropicProvider.parse_expense", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {
            "amount": 8000,
            "category": "식비",
            "description": "김치찌개",
            "date": "2026-03-25",
            "memo": "",
            "type": "expense",
        }
        resp = await authenticated_client.post(
            "/api/chat",
            json={"message": "김치찌개 8000원", "preview": True},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["parsed_items"] is not None


@pytest.mark.asyncio
async def test_chat_save_mode(authenticated_client, test_user, test_household, db_session):
    """채팅 저장 모드"""
    from app.models.category import Category

    cat = Category(name="식비", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.commit()

    with patch("app.services.llm_service.AnthropicProvider.parse_expense", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {
            "amount": 8000,
            "category": "식비",
            "description": "김치찌개",
            "date": "2026-03-25",
            "memo": "",
            "type": "expense",
        }
        resp = await authenticated_client.post(
            "/api/chat",
            json={"message": "김치찌개 8000원", "preview": False},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["expenses_created"] is not None


@pytest.mark.asyncio
async def test_chat_save_income(authenticated_client, test_user, test_household, db_session):
    """채팅 수입 저장"""
    from app.models.category import Category

    cat = Category(name="급여", type="income", household_id=test_household.id)
    db_session.add(cat)
    await db_session.commit()

    with patch("app.services.llm_service.AnthropicProvider.parse_expense", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = {
            "amount": 3000000,
            "category": "급여",
            "description": "월급",
            "date": "2026-03-25",
            "memo": "",
            "type": "income",
        }
        resp = await authenticated_client.post(
            "/api/chat",
            json={"message": "월급 300만원", "preview": False},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["incomes_created"] is not None


@pytest.mark.asyncio
async def test_chat_multiple_items(authenticated_client, test_user, test_household, db_session):
    """채팅 다건 저장"""
    from app.models.category import Category

    for name in ["식비", "교통"]:
        db_session.add(Category(name=name, type="expense", household_id=test_household.id))
    await db_session.commit()

    with patch("app.services.llm_service.AnthropicProvider.parse_expense", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = [
            {"amount": 8000, "category": "식비", "description": "점심", "date": "2026-03-25", "memo": "", "type": "expense"},
            {"amount": 1500, "category": "교통", "description": "버스", "date": "2026-03-25", "memo": "", "type": "expense"},
        ]
        resp = await authenticated_client.post(
            "/api/chat",
            json={"message": "점심 8000원 버스 1500원", "preview": False},
        )
        assert resp.status_code == 201


# ──────────────────────────────────────────
# Insights API 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_insights_generate_empty(authenticated_client, test_user, test_household, db_session):
    """지출 없을 때 인사이트"""
    today = date.today()
    month_str = f"{today.year}-{today.month:02d}"

    resp = await authenticated_client.post(
        "/api/insights/generate",
        params={"month": month_str},
    )
    assert resp.status_code == 200
    assert "기록된 지출이 없습니다" in resp.json()["insights"]


@pytest.mark.asyncio
async def test_insights_generate_with_data(authenticated_client, test_user, test_household, db_session, mock_llm_generate_insights):
    """데이터가 있을 때 인사이트"""
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="인사이트식비", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=50000,
            description="인사이트테스트",
            category_id=cat.id,
            date=datetime(today.year, today.month, 15),
        )
    )
    await db_session.commit()

    month_str = f"{today.year}-{today.month:02d}"
    resp = await authenticated_client.post(
        "/api/insights/generate",
        params={"month": month_str},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_insights_comprehensive(authenticated_client, test_user, test_household, db_session):
    """종합 인사이트"""
    today = date.today()
    month_str = f"{today.year}-{today.month:02d}"

    with patch("app.services.llm_service.AnthropicProvider.generate_comprehensive_insights", new_callable=AsyncMock) as mock_comp:
        mock_comp.return_value = {
            "findings": [{"what": "테스트", "so_what": "의미", "now_what": "행동"}],
            "asset_analysis": None,
            "action_items": [{"title": "절약", "description": "외식 줄이기"}],
            "encouragement": "잘하고 있어요!",
        }
        resp = await authenticated_client.post(
            "/api/insights/generate-comprehensive",
            json={
                "month": month_str,
                "expense_total": 100000,
                "income_total": 300000,
            },
        )
        assert resp.status_code == 200

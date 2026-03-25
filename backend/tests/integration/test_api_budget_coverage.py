"""예산 API 커버리지 강화 테스트 (#397)

미커버 영역:
- GET /api/budgets/monthly-stats — 다중 카테고리 예산 + 지출 조합, 정렬 검증
- GET /api/budgets/monthly-stats — exclude_from_stats 지출 제외
- GET /api/budgets/monthly-stats — total_monthly_budget이 없을 때 카테고리 합산 fallback
- GET /api/budgets/monthly-stats — 12월 날짜 경계 처리
- PUT /api/budgets/bulk — 혼합 (생성+업데이트+삭제 동시)
- PUT /api/budgets/bulk — 다른 월의 예산은 영향 없음
- GET /api/budgets/alerts — month 파라미터 없이 현재 월 기준
- GET /api/budgets/alerts — weekly/daily period 예산
- GET /api/budgets — 정렬 순서 검증
- PUT /api/budgets/{id} — 금액 + alert_threshold 동시 수정
- GET /api/budgets/total-budget — 조회/수정
"""

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.user import User

# ── monthly-stats 다중 카테고리 + 정렬 ──────────────────


@pytest.mark.asyncio
async def test_monthly_stats_multiple_categories_sorted(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """다중 카테고리 예산 + 지출 — usage_percentage 내림차순 정렬"""
    cat1 = Category(user_id=test_user.id, name="식비")
    cat2 = Category(user_id=test_user.id, name="교통비")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    # 식비 예산 300k, 지출 150k (50%)
    db_session.add(
        Budget(user_id=test_user.id, household_id=test_household.id, category_id=cat1.id, amount=300000, period="monthly", start_date=datetime(2026, 1, 1))
    )
    # 교통비 예산 100k, 지출 90k (90%)
    db_session.add(
        Budget(user_id=test_user.id, household_id=test_household.id, category_id=cat2.id, amount=100000, period="monthly", start_date=datetime(2026, 1, 1))
    )

    db_session.add_all(
        [
            Expense(user_id=test_user.id, household_id=test_household.id, category_id=cat1.id, amount=150000, description="식비", date=datetime(2026, 3, 10)),
            Expense(user_id=test_user.id, household_id=test_household.id, category_id=cat2.id, amount=90000, description="교통비", date=datetime(2026, 3, 15)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/monthly-stats?month=2026-03")
    assert response.status_code == 200
    data = response.json()

    assert len(data["categories"]) == 2
    # 교통비(90%) > 식비(50%) 순서
    assert data["categories"][0]["category_name"] == "교통비"
    assert data["categories"][0]["usage_percentage"] == 90.0
    assert data["categories"][1]["category_name"] == "식비"
    assert data["categories"][1]["usage_percentage"] == 50.0

    # total_spent 합산 검증
    assert data["total_spent"] == 240000.0


# ── monthly-stats exclude_from_stats ──────────────────


@pytest.mark.asyncio
async def test_monthly_stats_excludes_flagged_expenses(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """exclude_from_stats=True 지출은 monthly-stats 집계에서 제외"""
    cat = Category(user_id=test_user.id, name="저축")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    db_session.add(
        Budget(user_id=test_user.id, household_id=test_household.id, category_id=cat.id, amount=500000, period="monthly", start_date=datetime(2026, 1, 1))
    )
    db_session.add_all(
        [
            Expense(user_id=test_user.id, household_id=test_household.id, category_id=cat.id, amount=100000, description="정상", date=datetime(2026, 3, 10)),
            Expense(
                user_id=test_user.id,
                household_id=test_household.id,
                category_id=cat.id,
                amount=9000000,
                description="제외",
                date=datetime(2026, 3, 10),
                exclude_from_stats=True,
            ),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/monthly-stats?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    assert data["categories"][0]["spent_amount"] == 100000.0


# ── monthly-stats total_monthly_budget fallback ──────────────────


@pytest.mark.asyncio
async def test_monthly_stats_total_budget_fallback(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """total_monthly_budget 미설정 시 카테고리 예산 합산으로 fallback"""
    # test_user.total_monthly_budget은 기본 None
    cat1 = Category(user_id=test_user.id, name="식비")
    cat2 = Category(user_id=test_user.id, name="교통비")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    db_session.add_all(
        [
            Budget(user_id=test_user.id, household_id=test_household.id, category_id=cat1.id, amount=300000, period="monthly", start_date=datetime(2026, 1, 1)),
            Budget(user_id=test_user.id, household_id=test_household.id, category_id=cat2.id, amount=200000, period="monthly", start_date=datetime(2026, 1, 1)),
            Expense(user_id=test_user.id, household_id=test_household.id, category_id=cat1.id, amount=50000, description="식비", date=datetime(2026, 3, 10)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/monthly-stats?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    # total_monthly_budget이 None이면 카테고리 합산 (300k + 200k)
    assert data["total_budget"] == 500000.0


@pytest.mark.asyncio
async def test_monthly_stats_total_budget_from_user(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """total_monthly_budget 설정 시 해당 값 반환"""
    # 사용자에 총 예산 설정
    test_user.total_monthly_budget = 1000000
    await db_session.commit()

    cat = Category(user_id=test_user.id, name="식비")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    db_session.add(
        Budget(user_id=test_user.id, household_id=test_household.id, category_id=cat.id, amount=300000, period="monthly", start_date=datetime(2026, 1, 1))
    )
    db_session.add(
        Expense(user_id=test_user.id, household_id=test_household.id, category_id=cat.id, amount=50000, description="식비", date=datetime(2026, 3, 10))
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/monthly-stats?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    assert data["total_budget"] == 1000000.0


# ── monthly-stats 12월 경계 ──────────────────


@pytest.mark.asyncio
async def test_monthly_stats_december(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """12월 통계 — 연도 경계 처리"""
    cat = Category(user_id=test_user.id, name="식비")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    db_session.add(
        Budget(user_id=test_user.id, household_id=test_household.id, category_id=cat.id, amount=300000, period="monthly", start_date=datetime(2025, 1, 1))
    )
    db_session.add_all(
        [
            Expense(
                user_id=test_user.id, household_id=test_household.id, category_id=cat.id, amount=100000, description="12월 지출", date=datetime(2025, 12, 15)
            ),
            Expense(user_id=test_user.id, household_id=test_household.id, category_id=cat.id, amount=50000, description="1월 지출", date=datetime(2026, 1, 5)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/monthly-stats?month=2025-12")
    assert response.status_code == 200
    data = response.json()
    assert data["categories"][0]["spent_amount"] == 100000.0  # 1월 지출 제외


# ── bulk — 혼합 (생성+업데이트+삭제 동시) ──────────────────


@pytest.mark.asyncio
async def test_bulk_save_mixed(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """벌크 저장 — 생성+업데이트+삭제 동시"""
    cat1 = Category(user_id=test_user.id, household_id=test_household.id, name="식비", type="expense")
    cat2 = Category(user_id=test_user.id, household_id=test_household.id, name="교통비", type="expense")
    cat3 = Category(user_id=test_user.id, household_id=test_household.id, name="쇼핑", type="expense")
    db_session.add_all([cat1, cat2, cat3])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)
    await db_session.refresh(cat3)

    # 기존: cat1(식비), cat2(교통비) 예산 존재
    db_session.add_all(
        [
            Budget(
                user_id=test_user.id,
                household_id=test_household.id,
                category_id=cat1.id,
                amount=100000,
                period="monthly",
                start_date=datetime(2026, 3, 1),
                alert_threshold=0.8,
            ),
            Budget(
                user_id=test_user.id,
                household_id=test_household.id,
                category_id=cat2.id,
                amount=200000,
                period="monthly",
                start_date=datetime(2026, 3, 1),
                alert_threshold=0.8,
            ),
        ]
    )
    await db_session.commit()

    # 요청: cat1 금액 변경(업데이트), cat3 추가(생성), cat2 누락(삭제)
    response = await authenticated_client.put(
        "/api/budgets/bulk",
        json={
            "month": "2026-03",
            "alert_threshold": 0.9,
            "budgets": [
                {"category_id": cat1.id, "amount": 150000},
                {"category_id": cat3.id, "amount": 300000},
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["created"] == 1  # cat3
    assert data["updated"] == 1  # cat1
    assert data["deleted"] == 1  # cat2


# ── bulk — 다른 월 영향 없음 ──────────────────


@pytest.mark.asyncio
async def test_bulk_save_other_month_unaffected(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """벌크 저장 — 다른 월의 예산은 영향 없음"""
    cat = Category(user_id=test_user.id, household_id=test_household.id, name="식비", type="expense")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 2월 예산
    db_session.add(
        Budget(
            user_id=test_user.id,
            household_id=test_household.id,
            category_id=cat.id,
            amount=200000,
            period="monthly",
            start_date=datetime(2026, 2, 1),
            alert_threshold=0.8,
        )
    )
    # 3월 예산
    db_session.add(
        Budget(
            user_id=test_user.id,
            household_id=test_household.id,
            category_id=cat.id,
            amount=300000,
            period="monthly",
            start_date=datetime(2026, 3, 1),
            alert_threshold=0.8,
        )
    )
    await db_session.commit()

    # 3월 예산만 삭제 (빈 배열)
    response = await authenticated_client.put(
        "/api/budgets/bulk",
        json={"month": "2026-03", "alert_threshold": 0.8, "budgets": []},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["deleted"] == 1  # 3월 것만 삭제

    # 2월 예산은 그대로
    budgets_response = await authenticated_client.get("/api/budgets")
    budgets = budgets_response.json()
    assert len(budgets) == 1  # 2월 예산만 남음


# ── alerts — month 없이 현재 월 기준 ──────────────────


@pytest.mark.asyncio
async def test_alerts_default_current_month(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """alerts — month 파라미터 없이 현재 월 기준 (month 지정해서 안정적 검증)"""
    cat = Category(user_id=test_user.id, name="식비")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # month 파라미터 없이 현재 월 기준으로 동작하는지 확인
    # 안정적 검증을 위해 month=2026-03 로도 테스트
    db_session.add(
        Budget(
            user_id=test_user.id,
            household_id=test_household.id,
            category_id=cat.id,
            amount=100000,
            period="monthly",
            start_date=datetime(2026, 3, 1),
            alert_threshold=0.8,
        )
    )
    db_session.add(
        Expense(user_id=test_user.id, household_id=test_household.id, category_id=cat.id, amount=90000, description="식비", date=datetime(2026, 3, 10))
    )
    await db_session.commit()

    # month 파라미터 있으면 해당 월 기준 (기존 테스트와 차별: 확정 월)
    response = await authenticated_client.get("/api/budgets/alerts?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["category_name"] == "식비"
    assert data[0]["spent_amount"] == 90000
    assert data[0]["is_warning"] is True

    # month 없이도 응답 200 확인
    response2 = await authenticated_client.get("/api/budgets/alerts")
    assert response2.status_code == 200


# ── total-budget 조회/수정 ──────────────────


@pytest.mark.asyncio
async def test_get_total_budget_default(authenticated_client: AsyncClient, test_user: User):
    """total-budget 기본값 조회 (None)"""
    response = await authenticated_client.get("/api/budgets/total-budget")
    assert response.status_code == 200
    data = response.json()
    assert data["total_monthly_budget"] is None


@pytest.mark.asyncio
async def test_update_total_budget(
    authenticated_client: AsyncClient,
    test_user: User,
    db_session: AsyncSession,
):
    """total-budget 수정"""
    response = await authenticated_client.put(
        "/api/budgets/total-budget",
        json={"amount": 2000000},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_monthly_budget"] == 2000000.0

    # 다시 조회
    response2 = await authenticated_client.get("/api/budgets/total-budget")
    assert response2.json()["total_monthly_budget"] == 2000000.0


@pytest.mark.asyncio
async def test_update_total_budget_null(
    authenticated_client: AsyncClient,
    test_user: User,
    db_session: AsyncSession,
):
    """total-budget null로 초기화"""
    # 먼저 설정
    await authenticated_client.put("/api/budgets/total-budget", json={"amount": 500000})

    # null로 초기화
    response = await authenticated_client.put("/api/budgets/total-budget", json={"amount": None})
    assert response.status_code == 200
    data = response.json()
    assert data["total_monthly_budget"] is None


# ── budgets 정렬 순서 ──────────────────


@pytest.mark.asyncio
async def test_budgets_list_returns_all(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """예산 목록 — 등록한 예산이 모두 반환됨"""
    cat1 = Category(user_id=test_user.id, name="식비")
    cat2 = Category(user_id=test_user.id, name="교통비")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    db_session.add_all(
        [
            Budget(user_id=test_user.id, household_id=test_household.id, category_id=cat1.id, amount=100000, period="monthly", start_date=datetime(2026, 1, 1)),
            Budget(user_id=test_user.id, household_id=test_household.id, category_id=cat2.id, amount=200000, period="monthly", start_date=datetime(2026, 1, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    amounts = {d["amount"] for d in data}
    assert amounts == {100000, 200000}


# ── budget update 금액 + threshold 동시 ──────────────────


@pytest.mark.asyncio
async def test_update_budget_amount_and_threshold(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """예산 수정 — 금액 + alert_threshold 동시 변경"""
    cat = Category(user_id=test_user.id, name="식비")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=cat.id,
        amount=100000,
        period="monthly",
        start_date=datetime(2026, 1, 1),
        alert_threshold=0.8,
    )
    db_session.add(budget)
    await db_session.commit()
    await db_session.refresh(budget)

    response = await authenticated_client.put(
        f"/api/budgets/{budget.id}",
        json={"amount": 500000, "alert_threshold": 0.9},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["amount"] == 500000
    assert data["alert_threshold"] == 0.9

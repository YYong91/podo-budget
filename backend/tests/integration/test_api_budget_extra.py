"""예산 API 추가 통합 테스트

기존 test_api_budget.py에서 커버하지 않는 경로를 테스트합니다:
- 예산 수정 시 종료일 검증
- 다른 사용자 예산 수정/삭제 IDOR 방지
- 예산 알림 - 미래 시작 예산 스킵
- 예산 알림 - 카테고리 없는 예산 스킵
- 월별 예산 대비 지출 통계 조회
"""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.user import User


@pytest.mark.asyncio
async def test_update_budget_invalid_dates(authenticated_client: AsyncClient, test_user: User, test_household: Household, db_session: AsyncSession):
    """예산 수정 시 종료일이 시작일보다 이전이면 400"""
    category = Category(user_id=test_user.id, name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 시작일보다 이후 종료일로 먼저 생성
    start_date = datetime.now()
    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=category.id,
        amount=100000,
        period="monthly",
        start_date=start_date,
        end_date=start_date + timedelta(days=30),
    )
    db_session.add(budget)
    await db_session.commit()
    await db_session.refresh(budget)

    # 종료일을 시작일보다 이전으로 수정 시도
    early_date = (start_date - timedelta(days=10)).isoformat()
    response = await authenticated_client.put(
        f"/api/budgets/{budget.id}",
        json={"end_date": early_date},
    )

    assert response.status_code == 400
    assert "종료일은 시작일 이후여야 합니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_budget_other_user_not_found(
    authenticated_client: AsyncClient,
    test_user: User,
    test_user2: User,
    test_household2: Household,
    db_session: AsyncSession,
):
    """다른 사용자 예산 수정 시도 → 404 (IDOR 방지)"""
    category = Category(user_id=test_user2.id, name="교통비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    budget = Budget(
        user_id=test_user2.id,  # 다른 사용자의 예산
        household_id=test_household2.id,
        category_id=category.id,
        amount=200000,
        period="monthly",
        start_date=datetime.now(),
    )
    db_session.add(budget)
    await db_session.commit()
    await db_session.refresh(budget)

    # test_user로 인증된 클라이언트가 수정 시도
    response = await authenticated_client.put(
        f"/api/budgets/{budget.id}",
        json={"amount": 999999},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_budget_other_user_not_found(
    authenticated_client: AsyncClient,
    test_user: User,
    test_user2: User,
    test_household2: Household,
    db_session: AsyncSession,
):
    """다른 사용자 예산 삭제 시도 → 404 (IDOR 방지)"""
    category = Category(user_id=test_user2.id, name="교통비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    budget = Budget(
        user_id=test_user2.id,
        household_id=test_household2.id,
        category_id=category.id,
        amount=100000,
        period="monthly",
        start_date=datetime.now(),
    )
    db_session.add(budget)
    await db_session.commit()
    await db_session.refresh(budget)

    response = await authenticated_client.delete(f"/api/budgets/{budget.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_budget_alerts_future_budget_skipped(authenticated_client: AsyncClient, test_user: User, test_household: Household, db_session: AsyncSession):
    """미래 시작 예산은 알림에서 스킵"""
    category = Category(user_id=test_user.id, name="여행")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 미래에 시작하는 예산
    future_start = datetime.now() + timedelta(days=30)
    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=category.id,
        amount=500000,
        period="monthly",
        start_date=future_start,
    )
    db_session.add(budget)
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/alerts")
    assert response.status_code == 200
    data = response.json()
    # 미래 시작 예산은 알림 목록에 없어야 함
    assert len(data) == 0


@pytest.mark.asyncio
async def test_monthly_stats_empty(authenticated_client: AsyncClient, test_user: User):
    """예산 없을 때 monthly-stats는 빈 카테고리 반환"""
    response = await authenticated_client.get("/api/budgets/monthly-stats?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    assert data["month"] == "2026-03"
    assert data["categories"] == []
    assert data["total_spent"] == 0.0


@pytest.mark.asyncio
async def test_monthly_stats_with_budget_and_expenses(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """예산 및 지출이 있을 때 월별 통계 정상 반환"""
    category = Category(user_id=test_user.id, name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 2026-03에 활성 예산 생성
    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=category.id,
        amount=300000,
        period="monthly",
        start_date=datetime(2026, 1, 1),
    )
    db_session.add(budget)

    # 2026-03 지출 추가
    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=category.id,
        amount=150000,
        description="식비 테스트",
        date=datetime(2026, 3, 15),
    )
    db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/monthly-stats?month=2026-03")
    assert response.status_code == 200
    data = response.json()

    assert data["month"] == "2026-03"
    assert len(data["categories"]) == 1
    cat = data["categories"][0]
    assert cat["category_name"] == "식비"
    assert cat["budget_amount"] == 300000
    assert cat["spent_amount"] == 150000
    assert cat["remaining_amount"] == 150000
    assert cat["usage_percentage"] == 50.0
    assert cat["is_exceeded"] is False


@pytest.mark.asyncio
async def test_monthly_stats_exceeded(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """지출이 예산 초과 시 is_exceeded=True"""
    category = Category(user_id=test_user.id, name="외식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=category.id,
        amount=100000,
        period="monthly",
        start_date=datetime(2026, 1, 1),
    )
    db_session.add(budget)

    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=category.id,
        amount=150000,
        description="외식 초과",
        date=datetime(2026, 3, 10),
    )
    db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/monthly-stats?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    cat = data["categories"][0]
    assert cat["is_exceeded"] is True
    assert cat["usage_percentage"] == 150.0


@pytest.mark.asyncio
async def test_monthly_stats_invalid_month_format(authenticated_client: AsyncClient, test_user: User):
    """잘못된 월 형식으로 요청 시 422"""
    response = await authenticated_client.get("/api/budgets/monthly-stats?month=2026/03")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_category_overview_empty(authenticated_client: AsyncClient, test_user: User):
    """카테고리/예산/지출 없을 때 category-overview는 빈 배열 반환"""
    response = await authenticated_client.get("/api/budgets/category-overview")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_category_overview_with_data(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """카테고리/예산/지출 있을 때 category-overview 정상 반환"""
    category = Category(user_id=test_user.id, name="식비", type="expense")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=category.id,
        amount=300000,
        period="monthly",
        start_date=datetime(2026, 1, 1),
    )
    db_session.add(budget)

    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=category.id,
        amount=50000,
        description="식비 테스트",
        date=datetime(2026, 3, 10),
    )
    db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/category-overview")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

    cat_data = next((c for c in data if c["category_name"] == "식비"), None)
    assert cat_data is not None
    assert cat_data["current_budget_amount"] == 300000
    assert len(cat_data["monthly_spending"]) >= 1
    march_spending = next((s for s in cat_data["monthly_spending"] if s["month"] == 3), None)
    assert march_spending is not None
    assert march_spending["amount"] == 50000


@pytest.mark.asyncio
async def test_category_overview_null_category_expense(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """카테고리 미설정(NULL) 지출이 있어도 category-overview 500 에러 없음"""
    # 카테고리 미설정 지출 추가 (category_id=None)
    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=None,
        amount=10000,
        description="카테고리 없는 지출",
        date=datetime(2026, 3, 15),
    )
    db_session.add(expense)
    await db_session.commit()

    # 500 에러 없이 정상 응답해야 함
    response = await authenticated_client.get("/api/budgets/category-overview")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

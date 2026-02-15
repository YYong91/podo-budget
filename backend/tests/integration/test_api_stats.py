"""
통계 API 통합 테스트

- GET /api/expenses/stats — 주간/월간/연간 통계
- GET /api/expenses/stats/comparison — 기간 비교
"""

from datetime import datetime

import pytest

from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User


async def create_test_expenses(db_session, user: User):
    """3개월분 테스트 지출 데이터 생성 (2026-01, 02, 03)"""
    cat_food = Category(user_id=user.id, name="식비")
    cat_transport = Category(user_id=user.id, name="교통비")
    db_session.add_all([cat_food, cat_transport])
    await db_session.commit()
    await db_session.refresh(cat_food)
    await db_session.refresh(cat_transport)

    expenses = [
        # 2026-01
        Expense(user_id=user.id, amount=10000, description="1월 식비1", category_id=cat_food.id, date=datetime(2026, 1, 5)),
        Expense(user_id=user.id, amount=5000, description="1월 교통1", category_id=cat_transport.id, date=datetime(2026, 1, 10)),
        Expense(user_id=user.id, amount=15000, description="1월 식비2", category_id=cat_food.id, date=datetime(2026, 1, 20)),
        # 2026-02
        Expense(user_id=user.id, amount=8000, description="2월 식비1", category_id=cat_food.id, date=datetime(2026, 2, 3)),
        Expense(user_id=user.id, amount=12000, description="2월 식비2", category_id=cat_food.id, date=datetime(2026, 2, 15)),
        Expense(user_id=user.id, amount=3000, description="2월 교통1", category_id=cat_transport.id, date=datetime(2026, 2, 15)),
        Expense(user_id=user.id, amount=7000, description="2월 식비3", category_id=cat_food.id, date=datetime(2026, 2, 20)),
        # 2026-03
        Expense(user_id=user.id, amount=20000, description="3월 식비1", category_id=cat_food.id, date=datetime(2026, 3, 1)),
        Expense(user_id=user.id, amount=6000, description="3월 교통1", category_id=cat_transport.id, date=datetime(2026, 3, 10)),
    ]
    db_session.add_all(expenses)
    await db_session.commit()
    return cat_food, cat_transport


class TestStatsAPI:
    """GET /api/expenses/stats 테스트"""

    @pytest.mark.asyncio
    async def test_monthly_stats(self, authenticated_client, test_user, db_session):
        """월간 통계 조회"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-02-15")
        assert response.status_code == 200

        data = response.json()
        assert data["period"] == "monthly"
        assert data["label"] == "2026년 2월"
        assert data["start_date"] == "2026-02-01"
        assert data["end_date"] == "2026-02-28"
        assert data["total"] == 30000.0
        assert data["count"] == 4

    @pytest.mark.asyncio
    async def test_monthly_stats_by_category(self, authenticated_client, test_user, db_session):
        """월간 카테고리별 통계"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-02-15")
        data = response.json()

        categories = {c["category"]: c for c in data["by_category"]}
        assert categories["식비"]["amount"] == 27000.0
        assert categories["교통비"]["amount"] == 3000.0
        assert categories["식비"]["percentage"] == 90.0
        assert categories["교통비"]["percentage"] == 10.0

    @pytest.mark.asyncio
    async def test_monthly_stats_trend(self, authenticated_client, test_user, db_session):
        """월간 일별 트렌드"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-02-15")
        data = response.json()

        trend_labels = [t["label"] for t in data["trend"]]
        assert "02/03" in trend_labels
        assert "02/15" in trend_labels
        assert "02/20" in trend_labels

    @pytest.mark.asyncio
    async def test_weekly_stats(self, authenticated_client, test_user, db_session):
        """주간 통계 조회"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=weekly&date=2026-02-15")
        assert response.status_code == 200

        data = response.json()
        assert data["period"] == "weekly"
        assert "주차" in data["label"]

    @pytest.mark.asyncio
    async def test_yearly_stats(self, authenticated_client, test_user, db_session):
        """연간 통계 조회"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=yearly&date=2026-06-15")
        assert response.status_code == 200

        data = response.json()
        assert data["period"] == "yearly"
        assert data["label"] == "2026년"
        assert data["total"] == 86000.0
        assert len(data["trend"]) == 12

    @pytest.mark.asyncio
    async def test_yearly_stats_trend_by_month(self, authenticated_client, test_user, db_session):
        """연간 월별 트렌드 값 확인"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=yearly&date=2026-06-15")
        data = response.json()

        trend = {t["label"]: t["amount"] for t in data["trend"]}
        assert trend["1월"] == 30000.0
        assert trend["2월"] == 30000.0
        assert trend["3월"] == 26000.0
        assert trend["4월"] == 0

    @pytest.mark.asyncio
    async def test_stats_empty_period(self, authenticated_client, test_user, db_session):
        """데이터 없는 기간 조회"""
        response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2025-01-15")
        assert response.status_code == 200

        data = response.json()
        assert data["total"] == 0
        assert data["count"] == 0
        assert data["by_category"] == []

    @pytest.mark.asyncio
    async def test_stats_invalid_period(self, authenticated_client, test_user, db_session):
        """잘못된 period 값"""
        response = await authenticated_client.get("/api/expenses/stats?period=daily&date=2026-02-15")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_stats_default_date(self, authenticated_client, test_user, db_session):
        """date 미지정 시 오늘 기준"""
        response = await authenticated_client.get("/api/expenses/stats?period=monthly")
        assert response.status_code == 200

        data = response.json()
        assert data["period"] == "monthly"
        now = datetime.now()
        assert str(now.year) in data["label"]


class TestComparisonAPI:
    """GET /api/expenses/stats/comparison 테스트"""

    @pytest.mark.asyncio
    async def test_monthly_comparison(self, authenticated_client, test_user, db_session):
        """월간 비교 (전월 대비)"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-02-15")
        assert response.status_code == 200

        data = response.json()
        assert data["current"]["total"] == 30000.0
        assert data["previous"]["total"] == 30000.0
        assert data["change"]["amount"] == 0.0
        assert data["change"]["percentage"] == 0.0

    @pytest.mark.asyncio
    async def test_comparison_trend(self, authenticated_client, test_user, db_session):
        """3개월 트렌드"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-03-15&months=3")
        assert response.status_code == 200

        data = response.json()
        assert len(data["trend"]) == 3

    @pytest.mark.asyncio
    async def test_comparison_by_category(self, authenticated_client, test_user, db_session):
        """카테고리별 비교"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-02-15")
        data = response.json()

        categories = {c["category"]: c for c in data["by_category_comparison"]}
        assert "식비" in categories
        assert categories["식비"]["current"] == 27000.0
        assert categories["식비"]["previous"] == 25000.0

    @pytest.mark.asyncio
    async def test_comparison_no_previous_data(self, authenticated_client, test_user, db_session):
        """이전 기간 데이터 없을 때"""
        response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2025-06-15")
        assert response.status_code == 200

        data = response.json()
        assert data["current"]["total"] == 0
        assert data["previous"]["total"] == 0
        assert data["change"]["percentage"] is None

    @pytest.mark.asyncio
    async def test_comparison_invalid_period(self, authenticated_client, test_user, db_session):
        """weekly는 비교 미지원"""
        response = await authenticated_client.get("/api/expenses/stats/comparison?period=weekly&date=2026-02-15")
        assert response.status_code == 422

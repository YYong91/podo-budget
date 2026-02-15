"""수입 통계 API 통합 테스트"""

import pytest

from app.models.income import Income
from app.models.user import User


@pytest.mark.asyncio
async def test_income_stats_monthly(authenticated_client, test_user: User, db_session):
    """월간 수입 통계"""
    from datetime import datetime

    db_session.add_all(
        [
            Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1)),
            Income(user_id=test_user.id, amount=500000, description="보너스", date=datetime(2026, 2, 15)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4000000
    assert data["count"] == 2
    assert data["period"] == "monthly"


@pytest.mark.asyncio
async def test_income_stats_weekly(authenticated_client, test_user: User, db_session):
    """주간 수입 통계"""
    from datetime import datetime

    db_session.add(Income(user_id=test_user.id, amount=100000, description="용돈", date=datetime(2026, 2, 10)))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=weekly&date=2026-02-10")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 100000
    assert data["period"] == "weekly"


@pytest.mark.asyncio
async def test_income_stats_empty(authenticated_client):
    """수입 없는 기간의 통계"""
    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["count"] == 0


@pytest.mark.asyncio
async def test_income_stats_by_category(authenticated_client, test_user: User, db_session):
    """카테고리별 수입 통계"""
    from datetime import datetime

    from app.models.category import Category

    cat1 = Category(name="급여", type="income", user_id=test_user.id)
    cat2 = Category(name="부수입", type="income", user_id=test_user.id)
    db_session.add_all([cat1, cat2])
    await db_session.flush()

    db_session.add_all(
        [
            Income(user_id=test_user.id, amount=3500000, description="월급", category_id=cat1.id, date=datetime(2026, 2, 1)),
            Income(
                user_id=test_user.id,
                amount=200000,
                description="프리랜스",
                category_id=cat2.id,
                date=datetime(2026, 2, 10),
            ),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()
    assert len(data["by_category"]) == 2
    assert data["by_category"][0]["category"] == "급여"  # 금액 내림차순


@pytest.mark.asyncio
async def test_income_stats_trend(authenticated_client, test_user: User, db_session):
    """수입 추이 데이터"""
    from datetime import datetime

    db_session.add_all(
        [
            Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1)),
            Income(user_id=test_user.id, amount=100000, description="용돈", date=datetime(2026, 2, 10)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()
    assert len(data["trend"]) >= 2

"""예산 API 통합 테스트

예산 CRUD 및 알림 기능을 테스트합니다.
"""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense


@pytest.mark.asyncio
async def test_get_budgets_empty(client: AsyncClient):
    """예산 목록 조회 - 빈 목록 테스트"""
    response = await client.get("/api/budgets/")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_budget_success(client: AsyncClient, db_session):
    """예산 생성 성공 테스트"""
    # 카테고리 생성
    category = Category(name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 예산 생성 요청
    start_date = datetime.now()
    response = await client.post(
        "/api/budgets/",
        json={
            "category_id": category.id,
            "amount": 300000,
            "period": "monthly",
            "start_date": start_date.isoformat(),
            "end_date": None,
            "alert_threshold": 0.8,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["category_id"] == category.id
    assert data["amount"] == 300000
    assert data["period"] == "monthly"
    assert data["alert_threshold"] == 0.8
    assert "id" in data


@pytest.mark.asyncio
async def test_create_budget_nonexistent_category(client: AsyncClient):
    """존재하지 않는 카테고리로 예산 생성 시도 테스트"""
    response = await client.post(
        "/api/budgets/",
        json={
            "category_id": 99999,
            "amount": 100000,
            "period": "monthly",
            "start_date": datetime.now().isoformat(),
        },
    )

    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_budget_invalid_dates(client: AsyncClient, db_session):
    """종료일이 시작일보다 이른 경우 테스트"""
    # 카테고리 생성
    category = Category(name="교통비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    start_date = datetime.now()
    end_date = start_date - timedelta(days=1)  # 시작일보다 이른 종료일

    response = await client.post(
        "/api/budgets/",
        json={
            "category_id": category.id,
            "amount": 100000,
            "period": "monthly",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
    )

    assert response.status_code == 400
    assert "종료일은 시작일 이후여야 합니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_budgets_list(client: AsyncClient, db_session):
    """예산 목록 조회 테스트"""
    # 카테고리 및 예산 생성
    category = Category(name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    budget = Budget(
        category_id=category.id,
        amount=200000,
        period="monthly",
        start_date=datetime.now(),
        alert_threshold=0.8,
    )
    db_session.add(budget)
    await db_session.commit()

    # 목록 조회
    response = await client.get("/api/budgets/")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["amount"] == 200000
    assert data[0]["category_id"] == category.id


@pytest.mark.asyncio
async def test_update_budget_success(client: AsyncClient, db_session):
    """예산 수정 성공 테스트"""
    # 카테고리 및 예산 생성
    category = Category(name="쇼핑")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    budget = Budget(
        category_id=category.id,
        amount=100000,
        period="monthly",
        start_date=datetime.now(),
    )
    db_session.add(budget)
    await db_session.commit()
    await db_session.refresh(budget)

    # 예산 금액 수정
    response = await client.put(
        f"/api/budgets/{budget.id}",
        json={"amount": 150000},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["amount"] == 150000
    assert data["id"] == budget.id


@pytest.mark.asyncio
async def test_update_budget_not_found(client: AsyncClient):
    """존재하지 않는 예산 수정 시도 테스트"""
    response = await client.put(
        "/api/budgets/99999",
        json={"amount": 200000},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_budget_success(client: AsyncClient, db_session):
    """예산 삭제 성공 테스트"""
    # 카테고리 및 예산 생성
    category = Category(name="문화생활")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    budget = Budget(
        category_id=category.id,
        amount=50000,
        period="monthly",
        start_date=datetime.now(),
    )
    db_session.add(budget)
    await db_session.commit()
    await db_session.refresh(budget)

    # 삭제
    response = await client.delete(f"/api/budgets/{budget.id}")

    assert response.status_code == 204

    # 다시 조회하면 없어야 함
    get_response = await client.get("/api/budgets/")
    assert len(get_response.json()) == 0


@pytest.mark.asyncio
async def test_delete_budget_not_found(client: AsyncClient):
    """존재하지 않는 예산 삭제 시도 테스트"""
    response = await client.delete("/api/budgets/99999")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_budget_alerts_no_budgets(client: AsyncClient):
    """예산 알림 조회 - 예산 없음 테스트"""
    response = await client.get("/api/budgets/alerts")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_budget_alerts_with_expenses(client: AsyncClient, db_session):
    """예산 알림 조회 - 지출이 있는 경우 테스트"""
    # 카테고리 생성
    category = Category(name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 예산 설정 (30만원)
    start_date = datetime.now() - timedelta(days=5)
    budget = Budget(
        category_id=category.id,
        amount=300000,
        period="monthly",
        start_date=start_date,
        alert_threshold=0.8,  # 80% 경고
    )
    db_session.add(budget)
    await db_session.commit()

    # 지출 추가 (25만원 - 83% 사용, 경고 임계값 초과)
    expense = Expense(
        amount=250000,
        description="식비 지출",
        category_id=category.id,
        date=datetime.now(),
    )
    db_session.add(expense)
    await db_session.commit()

    # 알림 조회
    response = await client.get("/api/budgets/alerts")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

    alert = data[0]
    assert alert["category_name"] == "식비"
    assert alert["budget_amount"] == 300000
    assert alert["spent_amount"] == 250000
    assert alert["remaining_amount"] == 50000
    assert alert["usage_percentage"] > 80
    assert alert["is_warning"] is True  # 80% 이상이므로 경고
    assert alert["is_exceeded"] is False  # 아직 초과는 아님


@pytest.mark.asyncio
async def test_get_budget_alerts_exceeded(client: AsyncClient, db_session):
    """예산 알림 조회 - 예산 초과 테스트"""
    # 카테고리 생성
    category = Category(name="교통비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 예산 설정 (10만원)
    start_date = datetime.now() - timedelta(days=5)
    budget = Budget(
        category_id=category.id,
        amount=100000,
        period="monthly",
        start_date=start_date,
    )
    db_session.add(budget)
    await db_session.commit()

    # 지출 추가 (15만원 - 150% 사용, 초과)
    expense = Expense(
        amount=150000,
        description="택시비",
        category_id=category.id,
        date=datetime.now(),
    )
    db_session.add(expense)
    await db_session.commit()

    # 알림 조회
    response = await client.get("/api/budgets/alerts")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

    alert = data[0]
    assert alert["is_exceeded"] is True  # 예산 초과
    assert alert["remaining_amount"] == -50000  # 음수 (초과 금액)
    assert alert["usage_percentage"] == 150.0

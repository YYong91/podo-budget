"""예산 벌크 저장 API 통합 테스트"""

from datetime import datetime

import pytest
from httpx import AsyncClient

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User


@pytest.mark.asyncio
async def test_bulk_save_create_budgets(authenticated_client: AsyncClient, test_user: User, db_session):
    """벌크 저장 - 새 예산 생성"""
    cat1 = Category(user_id=test_user.id, name="식비", type="expense")
    cat2 = Category(user_id=test_user.id, name="교통비", type="expense")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    response = await authenticated_client.put(
        "/api/budgets/bulk",
        json={
            "month": "2026-02",
            "alert_threshold": 0.8,
            "budgets": [
                {"category_id": cat1.id, "amount": 300000},
                {"category_id": cat2.id, "amount": 200000},
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["created"] == 2
    assert data["updated"] == 0
    assert data["deleted"] == 0


@pytest.mark.asyncio
async def test_bulk_save_update_existing(authenticated_client: AsyncClient, test_user: User, db_session):
    """벌크 저장 - 기존 예산 업데이트"""
    cat = Category(user_id=test_user.id, name="식비", type="expense")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 기존 예산 생성
    budget = Budget(
        user_id=test_user.id,
        category_id=cat.id,
        amount=200000,
        period="monthly",
        start_date=datetime(2026, 2, 1),
        alert_threshold=0.8,
    )
    db_session.add(budget)
    await db_session.commit()

    # 금액 변경하여 벌크 저장
    response = await authenticated_client.put(
        "/api/budgets/bulk",
        json={
            "month": "2026-02",
            "alert_threshold": 0.9,
            "budgets": [
                {"category_id": cat.id, "amount": 500000},
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["updated"] == 1
    assert data["created"] == 0


@pytest.mark.asyncio
async def test_bulk_save_delete_missing(authenticated_client: AsyncClient, test_user: User, db_session):
    """벌크 저장 - 요청에 없는 예산 삭제"""
    cat1 = Category(user_id=test_user.id, name="식비", type="expense")
    cat2 = Category(user_id=test_user.id, name="교통비", type="expense")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    # 2개 예산 생성
    for cat in [cat1, cat2]:
        db_session.add(
            Budget(
                user_id=test_user.id,
                category_id=cat.id,
                amount=100000,
                period="monthly",
                start_date=datetime(2026, 2, 1),
                alert_threshold=0.8,
            )
        )
    await db_session.commit()

    # cat1만 보내면 cat2는 삭제
    response = await authenticated_client.put(
        "/api/budgets/bulk",
        json={
            "month": "2026-02",
            "alert_threshold": 0.8,
            "budgets": [
                {"category_id": cat1.id, "amount": 100000},
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["deleted"] == 1
    assert data["created"] == 0


@pytest.mark.asyncio
async def test_bulk_save_empty_clears_all(authenticated_client: AsyncClient, test_user: User, db_session):
    """벌크 저장 - 빈 배열이면 전체 삭제"""
    cat = Category(user_id=test_user.id, name="식비", type="expense")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    db_session.add(
        Budget(
            user_id=test_user.id,
            category_id=cat.id,
            amount=100000,
            period="monthly",
            start_date=datetime(2026, 2, 1),
            alert_threshold=0.8,
        )
    )
    await db_session.commit()

    response = await authenticated_client.put(
        "/api/budgets/bulk",
        json={"month": "2026-02", "alert_threshold": 0.8, "budgets": []},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["deleted"] == 1


@pytest.mark.asyncio
async def test_alerts_with_month_filter(authenticated_client: AsyncClient, test_user: User, db_session):
    """월별 알림 조회 - month 파라미터 사용"""
    cat = Category(user_id=test_user.id, name="식비", type="expense")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 2월 예산
    db_session.add(
        Budget(
            user_id=test_user.id,
            category_id=cat.id,
            amount=300000,
            period="monthly",
            start_date=datetime(2026, 2, 1),
            alert_threshold=0.8,
        )
    )

    # 2월 지출
    db_session.add(
        Expense(
            user_id=test_user.id,
            amount=250000,
            description="2월 식비",
            category_id=cat.id,
            date=datetime(2026, 2, 15),
        )
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/alerts", params={"month": "2026-02"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["spent_amount"] == 250000
    assert data[0]["budget_amount"] == 300000


@pytest.mark.asyncio
async def test_alerts_month_filter_ignores_other_months(authenticated_client: AsyncClient, test_user: User, db_session):
    """월별 알림 - 다른 달 지출은 포함하지 않음"""
    cat = Category(user_id=test_user.id, name="식비", type="expense")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 2월 예산
    db_session.add(
        Budget(
            user_id=test_user.id,
            category_id=cat.id,
            amount=300000,
            period="monthly",
            start_date=datetime(2026, 2, 1),
            alert_threshold=0.8,
        )
    )

    # 1월 지출 (포함 안 됨)
    db_session.add(
        Expense(
            user_id=test_user.id,
            amount=500000,
            description="1월 식비",
            category_id=cat.id,
            date=datetime(2026, 1, 15),
        )
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/budgets/alerts", params={"month": "2026-02"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["spent_amount"] == 0

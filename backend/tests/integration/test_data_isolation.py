"""데이터 격리 테스트

사용자별로 데이터가 완전히 격리되는지 검증합니다.
- 사용자 A는 사용자 B의 지출/카테고리/예산을 조회할 수 없음
- 사용자 A는 사용자 B의 지출/카테고리/예산을 수정/삭제할 수 없음
"""

from datetime import datetime

import pytest

from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User


@pytest.mark.asyncio
async def test_expense_data_isolation_list(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session,
):
    """지출 목록 조회 시 다른 사용자의 지출은 보이지 않음"""
    # User1의 지출
    expense1 = Expense(user_id=test_user.id, amount=10000, description="User1 지출", date=datetime.now())
    # User2의 지출
    expense2 = Expense(user_id=test_user2.id, amount=20000, description="User2 지출", date=datetime.now())
    db_session.add_all([expense1, expense2])
    await db_session.commit()

    # User1으로 조회 → User1의 지출만 보임
    response1 = await authenticated_client.get("/api/expenses/")
    assert response1.status_code == 200
    data1 = response1.json()
    assert len(data1) == 1
    assert data1[0]["description"] == "User1 지출"

    # User2로 조회 → User2의 지출만 보임
    response2 = await authenticated_client2.get("/api/expenses/")
    assert response2.status_code == 200
    data2 = response2.json()
    assert len(data2) == 1
    assert data2[0]["description"] == "User2 지출"


@pytest.mark.asyncio
async def test_expense_data_isolation_detail(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session,
):
    """다른 사용자의 지출 상세 조회 시 404"""
    # User2의 지출
    expense = Expense(user_id=test_user2.id, amount=20000, description="User2 지출", date=datetime.now())
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    # User1이 User2의 지출 조회 시도 → 404
    response = await authenticated_client.get(f"/api/expenses/{expense.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_expense_data_isolation_update(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session,
):
    """다른 사용자의 지출 수정 시도 시 404"""
    # User2의 지출
    expense = Expense(user_id=test_user2.id, amount=20000, description="User2 지출", date=datetime.now())
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    # User1이 User2의 지출 수정 시도 → 404
    response = await authenticated_client.put(f"/api/expenses/{expense.id}", json={"amount": 99999})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_expense_data_isolation_delete(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session,
):
    """다른 사용자의 지출 삭제 시도 시 404"""
    # User2의 지출
    expense = Expense(user_id=test_user2.id, amount=20000, description="User2 지출", date=datetime.now())
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    # User1이 User2의 지출 삭제 시도 → 404
    response = await authenticated_client.delete(f"/api/expenses/{expense.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_category_data_isolation(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session,
):
    """카테고리 조회 시 시스템 카테고리 + 자신의 카테고리만 보임"""
    # 시스템 카테고리 (user_id=None)
    system_cat = Category(user_id=None, name="시스템카테고리")
    # User1의 개인 카테고리
    user1_cat = Category(user_id=test_user.id, name="User1 개인카테고리")
    # User2의 개인 카테고리
    user2_cat = Category(user_id=test_user2.id, name="User2 개인카테고리")
    db_session.add_all([system_cat, user1_cat, user2_cat])
    await db_session.commit()

    # User1으로 조회 → 시스템 + User1 카테고리만 보임
    response1 = await authenticated_client.get("/api/categories/")
    assert response1.status_code == 200
    data1 = response1.json()
    assert len(data1) == 2
    names1 = {cat["name"] for cat in data1}
    assert names1 == {"시스템카테고리", "User1 개인카테고리"}

    # User2로 조회 → 시스템 + User2 카테고리만 보임
    response2 = await authenticated_client2.get("/api/categories/")
    assert response2.status_code == 200
    data2 = response2.json()
    assert len(data2) == 2
    names2 = {cat["name"] for cat in data2}
    assert names2 == {"시스템카테고리", "User2 개인카테고리"}


@pytest.mark.asyncio
async def test_category_cannot_modify_others(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session,
):
    """다른 사용자의 카테고리 수정/삭제 불가"""
    # User2의 개인 카테고리
    user2_cat = Category(user_id=test_user2.id, name="User2 카테고리")
    db_session.add(user2_cat)
    await db_session.commit()
    await db_session.refresh(user2_cat)

    # User1이 User2의 카테고리 수정 시도 → 404
    response = await authenticated_client.put(f"/api/categories/{user2_cat.id}", json={"description": "해킹 시도"})
    assert response.status_code == 404

    # User1이 User2의 카테고리 삭제 시도 → 404
    response = await authenticated_client.delete(f"/api/categories/{user2_cat.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_category_cannot_modify_system(
    authenticated_client,
    test_user: User,
    db_session,
):
    """시스템 카테고리는 수정/삭제 불가"""
    # 시스템 카테고리 (user_id=None)
    system_cat = Category(user_id=None, name="시스템카테고리")
    db_session.add(system_cat)
    await db_session.commit()
    await db_session.refresh(system_cat)

    # 시스템 카테고리 수정 시도 → 403
    response = await authenticated_client.put(f"/api/categories/{system_cat.id}", json={"description": "수정 시도"})
    assert response.status_code == 403

    # 시스템 카테고리 삭제 시도 → 403
    response = await authenticated_client.delete(f"/api/categories/{system_cat.id}")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_budget_data_isolation(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session,
):
    """예산 조회 시 자신의 예산만 보임"""
    # API를 통해 카테고리와 예산 생성 (간단하게)
    # User1의 카테고리 생성
    cat1_response = await authenticated_client.post("/api/categories/", json={"name": "User1 카테고리"})
    assert cat1_response.status_code == 201
    cat1_id = cat1_response.json()["id"]

    # User1의 예산 생성
    budget1_payload = {
        "category_id": cat1_id,
        "amount": 100000,
        "period": "monthly",
        "start_date": "2026-02-01T00:00:00",
    }
    budget1_response = await authenticated_client.post("/api/budgets/", json=budget1_payload)
    if budget1_response.status_code != 201:
        print(f"Budget creation failed: {budget1_response.status_code}, {budget1_response.json()}")
    assert budget1_response.status_code == 201

    # User2의 카테고리 생성
    cat2_response = await authenticated_client2.post("/api/categories/", json={"name": "User2 카테고리"})
    assert cat2_response.status_code == 201
    cat2_id = cat2_response.json()["id"]

    # User2의 예산 생성
    budget2_payload = {
        "category_id": cat2_id,
        "amount": 200000,
        "period": "monthly",
        "start_date": "2026-02-01T00:00:00",
    }
    budget2_response = await authenticated_client2.post("/api/budgets/", json=budget2_payload)
    assert budget2_response.status_code == 201

    # User1으로 조회 → User1의 예산만 보임
    response1 = await authenticated_client.get("/api/budgets/")
    assert response1.status_code == 200
    data1 = response1.json()
    assert len(data1) == 1
    assert data1[0]["amount"] == 100000

    # User2로 조회 → User2의 예산만 보임
    response2 = await authenticated_client2.get("/api/budgets/")
    assert response2.status_code == 200
    data2 = response2.json()
    assert len(data2) == 1
    assert data2[0]["amount"] == 200000


@pytest.mark.asyncio
async def test_budget_cannot_modify_others(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session,
):
    """다른 사용자의 예산 수정/삭제 불가"""
    # User2의 카테고리와 예산 생성 (API 사용)
    cat2_response = await authenticated_client2.post("/api/categories/", json={"name": "User2 예산카테고리"})
    assert cat2_response.status_code == 201
    cat2_id = cat2_response.json()["id"]

    budget2_payload = {
        "category_id": cat2_id,
        "amount": 200000,
        "period": "monthly",
        "start_date": "2026-02-01T00:00:00",
    }
    budget2_response = await authenticated_client2.post("/api/budgets/", json=budget2_payload)
    assert budget2_response.status_code == 201
    budget2_id = budget2_response.json()["id"]

    # User1이 User2의 예산 수정 시도 → 404
    response = await authenticated_client.put(f"/api/budgets/{budget2_id}", json={"amount": 999999})
    assert response.status_code == 404

    # User1이 User2의 예산 삭제 시도 → 404
    response = await authenticated_client.delete(f"/api/budgets/{budget2_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_monthly_stats_data_isolation(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    db_session,
):
    """월별 통계는 자신의 지출만 집계됨"""
    # User1의 2월 지출
    expense1 = Expense(user_id=test_user.id, amount=10000, description="User1 지출", date=datetime(2026, 2, 15))
    # User2의 2월 지출
    expense2 = Expense(user_id=test_user2.id, amount=50000, description="User2 지출", date=datetime(2026, 2, 15))
    db_session.add_all([expense1, expense2])
    await db_session.commit()

    # User1의 월별 통계 → 10,000원만
    response1 = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-02")
    assert response1.status_code == 200
    data1 = response1.json()
    assert data1["total"] == 10000.0

    # User2의 월별 통계 → 50,000원만
    response2 = await authenticated_client2.get("/api/expenses/stats/monthly?month=2026-02")
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["total"] == 50000.0

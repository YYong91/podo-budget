"""
지출 API 통합 테스트

- POST /api/expenses/ - 지출 생성
- GET /api/expenses/ - 지출 목록 조회 (필터링, 페이지네이션)
- GET /api/expenses/{id} - 지출 상세 조회
- PUT /api/expenses/{id} - 지출 수정
- DELETE /api/expenses/{id} - 지출 삭제
- GET /api/expenses/stats/monthly - 월별 통계
"""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.expense import Expense


@pytest.mark.asyncio
async def test_create_expense(client, db_session):
    """지출 생성 API 테스트"""
    payload = {
        "amount": 8000.0,
        "description": "김치찌개",
        "category_id": None,
        "date": "2026-02-11T12:00:00",
        "raw_input": "점심 8000원",
    }

    response = await client.post("/api/expenses/", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["amount"] == 8000.0
    assert data["description"] == "김치찌개"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_get_expenses_empty(client, db_session):
    """지출 목록 조회 (데이터 없음)"""
    response = await client.get("/api/expenses/")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_expenses_list(client, db_session):
    """지출 목록 조회 (데이터 있음)"""
    # 테스트 데이터 생성
    expense1 = Expense(amount=5000, description="택시", date=datetime(2026, 2, 10))
    expense2 = Expense(amount=8000, description="김치찌개", date=datetime(2026, 2, 11))
    db_session.add_all([expense1, expense2])
    await db_session.commit()

    response = await client.get("/api/expenses/")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2
    # 날짜 내림차순 정렬 확인
    assert data[0]["description"] == "김치찌개"
    assert data[1]["description"] == "택시"


@pytest.mark.asyncio
async def test_get_expenses_pagination(client, db_session):
    """지출 목록 페이지네이션 테스트"""
    # 5개 생성
    for i in range(5):
        expense = Expense(amount=1000 * (i + 1), description=f"지출{i}", date=datetime(2026, 2, i + 1))
        db_session.add(expense)
    await db_session.commit()

    # skip=2, limit=2
    response = await client.get("/api/expenses/?skip=2&limit=2")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_expenses_filter_by_date(client, db_session):
    """지출 목록 날짜 필터링 테스트"""
    expense1 = Expense(amount=5000, description="1월 지출", date=datetime(2026, 1, 15))
    expense2 = Expense(amount=8000, description="2월 지출", date=datetime(2026, 2, 15))
    expense3 = Expense(amount=3000, description="3월 지출", date=datetime(2026, 3, 15))
    db_session.add_all([expense1, expense2, expense3])
    await db_session.commit()

    # 2월 데이터만 필터링
    response = await client.get("/api/expenses/?start_date=2026-02-01T00:00:00&end_date=2026-02-28T23:59:59")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "2월 지출"


@pytest.mark.asyncio
async def test_get_expenses_filter_by_category(client, db_session):
    """지출 목록 카테고리 필터링 테스트"""
    # 카테고리 생성
    cat1 = Category(name="식비")
    cat2 = Category(name="교통비")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    # 지출 생성
    expense1 = Expense(amount=8000, description="김치찌개", category_id=cat1.id, date=datetime.now())
    expense2 = Expense(amount=5000, description="택시", category_id=cat2.id, date=datetime.now())
    db_session.add_all([expense1, expense2])
    await db_session.commit()

    # 식비만 필터링
    response = await client.get(f"/api/expenses/?category_id={cat1.id}")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "김치찌개"


@pytest.mark.asyncio
async def test_get_expense_by_id(client, db_session):
    """특정 지출 조회 API 테스트"""
    expense = Expense(amount=8000, description="김치찌개", date=datetime.now())
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    response = await client.get(f"/api/expenses/{expense.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == expense.id
    assert data["description"] == "김치찌개"


@pytest.mark.asyncio
async def test_get_expense_not_found(client, db_session):
    """존재하지 않는 지출 조회 시 404"""
    response = await client.get("/api/expenses/9999")
    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_expense(client, db_session):
    """지출 수정 API 테스트"""
    expense = Expense(amount=8000, description="김치찌개", date=datetime.now())
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    # 금액과 설명 수정
    update_payload = {"amount": 9000.0, "description": "수정된 김치찌개"}
    response = await client.put(f"/api/expenses/{expense.id}", json=update_payload)
    assert response.status_code == 200

    data = response.json()
    assert data["amount"] == 9000.0
    assert data["description"] == "수정된 김치찌개"

    # DB에서도 변경 확인
    result = await db_session.execute(select(Expense).where(Expense.id == expense.id))
    updated = result.scalar_one()
    assert updated.amount == 9000.0


@pytest.mark.asyncio
async def test_update_expense_not_found(client, db_session):
    """존재하지 않는 지출 수정 시 404"""
    update_payload = {"amount": 9000.0}
    response = await client.put("/api/expenses/9999", json=update_payload)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_expense(client, db_session):
    """지출 삭제 API 테스트"""
    expense = Expense(amount=8000, description="김치찌개", date=datetime.now())
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    response = await client.delete(f"/api/expenses/{expense.id}")
    assert response.status_code == 200
    assert "삭제되었습니다" in response.json()["message"]

    # DB에서 삭제 확인
    result = await db_session.execute(select(Expense).where(Expense.id == expense.id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_expense_not_found(client, db_session):
    """존재하지 않는 지출 삭제 시 404"""
    response = await client.delete("/api/expenses/9999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_monthly_stats(client, db_session):
    """월별 통계 API 테스트"""
    # 카테고리 생성
    cat1 = Category(name="식비")
    cat2 = Category(name="교통비")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    # 2026-02 지출 생성
    expense1 = Expense(amount=8000, description="김치찌개", category_id=cat1.id, date=datetime(2026, 2, 10))
    expense2 = Expense(amount=15000, description="택시", category_id=cat2.id, date=datetime(2026, 2, 15))
    expense3 = Expense(amount=5000, description="버스", category_id=cat2.id, date=datetime(2026, 2, 20))
    # 다른 달 지출 (포함 안 됨)
    expense4 = Expense(amount=10000, description="1월 지출", category_id=cat1.id, date=datetime(2026, 1, 15))
    db_session.add_all([expense1, expense2, expense3, expense4])
    await db_session.commit()

    response = await client.get("/api/expenses/stats/monthly?month=2026-02")
    assert response.status_code == 200

    data = response.json()
    assert data["month"] == "2026-02"
    assert data["total"] == 28000.0  # 8000 + 15000 + 5000
    assert len(data["by_category"]) == 2

    # 카테고리별 합계 확인
    categories = {item["category"]: item["amount"] for item in data["by_category"]}
    assert categories["식비"] == 8000.0
    assert categories["교통비"] == 20000.0

    # 일별 추이 확인
    assert "daily_trend" in data
    assert len(data["daily_trend"]) == 3


@pytest.mark.asyncio
async def test_monthly_stats_no_data(client, db_session):
    """월별 통계 (데이터 없음)"""
    response = await client.get("/api/expenses/stats/monthly?month=2026-02")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 0.0
    assert data["by_category"] == []
    assert data["daily_trend"] == []


@pytest.mark.asyncio
async def test_monthly_stats_invalid_format(client, db_session):
    """월별 통계 (잘못된 month 형식) - Validation Error"""
    response = await client.get("/api/expenses/stats/monthly?month=202602")
    assert response.status_code == 422  # Unprocessable Entity

"""
지출 API 통합 테스트 (인증 적용)

- POST /api/expenses/ - 지출 생성
- GET /api/expenses/ - 지출 목록 조회 (필터링, 페이지네이션)
- GET /api/expenses/{id} - 지출 상세 조회
- PUT /api/expenses/{id} - 지출 수정
- DELETE /api/expenses/{id} - 지출 삭제
- GET /api/expenses/stats/monthly - 월별 통계

모든 엔드포인트는 JWT 인증이 필요합니다.
"""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.user import User


@pytest.mark.asyncio
async def test_create_expense(authenticated_client, test_user: User, db_session):
    """지출 생성 API 테스트"""
    payload = {
        "amount": 8000.0,
        "description": "김치찌개",
        "category_id": None,
        "date": "2026-02-11T12:00:00",
        "raw_input": "점심 8000원",
    }

    response = await authenticated_client.post("/api/expenses", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["amount"] == 8000.0
    assert data["description"] == "김치찌개"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_get_expenses_empty(authenticated_client, test_user: User, db_session):
    """지출 목록 조회 (데이터 없음)"""
    response = await authenticated_client.get("/api/expenses")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_expenses_list(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 목록 조회 (데이터 있음)"""
    expense1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="택시", date=datetime(2026, 2, 10))
    expense2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="김치찌개", date=datetime(2026, 2, 11))
    db_session.add_all([expense1, expense2])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2
    assert data[0]["description"] == "김치찌개"
    assert data[1]["description"] == "택시"


@pytest.mark.asyncio
async def test_get_expenses_pagination(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 목록 페이지네이션 테스트"""
    for i in range(5):
        expense = Expense(user_id=test_user.id, household_id=test_household.id, amount=1000 * (i + 1), description=f"지출{i}", date=datetime(2026, 2, i + 1))
        db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses?skip=2&limit=2")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_expenses_filter_by_date(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 목록 날짜 필터링 테스트"""
    expense1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="1월 지출", date=datetime(2026, 1, 15))
    expense2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="2월 지출", date=datetime(2026, 2, 15))
    expense3 = Expense(user_id=test_user.id, household_id=test_household.id, amount=3000, description="3월 지출", date=datetime(2026, 3, 15))
    db_session.add_all([expense1, expense2, expense3])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses?start_date=2026-02-01T00:00:00&end_date=2026-02-28T23:59:59")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "2월 지출"


@pytest.mark.asyncio
async def test_get_expenses_filter_by_date_only_format(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 목록 날짜 필터링 — YYYY-MM-DD 형식 (프론트엔드 date input 출력 형식)"""
    expense1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="1월 지출", date=datetime(2026, 1, 15))
    expense2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="2월 지출", date=datetime(2026, 2, 15))
    expense3 = Expense(user_id=test_user.id, household_id=test_household.id, amount=3000, description="3월 지출", date=datetime(2026, 3, 15))
    db_session.add_all([expense1, expense2, expense3])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses?start_date=2026-02-01&end_date=2026-02-28")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "2월 지출"


@pytest.mark.asyncio
async def test_get_expenses_filter_by_category(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 목록 카테고리 필터링 테스트"""
    cat1 = Category(user_id=test_user.id, name="식비")
    cat2 = Category(user_id=test_user.id, name="교통비")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    expense1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="김치찌개", category_id=cat1.id, date=datetime.now())
    expense2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="택시", category_id=cat2.id, date=datetime.now())
    db_session.add_all([expense1, expense2])
    await db_session.commit()

    response = await authenticated_client.get(f"/api/expenses?category_id={cat1.id}")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "김치찌개"


@pytest.mark.asyncio
async def test_get_expense_by_id(authenticated_client, test_user: User, test_household: Household, db_session):
    """특정 지출 조회 API 테스트"""
    expense = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="김치찌개", date=datetime.now())
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    response = await authenticated_client.get(f"/api/expenses/{expense.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == expense.id
    assert data["description"] == "김치찌개"


@pytest.mark.asyncio
async def test_get_expense_not_found(authenticated_client, test_user: User, db_session):
    """존재하지 않는 지출 조회 시 404"""
    response = await authenticated_client.get("/api/expenses/9999")
    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_expense(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 수정 API 테스트"""
    expense = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="김치찌개", date=datetime.now())
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    update_payload = {"amount": 9000.0, "description": "수정된 김치찌개"}
    response = await authenticated_client.put(f"/api/expenses/{expense.id}", json=update_payload)
    assert response.status_code == 200

    data = response.json()
    assert data["amount"] == 9000.0
    assert data["description"] == "수정된 김치찌개"

    result = await db_session.execute(select(Expense).where(Expense.id == expense.id))
    updated = result.scalar_one()
    assert updated.amount == 9000.0


@pytest.mark.asyncio
async def test_update_expense_not_found(authenticated_client, test_user: User, db_session):
    """존재하지 않는 지출 수정 시 404"""
    update_payload = {"amount": 9000.0}
    response = await authenticated_client.put("/api/expenses/9999", json=update_payload)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_expense(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 삭제 API 테스트"""
    expense = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="김치찌개", date=datetime.now())
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    response = await authenticated_client.delete(f"/api/expenses/{expense.id}")
    assert response.status_code == 204

    result = await db_session.execute(select(Expense).where(Expense.id == expense.id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_expense_not_found(authenticated_client, test_user: User, db_session):
    """존재하지 않는 지출 삭제 시 404"""
    response = await authenticated_client.delete("/api/expenses/9999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_monthly_stats(authenticated_client, test_user: User, test_household: Household, db_session):
    """월별 통계 API 테스트"""
    cat1 = Category(user_id=test_user.id, name="식비")
    cat2 = Category(user_id=test_user.id, name="교통비")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    expense1 = Expense(
        user_id=test_user.id, household_id=test_household.id, amount=8000, description="김치찌개", category_id=cat1.id, date=datetime(2026, 2, 10)
    )
    expense2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=15000, description="택시", category_id=cat2.id, date=datetime(2026, 2, 15))
    expense3 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="버스", category_id=cat2.id, date=datetime(2026, 2, 20))
    expense4 = Expense(
        user_id=test_user.id, household_id=test_household.id, amount=10000, description="1월 지출", category_id=cat1.id, date=datetime(2026, 1, 15)
    )
    db_session.add_all([expense1, expense2, expense3, expense4])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-02")
    assert response.status_code == 200

    data = response.json()
    assert data["month"] == "2026-02"
    assert data["total"] == 28000.0
    assert len(data["by_category"]) == 2

    categories = {item["category"]: item["amount"] for item in data["by_category"]}
    assert categories["식비"] == 8000.0
    assert categories["교통비"] == 20000.0

    assert "daily_trend" in data
    assert len(data["daily_trend"]) == 3


@pytest.mark.asyncio
async def test_monthly_stats_no_data(authenticated_client, test_user: User, db_session):
    """월별 통계 (데이터 없음)"""
    response = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-02")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 0.0
    assert data["by_category"] == []
    assert data["daily_trend"] == []


@pytest.mark.asyncio
async def test_monthly_stats_invalid_format(authenticated_client, test_user: User, db_session):
    """월별 통계 (잘못된 month 형식) - Validation Error"""
    response = await authenticated_client.get("/api/expenses/stats/monthly?month=202602")
    assert response.status_code == 422


# ──────────────────────────────────────────────
# 금액 검증 테스트 (TST-004)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_expense_negative_amount(authenticated_client, test_user: User, db_session):
    """음수 금액 지출 생성 시 422 반환"""
    category = Category(name="테스트", user_id=test_user.id)
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    payload = {
        "amount": -5000,
        "description": "음수 테스트",
        "category_id": category.id,
        "date": "2026-02-14T12:00:00",
    }
    response = await authenticated_client.post("/api/expenses", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_expense_zero_amount(authenticated_client, test_user: User, db_session):
    """0원 지출 생성 시 422 반환"""
    category = Category(name="테스트", user_id=test_user.id)
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    payload = {
        "amount": 0,
        "description": "0원 테스트",
        "category_id": category.id,
        "date": "2026-02-14T12:00:00",
    }
    response = await authenticated_client.post("/api/expenses", json=payload)
    assert response.status_code == 422


# ──────────────────────────────────────────────
# 날짜 형식 호환성 테스트 (TST-DATE)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_expense_with_date_only_format(authenticated_client, test_user: User, db_session):
    """YYYY-MM-DD 형식(시간 없는 날짜)으로 지출 생성"""
    payload = {
        "amount": 11680,
        "description": "전기차충전",
        "date": "2026-02-11",
    }
    response = await authenticated_client.post("/api/expenses", json=payload)
    assert response.status_code == 201, "YYYY-MM-DD 형식 날짜로 지출 생성이 실패함. ExpenseCreate.date 필드가 날짜만 있는 문자열을 허용해야 합니다."
    data = response.json()
    assert data["description"] == "전기차충전"
    assert data["amount"] == 11680
    assert "2026-02-11" in data["date"]


# ──────────────────────────────────────────────
# memo 필드 테스트 (TST-MEMO)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_expense_with_memo(authenticated_client, test_user: User, db_session):
    """memo 필드 포함 지출 생성"""
    payload = {
        "amount": 15000,
        "description": "주유",
        "date": "2026-02-15T10:00:00",
        "memo": "주유소 할인 카드 사용",
    }
    response = await authenticated_client.post("/api/expenses", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["memo"] == "주유소 할인 카드 사용"


@pytest.mark.asyncio
async def test_create_expense_without_memo(authenticated_client, test_user: User, db_session):
    """memo 없이 지출 생성 — memo는 선택 필드"""
    payload = {
        "amount": 3000,
        "description": "버스",
        "date": "2026-02-15T08:00:00",
    }
    response = await authenticated_client.post("/api/expenses", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data.get("memo") is None


@pytest.mark.asyncio
async def test_get_expenses_list_includes_memo(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 목록 조회 시 memo 필드 포함"""
    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="치킨",
        date=datetime(2026, 2, 20),
        memo="배달 앱 쿠폰 사용",
    )
    db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["memo"] == "배달 앱 쿠폰 사용"


@pytest.mark.asyncio
async def test_search_expenses_by_query(authenticated_client, test_user: User, test_household: Household, db_session):
    """query 파라미터로 description 검색"""
    e1 = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="점심 김치찌개",
        date=datetime(2026, 3, 1),
    )
    e2 = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=45000,
        description="정형외과 병원",
        date=datetime(2026, 3, 2),
    )
    e3 = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="버스 교통비",
        date=datetime(2026, 3, 3),
    )
    db_session.add_all([e1, e2, e3])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses?query=병원")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "정형외과 병원"


@pytest.mark.asyncio
async def test_search_expenses_no_match(authenticated_client, test_user: User, test_household: Household, db_session):
    """query 파라미터로 검색 — 결과 없음"""
    e1 = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="점심 김치찌개",
        date=datetime(2026, 3, 1),
    )
    db_session.add(e1)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses?query=병원")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_search_expenses_with_category_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """query + category_id 필터 조합"""
    cat = Category(name="의료", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    e1 = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=45000,
        description="정형외과 병원",
        category_id=cat.id,
        date=datetime(2026, 3, 1),
    )
    e2 = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="약국 병원약",
        category_id=None,
        date=datetime(2026, 3, 2),
    )
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get(f"/api/expenses?query=병원&category_id={cat.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "정형외과 병원"


@pytest.mark.asyncio
async def test_search_summary_expenses(authenticated_client, test_user: User, test_household: Household, db_session):
    """검색 합계 — 건수 + 총액"""
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=45000, description="정형외과 병원", date=datetime(2026, 3, 1))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=12000, description="약국 병원약", date=datetime(2026, 3, 2))
    e3 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심", date=datetime(2026, 3, 3))
    db_session.add_all([e1, e2, e3])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/search/summary?query=병원")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 2
    assert data["total_amount"] == 57000.0


@pytest.mark.asyncio
async def test_search_summary_expenses_no_query(authenticated_client, test_user: User, test_household: Household, db_session):
    """검색 합계 — query 없이 전체 합계"""
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=10000, description="택시", date=datetime(2026, 3, 1))
    db_session.add(e1)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/search/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 1
    assert data["total_amount"] == 10000.0


@pytest.mark.asyncio
async def test_update_expense_category_saves_correction(
    authenticated_client,
    test_household,
    test_user,
    db_session,
):
    """카테고리 수정 시 정정 신호가 저장된다"""
    from sqlalchemy import select

    from app.models.category_correction import CategoryCorrection

    # 지출 생성
    create_resp = await authenticated_client.post(
        "/api/expenses",
        json={
            "description": "쿠팡 우유",
            "amount": 3500,
            "date": "2026-04-26",
            "household_id": test_household.id,
            "category_id": None,
        },
    )
    assert create_resp.status_code == 201
    expense_id = create_resp.json()["id"]

    # 카테고리 추가 (식비 카테고리 먼저 생성)
    from app.models.category import Category

    food_cat = Category(name="식비", household_id=None, user_id=None)
    db_session.add(food_cat)
    await db_session.flush()

    # 카테고리 수정 → 정정 신호 발생
    update_resp = await authenticated_client.put(
        f"/api/expenses/{expense_id}",
        json={"category_id": food_cat.id},
    )
    assert update_resp.status_code == 200

    # 정정 레코드 확인
    result = await db_session.execute(select(CategoryCorrection).where(CategoryCorrection.household_id == test_household.id))
    corrections = result.scalars().all()
    assert len(corrections) == 1
    assert corrections[0].input_text == "쿠팡 우유"
    assert corrections[0].category_id == food_cat.id
    assert corrections[0].source == "edit"


@pytest.mark.asyncio
async def test_update_expense_same_category_no_correction(
    authenticated_client,
    test_household,
    test_user,
    db_session,
):
    """카테고리 변경 없이 수정 시 정정 신호가 저장되지 않는다"""
    from sqlalchemy import select

    from app.models.category import Category
    from app.models.category_correction import CategoryCorrection

    food_cat = Category(name="식비", household_id=None, user_id=None)
    db_session.add(food_cat)
    await db_session.flush()

    create_resp = await authenticated_client.post(
        "/api/expenses",
        json={
            "description": "편의점 도시락",
            "amount": 5000,
            "date": "2026-04-26",
            "household_id": test_household.id,
            "category_id": food_cat.id,
        },
    )
    expense_id = create_resp.json()["id"]

    # 같은 카테고리로 수정
    await authenticated_client.put(
        f"/api/expenses/{expense_id}",
        json={"category_id": food_cat.id},
    )

    result = await db_session.execute(select(CategoryCorrection).where(CategoryCorrection.household_id == test_household.id))
    assert len(result.scalars().all()) == 0

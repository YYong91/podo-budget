"""
E2E (End-to-End) 통합 시나리오 테스트 (인증 적용)

- 전체 애플리케이션 워크플로우 검증
- 채팅 입력 → 지출 생성 → 카테고리 자동 생성 → 통계 조회 → 인사이트 생성
"""

from datetime import datetime

import pytest

from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User


@pytest.mark.asyncio
async def test_health_check(client):
    """헬스 체크 엔드포인트 테스트"""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """루트 엔드포인트 테스트"""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "HomeNRich" in data["message"]
    assert data["docs"] == "/docs"


@pytest.mark.asyncio
async def test_full_expense_workflow(authenticated_client, test_user: User, db_session, mock_llm_parse_expense, mock_llm_generate_insights):
    """전체 지출 입력 → 조회 → 통계 → 인사이트 워크플로우"""

    # 1. 채팅으로 첫 번째 지출 입력
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-02-11",
        "memo": "",
    }
    response1 = await authenticated_client.post("/api/chat/", json={"message": "점심 김치찌개 8000원"})
    assert response1.status_code == 201
    assert "기록되었습니다" in response1.json()["message"]

    # 2. 두 번째 지출 입력 (다른 카테고리)
    mock_llm_parse_expense.return_value = {
        "amount": 15000,
        "category": "교통비",
        "description": "택시",
        "date": "2026-02-15",
        "memo": "",
    }
    response2 = await authenticated_client.post("/api/chat/", json={"message": "택시 15000원"})
    assert response2.status_code == 201

    # 3. 세 번째 지출 입력 (같은 카테고리)
    mock_llm_parse_expense.return_value = {
        "amount": 12000,
        "category": "식비",
        "description": "비빔밥",
        "date": "2026-02-20",
        "memo": "",
    }
    response3 = await authenticated_client.post("/api/chat/", json={"message": "저녁 비빔밥 12000원"})
    assert response3.status_code == 201

    # 4. 지출 목록 조회
    response_list = await authenticated_client.get("/api/expenses/")
    assert response_list.status_code == 200
    expenses = response_list.json()
    assert len(expenses) == 3

    # 5. 카테고리 목록 조회 (자동 생성된 2개)
    response_categories = await authenticated_client.get("/api/categories/")
    assert response_categories.status_code == 200
    categories = response_categories.json()
    assert len(categories) == 2
    category_names = [cat["name"] for cat in categories]
    assert "식비" in category_names
    assert "교통비" in category_names

    # 6. 월별 통계 조회
    response_stats = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-02")
    assert response_stats.status_code == 200
    stats = response_stats.json()
    assert stats["total"] == 35000.0
    assert len(stats["by_category"]) == 2
    assert stats["by_category"][0]["category"] == "식비"
    assert stats["by_category"][0]["amount"] == 20000.0

    # 7. 인사이트 생성
    mock_llm_generate_insights.return_value = "# 2월 지출 분석\n\n총 지출: ₩35,000\n식비가 57%로 가장 큰 비중입니다."
    response_insights = await authenticated_client.post("/api/insights/generate?month=2026-02")
    assert response_insights.status_code == 200
    insights = response_insights.json()
    assert insights["total"] == 35000.0
    assert "지출 분석" in insights["insights"]
    assert "35,000" in insights["insights"]

    # 8. 특정 지출 상세 조회
    first_expense_id = expenses[0]["id"]
    response_detail = await authenticated_client.get(f"/api/expenses/{first_expense_id}")
    assert response_detail.status_code == 200
    detail = response_detail.json()
    assert detail["id"] == first_expense_id

    # 9. 지출 수정
    update_payload = {"amount": 9000.0, "description": "수정된 김치찌개"}
    response_update = await authenticated_client.put(f"/api/expenses/{first_expense_id}", json=update_payload)
    assert response_update.status_code == 200
    updated = response_update.json()
    assert updated["amount"] == 9000.0

    # 10. 지출 삭제
    response_delete = await authenticated_client.delete(f"/api/expenses/{first_expense_id}")
    assert response_delete.status_code == 204

    # 11. 삭제 후 목록 재조회
    response_list_after = await authenticated_client.get("/api/expenses/")
    expenses_after = response_list_after.json()
    assert len(expenses_after) == 2


@pytest.mark.asyncio
async def test_category_management_workflow(authenticated_client, test_user: User, db_session):
    """카테고리 관리 워크플로우"""

    # 1. 빈 카테고리 목록
    response_empty = await authenticated_client.get("/api/categories/")
    assert response_empty.status_code == 200
    assert len(response_empty.json()) == 0

    # 2. 카테고리 생성
    response_create = await authenticated_client.post("/api/categories/", json={"name": "식비", "description": "음식 관련"})
    assert response_create.status_code == 201
    category_id = response_create.json()["id"]

    # 3. 카테고리 목록 조회
    response_list = await authenticated_client.get("/api/categories/")
    assert len(response_list.json()) == 1

    # 4. 카테고리 수정
    response_update = await authenticated_client.put(f"/api/categories/{category_id}", json={"name": "수정된 식비"})
    assert response_update.status_code == 200
    assert response_update.json()["name"] == "수정된 식비"

    # 5. 카테고리 삭제
    response_delete = await authenticated_client.delete(f"/api/categories/{category_id}")
    assert response_delete.status_code == 204

    # 6. 삭제 후 목록 재조회
    response_after = await authenticated_client.get("/api/categories/")
    assert len(response_after.json()) == 0


@pytest.mark.asyncio
async def test_expense_filtering_workflow(authenticated_client, test_user: User, db_session):
    """지출 필터링 워크플로우"""
    cat1 = Category(user_id=test_user.id, name="식비")
    cat2 = Category(user_id=test_user.id, name="교통비")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    expenses_data = [
        (10000, "1월 식비", cat1.id, datetime(2026, 1, 15)),
        (8000, "2월 식비", cat1.id, datetime(2026, 2, 10)),
        (5000, "2월 교통비", cat2.id, datetime(2026, 2, 15)),
        (12000, "3월 식비", cat1.id, datetime(2026, 3, 20)),
    ]

    for amount, desc, cat_id, date in expenses_data:
        expense = Expense(user_id=test_user.id, amount=amount, description=desc, category_id=cat_id, date=date)
        db_session.add(expense)
    await db_session.commit()

    # 1. 전체 조회
    response_all = await authenticated_client.get("/api/expenses/")
    assert len(response_all.json()) == 4

    # 2. 날짜 필터링 (2월만)
    response_feb = await authenticated_client.get("/api/expenses/?start_date=2026-02-01T00:00:00&end_date=2026-02-28T23:59:59")
    feb_expenses = response_feb.json()
    assert len(feb_expenses) == 2

    # 3. 카테고리 필터링 (식비만)
    response_food = await authenticated_client.get(f"/api/expenses/?category_id={cat1.id}")
    food_expenses = response_food.json()
    assert len(food_expenses) == 3

    # 4. 날짜 + 카테고리 필터링 (2월 식비)
    response_feb_food = await authenticated_client.get(f"/api/expenses/?start_date=2026-02-01T00:00:00&end_date=2026-02-28T23:59:59&category_id={cat1.id}")
    feb_food_expenses = response_feb_food.json()
    assert len(feb_food_expenses) == 1
    assert feb_food_expenses[0]["description"] == "2월 식비"


@pytest.mark.asyncio
async def test_error_handling_workflow(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """에러 처리 워크플로우"""

    # 1. 존재하지 않는 지출 조회
    response_404 = await authenticated_client.get("/api/expenses/9999")
    assert response_404.status_code == 404

    # 2. 중복 카테고리 생성
    await authenticated_client.post("/api/categories/", json={"name": "식비"})
    response_duplicate = await authenticated_client.post("/api/categories/", json={"name": "식비"})
    assert response_duplicate.status_code == 400
    assert "이미 존재" in response_duplicate.json()["detail"]

    # 3. LLM 파싱 실패
    mock_llm_parse_expense.return_value = {"error": "금액을 찾을 수 없습니다"}
    response_parse_fail = await authenticated_client.post("/api/chat/", json={"message": "텍스트만"})
    assert response_parse_fail.status_code == 201
    assert "금액을 찾을 수 없습니다" in response_parse_fail.json()["message"]

    # 4. 잘못된 월 형식
    response_invalid_month = await authenticated_client.get("/api/expenses/stats/monthly?month=202602")
    assert response_invalid_month.status_code == 422


@pytest.mark.asyncio
async def test_pagination_workflow(authenticated_client, test_user: User, db_session):
    """페이지네이션 워크플로우"""
    for i in range(30):
        expense = Expense(user_id=test_user.id, amount=1000 * (i + 1), description=f"지출{i}", date=datetime(2026, 2, 1 + (i % 28)))
        db_session.add(expense)
    await db_session.commit()

    # 1. 첫 페이지 (기본 limit=20)
    response_page1 = await authenticated_client.get("/api/expenses/?skip=0&limit=20")
    page1 = response_page1.json()
    assert len(page1) == 20

    # 2. 두 번째 페이지
    response_page2 = await authenticated_client.get("/api/expenses/?skip=20&limit=20")
    page2 = response_page2.json()
    assert len(page2) == 10

    # 3. limit 초과 시
    response_max = await authenticated_client.get("/api/expenses/?limit=200")
    assert response_max.status_code in [200, 422]


@pytest.mark.asyncio
async def test_data_persistence_workflow(authenticated_client, test_user: User, db_session):
    """데이터 영속성 워크플로우 (같은 세션 내)"""
    # 1. 지출 생성
    payload = {
        "amount": 8000.0,
        "description": "김치찌개",
        "category_id": None,
        "date": "2026-02-11T12:00:00",
    }
    response_create = await authenticated_client.post("/api/expenses/", json=payload)
    assert response_create.status_code == 201
    expense_id = response_create.json()["id"]

    # 2. 다시 조회하여 데이터가 유지되는지 확인
    response_get = await authenticated_client.get(f"/api/expenses/{expense_id}")
    assert response_get.status_code == 200
    assert response_get.json()["description"] == "김치찌개"

    # 3. 수정
    response_update = await authenticated_client.put(f"/api/expenses/{expense_id}", json={"description": "수정됨"})
    assert response_update.json()["description"] == "수정됨"

    # 4. 다시 조회하여 수정사항 확인
    response_get2 = await authenticated_client.get(f"/api/expenses/{expense_id}")
    assert response_get2.json()["description"] == "수정됨"

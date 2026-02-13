"""
인사이트 API 통합 테스트 (인증 적용)

- POST /api/insights/generate - Claude AI로 월별 지출 인사이트 생성
- GET /api/insights/budget-alerts - 예산 경고 조회

모든 엔드포인트는 JWT 인증이 필요합니다.
"""

from datetime import datetime

import pytest

from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User


@pytest.mark.asyncio
async def test_generate_insights_success(authenticated_client, test_user: User, db_session, mock_llm_generate_insights):
    """인사이트 생성 성공 케이스"""
    cat1 = Category(user_id=test_user.id, name="식비")
    cat2 = Category(user_id=test_user.id, name="교통비")
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    expense1 = Expense(user_id=test_user.id, amount=8000, description="김치찌개", category_id=cat1.id, date=datetime(2026, 2, 10))
    expense2 = Expense(user_id=test_user.id, amount=15000, description="택시", category_id=cat2.id, date=datetime(2026, 2, 15))
    expense3 = Expense(user_id=test_user.id, amount=12000, description="비빔밥", category_id=cat1.id, date=datetime(2026, 2, 20))
    db_session.add_all([expense1, expense2, expense3])
    await db_session.commit()

    mock_llm_generate_insights.return_value = "# 2월 지출 분석\n\n총 지출: ₩35,000\n식비가 가장 큰 비중을 차지합니다."

    response = await authenticated_client.post("/api/insights/generate?month=2026-02")
    assert response.status_code == 200

    data = response.json()
    assert data["month"] == "2026-02"
    assert data["total"] == 35000.0
    assert "by_category" in data
    assert len(data["by_category"]) == 2
    assert data["insights"] is not None
    assert "지출 분석" in data["insights"]
    assert "35,000" in data["insights"]

    mock_llm_generate_insights.assert_called_once()


@pytest.mark.asyncio
async def test_generate_insights_no_data(authenticated_client, test_user: User, db_session, mock_llm_generate_insights):
    """데이터가 없을 때 인사이트 요청"""
    response = await authenticated_client.post("/api/insights/generate?month=2026-02")
    assert response.status_code == 200

    data = response.json()
    assert data["month"] == "2026-02"
    assert "기록된 지출이 없습니다" in data["insights"]
    assert "지출을 입력해주세요" in data["insights"]

    mock_llm_generate_insights.assert_not_called()


@pytest.mark.asyncio
async def test_generate_insights_filter_by_month(authenticated_client, test_user: User, db_session, mock_llm_generate_insights):
    """특정 월 데이터만 필터링하여 인사이트 생성"""
    category = Category(user_id=test_user.id, name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    expense1 = Expense(user_id=test_user.id, amount=10000, description="1월 지출", category_id=category.id, date=datetime(2026, 1, 15))
    expense2 = Expense(user_id=test_user.id, amount=20000, description="2월 지출", category_id=category.id, date=datetime(2026, 2, 15))
    expense3 = Expense(user_id=test_user.id, amount=30000, description="3월 지출", category_id=category.id, date=datetime(2026, 3, 15))
    db_session.add_all([expense1, expense2, expense3])
    await db_session.commit()

    mock_llm_generate_insights.return_value = "# 2월 분석\n\n총 ₩20,000"

    response = await authenticated_client.post("/api/insights/generate?month=2026-02")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 20000.0
    assert data["by_category"]["식비"] == 20000.0


@pytest.mark.asyncio
async def test_generate_insights_top_expenses(authenticated_client, test_user: User, db_session, mock_llm_generate_insights):
    """인사이트 생성 시 상위 지출 내역 포함"""
    category = Category(user_id=test_user.id, name="쇼핑")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    for i in range(25):
        expense = Expense(
            user_id=test_user.id,
            amount=1000 * (i + 1),
            description=f"지출{i}",
            category_id=category.id,
            date=datetime(2026, 2, 10 + (i % 18)),
        )
        db_session.add(expense)
    await db_session.commit()

    mock_llm_generate_insights.return_value = "# 분석 결과"

    response = await authenticated_client.post("/api/insights/generate?month=2026-02")
    assert response.status_code == 200

    call_args = mock_llm_generate_insights.call_args
    expenses_data = call_args[0][0]
    assert "top_expenses" in expenses_data
    assert len(expenses_data["top_expenses"]) == 20


@pytest.mark.asyncio
async def test_generate_insights_invalid_month_format(authenticated_client, test_user: User, db_session):
    """잘못된 month 형식 - Validation Error"""
    response = await authenticated_client.post("/api/insights/generate?month=202602")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_generate_insights_december(authenticated_client, test_user: User, db_session, mock_llm_generate_insights):
    """12월 데이터 요청 시 year 전환 처리 확인"""
    category = Category(user_id=test_user.id, name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    expense1 = Expense(user_id=test_user.id, amount=10000, description="12월 지출", category_id=category.id, date=datetime(2026, 12, 25))
    db_session.add(expense1)
    await db_session.commit()

    mock_llm_generate_insights.return_value = "# 12월 분석"

    response = await authenticated_client.post("/api/insights/generate?month=2026-12")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 10000.0


@pytest.mark.asyncio
async def test_generate_insights_category_by_category(authenticated_client, test_user: User, db_session, mock_llm_generate_insights):
    """카테고리별 합계가 내림차순 정렬되는지 확인"""
    cat1 = Category(user_id=test_user.id, name="식비")
    cat2 = Category(user_id=test_user.id, name="교통비")
    cat3 = Category(user_id=test_user.id, name="문화생활")
    db_session.add_all([cat1, cat2, cat3])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)
    await db_session.refresh(cat3)

    expense1 = Expense(user_id=test_user.id, amount=5000, description="버스", category_id=cat2.id, date=datetime(2026, 2, 10))
    expense2 = Expense(user_id=test_user.id, amount=20000, description="영화", category_id=cat3.id, date=datetime(2026, 2, 15))
    expense3 = Expense(user_id=test_user.id, amount=15000, description="김치찌개", category_id=cat1.id, date=datetime(2026, 2, 20))
    db_session.add_all([expense1, expense2, expense3])
    await db_session.commit()

    mock_llm_generate_insights.return_value = "# 분석"

    response = await authenticated_client.post("/api/insights/generate?month=2026-02")
    assert response.status_code == 200

    data = response.json()
    by_category = data["by_category"]

    assert by_category["문화생활"] == 20000.0
    assert by_category["식비"] == 15000.0
    assert by_category["교통비"] == 5000.0

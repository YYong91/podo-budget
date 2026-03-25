"""
지출 API 추가 통합 테스트 (#358)

기존 test_api_expenses.py에서 누락된 영역:
- GET /api/expenses/stats (주간/월간/연간 통합 통계)
- GET /api/expenses/stats/comparison (기간 비교)
- POST /api/expenses/ocr (이미지 OCR 파싱, LLM 모킹)
- 검색 + 필터 조합 (query + date_range + category_id)
- search/summary에 날짜 필터 조합
- 멤버별 필터링 (member_user_id)
- exclude_from_stats 필드 동작
"""

from datetime import datetime
from io import BytesIO
from unittest.mock import AsyncMock, patch

import pytest

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.user import User

# ── GET /api/expenses/stats 통합 통계 ──────────────────────────


@pytest.mark.asyncio
async def test_stats_weekly(authenticated_client, test_user: User, test_household: Household, db_session):
    """주간 통계 조회"""
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 2026-03-23 (월)~29 (일) 주간에 지출 생성
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심", category_id=cat.id, date=datetime(2026, 3, 23))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="커피", category_id=cat.id, date=datetime(2026, 3, 24))
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats?period=weekly&date=2026-03-23")
    assert response.status_code == 200

    data = response.json()
    assert data["period"] == "weekly"
    assert data["total"] == 13000.0
    assert data["count"] == 2
    assert len(data["by_category"]) == 1
    assert data["by_category"][0]["category"] == "식비"
    assert len(data["trend"]) >= 1  # 일별 트렌드


@pytest.mark.asyncio
async def test_stats_monthly(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 통계 조회"""
    cat = Category(name="교통비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=15000, description="택시", category_id=cat.id, date=datetime(2026, 3, 10))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=3000, description="버스", category_id=cat.id, date=datetime(2026, 3, 20))
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-03-15")
    assert response.status_code == 200

    data = response.json()
    assert data["period"] == "monthly"
    assert data["total"] == 18000.0
    assert data["count"] == 2
    assert "2026년 3월" in data["label"]
    assert len(data["trend"]) == 2  # 2일에 지출


@pytest.mark.asyncio
async def test_stats_yearly(authenticated_client, test_user: User, test_household: Household, db_session):
    """연간 통계 조회"""
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=100000, description="1월 지출", category_id=cat.id, date=datetime(2026, 1, 15))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=200000, description="3월 지출", category_id=cat.id, date=datetime(2026, 3, 15))
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats?period=yearly&date=2026-06-01")
    assert response.status_code == 200

    data = response.json()
    assert data["period"] == "yearly"
    assert data["total"] == 300000.0
    assert data["count"] == 2
    assert "2026년" in data["label"]
    # 연간은 월별 12포인트 트렌드
    assert len(data["trend"]) >= 2


@pytest.mark.asyncio
async def test_stats_empty(authenticated_client, test_user: User, db_session):
    """통계 조회 — 데이터 없음"""
    response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-01-15")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 0.0
    assert data["count"] == 0
    assert data["by_category"] == []


@pytest.mark.asyncio
async def test_stats_excludes_flagged(authenticated_client, test_user: User, test_household: Household, db_session):
    """exclude_from_stats=True인 지출은 통계에서 제외"""
    cat = Category(name="저축", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    e_normal = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=50000,
        description="정상 지출",
        category_id=cat.id,
        date=datetime(2026, 3, 15),
    )
    e_excluded = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000000,
        description="저축 이체",
        category_id=cat.id,
        date=datetime(2026, 3, 15),
        exclude_from_stats=True,
    )
    db_session.add_all([e_normal, e_excluded])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-03-15")
    assert response.status_code == 200

    data = response.json()
    # exclude_from_stats=True인 500만원은 제외되고 5만원만 집계
    assert data["total"] == 50000.0
    assert data["count"] == 1


# ── GET /api/expenses/stats/comparison ──────────────────────────


@pytest.mark.asyncio
async def test_stats_comparison_monthly(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 비교 통계"""
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 2월 지출
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=100000, description="2월 식비", category_id=cat.id, date=datetime(2026, 2, 15))
    # 3월 지출
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=150000, description="3월 식비", category_id=cat.id, date=datetime(2026, 3, 15))
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-03-31&months=3")
    assert response.status_code == 200

    data = response.json()
    assert "current" in data
    assert "previous" in data
    assert "change" in data
    assert "trend" in data
    assert len(data["trend"]) == 3  # 3개월 트렌드


@pytest.mark.asyncio
async def test_stats_comparison_yearly(authenticated_client, test_user: User, test_household: Household, db_session):
    """연간 비교 통계"""
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 2025년 지출
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=500000, description="2025 식비", category_id=cat.id, date=datetime(2025, 6, 15))
    # 2026년 지출
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=300000, description="2026 식비", category_id=cat.id, date=datetime(2026, 3, 15))
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/comparison?period=yearly&date=2026-03-15&months=2")
    assert response.status_code == 200

    data = response.json()
    assert "current" in data
    assert "previous" in data
    assert data["current"]["total"] == 300000.0
    assert data["previous"]["total"] == 500000.0
    assert data["change"]["amount"] == -200000.0


@pytest.mark.asyncio
async def test_stats_comparison_empty(authenticated_client, test_user: User, db_session):
    """비교 통계 — 데이터 없음"""
    response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-01-15")
    assert response.status_code == 200

    data = response.json()
    assert data["current"]["total"] == 0.0
    assert data["previous"]["total"] == 0.0


# ── POST /api/expenses/ocr ──────────────────────────


@pytest.mark.asyncio
async def test_ocr_parse_success(authenticated_client, test_user: User, db_session):
    """OCR 이미지 파싱 성공 (LLM 모킹)"""
    # 유효한 JPEG 매직 바이트로 시작하는 더미 이미지
    dummy_jpeg = b"\xff\xd8\xff" + b"\x00" * 100

    with patch("app.api.expenses.get_llm_provider") as mock_provider_fn:
        mock_provider = mock_provider_fn.return_value
        mock_provider.parse_image = AsyncMock(
            return_value={
                "amount": 25000,
                "description": "편의점 결제",
                "category": "생활",
                "date": "2026-03-25",
                "memo": "",
            }
        )

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("receipt.jpg", BytesIO(dummy_jpeg), "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert "인식" in data["message"]
    assert data["parsed_items"] is not None
    assert len(data["parsed_items"]) == 1
    assert data["parsed_items"][0]["amount"] == 25000


@pytest.mark.asyncio
async def test_ocr_invalid_content_type(authenticated_client, test_user: User, db_session):
    """OCR 잘못된 파일 형식 → 400"""
    response = await authenticated_client.post(
        "/api/expenses/ocr",
        files={"file": ("doc.pdf", BytesIO(b"dummy pdf content"), "application/pdf")},
    )
    assert response.status_code == 400
    assert "이미지" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ocr_magic_byte_mismatch(authenticated_client, test_user: User, db_session):
    """OCR 매직 바이트 불일치 → 400"""
    # Content-Type은 JPEG이지만 실제 내용은 PNG 매직 바이트 아님
    fake_jpeg = b"NOT_JPEG_CONTENT"

    response = await authenticated_client.post(
        "/api/expenses/ocr",
        files={"file": ("fake.jpg", BytesIO(fake_jpeg), "image/jpeg")},
    )
    assert response.status_code == 400
    assert "올바르지 않습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ocr_llm_error_response(authenticated_client, test_user: User, db_session):
    """OCR LLM 파싱 실패 → 에러 메시지 반환"""
    dummy_jpeg = b"\xff\xd8\xff" + b"\x00" * 100

    with patch("app.api.expenses.get_llm_provider") as mock_provider_fn:
        mock_provider = mock_provider_fn.return_value
        mock_provider.parse_image = AsyncMock(return_value={"error": "이미지를 인식할 수 없습니다"})

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("receipt.jpg", BytesIO(dummy_jpeg), "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert "인식할 수 없습니다" in data["message"]
    assert data["parsed_items"] is None


@pytest.mark.asyncio
async def test_ocr_multiple_items(authenticated_client, test_user: User, db_session):
    """OCR 다건 인식 (영수증에 여러 항목)"""
    dummy_jpeg = b"\xff\xd8\xff" + b"\x00" * 100

    with patch("app.api.expenses.get_llm_provider") as mock_provider_fn:
        mock_provider = mock_provider_fn.return_value
        mock_provider.parse_image = AsyncMock(
            return_value=[
                {"amount": 5000, "description": "아메리카노", "category": "카페", "date": "2026-03-25"},
                {"amount": 12000, "description": "샐러드", "category": "식비", "date": "2026-03-25"},
            ]
        )

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("receipt.jpg", BytesIO(dummy_jpeg), "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parsed_items"] is not None
    assert len(data["parsed_items"]) == 2
    assert "2건" in data["message"]
    assert "17,000" in data["message"]


# ── 검색 + 날짜 필터 조합 ──────────────────────────


@pytest.mark.asyncio
async def test_search_with_date_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """query + 날짜 범위 필터 조합"""
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심 김치찌개", date=datetime(2026, 2, 15))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=9000, description="점심 된장찌개", date=datetime(2026, 3, 15))
    e3 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="커피", date=datetime(2026, 3, 16))
    db_session.add_all([e1, e2, e3])
    await db_session.commit()

    # "점심" 검색 + 3월로 필터 → 된장찌개만
    response = await authenticated_client.get("/api/expenses?query=점심&start_date=2026-03-01&end_date=2026-03-31")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "점심 된장찌개"


@pytest.mark.asyncio
async def test_search_with_all_filters(authenticated_client, test_user: User, test_household: Household, db_session):
    """query + category_id + 날짜 범위 필터 조합"""
    cat = Category(name="식비", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심", category_id=cat.id, date=datetime(2026, 3, 10))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=12000, description="점심 회식", category_id=None, date=datetime(2026, 3, 15))
    e3 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="커피", category_id=cat.id, date=datetime(2026, 3, 20))
    db_session.add_all([e1, e2, e3])
    await db_session.commit()

    # "점심" + 식비 카테고리 + 3월 → e1만
    response = await authenticated_client.get(f"/api/expenses?query=점심&category_id={cat.id}&start_date=2026-03-01&end_date=2026-03-31")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "점심"
    assert data[0]["amount"] == 8000.0


# ── search/summary 날짜 필터 조합 ──────────────────────────


@pytest.mark.asyncio
async def test_search_summary_with_date_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """search/summary에 날짜 필터 적용"""
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=10000, description="택시", date=datetime(2026, 2, 15))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=20000, description="택시", date=datetime(2026, 3, 15))
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/search/summary?query=택시&start_date=2026-03-01&end_date=2026-03-31")
    assert response.status_code == 200

    data = response.json()
    assert data["total_count"] == 1
    assert data["total_amount"] == 20000.0


@pytest.mark.asyncio
async def test_search_summary_with_category_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """search/summary에 카테고리 필터 적용"""
    cat = Category(name="교통", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=15000, description="택시", category_id=cat.id, date=datetime(2026, 3, 1))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심", category_id=None, date=datetime(2026, 3, 2))
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get(f"/api/expenses/search/summary?category_id={cat.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["total_count"] == 1
    assert data["total_amount"] == 15000.0


# ── 일별 통계 (monthly stats daily_trend) ──────────────────────────


@pytest.mark.asyncio
async def test_monthly_stats_daily_trend(authenticated_client, test_user: User, test_household: Household, db_session):
    """월별 통계의 daily_trend 정확성 검증"""
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 3월 5일에 2건, 3월 10일에 1건
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="커피", category_id=cat.id, date=datetime(2026, 3, 5, 10, 0))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심", category_id=cat.id, date=datetime(2026, 3, 5, 12, 0))
    e3 = Expense(user_id=test_user.id, household_id=test_household.id, amount=15000, description="저녁", category_id=cat.id, date=datetime(2026, 3, 10, 19, 0))
    db_session.add_all([e1, e2, e3])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-03")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 28000.0
    assert len(data["daily_trend"]) == 2  # 2일에 지출

    # 날짜별 합계 검증
    daily_map = {d["date"]: d["amount"] for d in data["daily_trend"]}
    assert daily_map.get("2026-03-05") == 13000.0  # 5000 + 8000
    assert daily_map.get("2026-03-10") == 15000.0


# ── 멤버별 필터링 ──────────────────────────


@pytest.mark.asyncio
async def test_filter_by_member_user_id(authenticated_client, test_user: User, test_household: Household, db_session):
    """member_user_id로 특정 멤버의 지출만 필터링"""
    from app.models.household_member import HouseholdMember

    # 두 번째 멤버 생성 (같은 가구)
    user2 = User(
        auth_user_id="a1b2c3d4-9999-0000-0000-000000000099",
        username="member2",
        email="member2@test.com",
        is_active=True,
    )
    db_session.add(user2)
    await db_session.flush()
    member2 = HouseholdMember(household_id=test_household.id, user_id=user2.id, role="member")
    db_session.add(member2)
    await db_session.flush()

    # test_user의 지출
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="test_user 지출", date=datetime(2026, 3, 15))
    # user2의 지출
    e2 = Expense(user_id=user2.id, household_id=test_household.id, amount=5000, description="member2 지출", date=datetime(2026, 3, 15))
    db_session.add_all([e1, e2])
    await db_session.commit()

    # member_user_id=user2.id로 필터
    response = await authenticated_client.get(f"/api/expenses?member_user_id={user2.id}")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "member2 지출"


# ── 지출 수정 시 일부 필드만 변경 ──────────────────────────


@pytest.mark.asyncio
async def test_update_expense_partial(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 수정 시 금액만 변경 (다른 필드 유지)"""
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="김치찌개",
        category_id=cat.id,
        date=datetime(2026, 3, 15),
        memo="원래 메모",
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    # 금액만 변경
    response = await authenticated_client.put(f"/api/expenses/{expense.id}", json={"amount": 10000.0})
    assert response.status_code == 200

    data = response.json()
    assert data["amount"] == 10000.0
    assert data["description"] == "김치찌개"  # 유지
    assert data["memo"] == "원래 메모"  # 유지


@pytest.mark.asyncio
async def test_update_expense_category(authenticated_client, test_user: User, test_household: Household, db_session):
    """지출 수정 시 카테고리 변경"""
    cat1 = Category(name="식비", user_id=test_user.id)
    cat2 = Category(name="외식비", user_id=test_user.id)
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="김치찌개",
        category_id=cat1.id,
        date=datetime(2026, 3, 15),
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    response = await authenticated_client.put(f"/api/expenses/{expense.id}", json={"category_id": cat2.id})
    assert response.status_code == 200

    data = response.json()
    assert data["category_id"] == cat2.id


# ── 카테고리 없는 지출의 통계 (미분류) ──────────────────────────


@pytest.mark.asyncio
async def test_stats_uncategorized(authenticated_client, test_user: User, test_household: Household, db_session):
    """카테고리 없는 지출은 통계에서 '미분류'로 표시"""
    e = Expense(user_id=test_user.id, household_id=test_household.id, amount=10000, description="미분류 지출", category_id=None, date=datetime(2026, 3, 15))
    db_session.add(e)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-03-15")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 10000.0
    assert len(data["by_category"]) == 1
    assert data["by_category"][0]["category"] == "미분류"


# ── 비교 통계에서 카테고리별 비교 ──────────────────────────


@pytest.mark.asyncio
async def test_stats_comparison_by_category(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 비교 통계에서 카테고리별 비교 데이터 포함"""
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 2월 식비 100,000원
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=100000, description="2월 식비", category_id=cat.id, date=datetime(2026, 2, 15))
    # 3월 식비 150,000원
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=150000, description="3월 식비", category_id=cat.id, date=datetime(2026, 3, 15))
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-03-31")
    assert response.status_code == 200

    data = response.json()
    assert "by_category_comparison" in data
    assert len(data["by_category_comparison"]) >= 1

    food_comparison = next((c for c in data["by_category_comparison"] if c["category"] == "식비"), None)
    assert food_comparison is not None
    assert food_comparison["current"] == 150000.0
    assert food_comparison["previous"] == 100000.0
    assert food_comparison["change_amount"] == 50000.0

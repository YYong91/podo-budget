"""지출 API 커버리지 강화 테스트 (#397)

미커버 영역:
- GET /api/expenses/stats/comparison — monthly 상세 분기 (카테고리별, 트렌드, 변화율)
- GET /api/expenses/stats/comparison — yearly 상세 분기 (trend, 변화율)
- GET /api/expenses/stats — yearly 트렌드 12포인트 검증
- GET /api/expenses/stats — daily trend 라벨 형식 검증
- search/summary + member_user_id 필터
- GET /api/expenses — member_user_id + query 복합 필터
- GET /api/expenses — member_user_id + category_id 복합 필터
- exclude_from_stats가 monthly stats에서 제외
- OCR NotImplementedError → 501
- OCR 파일 크기 초과 → 400
- OCR PNG 이미지 성공
- stats/comparison monthly — 이전 기간 총액 0일 때 change_percentage null
"""

from datetime import datetime
from io import BytesIO
from unittest.mock import AsyncMock, patch

import pytest

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.user import User

# ── stats/comparison monthly 상세 분기 ──────────────────


@pytest.mark.asyncio
async def test_comparison_monthly_change_percentage(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 비교 — 이전 기간 총액 > 0일 때 change_percentage 계산"""
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 1월 200,000원, 2월 300,000원
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=200000, description="1월", category_id=cat.id, date=datetime(2026, 1, 15))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=300000, description="2월", category_id=cat.id, date=datetime(2026, 2, 15))
    db_session.add_all([e1, e2])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-02-28&months=2")
    assert response.status_code == 200

    data = response.json()
    assert data["current"]["total"] == 300000.0
    assert data["previous"]["total"] == 200000.0
    assert data["change"]["amount"] == 100000.0
    assert data["change"]["percentage"] == 50.0  # (100000 / 200000) * 100


@pytest.mark.asyncio
async def test_comparison_monthly_zero_previous(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 비교 — 이전 기간 총액 0일 때 change_percentage null"""
    e = Expense(user_id=test_user.id, household_id=test_household.id, amount=100000, description="2월 지출", date=datetime(2026, 2, 15))
    db_session.add(e)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-02-28&months=2")
    assert response.status_code == 200

    data = response.json()
    assert data["previous"]["total"] == 0.0
    assert data["change"]["percentage"] is None


@pytest.mark.asyncio
async def test_comparison_monthly_trend_count(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 비교 — months 파라미터에 따른 trend 포인트 수"""
    e = Expense(user_id=test_user.id, household_id=test_household.id, amount=50000, description="지출", date=datetime(2026, 3, 10))
    db_session.add(e)
    await db_session.commit()

    for months in [2, 4, 6]:
        response = await authenticated_client.get(f"/api/expenses/stats/comparison?period=monthly&date=2026-03-31&months={months}")
        assert response.status_code == 200
        data = response.json()
        assert len(data["trend"]) == months


@pytest.mark.asyncio
async def test_comparison_monthly_category_change(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 비교 — by_category_comparison에서 change_amount, change_percentage 검증"""
    cat1 = Category(name="식비", user_id=test_user.id)
    cat2 = Category(name="교통비", user_id=test_user.id)
    db_session.add_all([cat1, cat2])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)

    # 1월: 식비 100k, 교통비 50k
    db_session.add_all(
        [
            Expense(
                user_id=test_user.id, household_id=test_household.id, amount=100000, description="1월 식비", category_id=cat1.id, date=datetime(2026, 1, 15)
            ),
            Expense(
                user_id=test_user.id, household_id=test_household.id, amount=50000, description="1월 교통비", category_id=cat2.id, date=datetime(2026, 1, 15)
            ),
        ]
    )
    # 2월: 식비 200k (교통비 없음)
    db_session.add(
        Expense(user_id=test_user.id, household_id=test_household.id, amount=200000, description="2월 식비", category_id=cat1.id, date=datetime(2026, 2, 15)),
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-02-28&months=2")
    assert response.status_code == 200

    data = response.json()
    by_cat = {c["category"]: c for c in data["by_category_comparison"]}

    assert "식비" in by_cat
    assert by_cat["식비"]["current"] == 200000.0
    assert by_cat["식비"]["previous"] == 100000.0
    assert by_cat["식비"]["change_amount"] == 100000.0
    assert by_cat["식비"]["change_percentage"] == 100.0

    # 교통비: 2월에 0원 → 이전 50k, change_amount -50k
    assert "교통비" in by_cat
    assert by_cat["교통비"]["current"] == 0.0
    assert by_cat["교통비"]["previous"] == 50000.0


# ── stats/comparison yearly 상세 분기 ──────────────────


@pytest.mark.asyncio
async def test_comparison_yearly_trend(authenticated_client, test_user: User, test_household: Household, db_session):
    """연간 비교 — trend 포인트 수 및 합계"""
    db_session.add_all(
        [
            Expense(user_id=test_user.id, household_id=test_household.id, amount=1000000, description="2024", date=datetime(2024, 6, 15)),
            Expense(user_id=test_user.id, household_id=test_household.id, amount=2000000, description="2025", date=datetime(2025, 6, 15)),
            Expense(user_id=test_user.id, household_id=test_household.id, amount=3000000, description="2026", date=datetime(2026, 3, 15)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/comparison?period=yearly&date=2026-06-01&months=3")
    assert response.status_code == 200

    data = response.json()
    assert len(data["trend"]) == 3
    # trend에 2024, 2025, 2026년이 포함
    labels = [t["label"] for t in data["trend"]]
    assert "2024년" in labels
    assert "2025년" in labels
    assert "2026년" in labels


@pytest.mark.asyncio
async def test_comparison_yearly_zero_previous(authenticated_client, test_user: User, test_household: Household, db_session):
    """연간 비교 — 이전 연도 데이터 없으면 change_percentage null"""
    db_session.add(Expense(user_id=test_user.id, household_id=test_household.id, amount=500000, description="2026", date=datetime(2026, 3, 15)))
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/comparison?period=yearly&date=2026-06-01&months=2")
    assert response.status_code == 200

    data = response.json()
    assert data["current"]["total"] == 500000.0
    assert data["previous"]["total"] == 0.0
    assert data["change"]["percentage"] is None
    # yearly는 by_category_comparison이 빈 배열
    assert data["by_category_comparison"] == []


# ── stats yearly 트렌드 12포인트 ──────────────────


@pytest.mark.asyncio
async def test_stats_yearly_12_trend_points(authenticated_client, test_user: User, test_household: Household, db_session):
    """연간 통계 — 트렌드 12포인트 (빈 달은 0)"""
    db_session.add_all(
        [
            Expense(user_id=test_user.id, household_id=test_household.id, amount=10000, description="3월", date=datetime(2026, 3, 15)),
            Expense(user_id=test_user.id, household_id=test_household.id, amount=20000, description="7월", date=datetime(2026, 7, 15)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats?period=yearly&date=2026-06-01")
    assert response.status_code == 200

    data = response.json()
    assert len(data["trend"]) == 12  # 1월~12월
    trend_map = {t["label"]: t["amount"] for t in data["trend"]}
    assert trend_map["3월"] == 10000.0
    assert trend_map["7월"] == 20000.0
    assert trend_map["1월"] == 0.0
    assert trend_map["12월"] == 0.0


# ── stats daily trend 라벨 형식 ──────────────────


@pytest.mark.asyncio
async def test_stats_daily_trend_label_format(authenticated_client, test_user: User, test_household: Household, db_session):
    """월간 통계 — 일별 트렌드 라벨 형식 (MM/DD)"""
    db_session.add(Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="커피", date=datetime(2026, 3, 5)))
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-03-15")
    assert response.status_code == 200

    data = response.json()
    assert len(data["trend"]) >= 1
    # 라벨은 "03/05" 형식
    assert data["trend"][0]["label"] == "03/05"


# ── search/summary + member_user_id 필터 ──────────────────


@pytest.mark.asyncio
async def test_search_summary_member_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """search/summary에서 member_user_id 필터"""
    user2 = User(auth_user_id="cov-0001-0000-0000-000000000001", username="member_a", email="member_a@test.com", is_active=True)
    db_session.add(user2)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=user2.id, role="member"))
    await db_session.flush()

    db_session.add_all(
        [
            Expense(user_id=test_user.id, household_id=test_household.id, amount=10000, description="내 지출", date=datetime(2026, 3, 1)),
            Expense(user_id=user2.id, household_id=test_household.id, amount=20000, description="멤버 지출", date=datetime(2026, 3, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/expenses/search/summary?member_user_id={user2.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 1
    assert data["total_amount"] == 20000.0


# ── GET /api/expenses — member_user_id + query 복합 ──────────────────


@pytest.mark.asyncio
async def test_expenses_member_and_query_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """member_user_id + query 복합 필터"""
    user2 = User(auth_user_id="cov-0002-0000-0000-000000000002", username="member_b", email="member_b@test.com", is_active=True)
    db_session.add(user2)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=user2.id, role="member"))
    await db_session.flush()

    db_session.add_all(
        [
            Expense(user_id=user2.id, household_id=test_household.id, amount=8000, description="점심 김치찌개", date=datetime(2026, 3, 1)),
            Expense(user_id=user2.id, household_id=test_household.id, amount=5000, description="커피", date=datetime(2026, 3, 1)),
            Expense(user_id=test_user.id, household_id=test_household.id, amount=9000, description="점심 돈까스", date=datetime(2026, 3, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/expenses?member_user_id={user2.id}&query=점심")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "점심 김치찌개"


@pytest.mark.asyncio
async def test_expenses_member_and_category_filter(authenticated_client, test_user: User, test_household: Household, db_session):
    """member_user_id + category_id 복합 필터"""
    cat = Category(name="식비", user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    user2 = User(auth_user_id="cov-0003-0000-0000-000000000003", username="member_c", email="member_c@test.com", is_active=True)
    db_session.add(user2)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=test_household.id, user_id=user2.id, role="member"))
    await db_session.flush()

    db_session.add_all(
        [
            Expense(user_id=user2.id, household_id=test_household.id, amount=8000, description="점심", category_id=cat.id, date=datetime(2026, 3, 1)),
            Expense(user_id=user2.id, household_id=test_household.id, amount=5000, description="택시", category_id=None, date=datetime(2026, 3, 1)),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get(f"/api/expenses?member_user_id={user2.id}&category_id={cat.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "점심"


# ── exclude_from_stats — monthly stats 에서 제외 ──────────────────


@pytest.mark.asyncio
async def test_monthly_stats_excludes_flagged(authenticated_client, test_user: User, test_household: Household, db_session):
    """exclude_from_stats=True 지출은 /stats/monthly에서도 제외"""
    cat = Category(name="저축", user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    db_session.add_all(
        [
            Expense(
                user_id=test_user.id, household_id=test_household.id, amount=50000, description="정상 지출", category_id=cat.id, date=datetime(2026, 3, 15)
            ),
            Expense(
                user_id=test_user.id,
                household_id=test_household.id,
                amount=5000000,
                description="저축 이체",
                category_id=cat.id,
                date=datetime(2026, 3, 15),
                exclude_from_stats=True,
            ),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 50000.0


# ── OCR 추가 분기 ──────────────────


@pytest.mark.asyncio
async def test_ocr_not_implemented(authenticated_client, test_user: User, db_session):
    """OCR 프로바이더가 NotImplementedError → 501"""
    dummy_jpeg = b"\xff\xd8\xff" + b"\x00" * 100

    with patch("app.api.expenses.get_llm_provider") as mock_provider_fn:
        mock_provider = mock_provider_fn.return_value
        mock_provider.parse_image = AsyncMock(side_effect=NotImplementedError("OCR 미지원"))

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("receipt.jpg", BytesIO(dummy_jpeg), "image/jpeg")},
        )

    assert response.status_code == 501
    assert "지원하지 않습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ocr_file_too_large(authenticated_client, test_user: User, db_session):
    """OCR 파일 크기 초과 → 400"""
    # 10MB + 1byte
    dummy_jpeg = b"\xff\xd8\xff" + b"\x00" * (10 * 1024 * 1024 + 1)

    response = await authenticated_client.post(
        "/api/expenses/ocr",
        files={"file": ("big.jpg", BytesIO(dummy_jpeg), "image/jpeg")},
    )

    assert response.status_code == 400
    assert "10MB" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ocr_png_success(authenticated_client, test_user: User, db_session):
    """OCR PNG 이미지 파싱 성공"""
    dummy_png = b"\x89PNG\r\n" + b"\x00" * 100

    with patch("app.api.expenses.get_llm_provider") as mock_provider_fn:
        mock_provider = mock_provider_fn.return_value
        mock_provider.parse_image = AsyncMock(return_value={"amount": 15000, "description": "PNG 영수증", "category": "기타", "date": "2026-03-25"})

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("receipt.png", BytesIO(dummy_png), "image/png")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parsed_items"] is not None
    assert data["parsed_items"][0]["amount"] == 15000


# ── stats/comparison — exclude_from_stats ──────────────────


@pytest.mark.asyncio
async def test_comparison_excludes_flagged(authenticated_client, test_user: User, test_household: Household, db_session):
    """비교 통계에서 exclude_from_stats=True 지출 제외"""
    db_session.add_all(
        [
            Expense(user_id=test_user.id, household_id=test_household.id, amount=100000, description="정상", date=datetime(2026, 2, 15)),
            Expense(
                user_id=test_user.id, household_id=test_household.id, amount=9999999, description="제외", date=datetime(2026, 2, 15), exclude_from_stats=True
            ),
        ]
    )
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-02-28&months=2")
    assert response.status_code == 200
    data = response.json()
    assert data["current"]["total"] == 100000.0

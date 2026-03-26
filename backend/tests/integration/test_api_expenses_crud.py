"""지출 CRUD + 통계 + 검색 + OCR 커버리지 테스트

api/expenses.py 미커버 라인 커버:
- 101-107 (create_expense)
- 134-146 (get_expenses with filters)
- 190-256 (stats)
- 291-296, 304-306, 317-417 (stats comparison)
- 446-477 (monthly stats)
- 534-574 (OCR)
- 577, 601-615 (search summary)
- 630-646 (get_expense detail)
- 662-690 (update_expense)
- 705-729 (delete_expense)
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.models.category import Category
from app.models.expense import Expense


@pytest.mark.asyncio
async def test_create_expense(authenticated_client, test_user, test_household, db_session):
    """지출 생성"""
    resp = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 8000,
            "description": "김치찌개",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == 8000


@pytest.mark.asyncio
async def test_get_expenses_with_filters(authenticated_client, test_user, test_household, db_session):
    """지출 목록 조회 + 필터"""
    cat = Category(name="식비", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    for i in range(3):
        exp = Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=10000 * (i + 1),
            description=f"지출 {i}",
            category_id=cat.id,
            date=datetime(2026, 3, 10 + i),
        )
        db_session.add(exp)
    await db_session.commit()

    # 날짜 필터 (날짜만, 시간 없는 end_date)
    resp = await authenticated_client.get("/api/expenses?start_date=2026-03-10&end_date=2026-03-11")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # 카테고리 필터
    resp = await authenticated_client.get(f"/api/expenses?category_id={cat.id}")
    assert resp.status_code == 200
    assert len(resp.json()) == 3

    # 텍스트 검색
    resp = await authenticated_client.get("/api/expenses?query=지출 1")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 멤버별 필터
    resp = await authenticated_client.get(f"/api/expenses?member_user_id={test_user.id}")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_expense_stats_weekly(authenticated_client, test_user, test_household, db_session):
    """지출 주간 통계"""
    cat = Category(name="식비", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=50000,
        description="식비",
        category_id=cat.id,
        date=datetime(2026, 3, 23),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get("/api/expenses/stats?period=weekly&date=2026-03-23")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 50000
    assert data["count"] == 1
    assert len(data["by_category"]) == 1
    assert len(data["trend"]) >= 1


@pytest.mark.asyncio
async def test_expense_stats_monthly(authenticated_client, test_user, test_household, db_session):
    """지출 월간 통계"""
    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=80000,
        description="테스트",
        date=datetime(2026, 3, 15),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-03-15")
    assert resp.status_code == 200
    assert resp.json()["total"] == 80000


@pytest.mark.asyncio
async def test_expense_stats_yearly(authenticated_client, test_user, test_household, db_session):
    """지출 연간 통계 (월별 트렌드 포함)"""
    for m in (1, 2, 3):
        exp = Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=100000 * m,
            description=f"{m}월 지출",
            date=datetime(2026, m, 15),
        )
        db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get("/api/expenses/stats?period=yearly&date=2026-03-15")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 600000
    assert len(data["trend"]) == 12


@pytest.mark.asyncio
async def test_expense_stats_comparison_monthly(authenticated_client, test_user, test_household, db_session):
    """지출 월간 비교"""
    cat = Category(name="식비", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    # 2월 지출
    exp_prev = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=200000,
        description="2월 식비",
        category_id=cat.id,
        date=datetime(2026, 2, 15),
    )
    db_session.add(exp_prev)

    # 3월 지출
    exp_cur = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=300000,
        description="3월 식비",
        category_id=cat.id,
        date=datetime(2026, 3, 15),
    )
    db_session.add(exp_cur)
    await db_session.commit()

    resp = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-03-15&months=3")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current"]["total"] == 300000
    assert data["previous"]["total"] == 200000
    assert data["change"]["amount"] == 100000
    assert len(data["trend"]) == 3
    assert len(data["by_category_comparison"]) >= 1


@pytest.mark.asyncio
async def test_expense_stats_comparison_yearly(authenticated_client, test_user, test_household, db_session):
    """지출 연간 비교"""
    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000000,
        description="올해 지출",
        date=datetime(2026, 3, 15),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get("/api/expenses/stats/comparison?period=yearly&date=2026-03-15&months=3")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current"]["total"] == 5000000
    assert len(data["trend"]) == 3


@pytest.mark.asyncio
async def test_expense_monthly_stats(authenticated_client, test_user, test_household, db_session):
    """월별 지출 통계 (/stats/monthly)"""
    cat = Category(name="교통", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=50000,
        description="교통비",
        category_id=cat.id,
        date=datetime(2026, 3, 20),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-03")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 50000
    assert data["month"] == "2026-03"
    assert len(data["by_category"]) == 1


@pytest.mark.asyncio
async def test_expense_search_summary(authenticated_client, test_user, test_household, db_session):
    """지출 검색 요약"""
    for i in range(3):
        exp = Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=10000 * (i + 1),
            description=f"항목{i}",
            date=datetime(2026, 3, 10 + i),
        )
        db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.get("/api/expenses/search/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] == 3
    assert data["total_amount"] == 60000


@pytest.mark.asyncio
async def test_get_expense_detail(authenticated_client, test_user, test_household, db_session):
    """지출 상세 조회"""
    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=15000,
        description="점심",
        date=datetime(2026, 3, 25),
    )
    db_session.add(exp)
    await db_session.commit()
    await db_session.refresh(exp)

    resp = await authenticated_client.get(f"/api/expenses/{exp.id}")
    assert resp.status_code == 200
    assert resp.json()["amount"] == 15000


@pytest.mark.asyncio
async def test_get_expense_not_found(authenticated_client):
    """존재하지 않는 지출 조회 → 404"""
    resp = await authenticated_client.get("/api/expenses/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_expense(authenticated_client, test_user, test_household, db_session):
    """지출 수정"""
    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="김치찌개",
        date=datetime(2026, 3, 25),
    )
    db_session.add(exp)
    await db_session.commit()
    await db_session.refresh(exp)

    resp = await authenticated_client.put(
        f"/api/expenses/{exp.id}",
        json={"amount": 9000, "description": "된장찌개"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount"] == 9000
    assert data["description"] == "된장찌개"


@pytest.mark.asyncio
async def test_update_expense_not_found(authenticated_client):
    """존재하지 않는 지출 수정 → 404"""
    resp = await authenticated_client.put("/api/expenses/99999", json={"amount": 1000})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_expense_other_user_member_role(authenticated_client2, test_user, test_user2, test_household, db_session):
    """타인 지출 수정 시 member 역할이면 403"""
    from app.models.household_member import HouseholdMember

    m = HouseholdMember(household_id=test_household.id, user_id=test_user2.id, role="member")
    db_session.add(m)
    await db_session.flush()

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="테스트",
        date=datetime(2026, 3, 25),
    )
    db_session.add(exp)
    await db_session.commit()
    await db_session.refresh(exp)

    resp = await authenticated_client2.put(f"/api/expenses/{exp.id}", json={"amount": 1})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_expense(authenticated_client, test_user, test_household, db_session):
    """지출 삭제"""
    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="삭제할 지출",
        date=datetime(2026, 3, 25),
    )
    db_session.add(exp)
    await db_session.commit()
    await db_session.refresh(exp)

    resp = await authenticated_client.delete(f"/api/expenses/{exp.id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_expense_not_found(authenticated_client):
    """존재하지 않는 지출 삭제 → 404"""
    resp = await authenticated_client.delete("/api/expenses/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_expense_other_user_member_role(authenticated_client2, test_user, test_user2, test_household, db_session):
    """타인 지출 삭제 시 member 역할이면 403"""
    from app.models.household_member import HouseholdMember

    m = HouseholdMember(household_id=test_household.id, user_id=test_user2.id, role="member")
    db_session.add(m)
    await db_session.flush()

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=8000,
        description="테스트",
        date=datetime(2026, 3, 25),
    )
    db_session.add(exp)
    await db_session.commit()
    await db_session.refresh(exp)

    resp = await authenticated_client2.delete(f"/api/expenses/{exp.id}")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_ocr_parse_expense_image(authenticated_client, test_user, test_household, db_session):
    """OCR 이미지 파싱 — 정상 케이스"""
    # 유효한 PNG 매직 바이트가 있는 더미 이미지
    png_magic = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100

    mock_parsed = {
        "amount": 15000,
        "description": "스타벅스",
        "category": "카페",
        "date": "2026-03-25",
        "memo": "",
    }

    with patch("app.api.expenses.get_llm_provider") as mock_provider:
        mock_llm = AsyncMock()
        mock_llm.parse_image.return_value = mock_parsed
        mock_provider.return_value = mock_llm

        resp = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("receipt.png", png_magic, "image/png")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "인식했습니다" in data["message"]
        assert data["parsed_items"] is not None
        assert len(data["parsed_items"]) == 1


@pytest.mark.asyncio
async def test_ocr_invalid_content_type(authenticated_client, test_user, test_household, db_session):
    """OCR 잘못된 Content-Type → 400"""
    resp = await authenticated_client.post(
        "/api/expenses/ocr",
        files={"file": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_ocr_error_response(authenticated_client, test_user, test_household, db_session):
    """OCR 에러 응답 처리"""
    png_magic = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100

    with patch("app.api.expenses.get_llm_provider") as mock_provider:
        mock_llm = AsyncMock()
        mock_llm.parse_image.return_value = {"error": "이미지를 인식할 수 없습니다"}
        mock_provider.return_value = mock_llm

        resp = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("receipt.png", png_magic, "image/png")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "인식할 수 없습니다" in data["message"]


@pytest.mark.asyncio
async def test_ocr_not_implemented(authenticated_client, test_user, test_household, db_session):
    """OCR NotImplementedError → 501"""
    png_magic = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100

    with patch("app.api.expenses.get_llm_provider") as mock_provider:
        mock_llm = AsyncMock()
        mock_llm.parse_image.side_effect = NotImplementedError("Not supported")
        mock_provider.return_value = mock_llm

        resp = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("receipt.png", png_magic, "image/png")},
        )
        assert resp.status_code == 501

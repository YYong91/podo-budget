"""수입 CRUD + 통계 + 검색 커버리지 테스트

api/income.py 미커버 라인 커버: 77-85, 106-119, 156-206, 232-246, 257-272, 284-312, 323-347
"""

from datetime import datetime

import pytest

from app.models.category import Category
from app.models.income import Income


@pytest.mark.asyncio
async def test_create_income(authenticated_client, test_user, test_household, db_session):
    """수입 생성"""
    response = await authenticated_client.post(
        "/api/income",
        json={
            "amount": 3000000,
            "description": "3월 급여",
            "date": "2026-03-01T09:00:00",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == 3000000
    assert data["description"] == "3월 급여"


@pytest.mark.asyncio
async def test_get_incomes_with_filters(authenticated_client, test_user, test_household, db_session):
    """수입 목록 조회 + 필터링"""
    # 데이터 준비
    cat = Category(name="급여", type="income", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    for i in range(3):
        inc = Income(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=1000000 * (i + 1),
            description=f"수입 {i}",
            category_id=cat.id,
            date=datetime(2026, 3, 10 + i),
        )
        db_session.add(inc)
    await db_session.commit()

    # 기본 조회
    resp = await authenticated_client.get("/api/income")
    assert resp.status_code == 200
    assert len(resp.json()) == 3

    # 날짜 필터
    resp = await authenticated_client.get("/api/income?start_date=2026-03-11&end_date=2026-03-12")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # 카테고리 필터
    resp = await authenticated_client.get(f"/api/income?category_id={cat.id}")
    assert resp.status_code == 200
    assert len(resp.json()) == 3

    # 텍스트 검색
    resp = await authenticated_client.get("/api/income?query=수입 1")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 멤버별 필터
    resp = await authenticated_client.get(f"/api/income?member_user_id={test_user.id}")
    assert resp.status_code == 200
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_income_stats_weekly(authenticated_client, test_user, test_household, db_session):
    """수입 주간 통계"""
    cat = Category(name="급여", type="income", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=3000000,
        description="급여",
        category_id=cat.id,
        date=datetime(2026, 3, 23),
    )
    db_session.add(inc)
    await db_session.commit()

    resp = await authenticated_client.get("/api/income/stats?period=weekly&date=2026-03-23")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3000000
    assert data["count"] == 1
    assert len(data["by_category"]) == 1


@pytest.mark.asyncio
async def test_income_stats_monthly(authenticated_client, test_user, test_household, db_session):
    """수입 월간 통계"""
    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=2000000,
        description="부수입",
        date=datetime(2026, 3, 15),
    )
    db_session.add(inc)
    await db_session.commit()

    resp = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-03-15")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2000000


@pytest.mark.asyncio
async def test_income_stats_yearly(authenticated_client, test_user, test_household, db_session):
    """수입 연간 통계 (월별 트렌드 포함)"""
    for m in (1, 2, 3):
        inc = Income(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=1000000 * m,
            description=f"{m}월 급여",
            date=datetime(2026, m, 15),
        )
        db_session.add(inc)
    await db_session.commit()

    resp = await authenticated_client.get("/api/income/stats?period=yearly&date=2026-03-15")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 6000000
    assert len(data["trend"]) == 12  # 12개월 포인트


@pytest.mark.asyncio
async def test_income_search_summary(authenticated_client, test_user, test_household, db_session):
    """수입 검색 요약"""
    for i in range(5):
        inc = Income(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=100000 * (i + 1),
            description=f"수입항목{i}",
            date=datetime(2026, 3, 10 + i),
        )
        db_session.add(inc)
    await db_session.commit()

    resp = await authenticated_client.get("/api/income/search/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] == 5
    assert data["total_amount"] == 1500000

    # 필터 적용 검색
    resp = await authenticated_client.get("/api/income/search/summary?query=수입항목2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] == 1


@pytest.mark.asyncio
async def test_get_income_detail(authenticated_client, test_user, test_household, db_session):
    """수입 상세 조회"""
    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000000,
        description="보너스",
        date=datetime(2026, 3, 25),
    )
    db_session.add(inc)
    await db_session.commit()
    await db_session.refresh(inc)

    resp = await authenticated_client.get(f"/api/income/{inc.id}")
    assert resp.status_code == 200
    assert resp.json()["amount"] == 5000000


@pytest.mark.asyncio
async def test_get_income_not_found(authenticated_client):
    """존재하지 않는 수입 조회 → 404"""
    resp = await authenticated_client.get("/api/income/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_income(authenticated_client, test_user, test_household, db_session):
    """수입 수정"""
    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=3000000,
        description="급여",
        date=datetime(2026, 3, 1),
    )
    db_session.add(inc)
    await db_session.commit()
    await db_session.refresh(inc)

    resp = await authenticated_client.put(
        f"/api/income/{inc.id}",
        json={"amount": 3500000, "description": "급여+수당"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount"] == 3500000
    assert data["description"] == "급여+수당"


@pytest.mark.asyncio
async def test_update_income_not_found(authenticated_client):
    """존재하지 않는 수입 수정 → 404"""
    resp = await authenticated_client.put("/api/income/99999", json={"amount": 1000})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_income_other_user_member_role(authenticated_client, authenticated_client2, test_user, test_user2, test_household, db_session):
    """타인 수입 수정 시 member 역할이면 403"""
    from app.models.household_member import HouseholdMember

    # user2를 test_household에 member로 추가
    m = HouseholdMember(household_id=test_household.id, user_id=test_user2.id, role="member")
    db_session.add(m)
    await db_session.flush()

    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=3000000,
        description="급여",
        date=datetime(2026, 3, 1),
    )
    db_session.add(inc)
    await db_session.commit()
    await db_session.refresh(inc)

    resp = await authenticated_client2.put(
        f"/api/income/{inc.id}",
        json={"amount": 1},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_income(authenticated_client, test_user, test_household, db_session):
    """수입 삭제"""
    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=500000,
        description="부수입",
        date=datetime(2026, 3, 20),
    )
    db_session.add(inc)
    await db_session.commit()
    await db_session.refresh(inc)

    resp = await authenticated_client.delete(f"/api/income/{inc.id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_income_not_found(authenticated_client):
    """존재하지 않는 수입 삭제 → 404"""
    resp = await authenticated_client.delete("/api/income/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_income_other_user_member_role(authenticated_client, authenticated_client2, test_user, test_user2, test_household, db_session):
    """타인 수입 삭제 시 member 역할이면 403"""
    from app.models.household_member import HouseholdMember

    m = HouseholdMember(household_id=test_household.id, user_id=test_user2.id, role="member")
    db_session.add(m)
    await db_session.flush()

    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=3000000,
        description="급여",
        date=datetime(2026, 3, 1),
    )
    db_session.add(inc)
    await db_session.commit()
    await db_session.refresh(inc)

    resp = await authenticated_client2.delete(f"/api/income/{inc.id}")
    assert resp.status_code == 403

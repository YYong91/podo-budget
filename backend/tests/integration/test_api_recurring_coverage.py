"""정기 거래 CRUD + execute/skip 커버리지 테스트

api/recurring.py 미커버 라인: 51-57, 73-124, 137-145, 159-168, 179, 192-198, 209-210, 224-235, 252-260, 270-295
"""

from datetime import datetime

import pytest

from app.models.category import Category
from app.models.expense import Expense
from app.models.recurring_transaction import RecurringTransaction


@pytest.mark.asyncio
async def test_create_recurring(authenticated_client, test_user, test_household, db_session):
    """정기 거래 생성"""
    resp = await authenticated_client.post(
        "/api/recurring",
        json={
            "type": "expense",
            "amount": 50000,
            "description": "넷플릭스",
            "frequency": "monthly",
            "start_date": "2026-03-01",
            "day_of_month": 1,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == 50000
    assert data["description"] == "넷플릭스"


@pytest.mark.asyncio
async def test_create_recurring_with_source(authenticated_client, test_user, test_household, db_session):
    """원본 거래 연결된 정기 거래 생성"""
    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=50000,
        description="넷플릭스",
        date=datetime(2026, 3, 1),
    )
    db_session.add(exp)
    await db_session.commit()
    await db_session.refresh(exp)

    resp = await authenticated_client.post(
        "/api/recurring",
        json={
            "type": "expense",
            "amount": 50000,
            "description": "넷플릭스",
            "frequency": "monthly",
            "start_date": "2026-03-01",
            "day_of_month": 1,
            "source_id": exp.id,
        },
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_get_recurring_list(authenticated_client, test_user, test_household, db_session):
    """정기 거래 목록 조회"""
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=50000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=1,
        next_due_date=datetime(2026, 4, 1).date(),
        start_date=datetime(2026, 3, 1).date(),
    )
    db_session.add(rec)
    await db_session.commit()

    resp = await authenticated_client.get("/api/recurring")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 타입 필터
    resp = await authenticated_client.get("/api/recurring?type=expense")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = await authenticated_client.get("/api/recurring?type=income")
    assert resp.status_code == 200
    assert len(resp.json()) == 0


@pytest.mark.asyncio
async def test_get_pending_recurring(authenticated_client, test_user, test_household, db_session):
    """대기 중인 정기 거래 조회"""
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=50000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=1,
        next_due_date=datetime(2025, 1, 1).date(),  # 과거 날짜 = pending
        start_date=datetime(2025, 1, 1).date(),
    )
    db_session.add(rec)
    await db_session.commit()

    resp = await authenticated_client.get("/api/recurring/pending")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_get_recurring_detail(authenticated_client, test_user, test_household, db_session):
    """정기 거래 상세 조회"""
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=50000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=1,
        next_due_date=datetime(2026, 4, 1).date(),
        start_date=datetime(2026, 3, 1).date(),
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    resp = await authenticated_client.get(f"/api/recurring/{rec.id}")
    assert resp.status_code == 200
    assert resp.json()["amount"] == 50000


@pytest.mark.asyncio
async def test_get_recurring_not_found(authenticated_client):
    """존재하지 않는 정기 거래 조회 → 404"""
    resp = await authenticated_client.get("/api/recurring/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_recurring(authenticated_client, test_user, test_household, db_session):
    """정기 거래 수정"""
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=50000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=1,
        next_due_date=datetime(2026, 4, 1).date(),
        start_date=datetime(2026, 3, 1).date(),
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    resp = await authenticated_client.put(
        f"/api/recurring/{rec.id}",
        json={"amount": 60000, "description": "넷플릭스 프리미엄"},
    )
    assert resp.status_code == 200
    assert resp.json()["amount"] == 60000


@pytest.mark.asyncio
async def test_delete_recurring(authenticated_client, test_user, test_household, db_session):
    """정기 거래 삭제"""
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=50000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=1,
        next_due_date=datetime(2026, 4, 1).date(),
        start_date=datetime(2026, 3, 1).date(),
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    resp = await authenticated_client.delete(f"/api/recurring/{rec.id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_execute_recurring(authenticated_client, test_user, test_household, db_session):
    """정기 거래 실행"""
    cat = Category(name="구독", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=50000,
        description="넷플릭스",
        category_id=cat.id,
        frequency="monthly",
        next_due_date=datetime(2026, 3, 1).date(),
        start_date=datetime(2026, 3, 1).date(),
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    resp = await authenticated_client.post(f"/api/recurring/{rec.id}/execute")
    assert resp.status_code == 201
    data = resp.json()
    assert "등록되었습니다" in data["message"]
    assert data["created_id"] is not None


@pytest.mark.asyncio
async def test_execute_inactive_recurring(authenticated_client, test_user, test_household, db_session):
    """비활성 정기 거래 실행 → 400"""
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=50000,
        description="넷플릭스",
        frequency="monthly",
        next_due_date=datetime(2026, 3, 1).date(),
        start_date=datetime(2026, 3, 1).date(),
        is_active=False,
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    resp = await authenticated_client.post(f"/api/recurring/{rec.id}/execute")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_skip_recurring(authenticated_client, test_user, test_household, db_session):
    """정기 거래 건너뛰기"""
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=50000,
        description="넷플릭스",
        frequency="monthly",
        next_due_date=datetime(2026, 3, 1).date(),
        start_date=datetime(2026, 3, 1).date(),
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    resp = await authenticated_client.post(f"/api/recurring/{rec.id}/skip")
    assert resp.status_code == 200
    assert "next_due_date" in resp.json()


@pytest.mark.asyncio
async def test_skip_inactive_recurring(authenticated_client, test_user, test_household, db_session):
    """비활성 정기 거래 건너뛰기 → 400"""
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=50000,
        description="넷플릭스",
        frequency="monthly",
        next_due_date=datetime(2026, 3, 1).date(),
        start_date=datetime(2026, 3, 1).date(),
        is_active=False,
    )
    db_session.add(rec)
    await db_session.commit()
    await db_session.refresh(rec)

    resp = await authenticated_client.post(f"/api/recurring/{rec.id}/skip")
    assert resp.status_code == 400

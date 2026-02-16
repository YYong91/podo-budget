"""정기 거래 API 통합 테스트"""

from datetime import date

import pytest

from app.models.recurring_transaction import RecurringTransaction
from app.models.user import User

# --- Helper ---


def _monthly_payload(**overrides):
    """monthly 정기 거래 생성 페이로드"""
    base = {
        "type": "expense",
        "amount": 17000,
        "description": "넷플릭스",
        "frequency": "monthly",
        "day_of_month": 25,
        "start_date": "2026-02-01",
    }
    base.update(overrides)
    return base


def _weekly_payload(**overrides):
    """weekly 정기 거래 생성 페이로드"""
    base = {
        "type": "income",
        "amount": 500000,
        "description": "주급",
        "frequency": "weekly",
        "day_of_week": 4,  # 금요일
        "start_date": "2026-02-01",
    }
    base.update(overrides)
    return base


# --- CRUD 기본 ---


@pytest.mark.asyncio
async def test_create_monthly(authenticated_client, test_user: User):
    """monthly 정기 거래 생성"""
    response = await authenticated_client.post("/api/recurring/", json=_monthly_payload())
    assert response.status_code == 201

    data = response.json()
    assert data["description"] == "넷플릭스"
    assert data["amount"] == 17000
    assert data["frequency"] == "monthly"
    assert data["day_of_month"] == 25
    assert data["user_id"] == test_user.id
    assert data["is_active"] is True
    assert data["next_due_date"] == "2026-02-25"


@pytest.mark.asyncio
async def test_create_weekly(authenticated_client):
    """weekly 정기 거래 생성"""
    response = await authenticated_client.post("/api/recurring/", json=_weekly_payload())
    assert response.status_code == 201

    data = response.json()
    assert data["frequency"] == "weekly"
    assert data["type"] == "income"


@pytest.mark.asyncio
async def test_create_yearly(authenticated_client):
    """yearly 정기 거래 생성"""
    payload = {
        "type": "income",
        "amount": 42000000,
        "description": "연봉",
        "frequency": "yearly",
        "day_of_month": 1,
        "month_of_year": 1,
        "start_date": "2026-01-01",
    }
    response = await authenticated_client.post("/api/recurring/", json=payload)
    assert response.status_code == 201
    assert response.json()["next_due_date"] == "2026-01-01"


@pytest.mark.asyncio
async def test_create_custom(authenticated_client):
    """custom 정기 거래 생성"""
    payload = {
        "type": "expense",
        "amount": 5000,
        "description": "격주 청소",
        "frequency": "custom",
        "interval": 14,
        "start_date": "2026-02-16",
    }
    response = await authenticated_client.post("/api/recurring/", json=payload)
    assert response.status_code == 201
    assert response.json()["next_due_date"] == "2026-02-16"


@pytest.mark.asyncio
async def test_get_recurring_list(authenticated_client):
    """정기 거래 목록 조회"""
    await authenticated_client.post("/api/recurring/", json=_monthly_payload())
    await authenticated_client.post("/api/recurring/", json=_weekly_payload())

    response = await authenticated_client.get("/api/recurring/")
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_get_recurring_detail(authenticated_client):
    """정기 거래 상세 조회"""
    create_resp = await authenticated_client.post("/api/recurring/", json=_monthly_payload())
    rec_id = create_resp.json()["id"]

    response = await authenticated_client.get(f"/api/recurring/{rec_id}")
    assert response.status_code == 200
    assert response.json()["id"] == rec_id


@pytest.mark.asyncio
async def test_update_recurring(authenticated_client):
    """정기 거래 수정"""
    create_resp = await authenticated_client.post("/api/recurring/", json=_monthly_payload())
    rec_id = create_resp.json()["id"]

    response = await authenticated_client.put(
        f"/api/recurring/{rec_id}",
        json={"amount": 19900, "description": "넷플릭스 프리미엄"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["amount"] == 19900
    assert data["description"] == "넷플릭스 프리미엄"


@pytest.mark.asyncio
async def test_delete_recurring(authenticated_client):
    """정기 거래 삭제"""
    create_resp = await authenticated_client.post("/api/recurring/", json=_monthly_payload())
    rec_id = create_resp.json()["id"]

    response = await authenticated_client.delete(f"/api/recurring/{rec_id}")
    assert response.status_code == 204

    # 삭제 후 조회 불가
    get_resp = await authenticated_client.get(f"/api/recurring/{rec_id}")
    assert get_resp.status_code == 404


# --- 빈도 검증 ---


@pytest.mark.asyncio
async def test_monthly_without_day_of_month(authenticated_client):
    """monthly인데 day_of_month 없으면 422"""
    payload = _monthly_payload(day_of_month=None)
    del payload["day_of_month"]
    response = await authenticated_client.post("/api/recurring/", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_weekly_without_day_of_week(authenticated_client):
    """weekly인데 day_of_week 없으면 422"""
    payload = {
        "type": "expense",
        "amount": 10000,
        "description": "테스트",
        "frequency": "weekly",
        "start_date": "2026-02-01",
    }
    response = await authenticated_client.post("/api/recurring/", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_yearly_without_month_of_year(authenticated_client):
    """yearly인데 month_of_year 없으면 422"""
    payload = {
        "type": "expense",
        "amount": 10000,
        "description": "테스트",
        "frequency": "yearly",
        "day_of_month": 1,
        "start_date": "2026-02-01",
    }
    response = await authenticated_client.post("/api/recurring/", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_custom_without_interval(authenticated_client):
    """custom인데 interval 없으면 422"""
    payload = {
        "type": "expense",
        "amount": 10000,
        "description": "테스트",
        "frequency": "custom",
        "start_date": "2026-02-01",
    }
    response = await authenticated_client.post("/api/recurring/", json=payload)
    assert response.status_code == 422


# --- type 필터 ---


@pytest.mark.asyncio
async def test_filter_by_expense_type(authenticated_client):
    """expense 타입만 필터링"""
    await authenticated_client.post("/api/recurring/", json=_monthly_payload())
    await authenticated_client.post("/api/recurring/", json=_weekly_payload())  # income

    response = await authenticated_client.get("/api/recurring/?type=expense")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["type"] == "expense"


@pytest.mark.asyncio
async def test_filter_by_income_type(authenticated_client):
    """income 타입만 필터링"""
    await authenticated_client.post("/api/recurring/", json=_monthly_payload())
    await authenticated_client.post("/api/recurring/", json=_weekly_payload())  # income

    response = await authenticated_client.get("/api/recurring/?type=income")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["type"] == "income"


# --- pending ---


@pytest.mark.asyncio
async def test_pending_includes_past_due(authenticated_client, db_session, test_user: User):
    """next_due_date가 오늘 이전이면 pending에 포함"""
    recurring = RecurringTransaction(
        user_id=test_user.id,
        type="expense",
        amount=17000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=25,
        start_date=date(2026, 1, 1),
        next_due_date=date(2026, 1, 25),  # 과거
        is_active=True,
    )
    db_session.add(recurring)
    await db_session.commit()

    response = await authenticated_client.get("/api/recurring/pending")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_pending_excludes_future(authenticated_client, db_session, test_user: User):
    """next_due_date가 미래면 pending에 미포함"""
    recurring = RecurringTransaction(
        user_id=test_user.id,
        type="expense",
        amount=17000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=25,
        start_date=date(2026, 1, 1),
        next_due_date=date(2099, 12, 31),  # 먼 미래
        is_active=True,
    )
    db_session.add(recurring)
    await db_session.commit()

    response = await authenticated_client.get("/api/recurring/pending")
    assert response.status_code == 200
    assert len(response.json()) == 0


@pytest.mark.asyncio
async def test_pending_excludes_inactive(authenticated_client, db_session, test_user: User):
    """비활성화된 항목은 pending에 미포함"""
    recurring = RecurringTransaction(
        user_id=test_user.id,
        type="expense",
        amount=17000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=25,
        start_date=date(2026, 1, 1),
        next_due_date=date(2026, 1, 25),  # 과거
        is_active=False,
    )
    db_session.add(recurring)
    await db_session.commit()

    response = await authenticated_client.get("/api/recurring/pending")
    assert response.status_code == 200
    assert len(response.json()) == 0


# --- execute ---


@pytest.mark.asyncio
async def test_execute_expense(authenticated_client, db_session, test_user: User):
    """expense 정기 거래 실행 → Expense 생성"""
    recurring = RecurringTransaction(
        user_id=test_user.id,
        type="expense",
        amount=17000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=25,
        start_date=date(2026, 1, 1),
        next_due_date=date(2026, 2, 25),
        is_active=True,
    )
    db_session.add(recurring)
    await db_session.commit()
    await db_session.refresh(recurring)

    response = await authenticated_client.post(f"/api/recurring/{recurring.id}/execute")
    assert response.status_code == 201

    data = response.json()
    assert data["type"] == "expense"
    assert data["created_id"] > 0
    assert data["next_due_date"] == "2026-03-25"


@pytest.mark.asyncio
async def test_execute_income(authenticated_client, db_session, test_user: User):
    """income 정기 거래 실행 → Income 생성"""
    recurring = RecurringTransaction(
        user_id=test_user.id,
        type="income",
        amount=3500000,
        description="급여",
        frequency="monthly",
        day_of_month=25,
        start_date=date(2026, 1, 1),
        next_due_date=date(2026, 2, 25),
        is_active=True,
    )
    db_session.add(recurring)
    await db_session.commit()
    await db_session.refresh(recurring)

    response = await authenticated_client.post(f"/api/recurring/{recurring.id}/execute")
    assert response.status_code == 201

    data = response.json()
    assert data["type"] == "income"
    assert data["created_id"] > 0
    assert data["next_due_date"] == "2026-03-25"


@pytest.mark.asyncio
async def test_execute_inactive_fails(authenticated_client, db_session, test_user: User):
    """비활성화된 정기 거래 실행 시 400"""
    recurring = RecurringTransaction(
        user_id=test_user.id,
        type="expense",
        amount=17000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=25,
        start_date=date(2026, 1, 1),
        next_due_date=date(2026, 2, 25),
        is_active=False,
    )
    db_session.add(recurring)
    await db_session.commit()
    await db_session.refresh(recurring)

    response = await authenticated_client.post(f"/api/recurring/{recurring.id}/execute")
    assert response.status_code == 400


# --- skip ---


@pytest.mark.asyncio
async def test_skip_updates_next_due_date(authenticated_client, db_session, test_user: User):
    """skip 후 next_due_date 갱신"""
    recurring = RecurringTransaction(
        user_id=test_user.id,
        type="expense",
        amount=17000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=25,
        start_date=date(2026, 1, 1),
        next_due_date=date(2026, 2, 25),
        is_active=True,
    )
    db_session.add(recurring)
    await db_session.commit()
    await db_session.refresh(recurring)

    response = await authenticated_client.post(f"/api/recurring/{recurring.id}/skip")
    assert response.status_code == 200
    assert response.json()["next_due_date"] == "2026-03-25"


@pytest.mark.asyncio
async def test_skip_end_date_deactivates(authenticated_client, db_session, test_user: User):
    """skip 시 end_date 초과하면 비활성화"""
    recurring = RecurringTransaction(
        user_id=test_user.id,
        type="expense",
        amount=17000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=25,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 1),  # 3월 1일까지만
        next_due_date=date(2026, 2, 25),
        is_active=True,
    )
    db_session.add(recurring)
    await db_session.commit()
    await db_session.refresh(recurring)

    response = await authenticated_client.post(f"/api/recurring/{recurring.id}/skip")
    assert response.status_code == 200

    # 비활성화 확인
    get_resp = await authenticated_client.get(f"/api/recurring/{recurring.id}")
    assert get_resp.json()["is_active"] is False


# --- 권한 ---


@pytest.mark.asyncio
async def test_other_user_cannot_access(authenticated_client, authenticated_client2, db_session, test_user: User):
    """다른 사용자의 정기 거래 접근 불가"""
    recurring = RecurringTransaction(
        user_id=test_user.id,
        type="expense",
        amount=17000,
        description="넷플릭스",
        frequency="monthly",
        day_of_month=25,
        start_date=date(2026, 1, 1),
        next_due_date=date(2026, 2, 25),
        is_active=True,
    )
    db_session.add(recurring)
    await db_session.commit()
    await db_session.refresh(recurring)

    response = await authenticated_client2.get(f"/api/recurring/{recurring.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_not_found(authenticated_client):
    """존재하지 않는 정기 거래 조회 시 404"""
    response = await authenticated_client.get("/api/recurring/99999")
    assert response.status_code == 404

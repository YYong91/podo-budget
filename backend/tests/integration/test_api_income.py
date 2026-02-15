"""수입 CRUD API 통합 테스트"""

import pytest
from sqlalchemy import select

from app.models.income import Income
from app.models.user import User


@pytest.mark.asyncio
async def test_create_income(authenticated_client, test_user: User, db_session):
    """수입 생성 API 테스트"""
    payload = {
        "amount": 3500000,
        "description": "2월 월급",
        "category_id": None,
        "date": "2026-02-01T09:00:00",
        "raw_input": "월급 350만원",
    }
    response = await authenticated_client.post("/api/income/", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["amount"] == 3500000
    assert data["description"] == "2월 월급"
    assert data["user_id"] == test_user.id

    # DB 검증
    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 1


@pytest.mark.asyncio
async def test_create_income_invalid_amount(authenticated_client):
    """금액 0 이하면 422"""
    payload = {
        "amount": 0,
        "description": "무효",
        "date": "2026-02-01T00:00:00",
    }
    response = await authenticated_client.post("/api/income/", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_incomes(authenticated_client, test_user: User, db_session):
    """수입 목록 조회"""
    from datetime import datetime

    for i in range(3):
        db_session.add(
            Income(
                user_id=test_user.id,
                amount=1000000 * (i + 1),
                description=f"수입 {i + 1}",
                date=datetime(2026, 2, i + 1),
            )
        )
    await db_session.commit()

    response = await authenticated_client.get("/api/income/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


@pytest.mark.asyncio
async def test_get_incomes_with_date_filter(authenticated_client, test_user: User, db_session):
    """날짜 필터링"""
    from datetime import datetime

    db_session.add(Income(user_id=test_user.id, amount=100000, description="1월 수입", date=datetime(2026, 1, 15)))
    db_session.add(Income(user_id=test_user.id, amount=200000, description="2월 수입", date=datetime(2026, 2, 15)))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/?start_date=2026-02-01T00:00:00&end_date=2026-02-28T23:59:59")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "2월 수입"


@pytest.mark.asyncio
async def test_get_incomes_pagination(authenticated_client, test_user: User, db_session):
    """페이지네이션"""
    from datetime import datetime

    for i in range(5):
        db_session.add(Income(user_id=test_user.id, amount=100000, description=f"수입 {i}", date=datetime(2026, 2, 1)))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/?skip=0&limit=2")
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = await authenticated_client.get("/api/income/?skip=2&limit=2")
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_get_income_by_id(authenticated_client, test_user: User, db_session):
    """단일 수입 조회"""
    from datetime import datetime

    income = Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.get(f"/api/income/{income.id}")
    assert response.status_code == 200
    assert response.json()["amount"] == 3500000


@pytest.mark.asyncio
async def test_get_income_not_found(authenticated_client):
    """존재하지 않는 수입 조회 → 404"""
    response = await authenticated_client.get("/api/income/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_other_user_income(authenticated_client, authenticated_client2, test_user2: User, db_session):
    """다른 사용자의 수입 조회 → 404"""
    from datetime import datetime

    income = Income(user_id=test_user2.id, amount=5000000, description="타인 수입", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.get(f"/api/income/{income.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_income(authenticated_client, test_user: User, db_session):
    """수입 수정"""
    from datetime import datetime

    income = Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.put(f"/api/income/{income.id}", json={"amount": 4000000})
    assert response.status_code == 200
    assert response.json()["amount"] == 4000000


@pytest.mark.asyncio
async def test_update_other_user_income(authenticated_client, test_user2: User, db_session):
    """다른 사용자의 수입 수정 → 404"""
    from datetime import datetime

    income = Income(user_id=test_user2.id, amount=5000000, description="타인 수입", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.put(f"/api/income/{income.id}", json={"amount": 1})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_income(authenticated_client, test_user: User, db_session):
    """수입 삭제"""
    from datetime import datetime

    income = Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.delete(f"/api/income/{income.id}")
    assert response.status_code == 204

    # DB 확인
    result = await db_session.execute(select(Income))
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_delete_other_user_income(authenticated_client, test_user2: User, db_session):
    """다른 사용자의 수입 삭제 → 404"""
    from datetime import datetime

    income = Income(user_id=test_user2.id, amount=5000000, description="타인 수입", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.delete(f"/api/income/{income.id}")
    assert response.status_code == 404

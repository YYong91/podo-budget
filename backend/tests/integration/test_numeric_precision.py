"""금액(Numeric) 정밀도 엣지케이스 테스트 (#366)

Numeric(12,2) 필드의 정밀도를 검증합니다:
- 소수점 금액 정확히 저장/반환
- 최대 금액 (9,999,999,999.99)
- 0원/음수 금액 → 검증 에러
- 통계 합산 시 부동소수점 오차 없는지
"""

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.household import Household
from app.models.user import User

# ── 소수점 금액 정밀도 ──


@pytest.mark.asyncio
async def test_decimal_amount_preserved(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """소수점 금액 8000.50원이 정확히 저장되고 반환되어야 한다"""
    response = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 8000.50,
            "description": "소수점 테스트",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == 8000.5


@pytest.mark.asyncio
async def test_decimal_amount_two_places(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """소수점 둘째자리까지 정확히 보존되어야 한다"""
    response = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 1234.56,
            "description": "소수점 2자리",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == 1234.56


@pytest.mark.asyncio
async def test_small_decimal_amount(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """0.01원 같은 매우 작은 금액도 처리 가능해야 한다"""
    response = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 0.01,
            "description": "최소 금액",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 201
    assert response.json()["amount"] == 0.01


# ── 큰 금액 (Numeric(12,2) 최대값) ──


@pytest.mark.asyncio
async def test_large_amount_max_numeric(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """Numeric(12,2) 최대값 9,999,999,999.99가 정확히 처리되어야 한다"""
    max_amount = 9999999999.99
    response = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": max_amount,
            "description": "최대 금액",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == max_amount


@pytest.mark.asyncio
async def test_large_amount_1_billion(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """10억원도 정확히 처리되어야 한다"""
    response = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 1000000000,
            "description": "10억원 지출",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 201
    assert response.json()["amount"] == 1000000000.0


# ── 0원/음수 금액 → 검증 에러 ──


@pytest.mark.asyncio
async def test_zero_amount_rejected(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """0원 금액은 Pydantic gt=0 검증에 의해 거부되어야 한다"""
    response = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 0,
            "description": "0원 지출",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_negative_amount_rejected(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """음수 금액은 Pydantic gt=0 검증에 의해 거부되어야 한다"""
    response = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": -5000,
            "description": "음수 지출",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_zero_amount_update_rejected(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """지출 수정 시에도 0원은 거부되어야 한다"""
    # 먼저 정상 지출 생성
    create_resp = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 1000,
            "description": "수정 대상",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert create_resp.status_code == 201
    expense_id = create_resp.json()["id"]

    # 0원으로 수정 시도
    response = await authenticated_client.put(
        f"/api/expenses/{expense_id}",
        json={"amount": 0},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_negative_amount_update_rejected(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """지출 수정 시에도 음수 금액은 거부되어야 한다"""
    create_resp = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 1000,
            "description": "수정 대상",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert create_resp.status_code == 201
    expense_id = create_resp.json()["id"]

    response = await authenticated_client.put(
        f"/api/expenses/{expense_id}",
        json={"amount": -100},
    )
    assert response.status_code == 422


# ── 수입(Income)에도 동일한 검증 적용 ──


@pytest.mark.asyncio
async def test_income_zero_amount_rejected(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """수입에서도 0원 금액은 거부되어야 한다"""
    response = await authenticated_client.post(
        "/api/income",
        json={
            "amount": 0,
            "description": "0원 수입",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_income_negative_amount_rejected(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """수입에서도 음수 금액은 거부되어야 한다"""
    response = await authenticated_client.post(
        "/api/income",
        json={
            "amount": -3000,
            "description": "음수 수입",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_income_decimal_precision(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """수입의 소수점 금액도 정확히 보존되어야 한다"""
    response = await authenticated_client.post(
        "/api/income",
        json={
            "amount": 3000000.50,
            "description": "소수점 수입",
            "date": "2026-03-25T12:00:00",
        },
    )
    assert response.status_code == 201
    assert response.json()["amount"] == 3000000.5


# ── 통계 합산 시 부동소수점 오차 검증 ──


@pytest.mark.asyncio
async def test_monthly_stats_no_floating_point_error(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """여러 소수점 금액 합산 시 부동소수점 오차가 없어야 한다

    0.1 + 0.2 = 0.30000000000000004 같은 IEEE 754 오차가
    Numeric 타입에서는 발생하지 않아야 한다.
    """
    # 부동소수점 오차가 발생하기 쉬운 금액들
    amounts = [0.10, 0.20, 0.30, 0.40, 1000.99, 2000.01]
    for i, amount in enumerate(amounts):
        expense = Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=Decimal(str(amount)),
            description=f"합산 테스트 {i}",
            date=datetime(2026, 3, 15),
        )
        db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-03")
    assert response.status_code == 200
    data = response.json()

    # 예상 합계: 0.10 + 0.20 + 0.30 + 0.40 + 1000.99 + 2000.01 = 3002.00
    expected_total = 3002.00
    assert data["total"] == expected_total


@pytest.mark.asyncio
async def test_many_small_amounts_sum_correctly(
    authenticated_client,
    test_user: User,
    test_household: Household,
    db_session: AsyncSession,
):
    """많은 소액 합산 시에도 정확해야 한다"""
    # 100건의 33.33원 합산
    for i in range(100):
        expense = Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=Decimal("33.33"),
            description=f"소액 {i}",
            date=datetime(2026, 3, 20),
        )
        db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    # 33.33 * 100 = 3333.00
    assert data["total"] == 3333.0

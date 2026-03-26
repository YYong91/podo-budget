"""결제수단 API 통합 테스트

CRUD + is_default 해제 + 월별 사용액 조회 + 기본 결제수단 자동 적용 테스트.
"""

from datetime import datetime
from decimal import Decimal

import pytest

from app.models.category import Category
from app.models.expense import Expense
from app.models.payment_method import PaymentMethod

# ── CRUD 테스트 ──


@pytest.mark.asyncio
async def test_create_payment_method(authenticated_client, test_household):
    """결제수단 생성"""
    response = await authenticated_client.post(
        "/api/payment-methods",
        json={
            "name": "삼성카드",
            "type": "credit_card",
            "monthly_target": 300000,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "삼성카드"
    assert data["type"] == "credit_card"
    assert data["monthly_target"] == 300000.0
    assert data["is_default"] is False
    assert data["is_active"] is True
    assert data["household_id"] == test_household.id
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_payment_method_with_default(authenticated_client, test_household):
    """기본 결제수단으로 생성"""
    response = await authenticated_client.post(
        "/api/payment-methods",
        json={
            "name": "현금",
            "type": "cash",
            "is_default": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_default"] is True
    assert data["monthly_target"] is None


@pytest.mark.asyncio
async def test_create_payment_method_invalid_type(authenticated_client, test_household):
    """유효하지 않은 결제수단 타입 → 422"""
    response = await authenticated_client.post(
        "/api/payment-methods",
        json={
            "name": "비트코인",
            "type": "crypto",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_payment_methods(authenticated_client, test_household):
    """결제수단 목록 조회"""
    # 2개 생성
    await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "삼성카드", "type": "credit_card"},
    )
    await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "현금", "type": "cash"},
    )

    response = await authenticated_client.get("/api/payment-methods")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = {item["name"] for item in data}
    assert names == {"삼성카드", "현금"}


@pytest.mark.asyncio
async def test_list_payment_methods_excludes_inactive(authenticated_client, test_household):
    """비활성(삭제된) 결제수단은 목록에서 제외"""
    resp = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "삭제 예정", "type": "cash"},
    )
    pm_id = resp.json()["id"]

    # soft delete
    await authenticated_client.delete(f"/api/payment-methods/{pm_id}")

    response = await authenticated_client.get("/api/payment-methods")
    assert response.status_code == 200
    assert len(response.json()) == 0


@pytest.mark.asyncio
async def test_update_payment_method(authenticated_client, test_household):
    """결제수단 수정"""
    resp = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "삼성카드", "type": "credit_card"},
    )
    pm_id = resp.json()["id"]

    response = await authenticated_client.put(
        f"/api/payment-methods/{pm_id}",
        json={"name": "삼성카드 2호", "monthly_target": 500000},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "삼성카드 2호"
    assert data["monthly_target"] == 500000.0


@pytest.mark.asyncio
async def test_delete_payment_method_soft(authenticated_client, test_household, db_session):
    """결제수단 삭제는 soft delete (is_active=false)"""
    resp = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "삭제 테스트", "type": "cash"},
    )
    pm_id = resp.json()["id"]

    response = await authenticated_client.delete(f"/api/payment-methods/{pm_id}")
    assert response.status_code == 204

    # DB에서 직접 확인 — is_active=False로 변경됨
    from sqlalchemy import select

    result = await db_session.execute(select(PaymentMethod).where(PaymentMethod.id == pm_id))
    pm = result.scalar_one()
    assert pm.is_active is False


# ── is_default 자동 해제 테스트 ──


@pytest.mark.asyncio
async def test_set_default_clears_previous(authenticated_client, test_household):
    """기본 결제수단 설정 시 기존 기본값 자동 해제"""
    # 첫 번째를 기본으로 생성
    resp1 = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "삼성카드", "type": "credit_card", "is_default": True},
    )
    pm1_id = resp1.json()["id"]

    # 두 번째를 기본으로 설정
    resp2 = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "현금", "type": "cash", "is_default": True},
    )
    pm2_id = resp2.json()["id"]

    # 목록 조회하여 확인
    response = await authenticated_client.get("/api/payment-methods")
    data = response.json()
    defaults = {item["id"]: item["is_default"] for item in data}
    assert defaults[pm1_id] is False  # 이전 기본값 해제됨
    assert defaults[pm2_id] is True  # 새 기본값 설정됨


@pytest.mark.asyncio
async def test_update_to_default_clears_previous(authenticated_client, test_household):
    """수정으로 기본 결제수단 변경 시 기존 기본값 해제"""
    # 첫 번째를 기본으로 생성
    resp1 = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "삼성카드", "type": "credit_card", "is_default": True},
    )
    pm1_id = resp1.json()["id"]

    # 두 번째를 기본 아닌 상태로 생성
    resp2 = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "현금", "type": "cash"},
    )
    pm2_id = resp2.json()["id"]

    # 두 번째를 기본으로 업데이트
    await authenticated_client.put(
        f"/api/payment-methods/{pm2_id}",
        json={"is_default": True},
    )

    # 확인
    response = await authenticated_client.get("/api/payment-methods")
    data = response.json()
    defaults = {item["id"]: item["is_default"] for item in data}
    assert defaults[pm1_id] is False
    assert defaults[pm2_id] is True


# ── 월별 사용액 조회 ──


@pytest.mark.asyncio
async def test_monthly_usage_stats(authenticated_client, test_household, test_user, db_session):
    """결제수단별 월 사용액 조회"""
    # 결제수단 생성
    resp = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "삼성카드", "type": "credit_card", "monthly_target": 300000},
    )
    pm_id = resp.json()["id"]

    # 해당 결제수단으로 지출 2건 생성
    cat = Category(name="식비", type="expense", household_id=test_household.id, user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    for amount in [10000, 20000]:
        expense = Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=Decimal(str(amount)),
            description="테스트 지출",
            category_id=cat.id,
            payment_method_id=pm_id,
            date=datetime(2026, 3, 15),
        )
        db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get(
        "/api/payment-methods/stats/monthly",
        params={"month": "2026-03"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == pm_id
    assert data[0]["spent_amount"] == 30000.0
    assert data[0]["monthly_target"] == 300000.0
    assert data[0]["usage_percentage"] == 10.0  # 30000 / 300000 * 100
    assert data[0]["remaining"] == 270000.0


@pytest.mark.asyncio
async def test_monthly_usage_stats_no_target(authenticated_client, test_household, test_user, db_session):
    """월 목표가 없는 결제수단의 usage_percentage와 remaining은 None"""
    resp = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "현금", "type": "cash"},
    )
    pm_id = resp.json()["id"]

    cat = Category(name="식비", type="expense", household_id=test_household.id, user_id=test_user.id)
    db_session.add(cat)
    await db_session.flush()

    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=Decimal("5000"),
        description="테스트",
        category_id=cat.id,
        payment_method_id=pm_id,
        date=datetime(2026, 3, 15),
    )
    db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get(
        "/api/payment-methods/stats/monthly",
        params={"month": "2026-03"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["spent_amount"] == 5000.0
    assert data[0]["usage_percentage"] is None
    assert data[0]["remaining"] is None


# ── 기본 결제수단 자동 적용 (Task 3) ──


@pytest.mark.asyncio
async def test_default_payment_method_auto_applied(authenticated_client, test_household, test_user, db_session):
    """기본 결제수단 설정 시 미지정 지출에 자동 적용"""
    # 기본 결제수단 생성
    resp = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "삼성카드", "type": "credit_card", "is_default": True},
    )
    pm_id = resp.json()["id"]

    # 카테고리 생성
    cat = Category(name="식비", type="expense", household_id=test_household.id, user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 지출 생성 (payment_method_id 미지정)
    expense_resp = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 8000,
            "description": "김치찌개",
            "category_id": cat.id,
            "date": "2026-03-15",
        },
    )
    assert expense_resp.status_code == 201
    assert expense_resp.json()["payment_method_id"] == pm_id


@pytest.mark.asyncio
async def test_explicit_payment_method_overrides_default(authenticated_client, test_household, test_user, db_session):
    """명시적 결제수단 지정 시 기본값 무시"""
    # 기본 결제수단 A
    await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "삼성카드", "type": "credit_card", "is_default": True},
    )

    # 다른 결제수단 B
    resp_b = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "현금", "type": "cash"},
    )
    pm_b_id = resp_b.json()["id"]

    # 카테고리 생성
    cat = Category(name="식비", type="expense", household_id=test_household.id, user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    # 명시적으로 B를 지정하여 지출 생성
    expense_resp = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 8000,
            "description": "김치찌개",
            "category_id": cat.id,
            "date": "2026-03-15",
            "payment_method_id": pm_b_id,
        },
    )
    assert expense_resp.status_code == 201
    assert expense_resp.json()["payment_method_id"] == pm_b_id


@pytest.mark.asyncio
async def test_no_default_payment_method_no_auto_apply(authenticated_client, test_household, test_user, db_session):
    """기본 결제수단이 없으면 payment_method_id는 None"""
    cat = Category(name="식비", type="expense", household_id=test_household.id, user_id=test_user.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    expense_resp = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 8000,
            "description": "김치찌개",
            "category_id": cat.id,
            "date": "2026-03-15",
        },
    )
    assert expense_resp.status_code == 201
    assert expense_resp.json()["payment_method_id"] is None

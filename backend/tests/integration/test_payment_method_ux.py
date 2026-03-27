"""결제수단 UX 개선 통합 테스트

- exclude_auto_payment=true 카테고리 지출 시 기본 결제수단 미적용
- 가구 생성(온보딩) 시 현금+계좌이체 자동 생성
- display_order 기반 정렬
- 순서 변경 API (reorder)
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.payment_method import PaymentMethod
from app.models.user import User

# ── exclude_auto_payment 테스트 ──


@pytest.mark.asyncio
async def test_exclude_auto_payment_skips_default_pm(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household,
    db_session: AsyncSession,
):
    """exclude_auto_payment=true 카테고리의 지출 생성 시 기본 결제수단이 적용되지 않는다"""
    # 카테고리 생성: exclude_auto_payment=true
    cat = Category(
        name="저축/투자",
        type="expense",
        household_id=test_household.id,
        exclude_auto_payment=True,
    )
    db_session.add(cat)
    await db_session.flush()

    # 기본 결제수단 생성
    pm = PaymentMethod(
        household_id=test_household.id,
        created_by=test_user.id,
        name="삼성카드",
        type="credit_card",
        is_default=True,
    )
    db_session.add(pm)
    await db_session.commit()

    # 지출 생성 (payment_method_id 미지정 + exclude_auto_payment 카테고리)
    response = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 500000,
            "description": "적금 이체",
            "category_id": cat.id,
            "date": "2026-03-27T10:00:00",
        },
    )
    assert response.status_code == 201
    data = response.json()
    # 기본 결제수단이 자동 적용되지 않아야 함
    assert data.get("payment_method_id") is None


@pytest.mark.asyncio
async def test_normal_category_gets_default_pm(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household,
    db_session: AsyncSession,
):
    """exclude_auto_payment=false 카테고리의 지출 생성 시 기본 결제수단이 적용된다"""
    # 일반 카테고리 생성
    cat = Category(
        name="식비",
        type="expense",
        household_id=test_household.id,
        exclude_auto_payment=False,
    )
    db_session.add(cat)
    await db_session.flush()

    # 기본 결제수단 생성
    pm = PaymentMethod(
        household_id=test_household.id,
        created_by=test_user.id,
        name="삼성카드",
        type="credit_card",
        is_default=True,
    )
    db_session.add(pm)
    await db_session.commit()

    response = await authenticated_client.post(
        "/api/expenses",
        json={
            "amount": 8000,
            "description": "김치찌개",
            "category_id": cat.id,
            "date": "2026-03-27T12:00:00",
        },
    )
    assert response.status_code == 201
    data = response.json()
    # 기본 결제수단이 자동 적용되어야 함
    assert data["payment_method_id"] == pm.id


@pytest.mark.asyncio
async def test_chat_exclude_auto_payment_skips_default_pm(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household,
    db_session: AsyncSession,
    mock_llm_parse_expense,
):
    """chat API에서도 exclude_auto_payment=true 카테고리는 기본 결제수단이 적용되지 않는다"""
    # exclude_auto_payment 카테고리
    cat = Category(
        name="저축/투자",
        type="expense",
        household_id=test_household.id,
        exclude_auto_payment=True,
    )
    db_session.add(cat)
    await db_session.flush()

    # 기본 결제수단
    pm = PaymentMethod(
        household_id=test_household.id,
        created_by=test_user.id,
        name="삼성카드",
        type="credit_card",
        is_default=True,
    )
    db_session.add(pm)
    await db_session.commit()

    # LLM이 저축/투자 카테고리로 파싱한 경우
    mock_llm_parse_expense.return_value = {
        "amount": 500000,
        "category": "저축/투자",
        "description": "적금 이체",
        "date": "2026-03-27",
        "memo": "",
    }

    response = await authenticated_client.post(
        "/api/chat",
        json={"message": "적금 50만원 이체", "preview": False},
    )
    assert response.status_code == 201
    data = response.json()
    # 저장된 지출의 payment_method_id가 None이어야 함
    assert data["expenses_created"] is not None
    assert data["expenses_created"][0].get("payment_method_id") is None


# ── 온보딩 시 기본 결제수단 자동 생성 테스트 ──


@pytest_asyncio.fixture
async def fresh_user(db_session: AsyncSession):
    """가구 미소속 사용자 — 온보딩 테스트용"""
    from tests.conftest import TEST_AUTH_USER_ID_1

    user = User(
        auth_user_id=TEST_AUTH_USER_ID_1,
        username="freshuser",
        email="fresh@example.com",
        hashed_password=None,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_onboarding_creates_default_payment_methods(
    client: AsyncClient,
    fresh_user: User,
    db_session: AsyncSession,
):
    """온보딩으로 가구 생성 시 현금+계좌이체 결제수단이 자동 생성된다"""
    from tests.conftest import create_test_token

    token = create_test_token(
        auth_user_id=fresh_user.auth_user_id,
        email=fresh_user.email,
        name=fresh_user.username,
    )

    response = await client.post(
        "/api/onboarding/create-household",
        json={"name": "테스트 가계부"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    household_id = response.json()["id"]

    # 결제수단 목록 조회
    pm_response = await client.get(
        f"/api/payment-methods?household_id={household_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert pm_response.status_code == 200
    pms = pm_response.json()

    # 현금 + 계좌이체 2개 자동 생성
    assert len(pms) == 2
    names = {pm["name"] for pm in pms}
    assert names == {"현금", "계좌이체"}

    # type 확인
    types = {pm["name"]: pm["type"] for pm in pms}
    assert types["현금"] == "cash"
    assert types["계좌이체"] == "transfer"

    # is_default는 둘 다 False
    assert all(pm["is_default"] is False for pm in pms)

    # display_order 확인 (현금=0, 계좌이체=1)
    orders = {pm["name"]: pm["display_order"] for pm in pms}
    assert orders["현금"] == 0
    assert orders["계좌이체"] == 1


# ── display_order 정렬 테스트 ──


@pytest.mark.asyncio
async def test_list_payment_methods_sorted_by_display_order(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household,
    db_session: AsyncSession,
):
    """결제수단 목록이 display_order → created_at 순서로 정렬된다"""
    # display_order 역순으로 생성
    pm1 = PaymentMethod(
        household_id=test_household.id,
        created_by=test_user.id,
        name="카드C",
        type="credit_card",
        display_order=2,
    )
    pm2 = PaymentMethod(
        household_id=test_household.id,
        created_by=test_user.id,
        name="카드A",
        type="credit_card",
        display_order=0,
    )
    pm3 = PaymentMethod(
        household_id=test_household.id,
        created_by=test_user.id,
        name="카드B",
        type="debit_card",
        display_order=1,
    )
    db_session.add_all([pm1, pm2, pm3])
    await db_session.commit()

    response = await authenticated_client.get("/api/payment-methods")
    assert response.status_code == 200
    data = response.json()
    names = [pm["name"] for pm in data]
    # display_order 오름차순: A(0) → B(1) → C(2)
    assert names == ["카드A", "카드B", "카드C"]


# ── 순서 변경 API 테스트 ──


@pytest.mark.asyncio
async def test_reorder_payment_methods(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household,
    db_session: AsyncSession,
):
    """POST /api/payment-methods/reorder로 순서 변경이 반영된다"""
    pm1 = PaymentMethod(
        household_id=test_household.id,
        created_by=test_user.id,
        name="현금",
        type="cash",
        display_order=0,
    )
    pm2 = PaymentMethod(
        household_id=test_household.id,
        created_by=test_user.id,
        name="카드",
        type="credit_card",
        display_order=1,
    )
    pm3 = PaymentMethod(
        household_id=test_household.id,
        created_by=test_user.id,
        name="계좌이체",
        type="transfer",
        display_order=2,
    )
    db_session.add_all([pm1, pm2, pm3])
    await db_session.commit()

    # 순서 변경: 카드 → 현금 → 계좌이체
    response = await authenticated_client.post(
        "/api/payment-methods/reorder",
        json={"payment_method_ids": [pm2.id, pm1.id, pm3.id]},
    )
    assert response.status_code == 200

    # 목록 재조회로 순서 확인
    list_response = await authenticated_client.get("/api/payment-methods")
    assert list_response.status_code == 200
    names = [pm["name"] for pm in list_response.json()]
    assert names == ["카드", "현금", "계좌이체"]


@pytest.mark.asyncio
async def test_reorder_with_invalid_ids(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household,
    db_session: AsyncSession,
):
    """존재하지 않는 결제수단 ID로 reorder 시 400 에러"""
    response = await authenticated_client.post(
        "/api/payment-methods/reorder",
        json={"payment_method_ids": [9999, 8888]},
    )
    assert response.status_code == 400


# ── display_order 응답 필드 테스트 ──


@pytest.mark.asyncio
async def test_create_payment_method_with_display_order(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household,
):
    """결제수단 생성 시 display_order가 응답에 포함된다"""
    response = await authenticated_client.post(
        "/api/payment-methods",
        json={"name": "테스트카드", "type": "credit_card", "display_order": 5},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["display_order"] == 5


# ── exclude_auto_payment 카테고리 응답 필드 테스트 ──


@pytest.mark.asyncio
async def test_category_response_includes_exclude_auto_payment(
    authenticated_client: AsyncClient,
    test_user: User,
    test_household,
):
    """카테고리 생성 시 exclude_auto_payment 필드가 응답에 포함된다"""
    response = await authenticated_client.post(
        "/api/categories",
        json={
            "name": "보험료",
            "type": "expense",
            "exclude_auto_payment": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["exclude_auto_payment"] is True

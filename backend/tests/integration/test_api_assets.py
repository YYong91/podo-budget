"""자산 API 통합 테스트

- POST /api/assets — 자산 생성
- GET /api/assets — 자산 목록 (시세 포함)
- GET /api/assets/summary — 순자산 요약
- GET /api/assets/{id} — 자산 상세
- PUT /api/assets/{id} — 자산 수정
- DELETE /api/assets/{id} — 자산 삭제
- GET /api/assets/goal — 목표 조회 (없을 때 null)
"""

import pytest

from app.models.asset import Asset
from app.models.household import Household
from app.models.user import User

# ──────────────────────────────────────────────
# POST /api/assets — 자산 생성
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_asset_deposit(authenticated_client, test_user: User, test_household: Household, db_session):
    """예금 자산 생성 성공"""
    payload = {
        "name": "카카오뱅크 통장",
        "type": "deposit",
        "is_liability": False,
        "manual_value": 5000000.0,
        "household_id": test_household.id,
    }
    response = await authenticated_client.post("/api/assets", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "카카오뱅크 통장"
    assert data["type"] == "deposit"
    assert data["manual_value"] == 5000000.0
    assert data["is_liability"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_create_asset_loan(authenticated_client, test_user: User, test_household: Household, db_session):
    """대출(부채) 자산 생성"""
    payload = {
        "name": "전세 대출",
        "type": "loan",
        "is_liability": True,
        "manual_value": 100000000.0,
        "household_id": test_household.id,
    }
    response = await authenticated_client.post("/api/assets", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["is_liability"] is True
    assert data["type"] == "loan"


@pytest.mark.asyncio
async def test_create_asset_invalid_type(authenticated_client, test_household: Household):
    """유효하지 않은 type → 422"""
    payload = {
        "name": "잘못된 자산",
        "type": "invalid_type",
        "household_id": test_household.id,
    }
    response = await authenticated_client.post("/api/assets", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_asset_unauthenticated(client):
    """미인증 요청 → 401"""
    payload = {"name": "통장", "type": "deposit"}
    response = await client.post("/api/assets", json=payload)
    assert response.status_code == 401


# ──────────────────────────────────────────────
# GET /api/assets — 자산 목록
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_assets_empty(authenticated_client, test_user: User, db_session):
    """자산 없을 때 빈 목록"""
    response = await authenticated_client.get("/api/assets")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_assets_list(authenticated_client, test_user: User, test_household: Household, db_session):
    """자산 목록 조회"""
    asset1 = Asset(
        household_id=test_household.id,
        created_by=test_user.id,
        name="신한 통장",
        type="deposit",
        is_liability=False,
        manual_value=1000000,
    )
    asset2 = Asset(
        household_id=test_household.id,
        created_by=test_user.id,
        name="주택담보대출",
        type="loan",
        is_liability=True,
        manual_value=50000000,
    )
    db_session.add_all([asset1, asset2])
    await db_session.commit()

    response = await authenticated_client.get("/api/assets")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2


# ──────────────────────────────────────────────
# GET /api/assets/summary — 순자산 요약
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_asset_summary_empty(authenticated_client, test_user: User, db_session):
    """자산 없을 때 순자산 요약 — 모두 0"""
    response = await authenticated_client.get("/api/assets/summary")
    assert response.status_code == 200

    data = response.json()
    assert data["total_assets"] == 0.0
    assert data["total_liabilities"] == 0.0
    assert data["net_worth"] == 0.0


@pytest.mark.asyncio
async def test_get_asset_summary_with_data(authenticated_client, test_user: User, test_household: Household, db_session):
    """자산+부채 존재 시 순자산 계산"""
    asset = Asset(
        household_id=test_household.id,
        created_by=test_user.id,
        name="예금",
        type="deposit",
        is_liability=False,
        manual_value=10000000,
    )
    liability = Asset(
        household_id=test_household.id,
        created_by=test_user.id,
        name="대출",
        type="loan",
        is_liability=True,
        manual_value=3000000,
    )
    db_session.add_all([asset, liability])
    await db_session.commit()

    response = await authenticated_client.get("/api/assets/summary")
    assert response.status_code == 200

    data = response.json()
    assert data["total_assets"] == 10000000.0
    assert data["total_liabilities"] == 3000000.0
    assert data["net_worth"] == 7000000.0


# ──────────────────────────────────────────────
# GET /api/assets/{id} — 자산 상세 & IDOR 방지
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_asset_detail(authenticated_client, test_user: User, test_household: Household, db_session):
    """자산 상세 조회"""
    asset = Asset(
        household_id=test_household.id,
        created_by=test_user.id,
        name="부동산",
        type="real_estate",
        is_liability=False,
        manual_value=300000000,
    )
    db_session.add(asset)
    await db_session.commit()
    await db_session.refresh(asset)

    response = await authenticated_client.get(f"/api/assets/{asset.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "부동산"


@pytest.mark.asyncio
async def test_get_asset_idor(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
    test_household: Household,
    test_household2: Household,
    db_session,
):
    """다른 가구 자산 접근 시 404 (IDOR 방지)"""
    # test_user2의 가구에 자산 생성
    other_asset = Asset(
        household_id=test_household2.id,
        created_by=test_user2.id,
        name="타인 자산",
        type="deposit",
        is_liability=False,
        manual_value=1000000,
    )
    db_session.add(other_asset)
    await db_session.commit()
    await db_session.refresh(other_asset)

    # test_user(authenticated_client)로 test_user2의 자산 접근 시도
    response = await authenticated_client.get(f"/api/assets/{other_asset.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_asset_not_found(authenticated_client):
    """존재하지 않는 자산 → 404"""
    response = await authenticated_client.get("/api/assets/99999")
    assert response.status_code == 404


# ──────────────────────────────────────────────
# PUT /api/assets/{id} — 자산 수정
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_asset(authenticated_client, test_user: User, test_household: Household, db_session):
    """자산 수정 성공"""
    asset = Asset(
        household_id=test_household.id,
        created_by=test_user.id,
        name="구 이름",
        type="deposit",
        is_liability=False,
        manual_value=1000000,
    )
    db_session.add(asset)
    await db_session.commit()
    await db_session.refresh(asset)

    response = await authenticated_client.put(
        f"/api/assets/{asset.id}",
        json={"name": "새 이름", "manual_value": 2000000.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "새 이름"
    assert data["manual_value"] == 2000000.0


# ──────────────────────────────────────────────
# DELETE /api/assets/{id} — 자산 삭제
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_asset(authenticated_client, test_user: User, test_household: Household, db_session):
    """자산 삭제 성공"""
    asset = Asset(
        household_id=test_household.id,
        created_by=test_user.id,
        name="삭제할 자산",
        type="other",
        is_liability=False,
        manual_value=500000,
    )
    db_session.add(asset)
    await db_session.commit()
    await db_session.refresh(asset)

    response = await authenticated_client.delete(f"/api/assets/{asset.id}")
    assert response.status_code == 204

    # 삭제 후 조회 시 404
    response = await authenticated_client.get(f"/api/assets/{asset.id}")
    assert response.status_code == 404


# ──────────────────────────────────────────────
# GET /api/assets/goal — 순자산 목표
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_goal_none(authenticated_client, test_user: User, db_session):
    """목표 미설정 시 null 반환"""
    response = await authenticated_client.get("/api/assets/goal")
    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_upsert_and_get_goal(authenticated_client, test_user: User, test_household: Household, db_session):
    """목표 설정 후 조회"""
    payload = {
        "household_id": test_household.id,
        "target_net_worth": 100000000.0,
        "target_date": "2030-12-31",
    }
    response = await authenticated_client.post("/api/assets/goal", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["target_net_worth"] == 100000000.0


@pytest.mark.asyncio
async def test_delete_goal_not_found(authenticated_client, test_user: User, db_session):
    """목표 없을 때 삭제 시도 → 404"""
    response = await authenticated_client.delete("/api/assets/goal")
    assert response.status_code == 404


# ──────────────────────────────────────────────
# original_amount — 대출 원금 (상환 진척도용)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_loan_with_original_amount(authenticated_client, test_household: Household):
    """대출 등록 시 original_amount 필드가 저장된다"""
    resp = await authenticated_client.post(
        "/api/assets",
        json={
            "name": "주담대",
            "type": "loan",
            "is_liability": True,
            "manual_value": 78000000,
            "original_amount": 200000000,
            "household_id": test_household.id,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["original_amount"] == 200000000


@pytest.mark.asyncio
async def test_create_asset_without_original_amount(authenticated_client, test_household: Household):
    """original_amount 없이도 정상 등록된다"""
    resp = await authenticated_client.post(
        "/api/assets",
        json={
            "name": "신한 적금",
            "type": "deposit",
            "manual_value": 5000000,
            "household_id": test_household.id,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["original_amount"] is None


# ──────────────────────────────────────────────
# GET /api/assets/monthly-savings — 저축성지출 기반 저축액
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_monthly_savings_uses_savings_category(authenticated_client, test_household, db_session):
    """monthly-savings가 저축성지출 카테고리 기반으로 계산된다"""
    from datetime import date

    from app.models.category import Category
    from app.models.expense import Expense

    today = date.today()

    # 저축성 카테고리 생성
    savings_cat = Category(
        name="적금",
        type="expense",
        household_id=test_household.id,
        is_savings=True,
        exclude_auto_payment=False,
    )
    db_session.add(savings_cat)
    await db_session.flush()

    # 일반 카테고리 생성
    normal_cat = Category(
        name="식비",
        type="expense",
        household_id=test_household.id,
        is_savings=False,
        exclude_auto_payment=False,
    )
    db_session.add(normal_cat)
    await db_session.flush()

    # 저축성 지출 50만원
    db_session.add(
        Expense(
            amount=500000,
            description="적금 이체",
            date=today,
            household_id=test_household.id,
            category_id=savings_cat.id,
        )
    )
    # 일반 지출 30만원 (저축에 포함되면 안 됨)
    db_session.add(
        Expense(
            amount=300000,
            description="점심",
            date=today,
            household_id=test_household.id,
            category_id=normal_cat.id,
        )
    )
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/assets/monthly-savings",
        params={"household_id": test_household.id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["savings"] == 500000
    assert "month" in data
    assert "total_income" not in data  # 기존 필드 제거됨
    assert "net_savings" not in data


@pytest.mark.asyncio
async def test_create_insurance_asset(authenticated_client, test_household):
    """보험/연금 자산유형 생성"""
    response = await authenticated_client.post(
        "/api/assets",
        json={
            "name": "국민연금",
            "type": "insurance",
            "manual_value": 15000000,
            "household_id": test_household.id,
        },
    )
    assert response.status_code == 201
    assert response.json()["type"] == "insurance"
    assert response.json()["manual_value"] == 15000000


@pytest.mark.asyncio
async def test_create_vehicle_asset(authenticated_client, test_household):
    """자동차 자산유형 생성"""
    response = await authenticated_client.post(
        "/api/assets",
        json={
            "name": "현대 아이오닉6",
            "type": "vehicle",
            "manual_value": 35000000,
            "household_id": test_household.id,
        },
    )
    assert response.status_code == 201
    assert response.json()["type"] == "vehicle"
    assert response.json()["manual_value"] == 35000000

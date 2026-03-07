"""자산 관리 API 테스트"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_asset_stock_kr(authenticated_client: AsyncClient):
    """한국 주식 자산 등록"""
    resp = await authenticated_client.post(
        "/api/assets",
        json={
            "name": "삼성전자",
            "type": "stock_kr",
            "ticker": "005930",
            "quantity": 10,
            "avg_buy_price": 70000,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "삼성전자"
    assert data["type"] == "stock_kr"
    assert data["ticker"] == "005930"
    assert data["is_liability"] is False


@pytest.mark.asyncio
async def test_create_asset_loan(authenticated_client: AsyncClient):
    """대출 등록"""
    resp = await authenticated_client.post(
        "/api/assets",
        json={
            "name": "주택담보대출",
            "type": "loan",
            "is_liability": True,
            "manual_value": 200000000,
            "interest_rate": 3.8,
            "repayment_type": "equal_principal_interest",
            "monthly_payment": 900000,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_liability"] is True
    assert data["manual_value"] == 200000000


@pytest.mark.asyncio
async def test_get_assets_list(authenticated_client: AsyncClient):
    """자산 목록 조회"""
    # 2개 등록
    await authenticated_client.post(
        "/api/assets",
        json={"name": "삼성전자", "type": "stock_kr", "ticker": "005930", "quantity": 10, "avg_buy_price": 70000},
    )
    await authenticated_client.post(
        "/api/assets",
        json={"name": "적금", "type": "deposit", "manual_value": 5000000},
    )

    resp = await authenticated_client.get("/api/assets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_asset_detail(authenticated_client: AsyncClient):
    """자산 상세 조회"""
    create_resp = await authenticated_client.post("/api/assets", json={"name": "적금", "type": "deposit", "manual_value": 5000000})
    asset_id = create_resp.json()["id"]

    resp = await authenticated_client.get(f"/api/assets/{asset_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "적금"


@pytest.mark.asyncio
async def test_update_asset(authenticated_client: AsyncClient):
    """자산 수정"""
    create_resp = await authenticated_client.post("/api/assets", json={"name": "적금", "type": "deposit", "manual_value": 5000000})
    asset_id = create_resp.json()["id"]

    resp = await authenticated_client.put(f"/api/assets/{asset_id}", json={"manual_value": 6000000})
    assert resp.status_code == 200
    assert resp.json()["manual_value"] == 6000000


@pytest.mark.asyncio
async def test_delete_asset(authenticated_client: AsyncClient):
    """자산 삭제"""
    create_resp = await authenticated_client.post("/api/assets", json={"name": "적금", "type": "deposit", "manual_value": 5000000})
    asset_id = create_resp.json()["id"]

    resp = await authenticated_client.delete(f"/api/assets/{asset_id}")
    assert resp.status_code == 204

    resp = await authenticated_client.get(f"/api/assets/{asset_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_summary(authenticated_client: AsyncClient):
    """순자산 요약"""
    await authenticated_client.post("/api/assets", json={"name": "적금", "type": "deposit", "manual_value": 10000000})
    await authenticated_client.post("/api/assets", json={"name": "대출", "type": "loan", "is_liability": True, "manual_value": 3000000})

    resp = await authenticated_client.get("/api/assets/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_assets"] == 10000000
    assert data["total_liabilities"] == 3000000
    assert data["net_worth"] == 7000000


@pytest.mark.asyncio
async def test_asset_isolation(authenticated_client: AsyncClient, authenticated_client2: AsyncClient):
    """다른 유저의 자산 접근 불가"""
    create_resp = await authenticated_client.post("/api/assets", json={"name": "내 적금", "type": "deposit", "manual_value": 5000000})
    asset_id = create_resp.json()["id"]

    # 다른 유저가 접근 시도
    resp = await authenticated_client2.get(f"/api/assets/{asset_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_invalid_asset_type(authenticated_client: AsyncClient):
    """잘못된 자산 타입"""
    resp = await authenticated_client.post("/api/assets", json={"name": "뭔가", "type": "invalid_type"})
    assert resp.status_code == 422

"""순자산 목표 API 테스트"""

from datetime import date, timedelta

import pytest


@pytest.mark.asyncio
async def test_goal_crud(authenticated_client):
    """목표 CRUD (생성, 조회, 업데이트, 삭제)"""
    # 목표 설정
    resp = await authenticated_client.post(
        "/api/assets/goal",
        json={
            "target_net_worth": 100000000,
            "target_date": (date.today() + timedelta(days=365)).isoformat(),
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["target_net_worth"] == 100000000

    # 목표 조회
    resp = await authenticated_client.get("/api/assets/goal")
    assert resp.status_code == 200

    # 목표 업데이트 (upsert)
    resp = await authenticated_client.post(
        "/api/assets/goal",
        json={
            "target_net_worth": 200000000,
            "target_date": (date.today() + timedelta(days=730)).isoformat(),
        },
    )
    assert resp.status_code == 201
    assert resp.json()["target_net_worth"] == 200000000

    # 목표 삭제
    resp = await authenticated_client.delete("/api/assets/goal")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_goal_delete_not_found(authenticated_client):
    """존재하지 않는 목표 삭제 시 404"""
    resp = await authenticated_client.delete("/api/assets/goal")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_monthly_savings(authenticated_client):
    """월별 저축액 조회 — 저축성지출 카테고리 기반"""
    resp = await authenticated_client.get("/api/assets/monthly-savings")
    assert resp.status_code == 200
    data = resp.json()
    assert "savings" in data
    assert "month" in data

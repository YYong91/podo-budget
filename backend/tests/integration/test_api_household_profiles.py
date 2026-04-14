"""
가구 프로필(HouseholdProfile) API 통합 테스트

- GET /api/household-profiles/{household_id} - 가구 프로필 조회
- PUT /api/household-profiles/{household_id} - 가구 프로필 생성/수정 (upsert)
"""

import pytest
from httpx import AsyncClient

from app.models.household import Household

VALID_PROFILE = {
    "household_type": "dual_income",
    "housing_type": "jeonse",
    "income_types": ["salary"],
    "age_range": "30s",
}


@pytest.mark.asyncio
async def test_get_profile_not_found(authenticated_client: AsyncClient, test_household: Household):
    """프로필이 없을 때 404 반환"""
    response = await authenticated_client.get(f"/api/household-profiles/{test_household.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upsert_creates_profile(authenticated_client: AsyncClient, test_household: Household):
    """프로필이 없을 때 신규 생성"""
    response = await authenticated_client.put(
        f"/api/household-profiles/{test_household.id}",
        json=VALID_PROFILE,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["household_type"] == "dual_income"
    assert data["financial_goal"] is None


@pytest.mark.asyncio
async def test_upsert_updates_existing_profile(authenticated_client: AsyncClient, test_household: Household):
    """기존 프로필이 있을 때 수정"""
    # 먼저 생성
    await authenticated_client.put(
        f"/api/household-profiles/{test_household.id}",
        json=VALID_PROFILE,
    )
    # 수정
    updated = {**VALID_PROFILE, "financial_goal": "home_purchase", "goal_amount": 50000000}
    response = await authenticated_client.put(
        f"/api/household-profiles/{test_household.id}",
        json=updated,
    )
    assert response.status_code == 200
    assert response.json()["financial_goal"] == "home_purchase"


@pytest.mark.asyncio
async def test_get_profile_after_upsert(authenticated_client: AsyncClient, test_household: Household):
    """upsert 후 GET으로 조회 가능"""
    await authenticated_client.put(
        f"/api/household-profiles/{test_household.id}",
        json=VALID_PROFILE,
    )
    response = await authenticated_client.get(f"/api/household-profiles/{test_household.id}")
    assert response.status_code == 200
    assert response.json()["household_type"] == "dual_income"

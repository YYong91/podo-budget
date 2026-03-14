"""종합 재무 인사이트 API 테스트"""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

VALID_REQUEST = {
    "month": "2026-03",
    "income_total": 5000000,
    "expense_total": 3200000,
    "top_expense_categories": [
        {"name": "식비", "amount": 1200000, "percentage": 37.5},
        {"name": "주거", "amount": 800000, "percentage": 25.0},
    ],
    "savings_rate": 36.0,
    "health_score": {
        "savings": 85,
        "spending": 72,
        "debt": 90,
        "overall": 82,
        "grade": "B+",
    },
}

MOCK_LLM_RESPONSE = {
    "findings": [
        {
            "what": "식비가 전체 지출의 37.5%를 차지합니다",
            "so_what": "전국 평균(30%) 대비 높은 수준입니다",
            "now_what": "주 2회 도시락을 준비하면 월 20만원 절약 가능합니다",
        }
    ],
    "asset_analysis": None,
    "action_items": [
        {
            "title": "식비 예산 100만원 설정",
            "description": "이번 달 식비를 100만원 이내로 관리해보세요",
        }
    ],
    "encouragement": "저축률 36%는 매우 우수합니다! 이 습관을 유지하세요.",
}


@pytest.mark.asyncio
async def test_generate_comprehensive_insights(authenticated_client: AsyncClient):
    """종합 인사이트 생성 성공"""
    with patch("app.api.insights.get_llm_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.generate_comprehensive_insights.return_value = MOCK_LLM_RESPONSE
        mock_get_provider.return_value = mock_provider

        response = await authenticated_client.post(
            "/api/insights/generate-comprehensive",
            json=VALID_REQUEST,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["month"] == "2026-03"
    assert len(data["insights"]["findings"]) == 1
    assert data["insights"]["findings"][0]["what"] == "식비가 전체 지출의 37.5%를 차지합니다"
    assert len(data["insights"]["action_items"]) == 1
    assert data["insights"]["encouragement"] != ""


@pytest.mark.asyncio
async def test_generate_comprehensive_invalid_month(authenticated_client: AsyncClient):
    """잘못된 월 형식 → 422"""
    response = await authenticated_client.post(
        "/api/insights/generate-comprehensive",
        json={**VALID_REQUEST, "month": "2026-3"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_generate_comprehensive_minimal_request(authenticated_client: AsyncClient):
    """최소한의 데이터만으로도 동작"""
    with patch("app.api.insights.get_llm_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.generate_comprehensive_insights.return_value = MOCK_LLM_RESPONSE
        mock_get_provider.return_value = mock_provider

        response = await authenticated_client.post(
            "/api/insights/generate-comprehensive",
            json={
                "month": "2026-03",
                "income_total": 0,
                "expense_total": 0,
            },
        )

    assert response.status_code == 200

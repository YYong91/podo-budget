"""헬스체크 엔드포인트 통합 테스트 (#254)

/health/llm, /health/external 엔드포인트 동작 검증.
"""

from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestHealthLLM:
    """GET /health/llm 엔드포인트 테스트"""

    async def test_health_llm_returns_healthy(self, client: AsyncClient):
        """LLM 프로바이더가 정상이면 200 + healthy 상태를 반환한다"""
        response = await client.get("/health/llm")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "provider" in data

    async def test_health_llm_returns_unhealthy_on_failure(self, client: AsyncClient):
        """LLM 프로바이더 초기화 실패 시 503을 반환한다"""
        with patch("app.services.llm_service.get_llm_provider", side_effect=Exception("API key missing")):
            response = await client.get("/health/llm")
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "unhealthy"


@pytest.mark.asyncio
class TestHealthExternal:
    """GET /health/external 엔드포인트 테스트"""

    async def test_health_external_returns_status(self, client: AsyncClient):
        """외부 API 메트릭 요약을 반환한다"""
        response = await client.get("/health/external")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ("healthy", "degraded", "no_data")
        assert "metrics" in data

    async def test_health_external_partial_failure(self, client: AsyncClient):
        """일부 외부 API 실패 시에도 200 + degraded 상태를 반환한다"""
        from app.core.metrics import record_external_api_call, reset_metrics

        reset_metrics()
        # 성공 1건 + 실패 1건 기록
        record_external_api_call(service="naver", success=True, latency_ms=50.0)
        record_external_api_call(service="upbit", success=False, latency_ms=100.0)

        response = await client.get("/health/external")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert "external.naver" in data["metrics"]
        assert "external.upbit" in data["metrics"]

        # 정리
        reset_metrics()

    async def test_health_external_all_healthy(self, client: AsyncClient):
        """모든 외부 API가 성공이면 healthy 상태를 반환한다"""
        from app.core.metrics import record_external_api_call, reset_metrics

        reset_metrics()
        record_external_api_call(service="naver", success=True, latency_ms=50.0)
        record_external_api_call(service="yahoo", success=True, latency_ms=80.0)

        response = await client.get("/health/external")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

        reset_metrics()

    async def test_health_external_no_data(self, client: AsyncClient):
        """메트릭 데이터가 없으면 no_data 상태를 반환한다"""
        from app.core.metrics import reset_metrics

        reset_metrics()

        response = await client.get("/health/external")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "no_data"

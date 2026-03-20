"""커스텀 메트릭 모듈 단위 테스트 (#254)"""

import pytest


class TestMetricsModule:
    """app.core.metrics 모듈 존재 및 기본 기능 테스트"""

    def test_metrics_module_exists(self):
        """metrics 모듈을 import할 수 있다"""
        from app.core.metrics import get_metrics_summary, reset_metrics

        assert callable(get_metrics_summary)
        assert callable(reset_metrics)

    def test_record_llm_call_function_exists(self):
        """record_llm_call 함수가 존재하고 호출 가능하다"""
        from app.core.metrics import record_llm_call

        assert callable(record_llm_call)

    def test_record_external_api_call_function_exists(self):
        """record_external_api_call 함수가 존재하고 호출 가능하다"""
        from app.core.metrics import record_external_api_call

        assert callable(record_external_api_call)

    def test_record_llm_call_success(self):
        """LLM 호출 성공을 기록하면 메트릭에 반영된다"""
        from app.core.metrics import get_metrics_summary, record_llm_call, reset_metrics

        reset_metrics()
        record_llm_call(provider="anthropic", success=True, latency_ms=150.0)

        summary = get_metrics_summary()
        assert "llm.anthropic" in summary
        assert summary["llm.anthropic"]["total"] == 1
        assert summary["llm.anthropic"]["success"] == 1
        assert summary["llm.anthropic"]["failure"] == 0
        assert summary["llm.anthropic"]["avg_latency_ms"] == 150.0

    def test_record_llm_call_failure(self):
        """LLM 호출 실패를 기록하면 메트릭에 반영된다"""
        from app.core.metrics import get_metrics_summary, record_llm_call, reset_metrics

        reset_metrics()
        record_llm_call(provider="openai", success=False, latency_ms=5000.0)

        summary = get_metrics_summary()
        assert summary["llm.openai"]["total"] == 1
        assert summary["llm.openai"]["success"] == 0
        assert summary["llm.openai"]["failure"] == 1

    def test_record_llm_call_success_rate(self):
        """여러 호출 후 성공률이 올바르게 계산된다"""
        from app.core.metrics import get_metrics_summary, record_llm_call, reset_metrics

        reset_metrics()
        record_llm_call(provider="anthropic", success=True, latency_ms=100.0)
        record_llm_call(provider="anthropic", success=True, latency_ms=200.0)
        record_llm_call(provider="anthropic", success=False, latency_ms=300.0)

        summary = get_metrics_summary()
        assert summary["llm.anthropic"]["total"] == 3
        assert summary["llm.anthropic"]["success"] == 2
        assert summary["llm.anthropic"]["success_rate"] == pytest.approx(66.7, abs=0.1)
        assert summary["llm.anthropic"]["avg_latency_ms"] == 200.0

    def test_record_external_api_call_success(self):
        """외부 API 호출을 기록하면 메트릭에 반영된다"""
        from app.core.metrics import get_metrics_summary, record_external_api_call, reset_metrics

        reset_metrics()
        record_external_api_call(service="naver", success=True, latency_ms=50.0)
        record_external_api_call(service="upbit", success=False, latency_ms=10000.0)

        summary = get_metrics_summary()
        assert "external.naver" in summary
        assert summary["external.naver"]["total"] == 1
        assert summary["external.naver"]["success"] == 1
        assert "external.upbit" in summary
        assert summary["external.upbit"]["failure"] == 1

    def test_reset_metrics_clears_all(self):
        """reset_metrics 호출 후 메트릭이 비어있다"""
        from app.core.metrics import get_metrics_summary, record_llm_call, reset_metrics

        record_llm_call(provider="test", success=True, latency_ms=10.0)
        reset_metrics()

        summary = get_metrics_summary()
        assert len(summary) == 0

    def test_empty_metrics_summary(self):
        """초기 상태에서 메트릭 요약이 빈 딕셔너리이다"""
        from app.core.metrics import get_metrics_summary, reset_metrics

        reset_metrics()
        summary = get_metrics_summary()
        assert summary == {}

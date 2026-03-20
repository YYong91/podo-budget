"""커스텀 메트릭 수집 -- Sentry + 인메모리 카운터 (#254)

Sentry DSN이 설정된 경우 sentry_sdk로 메트릭 전송.
미설정이어도 인메모리 카운터로 /health 엔드포인트에서 조회 가능.
"""

import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class MetricCounter:
    total: int = 0
    success: int = 0
    failure: int = 0
    total_latency_ms: float = 0.0

    @property
    def success_rate(self) -> float:
        return (self.success / self.total * 100) if self.total > 0 else 0.0

    @property
    def avg_latency_ms(self) -> float:
        return (self.total_latency_ms / self.total) if self.total > 0 else 0.0


# 인메모리 메트릭 저장소
_metrics: dict[str, MetricCounter] = defaultdict(MetricCounter)


def record_llm_call(provider: str, success: bool, latency_ms: float) -> None:
    """LLM API 호출 기록 — 실패해도 비즈니스 로직에 영향 없음"""
    try:
        key = f"llm.{provider}"
        counter = _metrics[key]
        counter.total += 1
        if success:
            counter.success += 1
        else:
            counter.failure += 1
        counter.total_latency_ms += latency_ms
    except Exception:
        pass

    # Sentry 메트릭 (DSN 설정 시)
    try:
        import sentry_sdk

        sentry_sdk.metrics.incr("llm.call", tags={"provider": provider, "success": str(success)})
        sentry_sdk.metrics.distribution("llm.latency_ms", latency_ms, tags={"provider": provider})
    except Exception:
        pass


def record_external_api_call(service: str, success: bool, latency_ms: float) -> None:
    """외부 API 호출 기록 (네이버, 야후, 업비트, 환율 등) — 실패해도 비즈니스 로직에 영향 없음"""
    try:
        key = f"external.{service}"
        counter = _metrics[key]
        counter.total += 1
        if success:
            counter.success += 1
        else:
            counter.failure += 1
        counter.total_latency_ms += latency_ms
    except Exception:
        pass

    try:
        import sentry_sdk

        sentry_sdk.metrics.incr("external_api.call", tags={"service": service, "success": str(success)})
    except Exception:
        pass


@asynccontextmanager
async def track_llm_call(provider: str):
    """LLM 호출 메트릭 자동 추적 컨텍스트 매니저"""
    t0 = time.monotonic()
    success = False
    try:
        yield
        success = True
    except Exception:
        raise
    finally:
        latency = (time.monotonic() - t0) * 1000
        record_llm_call(provider=provider, success=success, latency_ms=latency)


def get_metrics_summary() -> dict:
    """현재 메트릭 요약 반환"""
    return {
        key: {
            "total": c.total,
            "success": c.success,
            "failure": c.failure,
            "success_rate": round(c.success_rate, 1),
            "avg_latency_ms": round(c.avg_latency_ms, 1),
        }
        for key, c in _metrics.items()
    }


def reset_metrics() -> None:
    """메트릭 초기화 (테스트용)"""
    _metrics.clear()

"""실시간 환율 조회 서비스

frankfurter.app API를 사용하여 외화 → KRW 실시간 환율을 조회합니다.
무료, API 키 불필요, ECB 기준 환율 기반.
"""

import logging
import time
from datetime import datetime, timedelta

import httpx

from app.core.metrics import record_external_api_call

logger = logging.getLogger(__name__)

# 환율 캐시 (API 호출 최소화)
_rate_cache: dict[str, tuple[float | None, datetime]] = {}
CACHE_TTL = timedelta(minutes=30)
NEGATIVE_CACHE_TTL = timedelta(seconds=30)  # 실패 캐시 30초 — 외부 API rate limit 방어 (#159)


async def get_exchange_rate(currency: str) -> float | None:
    """외화 → KRW 환율 조회

    Args:
        currency: 통화 코드 (예: "USD", "EUR", "JPY")

    Returns:
        1 외화 = ? KRW 환율. 실패 시 None.
    """
    currency = currency.upper()
    if currency == "KRW":
        return 1.0

    # 캐시 확인
    now = datetime.now()
    if currency in _rate_cache:
        rate, cached_at = _rate_cache[currency]
        ttl = NEGATIVE_CACHE_TTL if rate is None else CACHE_TTL
        if now - cached_at < ttl:
            if rate is None:
                return None  # 실패 캐시 hit (#159)
            logger.info(f"환율 캐시 사용: 1 {currency} = {rate:,.2f} KRW")
            return rate

    # API 호출
    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"https://api.frankfurter.dev/v1/latest?base={currency}&symbols=KRW")
            resp.raise_for_status()
            data = resp.json()
            rate = data["rates"]["KRW"]
            latency = (time.monotonic() - t0) * 1000

            # 캐시 저장
            _rate_cache[currency] = (rate, now)
            record_external_api_call(service="frankfurter", success=True, latency_ms=latency)
            logger.info(f"환율 조회 성공: 1 {currency} = {rate:,.2f} KRW")
            return rate

    except Exception as e:
        latency = (time.monotonic() - t0) * 1000
        record_external_api_call(service="frankfurter", success=False, latency_ms=latency)
        logger.error(f"환율 조회 실패 ({currency}): {e}")
        _rate_cache[currency] = (None, now)  # 실패 캐시 (NEGATIVE_CACHE_TTL 적용, #159)
        return None


def clear_rate_cache() -> None:
    """테스트용 캐시 초기화"""
    _rate_cache.clear()

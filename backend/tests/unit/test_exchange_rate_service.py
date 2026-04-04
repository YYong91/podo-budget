"""환율 서비스 단위 테스트

get_exchange_rate() 캐시 로직 검증:
- KRW는 항상 1.0 반환 (API 호출 없음)
- 캐시 히트 시 API 호출 스킵
- 캐시 만료 후 재조회
- API 실패 시 None + negative 캐시
- 공유 httpx 클라이언트 사용 확인
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.exchange_rate import (
    CACHE_TTL,
    NEGATIVE_CACHE_TTL,
    _rate_cache,
    clear_rate_cache,
    get_exchange_rate,
)


@pytest.fixture(autouse=True)
def clear_cache_before_each():
    """각 테스트 전 캐시 초기화"""
    clear_rate_cache()
    yield
    clear_rate_cache()


@pytest.mark.asyncio
async def test_krw_returns_1():
    """KRW는 항상 1.0 반환 (API 호출 없음)"""
    result = await get_exchange_rate("KRW")
    assert result == 1.0


@pytest.mark.asyncio
async def test_krw_lowercase():
    """소문자 krw도 1.0 반환"""
    result = await get_exchange_rate("krw")
    assert result == 1.0


@pytest.mark.asyncio
async def test_cache_hit_skips_api():
    """캐시 히트 시 외부 API 호출 없음"""
    # 캐시에 직접 삽입
    _rate_cache["USD"] = (1300.0, datetime.now())

    with patch("app.services.exchange_rate.get_http_client") as mock_get_client:
        result = await get_exchange_rate("USD")
        # API 호출이 없어야 함
        mock_get_client.assert_not_called()

    assert result == 1300.0


@pytest.mark.asyncio
async def test_cache_miss_calls_api():
    """캐시 없을 때 공유 httpx 클라이언트로 API 호출"""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"rates": {"KRW": 1320.5}}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response

    with patch("app.services.exchange_rate.get_http_client", return_value=mock_client):
        result = await get_exchange_rate("USD")

    assert result == 1320.5
    # 캐시에 저장됐는지 확인
    assert "USD" in _rate_cache
    assert _rate_cache["USD"][0] == 1320.5


@pytest.mark.asyncio
async def test_expired_cache_recalls_api():
    """만료된 캐시는 API 재호출"""
    # 만료된 캐시 삽입 (CACHE_TTL + 1초 전)
    expired_time = datetime.now() - CACHE_TTL - timedelta(seconds=1)
    _rate_cache["EUR"] = (1200.0, expired_time)

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"rates": {"KRW": 1250.0}}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response

    with patch("app.services.exchange_rate.get_http_client", return_value=mock_client):
        result = await get_exchange_rate("EUR")

    assert result == 1250.0


@pytest.mark.asyncio
async def test_api_failure_returns_none_and_caches_negative():
    """API 실패 → None 반환 + negative 캐시 저장"""
    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("네트워크 오류")

    with patch("app.services.exchange_rate.get_http_client", return_value=mock_client):
        result = await get_exchange_rate("JPY")

    assert result is None
    # negative 캐시에 None이 저장됨
    assert "JPY" in _rate_cache
    assert _rate_cache["JPY"][0] is None


@pytest.mark.asyncio
async def test_negative_cache_hit_returns_none():
    """negative 캐시 히트 시 API 재호출 없이 None 반환"""
    # 최근에 실패한 캐시
    _rate_cache["CNY"] = (None, datetime.now())

    with patch("app.services.exchange_rate.get_http_client") as mock_get_client:
        result = await get_exchange_rate("CNY")
        mock_get_client.assert_not_called()

    assert result is None


@pytest.mark.asyncio
async def test_expired_negative_cache_recalls_api():
    """만료된 negative 캐시 → API 재호출"""
    # 만료된 negative 캐시 (NEGATIVE_CACHE_TTL + 1초 전)
    expired_time = datetime.now() - NEGATIVE_CACHE_TTL - timedelta(seconds=1)
    _rate_cache["GBP"] = (None, expired_time)

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"rates": {"KRW": 1700.0}}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response

    with patch("app.services.exchange_rate.get_http_client", return_value=mock_client):
        result = await get_exchange_rate("GBP")

    assert result == 1700.0


def test_clear_rate_cache():
    """캐시 초기화 확인"""
    _rate_cache["USD"] = (1300.0, datetime.now())
    _rate_cache["EUR"] = (1250.0, datetime.now())
    assert len(_rate_cache) == 2

    clear_rate_cache()
    assert len(_rate_cache) == 0


@pytest.mark.asyncio
async def test_uses_shared_http_client():
    """exchange_rate가 price_service의 공유 httpx 클라이언트를 사용하는지 확인"""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"rates": {"KRW": 1400.0}}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_response

    with patch("app.services.exchange_rate.get_http_client", return_value=mock_client) as mock_get:
        await get_exchange_rate("USD")
        # _get_http_client이 호출됐는지 확인 (공유 클라이언트 사용 증명)
        mock_get.assert_called_once()

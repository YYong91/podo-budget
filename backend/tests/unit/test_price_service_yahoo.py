"""한국 주식 가격 Yahoo Finance 통일 테스트 (#77)

한국 주식 가격 조회가 Yahoo Finance를 사용하는지,
코스피는 .KS, 코스닥은 .KQ 서픽스를 사용하는지 검증.
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def clear_price_cache():
    """각 테스트 전후로 price_cache + singleflight 락 초기화"""
    from app.services import price_service

    price_service._price_cache.clear()
    price_service._price_locks.clear()
    yield
    price_service._price_cache.clear()
    price_service._price_locks.clear()


def _mock_yahoo_response(price: float = 80000.0) -> MagicMock:
    """Yahoo Finance 응답 mock 생성"""
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"chart": {"result": [{"meta": {"regularMarketPrice": price}}]}}
    return resp


def _mock_httpx_client(response: MagicMock | None = None, exception: Exception | None = None) -> AsyncMock:
    """httpx.AsyncClient mock 생성"""
    client = AsyncMock()
    if exception:
        client.get.side_effect = exception
    else:
        client.get.return_value = response
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    return client


# ── _get_yahoo_price ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_yahoo_price_success():
    """Yahoo Finance API로 시세 조회 성공"""
    from app.services.price_service import _get_yahoo_price

    mock_client = _mock_httpx_client(_mock_yahoo_response(80000.0))
    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await _get_yahoo_price("005930.KS")
        assert result == 80000.0
        # Yahoo API가 올바른 ticker로 호출되었는지
        mock_client.get.assert_called_once()
        call_args = mock_client.get.call_args
        assert "005930.KS" in call_args[0][0] or "005930.KS" in str(call_args)


@pytest.mark.asyncio
async def test_get_yahoo_price_failure():
    """Yahoo Finance API 실패 시 None 반환"""
    from app.services.price_service import _get_yahoo_price

    mock_client = _mock_httpx_client(exception=Exception("timeout"))
    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await _get_yahoo_price("005930.KS")
        assert result is None


@pytest.mark.asyncio
async def test_get_yahoo_price_bad_status():
    """Yahoo Finance API 비정상 상태 코드 → None"""
    from app.services.price_service import _get_yahoo_price

    resp = MagicMock()
    resp.status_code = 404
    mock_client = _mock_httpx_client(resp)
    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await _get_yahoo_price("INVALID.KS")
        assert result is None


# ── get_stock_kr_price (Yahoo 통일) ──────────────────────────


@pytest.mark.asyncio
async def test_kr_stock_kospi_uses_ks_suffix():
    """코스피 종목은 .KS 서픽스로 Yahoo API 호출"""
    from app.services import price_service

    # DB에서 KOSPI 종목 조회 mock
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_stock = MagicMock()
    mock_stock.market = "KOSPI"
    mock_result.scalar_one_or_none.return_value = mock_stock
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch.object(price_service, "_get_yahoo_price", new=AsyncMock(return_value=80000.0)) as mock_yahoo:
        result = await price_service.get_stock_kr_price("005930", mock_db)
        assert result == 80000.0
        mock_yahoo.assert_called_once_with("005930.KS")


@pytest.mark.asyncio
async def test_kr_stock_kosdaq_uses_kq_suffix():
    """코스닥 종목은 .KQ 서픽스로 Yahoo API 호출"""
    from app.services import price_service

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_stock = MagicMock()
    mock_stock.market = "KOSDAQ"
    mock_result.scalar_one_or_none.return_value = mock_stock
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch.object(price_service, "_get_yahoo_price", new=AsyncMock(return_value=50000.0)) as mock_yahoo:
        result = await price_service.get_stock_kr_price("247540", mock_db)
        assert result == 50000.0
        mock_yahoo.assert_called_once_with("247540.KQ")


@pytest.mark.asyncio
async def test_kr_stock_not_in_db_fallback_ks_then_kq():
    """DB에 미등록 종목은 .KS 시도 → 실패 시 .KQ fallback"""
    from app.services import price_service

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None  # DB에 없음
    mock_db.execute = AsyncMock(return_value=mock_result)

    # .KS 실패, .KQ 성공
    async def yahoo_side_effect(ticker: str) -> float | None:
        if ticker.endswith(".KQ"):
            return 30000.0
        return None

    with patch.object(price_service, "_get_yahoo_price", new=AsyncMock(side_effect=yahoo_side_effect)):
        result = await price_service.get_stock_kr_price("123456", mock_db)
        assert result == 30000.0


@pytest.mark.asyncio
async def test_kr_stock_not_in_db_both_fail():
    """DB 미등록 + .KS/.KQ 모두 실패 → None"""
    from app.services import price_service

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch.object(price_service, "_get_yahoo_price", new=AsyncMock(return_value=None)):
        result = await price_service.get_stock_kr_price("999999", mock_db)
        assert result is None


@pytest.mark.asyncio
async def test_kr_stock_cache_hit():
    """캐시 히트 시 DB/API 호출 없이 반환"""
    from app.services import price_service

    price_service._price_cache["kr:005930"] = (80000.0, time.monotonic())

    mock_db = AsyncMock()
    result = await price_service.get_stock_kr_price("005930", mock_db)
    assert result == 80000.0
    # DB가 호출되지 않았는지
    mock_db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_kr_stock_caches_result():
    """성공 결과가 캐시에 저장되는지"""
    from app.services import price_service

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_stock = MagicMock()
    mock_stock.market = "KOSPI"
    mock_result.scalar_one_or_none.return_value = mock_stock
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch.object(price_service, "_get_yahoo_price", new=AsyncMock(return_value=80000.0)):
        await price_service.get_stock_kr_price("005930", mock_db)

    assert "kr:005930" in price_service._price_cache
    assert price_service._price_cache["kr:005930"][0] == 80000.0

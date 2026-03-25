"""price_service 추가 단위 테스트 (#359)

외부 API 호출 모킹, 응답 파싱/에러 처리, 캐시 로직 심층 검증.
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


# ── 캐시 심층 테스트 ──────────────────────────────────────────


def test_negative_cache_ttl():
    """실패 캐시(None)는 NEGATIVE_CACHE_TTL(30초) 적용 (#159)"""
    from app.services import price_service
    from app.services.price_service import _CACHE_MISS, _get_cached, _set_cached

    _set_cached("test:fail", None)
    # 실패 캐시 히트
    assert _get_cached("test:fail") is None

    # NEGATIVE_CACHE_TTL 초과 → 미스
    price_service._price_cache["test:fail"] = (None, time.monotonic() - price_service.NEGATIVE_CACHE_TTL - 1)
    assert _get_cached("test:fail") is _CACHE_MISS


def test_success_cache_ttl():
    """성공 캐시는 CACHE_TTL(300초) 적용"""
    from app.services import price_service
    from app.services.price_service import _CACHE_MISS, _get_cached, _set_cached

    _set_cached("test:ok", 50000.0)
    assert _get_cached("test:ok") == 50000.0

    # CACHE_TTL 초과 → 미스
    price_service._price_cache["test:ok"] = (50000.0, time.monotonic() - price_service.CACHE_TTL - 1)
    assert _get_cached("test:ok") is _CACHE_MISS


def test_cache_expired_entry_deleted():
    """만료된 캐시 엔트리는 _get_cached 호출 시 삭제됨"""
    from app.services import price_service
    from app.services.price_service import _get_cached

    price_service._price_cache["test:del"] = (1234.0, time.monotonic() - price_service.CACHE_TTL - 1)
    _get_cached("test:del")
    assert "test:del" not in price_service._price_cache


# ── 한투 API 토큰 ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_kis_token_no_credentials():
    """KIS_APPKEY/APPSECRET이 없으면 None 반환"""
    from app.services.price_service import _get_kis_token

    with patch("app.services.price_service.settings") as mock_settings:
        mock_settings.KIS_APPKEY = ""
        mock_settings.KIS_APPSECRET = ""
        # 기존 토큰 캐시 무효화
        import app.services.price_service as ps

        ps._kis_token = None
        ps._kis_token_expires = 0

        result = await _get_kis_token()
        assert result is None


@pytest.mark.asyncio
async def test_get_kis_token_cached():
    """토큰이 캐시되어 있고 유효하면 재발급하지 않음"""
    import app.services.price_service as ps

    ps._kis_token = "cached-token"
    ps._kis_token_expires = time.monotonic() + 10000  # 유효

    result = await ps._get_kis_token()
    assert result == "cached-token"

    # 정리
    ps._kis_token = None
    ps._kis_token_expires = 0


@pytest.mark.asyncio
async def test_get_kis_token_success():
    """한투 API 토큰 발급 성공"""
    import app.services.price_service as ps

    ps._kis_token = None
    ps._kis_token_expires = 0

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"access_token": "new-token"}

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.price_service.settings") as mock_settings:
        mock_settings.KIS_APPKEY = "test-key"
        mock_settings.KIS_APPSECRET = "test-secret"  # pragma: allowlist secret

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await ps._get_kis_token()
            assert result == "new-token"

    # 정리
    ps._kis_token = None
    ps._kis_token_expires = 0


@pytest.mark.asyncio
async def test_get_kis_token_api_failure():
    """한투 API 토큰 발급 실패 → None"""
    import app.services.price_service as ps

    ps._kis_token = None
    ps._kis_token_expires = 0

    mock_client = AsyncMock()
    mock_client.post.side_effect = Exception("network error")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.price_service.settings") as mock_settings:
        mock_settings.KIS_APPKEY = "test-key"
        mock_settings.KIS_APPSECRET = "test-secret"  # pragma: allowlist secret

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await ps._get_kis_token()
            assert result is None


# ── 한국 주식 (KIS + 네이버 fallback) ─────────────────────────


@pytest.mark.asyncio
async def test_get_stock_kr_price_kis_success():
    """한투 API로 한국 주식 시세 조회 성공"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"output": {"stck_prpr": "80000"}}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with (
        patch.object(price_service, "_get_kis_token", new=AsyncMock(return_value="token")),
        patch("httpx.AsyncClient", return_value=mock_client),
        patch("app.services.price_service.settings") as mock_settings,
    ):
        mock_settings.KIS_APPKEY = "key"
        mock_settings.KIS_APPSECRET = "secret"  # pragma: allowlist secret

        result = await price_service._get_stock_kr_price_kis("005930")
        assert result == 80000.0


@pytest.mark.asyncio
async def test_get_stock_kr_price_kis_zero_price():
    """한투 API에서 가격이 0이면 None 반환"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"output": {"stck_prpr": "0"}}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with (
        patch.object(price_service, "_get_kis_token", new=AsyncMock(return_value="token")),
        patch("httpx.AsyncClient", return_value=mock_client),
        patch("app.services.price_service.settings") as mock_settings,
    ):
        mock_settings.KIS_APPKEY = "key"
        mock_settings.KIS_APPSECRET = "secret"  # pragma: allowlist secret

        result = await price_service._get_stock_kr_price_kis("005930")
        assert result is None


@pytest.mark.asyncio
async def test_get_stock_kr_price_kis_no_token():
    """한투 토큰이 없으면 None 반환"""
    from app.services import price_service

    with patch.object(price_service, "_get_kis_token", new=AsyncMock(return_value=None)):
        result = await price_service._get_stock_kr_price_kis("005930")
        assert result is None


@pytest.mark.asyncio
async def test_get_stock_kr_price_kis_exception():
    """한투 API 호출 중 예외 → None"""
    from app.services import price_service

    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("timeout")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with (
        patch.object(price_service, "_get_kis_token", new=AsyncMock(return_value="token")),
        patch("httpx.AsyncClient", return_value=mock_client),
        patch("app.services.price_service.settings") as mock_settings,
    ):
        mock_settings.KIS_APPKEY = "key"
        mock_settings.KIS_APPSECRET = "secret"  # pragma: allowlist secret

        result = await price_service._get_stock_kr_price_kis("005930")
        assert result is None


@pytest.mark.asyncio
async def test_get_stock_kr_price_naver_success():
    """네이버 금융 fallback 시세 조회 성공"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"currentPrice": 75000}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await price_service._get_stock_kr_price_naver("005930")
        assert result == 75000.0


@pytest.mark.asyncio
async def test_get_stock_kr_price_naver_zero_price():
    """네이버 금융에서 가격이 0이면 None"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"currentPrice": 0}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await price_service._get_stock_kr_price_naver("005930")
        assert result is None


@pytest.mark.asyncio
async def test_get_stock_kr_price_naver_exception():
    """네이버 금융 예외 → None"""
    from app.services import price_service

    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("network error")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await price_service._get_stock_kr_price_naver("005930")
        assert result is None


@pytest.mark.asyncio
async def test_get_stock_kr_price_with_cache_hit():
    """캐시에 시세가 있으면 API 호출 없이 반환"""
    from app.services import price_service

    price_service._price_cache["kr:005930"] = (80000.0, time.monotonic())

    result = await price_service.get_stock_kr_price("005930")
    assert result == 80000.0


@pytest.mark.asyncio
async def test_get_stock_kr_price_kis_fallback_to_naver():
    """한투 API 실패 시 네이버 fallback"""
    from app.services import price_service

    with (
        patch.object(price_service, "_get_stock_kr_price_kis", new=AsyncMock(return_value=None)),
        patch.object(price_service, "_get_stock_kr_price_naver", new=AsyncMock(return_value=70000.0)),
    ):
        result = await price_service.get_stock_kr_price("005930")
        assert result == 70000.0


@pytest.mark.asyncio
async def test_get_stock_kr_price_both_fail():
    """한투+네이버 모두 실패 → None (실패 캐시 저장)"""
    from app.services import price_service

    with (
        patch.object(price_service, "_get_stock_kr_price_kis", new=AsyncMock(return_value=None)),
        patch.object(price_service, "_get_stock_kr_price_naver", new=AsyncMock(return_value=None)),
    ):
        result = await price_service.get_stock_kr_price("005930")
        assert result is None
        # 실패 캐시 확인
        assert "kr:005930" in price_service._price_cache
        assert price_service._price_cache["kr:005930"][0] is None


# ── 미국 주식 (Yahoo Finance) ─────────────────────────────────


@pytest.mark.asyncio
async def test_get_stock_us_price_success():
    """Yahoo Finance 미국 주식 시세 조회 성공"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"chart": {"result": [{"meta": {"regularMarketPrice": 180.5}}]}}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with (
        patch("httpx.AsyncClient", return_value=mock_client),
        patch.object(price_service, "get_exchange_rate", new=AsyncMock(return_value=1350.0)),
    ):
        usd, krw = await price_service.get_stock_us_price("AAPL")
        assert usd == 180.5
        assert krw == 180.5 * 1350.0


@pytest.mark.asyncio
async def test_get_stock_us_price_no_exchange_rate():
    """환율 조회 실패 시 KRW는 None"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"chart": {"result": [{"meta": {"regularMarketPrice": 180.5}}]}}

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with (
        patch("httpx.AsyncClient", return_value=mock_client),
        patch.object(price_service, "get_exchange_rate", new=AsyncMock(return_value=None)),
    ):
        usd, krw = await price_service.get_stock_us_price("AAPL")
        assert usd == 180.5
        assert krw is None


@pytest.mark.asyncio
async def test_get_stock_us_price_api_failure():
    """Yahoo Finance API 실패 → (None, None)"""
    from app.services import price_service

    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("timeout")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with (
        patch("httpx.AsyncClient", return_value=mock_client),
        patch.object(price_service, "get_exchange_rate", new=AsyncMock(return_value=1350.0)),
    ):
        usd, krw = await price_service.get_stock_us_price("AAPL")
        assert usd is None
        assert krw is None


@pytest.mark.asyncio
async def test_get_stock_us_price_cache_hit():
    """미국 주식 캐시 히트"""
    from app.services import price_service

    price_service._price_cache["us:AAPL"] = (180.0, time.monotonic())

    with patch.object(price_service, "get_exchange_rate", new=AsyncMock(return_value=1350.0)):
        usd, krw = await price_service.get_stock_us_price("AAPL")
        assert usd == 180.0
        assert krw == 180.0 * 1350.0


@pytest.mark.asyncio
async def test_get_stock_us_price_negative_cache_hit():
    """미국 주식 실패 캐시 히트 → (None, None)"""
    from app.services import price_service

    price_service._price_cache["us:AAPL"] = (None, time.monotonic())

    with patch.object(price_service, "get_exchange_rate", new=AsyncMock(return_value=1350.0)):
        usd, krw = await price_service.get_stock_us_price("AAPL")
        assert usd is None
        assert krw is None


# ── 코인 (업비트) ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_crypto_price_success():
    """업비트 코인 시세 조회 성공"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [{"trade_price": 95000000.0}]

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await price_service.get_crypto_price("BTC")
        assert result == 95000000.0


@pytest.mark.asyncio
async def test_get_crypto_price_empty_response():
    """업비트 응답이 빈 리스트면 None"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = []

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await price_service.get_crypto_price("UNKNOWN")
        assert result is None


@pytest.mark.asyncio
async def test_get_crypto_price_exception():
    """업비트 API 예외 → None"""
    from app.services import price_service

    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("network")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        result = await price_service.get_crypto_price("BTC")
        assert result is None


@pytest.mark.asyncio
async def test_get_crypto_price_cache_hit():
    """코인 캐시 히트"""
    from app.services import price_service

    price_service._price_cache["crypto:ETH"] = (4000000.0, time.monotonic())

    result = await price_service.get_crypto_price("ETH")
    assert result == 4000000.0


# ── get_asset_current_value 추가 분기 ─────────────────────────


@pytest.mark.asyncio
async def test_get_asset_current_value_stock_kr_no_ticker():
    """ticker가 없는 한국 주식 자산은 None"""
    from app.services.price_service import get_asset_current_value

    asset = MagicMock()
    asset.type = "stock_kr"
    asset.ticker = None
    asset.quantity = 10

    result = await get_asset_current_value(asset)
    assert result["current_price"] is None
    assert result["current_value"] is None


@pytest.mark.asyncio
async def test_get_asset_current_value_stock_kr_no_quantity():
    """quantity가 없는 한국 주식 자산은 None"""
    from app.services.price_service import get_asset_current_value

    asset = MagicMock()
    asset.type = "stock_kr"
    asset.ticker = "005930"
    asset.quantity = None

    result = await get_asset_current_value(asset)
    assert result["current_price"] is None
    assert result["current_value"] is None


@pytest.mark.asyncio
async def test_get_asset_current_value_unknown_type():
    """알 수 없는 자산 유형은 모두 None"""
    from app.services.price_service import get_asset_current_value

    asset = MagicMock()
    asset.type = "unknown_type"
    asset.ticker = "X"
    asset.quantity = 1

    result = await get_asset_current_value(asset)
    assert result["current_price"] is None
    assert result["current_value"] is None


# ── _calc_profit ──────────────────────────────────────────────


def test_calc_profit_normal():
    """수익 계산 정상 케이스"""
    from app.services.price_service import _calc_profit

    pl, pct = _calc_profit(current_value=1200000.0, quantity=10, avg_buy_price=100000.0)
    assert pl == 200000.0
    assert abs(pct - 20.0) < 0.01


def test_calc_profit_no_avg_buy_price():
    """avg_buy_price 없으면 (None, None)"""
    from app.services.price_service import _calc_profit

    pl, pct = _calc_profit(current_value=1000000.0, quantity=10, avg_buy_price=None)
    assert pl is None
    assert pct is None


def test_calc_profit_zero_avg_buy_price():
    """avg_buy_price가 0이면 (None, None) — falsy"""
    from app.services.price_service import _calc_profit

    pl, pct = _calc_profit(current_value=1000000.0, quantity=10, avg_buy_price=0.0)
    assert pl is None
    assert pct is None


def test_calc_profit_loss():
    """손실 케이스"""
    from app.services.price_service import _calc_profit

    pl, pct = _calc_profit(current_value=800000.0, quantity=10, avg_buy_price=100000.0)
    assert pl == -200000.0
    assert abs(pct - (-20.0)) < 0.01


# ── 종목 검색 ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_stock_kr_naver_success():
    """네이버 종목 검색 성공"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "result": {
            "d": [
                {"cd": "005930", "nm": "삼성전자"},
                {"cd": "000660", "nm": "SK하이닉스"},
            ]
        }
    }

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        results = await price_service._search_stock_kr_naver("삼성")
        assert len(results) == 2
        assert results[0]["ticker"] == "005930"
        assert results[0]["market"] == "KR"


@pytest.mark.asyncio
async def test_search_stock_kr_naver_exception():
    """네이버 종목 검색 예외 → 빈 리스트"""
    from app.services import price_service

    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("error")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        results = await price_service._search_stock_kr_naver("삼성")
        assert results == []


@pytest.mark.asyncio
async def test_search_stock_kr_yahoo_filters_kr():
    """Yahoo 종목 검색은 .KS/.KQ만 필터"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "quotes": [
            {"symbol": "005930.KS", "shortname": "Samsung"},
            {"symbol": "AAPL", "shortname": "Apple"},  # 미국 — 제외
        ]
    }

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        results = await price_service._search_stock_kr_yahoo("삼성")
        assert len(results) == 1
        assert results[0]["ticker"] == "005930"


@pytest.mark.asyncio
async def test_search_stock_us_success():
    """미국 종목 검색 성공"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "quotes": [
            {"symbol": "AAPL", "shortname": "Apple Inc.", "quoteType": "EQUITY"},
            {"symbol": "BTC-USD", "shortname": "Bitcoin", "quoteType": "CRYPTOCURRENCY"},  # 제외
        ]
    }

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        results = await price_service.search_stock_us("apple")
        assert len(results) == 1
        assert results[0]["ticker"] == "AAPL"
        assert results[0]["market"] == "US"


@pytest.mark.asyncio
async def test_search_crypto_success():
    """코인 검색 성공"""
    from app.services import price_service

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [
        {"market": "KRW-BTC", "korean_name": "비트코인"},
        {"market": "KRW-ETH", "korean_name": "이더리움"},
        {"market": "BTC-XRP", "korean_name": "리플"},  # KRW 아님 → 제외
    ]

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        results = await price_service.search_crypto("비트")
        assert len(results) == 1
        assert results[0]["ticker"] == "BTC"
        assert results[0]["market"] == "CRYPTO"


# ── singleflight 락 ──────────────────────────────────────────


def test_lock_for_creates_per_key():
    """_lock_for는 키별 독립 락 생성"""
    from app.services.price_service import _lock_for

    lock1 = _lock_for("a")
    lock2 = _lock_for("b")
    lock1_again = _lock_for("a")

    assert lock1 is lock1_again
    assert lock1 is not lock2

"""자산 시세 조회 서비스

한국 주식/ETF: 한국투자증권 Open API (1차), 네이버 금융 (fallback)
미국 주식/ETF: Yahoo Finance
코인: 업비트 공개 API
환율: exchange_rate 서비스 위임 (USD/KRW 전용, #195)
"""

import asyncio
import logging
import time

import httpx

from app.core.config import settings
from app.core.metrics import record_external_api_call
from app.services.exchange_rate import get_exchange_rate

logger = logging.getLogger(__name__)

# 시세 캐시
_CACHE_MISS = object()  # "캐시 미스" sentinel — None(실패 캐시)과 구분 (#159)
_price_cache: dict[str, tuple[float | None, float]] = {}  # key → (price_or_none, timestamp)
CACHE_TTL = 300  # 성공 캐시 5분
NEGATIVE_CACHE_TTL = 30  # 실패 캐시 30초 — 외부 API rate limit 방어 (#159)

# singleflight 락 — 동시 요청이 같은 ticker 외부 API를 중복 호출하는 것을 방지 (#166)
_price_locks: dict[str, asyncio.Lock] = {}


def _lock_for(key: str) -> asyncio.Lock:
    """키별 락 반환 (없으면 생성) — asyncio 단일 스레드이므로 race-free"""
    if key not in _price_locks:
        _price_locks[key] = asyncio.Lock()
    return _price_locks[key]


# 한투 API 토큰 캐시
_kis_token: str | None = None
_kis_token_expires: float = 0  # unix timestamp
KIS_BASE_URL = "https://openapi.koreainvestment.com:9443"


# ── 한투 API 인증 ──────────────────────────────────────────────


async def _get_kis_token() -> str | None:
    """한투 API OAuth 토큰 발급/캐싱 (24시간 유효, 1시간 전 갱신)"""
    global _kis_token, _kis_token_expires

    if _kis_token and time.monotonic() < _kis_token_expires - 3600:
        return _kis_token

    if not settings.KIS_APPKEY or not settings.KIS_APPSECRET:
        return None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{KIS_BASE_URL}/oauth2/tokenP",
                json={
                    "grant_type": "client_credentials",
                    "appkey": settings.KIS_APPKEY,
                    "appsecret": settings.KIS_APPSECRET,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                _kis_token = data["access_token"]
                # token_token_expired: "YYYY-MM-DD HH:MM:SS" 형식이지만
                # 안전하게 현재 + 23시간으로 설정
                _kis_token_expires = time.monotonic() + 23 * 3600
                logger.info("한투 API 토큰 발급 성공")
                return _kis_token
    except Exception:
        logger.warning("한투 API 토큰 발급 실패")
    return None


# ── 한국 주식 시세 ─────────────────────────────────────────────


async def get_stock_kr_price(ticker: str) -> float | None:
    """한국 주식/ETF 현재가 조회 (한투 API 우선, 네이버 fallback)"""
    key = f"kr:{ticker}"
    cached = _get_cached(key)
    if cached is not _CACHE_MISS:
        return cached  # type: ignore[return-value]  # None(실패 캐시) 또는 float

    async with _lock_for(key):
        # 락 획득 후 재확인 — 대기 중에 다른 코루틴이 이미 채웠을 수 있음
        cached = _get_cached(key)
        if cached is not _CACHE_MISS:
            return cached  # type: ignore[return-value]

        # 1차: 한투 API
        price = await _get_stock_kr_price_kis(ticker)
        if not price:
            # 2차: 네이버 금융 fallback
            price = await _get_stock_kr_price_naver(ticker)
        # 성공·실패 모두 캐시 (실패 시 None → NEGATIVE_CACHE_TTL 30초 적용, #159)
        _set_cached(key, price)
        return price


async def _get_stock_kr_price_kis(ticker: str) -> float | None:
    """한투 API 한국 주식 현재가 조회"""

    token = await _get_kis_token()
    if not token:
        return None

    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price",
                headers={
                    "content-type": "application/json; charset=utf-8",
                    "authorization": f"Bearer {token}",
                    "appkey": settings.KIS_APPKEY,
                    "appsecret": settings.KIS_APPSECRET,
                    "tr_id": "FHKST01010100",
                },
                params={
                    "FID_COND_MRKT_DIV_CODE": "J",
                    "FID_INPUT_ISCD": ticker,
                },
            )
            latency = (time.monotonic() - t0) * 1000
            if resp.status_code == 200:
                data = resp.json()
                output = data.get("output", {})
                price = float(output.get("stck_prpr", 0))
                if price > 0:
                    record_external_api_call(service="kis", success=True, latency_ms=latency)
                    return price
            record_external_api_call(service="kis", success=False, latency_ms=latency)
    except Exception:
        latency = (time.monotonic() - t0) * 1000
        record_external_api_call(service="kis", success=False, latency_ms=latency)
        logger.warning("한투 API 시세 조회 실패: %s", ticker)
    return None


async def _get_stock_kr_price_naver(ticker: str) -> float | None:
    """네이버 금융 한국 주식 현재가 조회 (fallback)"""

    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://m.stock.naver.com/api/stock/{ticker}/basic",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            latency = (time.monotonic() - t0) * 1000
            if resp.status_code == 200:
                data = resp.json()
                price = float(data.get("currentPrice", 0))
                if price > 0:
                    record_external_api_call(service="naver", success=True, latency_ms=latency)
                    return price
            record_external_api_call(service="naver", success=False, latency_ms=latency)
    except Exception:
        latency = (time.monotonic() - t0) * 1000
        record_external_api_call(service="naver", success=False, latency_ms=latency)
    return None


# ── 미국 주식 시세 ─────────────────────────────────────────────


async def get_stock_us_price(ticker: str) -> tuple[float | None, float | None]:
    """미국 주식/ETF 현재가 조회 (USD + KRW 환산, #195: USD/KRW는 exchange_rate 서비스 위임)"""
    key = f"us:{ticker}"
    cached_usd = _get_cached(key)
    usd_krw = await get_exchange_rate("USD")

    if cached_usd is not _CACHE_MISS:
        if cached_usd is None:
            return None, None  # 실패 캐시 hit
        return cached_usd, cached_usd * usd_krw if usd_krw else None

    async with _lock_for(key):
        cached_usd = _get_cached(key)
        if cached_usd is not _CACHE_MISS:
            if cached_usd is None:
                return None, None
            return cached_usd, cached_usd * usd_krw if usd_krw else None

        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",
                    params={"interval": "1d", "range": "1d"},
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                latency = (time.monotonic() - t0) * 1000
                if resp.status_code == 200:
                    data = resp.json()
                    meta = data["chart"]["result"][0]["meta"]
                    price_usd = float(meta["regularMarketPrice"])
                    _set_cached(key, price_usd)
                    record_external_api_call(service="yahoo", success=True, latency_ms=latency)
                    krw_price = price_usd * usd_krw if usd_krw else None
                    return price_usd, krw_price
                record_external_api_call(service="yahoo", success=False, latency_ms=latency)
        except Exception:
            latency = (time.monotonic() - t0) * 1000
            record_external_api_call(service="yahoo", success=False, latency_ms=latency)
        _set_cached(key, None)  # 실패 캐시 (#159)
    return None, None


# ── 코인 시세 ──────────────────────────────────────────────────


async def get_crypto_price(symbol: str) -> float | None:
    """업비트 코인 현재가 조회 (KRW)"""
    key = f"crypto:{symbol}"
    cached = _get_cached(key)
    if cached is not _CACHE_MISS:
        return cached  # type: ignore[return-value]

    async with _lock_for(key):
        cached = _get_cached(key)
        if cached is not _CACHE_MISS:
            return cached  # type: ignore[return-value]

        market = f"KRW-{symbol.upper()}"
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.upbit.com/v1/ticker",
                    params={"markets": market},
                )
                latency = (time.monotonic() - t0) * 1000
                if resp.status_code == 200:
                    data = resp.json()
                    if data and len(data) > 0:
                        price = float(data[0]["trade_price"])
                        _set_cached(key, price)
                        record_external_api_call(service="upbit", success=True, latency_ms=latency)
                        return price
                record_external_api_call(service="upbit", success=False, latency_ms=latency)
        except Exception:
            latency = (time.monotonic() - t0) * 1000
            record_external_api_call(service="upbit", success=False, latency_ms=latency)
        _set_cached(key, None)  # 실패 캐시 (#159)
    return None


# ── 자산 평가액 계산 ───────────────────────────────────────────


def _calc_profit(current_value: float, quantity: float, avg_buy_price: float | None) -> tuple[float | None, float | None]:
    """수익/손실 계산 헬퍼 (#196)

    Returns: (profit_loss, profit_loss_pct) — avg_buy_price 없으면 (None, None)
    """
    if not avg_buy_price:
        return None, None
    cost = quantity * avg_buy_price
    profit_loss = current_value - cost
    profit_loss_pct = (profit_loss / cost) * 100 if cost > 0 else 0
    return profit_loss, profit_loss_pct


async def get_asset_current_value(asset) -> dict:
    """자산의 현재 평가액 계산

    Returns: {current_price, current_value, profit_loss, profit_loss_pct}
    """
    result = {"current_price": None, "current_value": None, "profit_loss": None, "profit_loss_pct": None}

    if asset.type == "stock_kr" and asset.ticker and asset.quantity:
        price = await get_stock_kr_price(asset.ticker)
        if price:
            result["current_price"] = price
            result["current_value"] = float(asset.quantity) * price
            result["profit_loss"], result["profit_loss_pct"] = _calc_profit(
                result["current_value"], float(asset.quantity), float(asset.avg_buy_price) if asset.avg_buy_price else None
            )

    elif asset.type == "stock_us" and asset.ticker and asset.quantity:
        _price_usd, price_krw = await get_stock_us_price(asset.ticker)
        if price_krw:
            result["current_price"] = price_krw
            result["current_value"] = float(asset.quantity) * price_krw
            result["profit_loss"], result["profit_loss_pct"] = _calc_profit(
                result["current_value"], float(asset.quantity), float(asset.avg_buy_price) if asset.avg_buy_price else None
            )

    elif asset.type == "crypto" and asset.ticker and asset.quantity:
        price = await get_crypto_price(asset.ticker)
        if price:
            result["current_price"] = price
            result["current_value"] = float(asset.quantity) * price
            result["profit_loss"], result["profit_loss_pct"] = _calc_profit(
                result["current_value"], float(asset.quantity), float(asset.avg_buy_price) if asset.avg_buy_price else None
            )

    elif asset.type in ("deposit", "real_estate", "other", "loan"):
        value = float(asset.manual_value) if asset.manual_value else 0
        result["current_value"] = value

    return result


# ── 종목 검색 ──────────────────────────────────────────────────


async def search_stock_kr(query: str) -> list[dict]:
    """한국 종목 검색 (프론트 정적 JSON으로 이전, 백엔드는 fallback용 유지)"""
    # 1차: 네이버 금융
    results = await _search_stock_kr_naver(query)
    if results:
        return results
    # 2차: Yahoo Finance fallback
    return await _search_stock_kr_yahoo(query)


async def _search_stock_kr_naver(query: str) -> list[dict]:
    """네이버 금융 한국 종목 검색"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://m.stock.naver.com/api/search/all",
                params={"query": query},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("result", {}).get("d", [])[:10]:
                    results.append({"ticker": item.get("cd", ""), "name": item.get("nm", ""), "market": "KR"})
                return results
    except Exception:
        pass
    return []


async def _search_stock_kr_yahoo(query: str) -> list[dict]:
    """Yahoo Finance 한국 종목 검색 fallback (.KS/.KQ 필터)"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://query1.finance.yahoo.com/v1/finance/search",
                params={"q": query, "quotesCount": 20},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("quotes", []):
                    symbol = item.get("symbol", "")
                    if symbol.endswith(".KS") or symbol.endswith(".KQ"):
                        ticker = symbol.rsplit(".", 1)[0]
                        name = item.get("shortname") or item.get("longname") or ticker
                        results.append({"ticker": ticker, "name": name, "market": "KR"})
                return results[:10]
    except Exception:
        pass
    return []


async def search_stock_us(query: str) -> list[dict]:
    """미국 종목 검색"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://query1.finance.yahoo.com/v1/finance/search",
                params={"q": query, "quotesCount": 10},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for item in data.get("quotes", []):
                    if item.get("quoteType") in ("EQUITY", "ETF"):
                        results.append({"ticker": item["symbol"], "name": item.get("shortname", ""), "market": "US"})
                return results
    except Exception:
        pass
    return []


async def search_crypto(query: str) -> list[dict]:
    """코인 검색 (업비트 마켓)"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://api.upbit.com/v1/market/all", params={"isDetails": "false"})
            if resp.status_code == 200:
                data = resp.json()
                results = []
                q = query.upper()
                for item in data:
                    market = item["market"]
                    if not market.startswith("KRW-"):
                        continue
                    symbol = market.replace("KRW-", "")
                    name = item.get("korean_name", "")
                    if q in symbol or q in name:
                        results.append({"ticker": symbol, "name": name, "market": "CRYPTO"})
                return results[:10]
    except Exception:
        pass
    return []


# ── 캐시 유틸 ──────────────────────────────────────────────────


def _get_cached(key: str) -> "float | None | object":
    """캐시 조회 — _CACHE_MISS 반환 시 캐시 없음, None 반환 시 실패 캐시 (#159)"""
    if key in _price_cache:
        price, ts = _price_cache[key]
        ttl = NEGATIVE_CACHE_TTL if price is None else CACHE_TTL
        if time.monotonic() - ts < ttl:
            return price  # None(실패 캐시) 또는 float
        del _price_cache[key]
    return _CACHE_MISS


def _set_cached(key: str, price: float | None) -> None:
    """캐시 저장 — None이면 실패 캐시 (NEGATIVE_CACHE_TTL 적용) (#159)"""
    _price_cache[key] = (price, time.monotonic())

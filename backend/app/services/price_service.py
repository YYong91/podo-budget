"""자산 시세 조회 서비스

한국 주식/ETF: Yahoo Finance (stocks 테이블에서 market lookup → .KS/.KQ 변환)
미국 주식/ETF: Yahoo Finance
코인: 업비트 공개 API
환율: exchange_rate 서비스 위임 (USD/KRW 전용, #195)
"""

import asyncio
import logging
import time
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import record_external_api_call
from app.models.stock import Stock
from app.services.exchange_rate import get_exchange_rate

logger = logging.getLogger(__name__)

# 시세 캐시
_CACHE_MISS = object()  # "캐시 미스" sentinel — None(실패 캐시)과 구분 (#159)
_price_cache: dict[str, tuple[float | None, float]] = {}  # key → (price_or_none, timestamp)
CACHE_TTL = 1800  # 성공 캐시 30분 — 빈번한 Yahoo Finance 호출 방지
NEGATIVE_CACHE_TTL = 30  # 실패 캐시 30초 — 외부 API rate limit 방어 (#159)

# singleflight 락 — 동시 요청이 같은 ticker 외부 API를 중복 호출하는 것을 방지 (#166)
_price_locks: dict[str, asyncio.Lock] = {}

# httpx 클라이언트 풀링 — 매 요청마다 새 클라이언트 생성 대신 모듈 레벨에서 공유
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    """공유 httpx 클라이언트 반환 (lazy init)"""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"},
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _http_client


def _lock_for(key: str) -> asyncio.Lock:
    """키별 락 반환 (없으면 생성) — asyncio 단일 스레드이므로 race-free"""
    if key not in _price_locks:
        _price_locks[key] = asyncio.Lock()
    return _price_locks[key]


# ── Yahoo Finance 공통 ───────────────────────────────────────


async def _get_yahoo_price(yahoo_ticker: str) -> float | None:
    """Yahoo Finance에서 시세 조회 (한국/미국 공통)

    Args:
        yahoo_ticker: Yahoo Finance 티커 (예: "005930.KS", "AAPL")
    """
    t0 = time.monotonic()
    try:
        client = _get_http_client()
        resp = await client.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_ticker}",
            params={"interval": "1d", "range": "1d"},
        )
        latency = (time.monotonic() - t0) * 1000
        if resp.status_code == 200:
            data = resp.json()
            meta = data["chart"]["result"][0]["meta"]
            price = float(meta["regularMarketPrice"])
            if price > 0:
                record_external_api_call(service="yahoo", success=True, latency_ms=latency)
                return price
        record_external_api_call(service="yahoo", success=False, latency_ms=latency)
    except Exception:
        latency = (time.monotonic() - t0) * 1000
        record_external_api_call(service="yahoo", success=False, latency_ms=latency)
    return None


# ── 한국 주식 시세 ─────────────────────────────────────────────


async def get_stock_kr_price(ticker: str, db: AsyncSession) -> float | None:
    """한국 주식/ETF 현재가 조회 (Yahoo Finance 단일 소스)

    stocks 테이블에서 market lookup → .KS(코스피)/.KQ(코스닥) 변환.
    미등록 종목은 .KS 시도 후 .KQ fallback.
    """
    key = f"kr:{ticker}"
    cached = _get_cached(key)
    if cached is not _CACHE_MISS:
        return cached  # type: ignore[return-value]

    async with _lock_for(key):
        # 락 획득 후 재확인 — 대기 중에 다른 코루틴이 이미 채웠을 수 있음
        cached = _get_cached(key)
        if cached is not _CACHE_MISS:
            return cached  # type: ignore[return-value]

        # stocks 테이블에서 market 확인
        result = await db.execute(select(Stock).where(Stock.ticker == ticker, Stock.is_active == True))  # noqa: E712
        stock = result.scalar_one_or_none()

        if stock:
            # DB에 등록된 종목 — market 기반으로 서픽스 결정
            suffix = ".KS" if stock.market == "KOSPI" else ".KQ"
            price = await _get_yahoo_price(f"{ticker}{suffix}")
        else:
            # 미등록 종목 — .KS 시도 후 .KQ fallback
            price = await _get_yahoo_price(f"{ticker}.KS")
            if price is None:
                price = await _get_yahoo_price(f"{ticker}.KQ")

        _set_cached(key, price)
        return price


# ── 미국 주식 시세 ─────────────────────────────────────────────


async def get_stock_us_price(ticker: str) -> tuple[float | None, float | None]:
    """미국 주식/ETF 현재가 조회 (USD + KRW 환산, #195: USD/KRW는 exchange_rate 서비스 위임)"""
    key = f"us:{ticker}"
    cached_usd = _get_cached(key)

    if cached_usd is not _CACHE_MISS:
        if cached_usd is None:
            return None, None  # 실패 캐시 hit
        usd_krw = await get_exchange_rate("USD")
        return cached_usd, cached_usd * usd_krw if usd_krw else None  # type: ignore[return-value,operator]

    async with _lock_for(key):
        cached_usd = _get_cached(key)
        if cached_usd is not _CACHE_MISS:
            if cached_usd is None:
                return None, None
            usd_krw = await get_exchange_rate("USD")
            return cached_usd, cached_usd * usd_krw if usd_krw else None  # type: ignore[return-value,operator]

        # 환율 + Yahoo 시세를 병렬 조회
        usd_krw, price_usd = await asyncio.gather(
            get_exchange_rate("USD"),
            _get_yahoo_price(ticker),
        )
        if price_usd is not None:
            _set_cached(key, price_usd)
            krw_price = price_usd * usd_krw if usd_krw else None
            return price_usd, krw_price

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
            client = _get_http_client()
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


async def get_asset_current_value(asset, db: AsyncSession | None = None) -> dict[str, Any]:  # type: ignore[no-untyped-def]
    """자산의 현재 평가액 계산

    Args:
        asset: Asset 모델 인스턴스
        db: AsyncSession (한국 주식 market lookup에 필요)

    Returns: {current_price, current_value, profit_loss, profit_loss_pct}
    """
    result = {"current_price": None, "current_value": None, "profit_loss": None, "profit_loss_pct": None}

    if asset.type == "stock_kr" and asset.ticker and asset.quantity:
        if db is not None:
            price = await get_stock_kr_price(asset.ticker, db)
        else:
            # db 없는 경우 fallback — .KS 기본 시도 (캐시/singleflight/KOSDAQ 미적용)
            logger.warning("get_asset_current_value: db=None, 한국 주식 market lookup 불가 — .KS fallback")
            price = await _get_yahoo_price(f"{asset.ticker}.KS")
        if price:
            result["current_price"] = price  # type: ignore[assignment]
            result["current_value"] = float(asset.quantity) * price  # type: ignore[assignment]
            result["profit_loss"], result["profit_loss_pct"] = _calc_profit(  # type: ignore[assignment]
                result["current_value"],  # type: ignore[arg-type]
                float(asset.quantity),
                float(asset.avg_buy_price) if asset.avg_buy_price else None,
            )

    elif asset.type == "stock_us" and asset.ticker and asset.quantity:
        _price_usd, price_krw = await get_stock_us_price(asset.ticker)
        if price_krw:
            result["current_price"] = price_krw  # type: ignore[assignment]
            result["current_value"] = float(asset.quantity) * price_krw  # type: ignore[assignment]
            result["profit_loss"], result["profit_loss_pct"] = _calc_profit(  # type: ignore[assignment]
                result["current_value"],  # type: ignore[arg-type]
                float(asset.quantity),
                float(asset.avg_buy_price) if asset.avg_buy_price else None,
            )

    elif asset.type == "crypto" and asset.ticker and asset.quantity:
        price = await get_crypto_price(asset.ticker)
        if price:
            result["current_price"] = price  # type: ignore[assignment]
            result["current_value"] = float(asset.quantity) * price  # type: ignore[assignment]
            result["profit_loss"], result["profit_loss_pct"] = _calc_profit(  # type: ignore[assignment]
                result["current_value"],  # type: ignore[arg-type]
                float(asset.quantity),
                float(asset.avg_buy_price) if asset.avg_buy_price else None,
            )

    elif asset.type in ("deposit", "real_estate", "other", "loan"):
        value = float(asset.manual_value) if asset.manual_value else 0
        result["current_value"] = value  # type: ignore[assignment]

    return result


# ── 종목 검색 ──────────────────────────────────────────────────


async def search_stock_us(query: str) -> list[dict[str, Any]]:
    """미국 종목 검색"""
    try:
        client = _get_http_client()
        resp = await client.get(
            "https://query1.finance.yahoo.com/v1/finance/search",
            params={"q": query, "quotesCount": 10},
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


async def search_crypto(query: str) -> list[dict[str, Any]]:
    """코인 검색 (업비트 마켓)"""
    try:
        client = _get_http_client()
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

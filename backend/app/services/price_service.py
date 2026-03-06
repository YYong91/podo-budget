"""자산 시세 조회 서비스

한국 주식/ETF: 네이버 금융 비공식 API
미국 주식/ETF: Yahoo Finance
코인: 업비트 공개 API
환율: exchangerate-api
"""

import time

import httpx

# 시세 캐시 (5분)
_price_cache: dict[str, tuple[float, float]] = {}  # ticker → (price, timestamp)
CACHE_TTL = 300  # 5분


async def get_stock_kr_price(ticker: str) -> float | None:
    """한국 주식/ETF 현재가 조회"""
    cached = _get_cached(f"kr:{ticker}")
    if cached is not None:
        return cached

    # 네이버 금융 API (비공식, 안정적)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://m.stock.naver.com/api/stock/{ticker}/basic",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                price = float(data.get("currentPrice", 0))
                if price > 0:
                    _set_cached(f"kr:{ticker}", price)
                    return price
    except Exception:
        pass
    return None


async def get_stock_us_price(ticker: str) -> tuple[float | None, float | None]:
    """미국 주식/ETF 현재가 조회 (USD + KRW 환산)"""
    cached_usd = _get_cached(f"us:{ticker}")
    exchange_rate = await get_usd_krw_rate()

    if cached_usd is not None and exchange_rate is not None:
        return cached_usd, cached_usd * exchange_rate

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",
                params={"interval": "1d", "range": "1d"},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                meta = data["chart"]["result"][0]["meta"]
                price_usd = float(meta["regularMarketPrice"])
                _set_cached(f"us:{ticker}", price_usd)
                krw_price = price_usd * exchange_rate if exchange_rate else None
                return price_usd, krw_price
    except Exception:
        pass
    return None, None


async def get_crypto_price(symbol: str) -> float | None:
    """업비트 코인 현재가 조회 (KRW)"""
    cached = _get_cached(f"crypto:{symbol}")
    if cached is not None:
        return cached

    market = f"KRW-{symbol.upper()}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.upbit.com/v1/ticker",
                params={"markets": market},
            )
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    price = float(data[0]["trade_price"])
                    _set_cached(f"crypto:{symbol}", price)
                    return price
    except Exception:
        pass
    return None


async def get_usd_krw_rate() -> float | None:
    """USD/KRW 환율 조회"""
    cached = _get_cached("fx:USDKRW")
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://open.er-api.com/v6/latest/USD")
            if resp.status_code == 200:
                data = resp.json()
                rate = float(data["rates"]["KRW"])
                _set_cached("fx:USDKRW", rate)
                return rate
    except Exception:
        pass
    return None


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
            if asset.avg_buy_price:
                cost = float(asset.quantity) * float(asset.avg_buy_price)
                result["profit_loss"] = result["current_value"] - cost
                result["profit_loss_pct"] = (result["profit_loss"] / cost) * 100 if cost > 0 else 0

    elif asset.type == "stock_us" and asset.ticker and asset.quantity:
        _price_usd, price_krw = await get_stock_us_price(asset.ticker)
        if price_krw:
            result["current_price"] = price_krw
            result["current_value"] = float(asset.quantity) * price_krw
            if asset.avg_buy_price:
                cost = float(asset.quantity) * float(asset.avg_buy_price)
                result["profit_loss"] = result["current_value"] - cost
                result["profit_loss_pct"] = (result["profit_loss"] / cost) * 100 if cost > 0 else 0

    elif asset.type == "crypto" and asset.ticker and asset.quantity:
        price = await get_crypto_price(asset.ticker)
        if price:
            result["current_price"] = price
            result["current_value"] = float(asset.quantity) * price
            if asset.avg_buy_price:
                cost = float(asset.quantity) * float(asset.avg_buy_price)
                result["profit_loss"] = result["current_value"] - cost
                result["profit_loss_pct"] = (result["profit_loss"] / cost) * 100 if cost > 0 else 0

    elif asset.type in ("deposit", "real_estate", "other", "loan"):
        value = float(asset.manual_value) if asset.manual_value else 0
        result["current_value"] = value

    return result


async def search_stock_kr(query: str) -> list[dict]:
    """한국 종목 검색"""
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


def _get_cached(key: str) -> float | None:
    if key in _price_cache:
        price, ts = _price_cache[key]
        if time.time() - ts < CACHE_TTL:
            return price
        del _price_cache[key]
    return None


def _set_cached(key: str, price: float) -> None:
    _price_cache[key] = (price, time.time())

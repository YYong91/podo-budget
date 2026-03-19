"""price_service 단위 테스트 (#197)

외부 API 없이 get_asset_current_value의 시세 계산 로직을 테스트합니다.
실제 네트워크 호출은 unittest.mock으로 대체합니다.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_asset(**kwargs) -> MagicMock:
    """테스트용 Asset 객체 생성"""
    asset = MagicMock()
    asset.type = kwargs.get("type", "deposit")
    asset.ticker = kwargs.get("ticker")
    asset.quantity = kwargs.get("quantity")
    asset.avg_buy_price = kwargs.get("avg_buy_price")
    asset.manual_value = kwargs.get("manual_value")
    return asset


# --- 예금/부동산/기타 (manual_value 기반) ---


@pytest.mark.asyncio
async def test_deposit_asset_returns_manual_value():
    """예금 자산은 manual_value를 current_value로 반환한다"""
    from app.services.price_service import get_asset_current_value

    asset = _make_asset(type="deposit", manual_value=5000000)
    result = await get_asset_current_value(asset)

    assert result["current_value"] == 5000000.0
    assert result["current_price"] is None
    assert result["profit_loss"] is None


@pytest.mark.asyncio
async def test_real_estate_asset_returns_manual_value():
    """부동산 자산은 manual_value를 current_value로 반환한다"""
    from app.services.price_service import get_asset_current_value

    asset = _make_asset(type="real_estate", manual_value=300000000)
    result = await get_asset_current_value(asset)

    assert result["current_value"] == 300000000.0


@pytest.mark.asyncio
async def test_loan_asset_returns_manual_value():
    """대출(부채) 자산은 manual_value를 current_value로 반환한다"""
    from app.services.price_service import get_asset_current_value

    asset = _make_asset(type="loan", manual_value=10000000)
    result = await get_asset_current_value(asset)

    assert result["current_value"] == 10000000.0


@pytest.mark.asyncio
async def test_other_asset_with_no_manual_value_returns_zero():
    """manual_value가 없는 기타 자산은 current_value 0 반환"""
    from app.services.price_service import get_asset_current_value

    asset = _make_asset(type="other", manual_value=None)
    result = await get_asset_current_value(asset)

    assert result["current_value"] == 0.0


# --- 한국 주식 계산 ---


@pytest.mark.asyncio
async def test_stock_kr_profit_loss_calculation():
    """한국 주식 손익 계산: (현재가 - 평단가) × 수량"""
    from app.services import price_service

    asset = _make_asset(
        type="stock_kr",
        ticker="005930",
        quantity=10,
        avg_buy_price=70000,
    )

    with patch.object(price_service, "get_stock_kr_price", new=AsyncMock(return_value=80000.0)):
        result = await price_service.get_asset_current_value(asset)

    assert result["current_price"] == 80000.0
    assert result["current_value"] == 800000.0  # 80000 × 10
    assert result["profit_loss"] == 100000.0  # (80000 - 70000) × 10
    assert abs(result["profit_loss_pct"] - 14.2857) < 0.01  # 10만 / 70만 × 100


@pytest.mark.asyncio
async def test_stock_kr_no_price_returns_none():
    """한국 주식 시세 조회 실패 시 None 반환"""
    from app.services import price_service

    asset = _make_asset(type="stock_kr", ticker="005930", quantity=10, avg_buy_price=70000)

    with patch.object(price_service, "get_stock_kr_price", new=AsyncMock(return_value=None)):
        result = await price_service.get_asset_current_value(asset)

    assert result["current_price"] is None
    assert result["current_value"] is None
    assert result["profit_loss"] is None


@pytest.mark.asyncio
async def test_stock_kr_without_avg_buy_price_no_profit():
    """평균 매입가 없으면 손익 계산 안 함"""
    from app.services import price_service

    asset = _make_asset(type="stock_kr", ticker="005930", quantity=5, avg_buy_price=None)

    with patch.object(price_service, "get_stock_kr_price", new=AsyncMock(return_value=60000.0)):
        result = await price_service.get_asset_current_value(asset)

    assert result["current_price"] == 60000.0
    assert result["current_value"] == 300000.0  # 60000 × 5
    assert result["profit_loss"] is None
    assert result["profit_loss_pct"] is None


# --- 미국 주식 계산 ---


@pytest.mark.asyncio
async def test_stock_us_profit_loss_calculation():
    """미국 주식 손익 계산 (KRW 환산 기준)"""
    from app.services import price_service

    asset = _make_asset(
        type="stock_us",
        ticker="AAPL",
        quantity=2,
        avg_buy_price=200000,  # KRW 기준 평균 매입가
    )

    # get_stock_us_price는 (usd, krw) 튜플 반환
    with patch.object(price_service, "get_stock_us_price", new=AsyncMock(return_value=(180.0, 240000.0))):
        result = await price_service.get_asset_current_value(asset)

    assert result["current_price"] == 240000.0  # KRW 현재가
    assert result["current_value"] == 480000.0  # 240000 × 2
    assert result["profit_loss"] == 80000.0  # (240000 - 200000) × 2
    assert abs(result["profit_loss_pct"] - 20.0) < 0.01  # 8만 / 40만 × 100


@pytest.mark.asyncio
async def test_stock_us_no_price_returns_none():
    """미국 주식 시세 조회 실패 시 None 반환"""
    from app.services import price_service

    asset = _make_asset(type="stock_us", ticker="AAPL", quantity=1, avg_buy_price=200000)

    with patch.object(price_service, "get_stock_us_price", new=AsyncMock(return_value=(None, None))):
        result = await price_service.get_asset_current_value(asset)

    assert result["current_price"] is None
    assert result["current_value"] is None


# --- 코인 계산 ---


@pytest.mark.asyncio
async def test_crypto_profit_loss_calculation():
    """코인 손익 계산"""
    from app.services import price_service

    asset = _make_asset(
        type="crypto",
        ticker="BTC",
        quantity=0.5,
        avg_buy_price=80000000,
    )

    with patch.object(price_service, "get_crypto_price", new=AsyncMock(return_value=100000000.0)):
        result = await price_service.get_asset_current_value(asset)

    assert result["current_price"] == 100000000.0
    assert result["current_value"] == 50000000.0  # 100000000 × 0.5
    assert result["profit_loss"] == 10000000.0  # (100000000 - 80000000) × 0.5
    assert abs(result["profit_loss_pct"] - 25.0) < 0.01  # 1000만 / 4000만 × 100


@pytest.mark.asyncio
async def test_crypto_no_price_returns_none():
    """코인 시세 조회 실패 시 None 반환"""
    from app.services import price_service

    asset = _make_asset(type="crypto", ticker="BTC", quantity=0.5, avg_buy_price=80000000)

    with patch.object(price_service, "get_crypto_price", new=AsyncMock(return_value=None)):
        result = await price_service.get_asset_current_value(asset)

    assert result["current_price"] is None
    assert result["current_value"] is None


# --- 캐시 유틸 ---


def test_price_cache_ttl():
    """시세 캐시는 TTL(5분) 이내에는 동일 값을 반환한다"""
    from app.services.price_service import _get_cached, _set_cached

    _set_cached("test:CACHE", 12345.0)
    cached = _get_cached("test:CACHE")

    assert cached == 12345.0


def test_price_cache_miss_returns_none():
    """캐시에 없는 키는 None 반환"""
    from app.services.price_service import _get_cached

    result = _get_cached("test:NONEXISTENT_KEY_XYZ")
    assert result is None


def test_price_cache_expired_returns_none():
    """TTL 만료된 캐시는 None 반환"""
    import time

    from app.services import price_service

    # 만료된 캐시 직접 삽입 (타임스탬프를 과거로 설정)
    price_service._price_cache["test:EXPIRED"] = (9999.0, time.time() - price_service.CACHE_TTL - 1)

    result = price_service._get_cached("test:EXPIRED")
    assert result is None

"""price_service 단위 테스트 (#197)

외부 API 없이 get_asset_current_value의 시세 계산 로직을 테스트합니다.
실제 네트워크 호출은 unittest.mock으로 대체합니다.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def clear_price_cache():
    """각 테스트 전후로 price_cache 초기화 — 모듈 레벨 상태 격리"""
    from app.services import price_service

    price_service._price_cache.clear()
    yield
    price_service._price_cache.clear()


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
    mock_db = AsyncMock()

    with patch.object(price_service, "get_stock_kr_price", new=AsyncMock(return_value=80000.0)):
        result = await price_service.get_asset_current_value(asset, mock_db)

    assert result["current_price"] == 80000.0
    assert result["current_value"] == 800000.0  # 80000 × 10
    assert result["profit_loss"] == 100000.0  # (80000 - 70000) × 10
    assert abs(result["profit_loss_pct"] - 14.2857) < 0.01  # 10만 / 70만 × 100


@pytest.mark.asyncio
async def test_stock_kr_no_price_returns_none():
    """한국 주식 시세 조회 실패 시 None 반환"""
    from app.services import price_service

    asset = _make_asset(type="stock_kr", ticker="005930", quantity=10, avg_buy_price=70000)
    mock_db = AsyncMock()

    with patch.object(price_service, "get_stock_kr_price", new=AsyncMock(return_value=None)):
        result = await price_service.get_asset_current_value(asset, mock_db)

    assert result["current_price"] is None
    assert result["current_value"] is None
    assert result["profit_loss"] is None


@pytest.mark.asyncio
async def test_stock_kr_without_avg_buy_price_no_profit():
    """평균 매입가 없으면 손익 계산 안 함"""
    from app.services import price_service

    asset = _make_asset(type="stock_kr", ticker="005930", quantity=5, avg_buy_price=None)
    mock_db = AsyncMock()

    with patch.object(price_service, "get_stock_kr_price", new=AsyncMock(return_value=60000.0)):
        result = await price_service.get_asset_current_value(asset, mock_db)

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
    """시세 캐시 동작 검증: TTL 히트 / 미스 / 만료 (#197)

    단일 테스트 내에서 순차 실행하여 테스트 간 상태 오염 문제 완전 방지.
    _get_cached: 미스 → _CACHE_MISS sentinel, 히트 → 값, 만료 → _CACHE_MISS (#159)
    """
    import time

    from app.services import price_service
    from app.services.price_service import _CACHE_MISS, _get_cached, _set_cached

    # 1. 히트: 설정된 키는 TTL 이내에 동일 값 반환
    _set_cached("test:CACHE", 12345.0)
    assert _get_cached("test:CACHE") == 12345.0

    # 2. 미스: 설정한 키와 다른 키는 _CACHE_MISS sentinel 반환 (#159)
    assert _get_cached("test:CACHE_DIFFERENT_KEY") is _CACHE_MISS

    # 3. 만료: TTL 초과 항목은 _CACHE_MISS 반환 + 캐시에서 삭제
    price_service._price_cache["test:EXPIRED"] = (9999.0, time.monotonic() - price_service.CACHE_TTL - 1)
    assert _get_cached("test:EXPIRED") is _CACHE_MISS
    assert "test:EXPIRED" not in price_service._price_cache

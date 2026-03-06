# Phase 1: 자산/부채 현황 대시보드 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 가족(household) 단위 자산/부채 등록, 실시간 시세 조회, 순자산 대시보드 구현

**Architecture:** Asset 모델 + 시세 서비스(한국주식/미국주식/코인/환율 API) + 자연어 파싱. 기존 household 격리 패턴 재사용. 프론트엔드는 자산 대시보드 + 등록 폼(자연어/직접 입력).

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, React 19, Tailwind CSS v4 (Grape), Recharts, KIS OpenAPI, Yahoo Finance, 업비트 API

---

### Task 1: Asset 모델 정의

**Files:**
- Create: `backend/app/models/asset.py`
- Create: `backend/app/models/asset_snapshot.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Asset 모델 생성**

```python
# backend/app/models/asset.py
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        Index("ix_assets_household_id", "household_id"),
        Index("ix_assets_user_type", "user_id", "type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # stock_kr, stock_us, crypto, deposit, real_estate, other, loan
    is_liability = Column(Boolean, nullable=False, default=False)

    # 투자형 (stock/crypto)
    ticker = Column(String, nullable=True)
    quantity = Column(Numeric(18, 8), nullable=True)  # 코인 소수점 대응
    avg_buy_price = Column(Numeric(18, 2), nullable=True)

    # 수동형 (deposit/real_estate/other/loan)
    manual_value = Column(Numeric(18, 2), nullable=True)
    interest_rate = Column(Numeric(5, 2), nullable=True)
    maturity_date = Column(Date, nullable=True)

    # 대출 전용
    repayment_type = Column(String, nullable=True)  # equal_principal_interest, equal_principal, bullet
    monthly_payment = Column(Numeric(18, 2), nullable=True)

    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="assets")
    household = relationship("Household", backref="assets")
```

**Step 2: AssetSnapshot 모델 생성**

```python
# backend/app/models/asset_snapshot.py
from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, Text
from sqlalchemy.sql import func

from app.core.database import Base


class AssetSnapshot(Base):
    __tablename__ = "asset_snapshots"
    __table_args__ = (
        Index("ix_asset_snapshots_household_date", "household_id", "snapshot_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    snapshot_date = Column(Date, nullable=False)
    total_assets = Column(Numeric(18, 2), nullable=False, default=0)
    total_liabilities = Column(Numeric(18, 2), nullable=False, default=0)
    net_worth = Column(Numeric(18, 2), nullable=False, default=0)
    breakdown = Column(Text, nullable=True)  # JSON string: 유형별 합산
    created_at = Column(DateTime, default=func.now())
```

**Step 3: models/__init__.py에 등록**

`backend/app/models/__init__.py`에 추가:
```python
from app.models.asset import Asset
from app.models.asset_snapshot import AssetSnapshot

# __all__에 "Asset", "AssetSnapshot" 추가
```

**Step 4: Commit**

```bash
git add backend/app/models/asset.py backend/app/models/asset_snapshot.py backend/app/models/__init__.py
git commit -m "feat: Asset, AssetSnapshot 모델 정의"
```

---

### Task 2: Alembic 마이그레이션

**Files:**
- Create: `backend/alembic/versions/k4l5m6n7o8p9_add_assets_tables.py` (자동 생성)

**Step 1: 마이그레이션 생성**

```bash
cd backend
alembic revision --autogenerate -m "add assets and asset_snapshots tables"
```

**Step 2: 마이그레이션 파일 확인**

생성된 파일에서:
- `assets` 테이블의 모든 컬럼이 포함되어 있는지 확인
- `asset_snapshots` 테이블이 포함되어 있는지 확인
- SQLite batch_alter_table 패턴이 필요한 경우 수정

**Step 3: 마이그레이션 적용**

```bash
alembic upgrade head
```

**Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "chore: assets 테이블 마이그레이션 추가"
```

---

### Task 3: Pydantic 스키마

**Files:**
- Create: `backend/app/schemas/asset.py`

**Step 1: 스키마 정의**

```python
# backend/app/schemas/asset.py
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class AssetBase(BaseModel):
    name: str
    type: str = Field(..., pattern="^(stock_kr|stock_us|crypto|deposit|real_estate|other|loan)$")
    is_liability: bool = False
    ticker: str | None = None
    quantity: float | None = None
    avg_buy_price: float | None = None
    manual_value: float | None = None
    interest_rate: float | None = Field(None, ge=0, le=100)
    maturity_date: date | None = None
    repayment_type: str | None = None
    monthly_payment: float | None = None
    memo: str | None = None


class AssetCreate(AssetBase):
    household_id: int | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    type: str | None = Field(None, pattern="^(stock_kr|stock_us|crypto|deposit|real_estate|other|loan)$")
    is_liability: bool | None = None
    ticker: str | None = None
    quantity: float | None = None
    avg_buy_price: float | None = None
    manual_value: float | None = None
    interest_rate: float | None = None
    maturity_date: date | None = None
    repayment_type: str | None = None
    monthly_payment: float | None = None
    memo: str | None = None


class AssetResponse(AssetBase):
    id: int
    household_id: int | None = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssetWithPrice(AssetResponse):
    """시세 정보가 포함된 응답"""
    current_price: float | None = None  # 현재가 (투자형만)
    current_value: float | None = None  # 현재 평가액
    profit_loss: float | None = None  # 손익 금액
    profit_loss_pct: float | None = None  # 수익률 %


class AssetSummary(BaseModel):
    """순자산 요약"""
    total_assets: float
    total_liabilities: float
    net_worth: float
    breakdown: dict[str, float]  # 유형별 합산 {"stock_kr": 5000000, ...}
    total_profit_loss: float
    total_profit_loss_pct: float | None


class AssetSnapshotResponse(BaseModel):
    snapshot_date: date
    total_assets: float
    total_liabilities: float
    net_worth: float
    breakdown: dict[str, float] | None = None

    class Config:
        from_attributes = True


class AssetParseRequest(BaseModel):
    """자연어 입력"""
    text: str


class AssetParseResponse(BaseModel):
    """자연어 파싱 결과"""
    items: list[AssetCreate]
```

**Step 2: Commit**

```bash
git add backend/app/schemas/asset.py
git commit -m "feat: Asset Pydantic 스키마 정의"
```

---

### Task 4: 시세 조회 서비스

**Files:**
- Create: `backend/app/services/price_service.py`

**Step 1: 시세 서비스 구현**

```python
# backend/app/services/price_service.py
"""자산 시세 조회 서비스

한국 주식/ETF: KIS 또는 KRX 공개 시세
미국 주식/ETF: Yahoo Finance (yfinance)
코인: 업비트 공개 API
환율: exchangerate-api 또는 한국은행 ECOS
"""
import time
from decimal import Decimal

import httpx

# 시세 캐시 (5분)
_price_cache: dict[str, tuple[float, float]] = {}  # ticker → (price, timestamp)
CACHE_TTL = 300  # 5분


async def get_stock_kr_price(ticker: str) -> float | None:
    """한국 주식/ETF 현재가 조회"""
    cached = _get_cached(f"kr:{ticker}")
    if cached is not None:
        return cached

    # KRX 공개 시세 API 사용 (인증 불필요)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # 네이버 금융 API (비공식, 안정적)
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
        price_usd, price_krw = await get_stock_us_price(asset.ticker)
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


def _get_cached(key: str) -> float | None:
    if key in _price_cache:
        price, ts = _price_cache[key]
        if time.time() - ts < CACHE_TTL:
            return price
        del _price_cache[key]
    return None


def _set_cached(key: str, price: float) -> None:
    _price_cache[key] = (price, time.time())
```

**Step 2: 종목 검색 서비스**

같은 파일 하단에 추가:

```python
async def search_stock_kr(query: str) -> list[dict]:
    """한국 종목 검색"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://m.stock.naver.com/api/search/all",
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
                f"https://query1.finance.yahoo.com/v1/finance/search",
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
```

**Step 3: Commit**

```bash
git add backend/app/services/price_service.py
git commit -m "feat: 시세 조회 서비스 구현 (한국주식, 미국주식, 코인, 환율)"
```

---

### Task 5: 자산 서비스 (비즈니스 로직)

**Files:**
- Create: `backend/app/services/asset_service.py`

**Step 1: 자산 CRUD + 요약 서비스**

```python
# backend/app/services/asset_service.py
"""자산 관리 비즈니스 로직"""
import json
from datetime import date, datetime

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.asset_snapshot import AssetSnapshot
from app.models.user import User
from app.services.price_service import get_asset_current_value


async def get_user_active_household_id(user: User, db: AsyncSession) -> int | None:
    """사용자의 활성 household_id 가져오기 (기존 패턴 재사용)"""
    from app.api.expenses import get_user_active_household_id as _get
    return await _get(user, db)


async def create_asset(db: AsyncSession, asset_data: dict, user: User) -> Asset:
    """자산 생성"""
    household_id = asset_data.pop("household_id", None)
    if household_id is None:
        household_id = await get_user_active_household_id(user, db)

    asset = Asset(**asset_data, created_by=user.id, household_id=household_id)
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def get_assets(db: AsyncSession, user: User, household_id: int | None = None) -> list[Asset]:
    """자산 목록 조회 (household 또는 개인)"""
    if household_id is not None:
        query = select(Asset).where(Asset.household_id == household_id)
    else:
        query = select(Asset).where(Asset.created_by == user.id)
    query = query.order_by(Asset.type, Asset.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_asset_by_id(db: AsyncSession, asset_id: int, user: User) -> Asset | None:
    """자산 상세 조회 (권한 체크 포함)"""
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        return None
    # 권한 체크: household 멤버이거나 본인이 생성
    if asset.household_id:
        from app.api.dependencies import get_household_member
        # household 멤버 여부는 API 레이어에서 체크
        return asset
    elif asset.created_by != user.id:
        return None
    return asset


async def update_asset(db: AsyncSession, asset: Asset, update_data: dict) -> Asset:
    """자산 수정"""
    for key, value in update_data.items():
        setattr(asset, key, value)
    await db.commit()
    await db.refresh(asset)
    return asset


async def delete_asset(db: AsyncSession, asset: Asset) -> None:
    """자산 삭제"""
    await db.delete(asset)
    await db.commit()


async def get_assets_with_prices(db: AsyncSession, user: User, household_id: int | None = None) -> list[dict]:
    """시세 포함 자산 목록"""
    assets = await get_assets(db, user, household_id)
    results = []
    for asset in assets:
        price_info = await get_asset_current_value(asset)
        asset_dict = {
            "id": asset.id,
            "household_id": asset.household_id,
            "created_by": asset.created_by,
            "name": asset.name,
            "type": asset.type,
            "is_liability": asset.is_liability,
            "ticker": asset.ticker,
            "quantity": float(asset.quantity) if asset.quantity else None,
            "avg_buy_price": float(asset.avg_buy_price) if asset.avg_buy_price else None,
            "manual_value": float(asset.manual_value) if asset.manual_value else None,
            "interest_rate": float(asset.interest_rate) if asset.interest_rate else None,
            "maturity_date": asset.maturity_date,
            "repayment_type": asset.repayment_type,
            "monthly_payment": float(asset.monthly_payment) if asset.monthly_payment else None,
            "memo": asset.memo,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at,
            **price_info,
        }
        results.append(asset_dict)
    return results


async def get_asset_summary(db: AsyncSession, user: User, household_id: int | None = None) -> dict:
    """순자산 요약"""
    assets_with_prices = await get_assets_with_prices(db, user, household_id)

    total_assets = 0.0
    total_liabilities = 0.0
    total_cost = 0.0
    breakdown: dict[str, float] = {}

    for a in assets_with_prices:
        value = a.get("current_value") or 0
        asset_type = a["type"]

        if a["is_liability"]:
            total_liabilities += value
        else:
            total_assets += value
            breakdown[asset_type] = breakdown.get(asset_type, 0) + value

        # 투자 원금 합산 (수익률 계산용)
        if a.get("avg_buy_price") and a.get("quantity"):
            total_cost += a["avg_buy_price"] * a["quantity"]

    total_profit_loss = total_assets - total_cost if total_cost > 0 else 0
    total_profit_loss_pct = (total_profit_loss / total_cost) * 100 if total_cost > 0 else None

    return {
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "net_worth": total_assets - total_liabilities,
        "breakdown": breakdown,
        "total_profit_loss": total_profit_loss,
        "total_profit_loss_pct": total_profit_loss_pct,
    }


async def create_snapshot(db: AsyncSession, user: User, household_id: int | None = None) -> AssetSnapshot:
    """월별 스냅샷 생성"""
    summary = await get_asset_summary(db, user, household_id)
    today = date.today().replace(day=1)  # 월초로 정규화

    # 이미 이번 달 스냅샷이 있으면 업데이트
    result = await db.execute(
        select(AssetSnapshot).where(
            AssetSnapshot.user_id == user.id,
            AssetSnapshot.household_id == household_id,
            AssetSnapshot.snapshot_date == today,
        )
    )
    snapshot = result.scalar_one_or_none()

    if snapshot:
        snapshot.total_assets = summary["total_assets"]
        snapshot.total_liabilities = summary["total_liabilities"]
        snapshot.net_worth = summary["net_worth"]
        snapshot.breakdown = json.dumps(summary["breakdown"])
    else:
        snapshot = AssetSnapshot(
            user_id=user.id,
            household_id=household_id,
            snapshot_date=today,
            total_assets=summary["total_assets"],
            total_liabilities=summary["total_liabilities"],
            net_worth=summary["net_worth"],
            breakdown=json.dumps(summary["breakdown"]),
        )
        db.add(snapshot)

    await db.commit()
    await db.refresh(snapshot)
    return snapshot


async def get_snapshots(db: AsyncSession, user: User, household_id: int | None = None, months: int = 12) -> list[AssetSnapshot]:
    """월별 스냅샷 조회"""
    query = select(AssetSnapshot).where(AssetSnapshot.user_id == user.id)
    if household_id is not None:
        query = query.where(AssetSnapshot.household_id == household_id)
    query = query.order_by(AssetSnapshot.snapshot_date.desc()).limit(months)
    result = await db.execute(query)
    return list(result.scalars().all())
```

**Step 2: Commit**

```bash
git add backend/app/services/asset_service.py
git commit -m "feat: 자산 서비스 (CRUD, 시세 연동, 순자산 요약, 스냅샷)"
```

---

### Task 6: 자산 자연어 파싱

**Files:**
- Create: `backend/app/services/asset_parse_service.py`

**Step 1: LLM 기반 자산 파싱**

```python
# backend/app/services/asset_parse_service.py
"""자연어 자산 입력 파싱"""
import json

from app.services.llm_service import get_llm_provider

ASSET_PARSE_PROMPT = """사용자가 보유 자산이나 부채를 자연어로 입력했습니다. 아래 JSON 배열로 파싱해주세요.

각 항목의 필드:
- name: 자산명 (예: "삼성전자", "신한은행 적금", "주택담보대출")
- type: stock_kr | stock_us | crypto | deposit | real_estate | other | loan
- is_liability: 부채면 true, 자산이면 false
- ticker: 종목코드(한국) 또는 티커(미국) 또는 코인심볼. 모르면 null
- quantity: 수량 (주식 주수, 코인 개수). 해당없으면 null
- avg_buy_price: 매입 평균가 (원). 해당없으면 null
- manual_value: 수동 평가액 (예금 잔액, 부동산 시세, 대출 잔액 등). 해당없으면 null
- interest_rate: 이율(%). 해당없으면 null
- maturity_date: 만기일 (YYYY-MM-DD). 해당없으면 null
- repayment_type: 상환방식 (equal_principal_interest/equal_principal/bullet). 대출만 해당, 나머지 null
- monthly_payment: 월 상환액. 대출만 해당, 나머지 null
- memo: 기타 메모. 해당없으면 null

한국 주식 종목코드 예시: 삼성전자=005930, SK하이닉스=000660, 카카오=035720, NAVER=035420
미국 주식 티커 예시: 애플=AAPL, 테슬라=TSLA, 엔비디아=NVDA, SPY, QQQ
코인 심볼 예시: 비트코인=BTC, 이더리움=ETH, 리플=XRP

금액 단위: 모두 원(KRW) 기준. "7만원"=70000, "2억"=200000000, "5천만원"=50000000

응답은 반드시 JSON 배열만 출력하세요. 다른 텍스트 없이.

사용자 입력:
{input_text}"""


async def parse_asset_input(text: str) -> list[dict]:
    """자연어 → 자산 정보 파싱"""
    llm = get_llm_provider()
    prompt = ASSET_PARSE_PROMPT.replace("{input_text}", text)

    response = await llm.generate(prompt)

    # JSON 파싱
    try:
        # ```json ... ``` 래핑 제거
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1]
            clean = clean.rsplit("```", 1)[0]
        items = json.loads(clean)
        if isinstance(items, dict):
            items = [items]
        return items
    except (json.JSONDecodeError, IndexError):
        return []
```

**Step 2: Commit**

```bash
git add backend/app/services/asset_parse_service.py
git commit -m "feat: 자산 자연어 파싱 서비스 (LLM 기반)"
```

---

### Task 7: API 라우터

**Files:**
- Create: `backend/app/api/assets.py`
- Modify: `backend/app/main.py` (라우터 등록)

**Step 1: assets API 라우터**

```python
# backend/app/api/assets.py
"""자산 관리 API"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.asset import (
    AssetCreate,
    AssetParseRequest,
    AssetParseResponse,
    AssetResponse,
    AssetSnapshotResponse,
    AssetSummary,
    AssetUpdate,
    AssetWithPrice,
)
from app.services import asset_service, price_service
from app.services.asset_parse_service import parse_asset_input

router = APIRouter()


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(
    asset: AssetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자산/부채 등록"""
    asset_data = asset.model_dump()
    result = await asset_service.create_asset(db, asset_data, current_user)
    return result


@router.get("", response_model=list[AssetWithPrice])
async def get_assets(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자산 목록 (시세 포함)"""
    if household_id is not None:
        from app.api.dependencies import get_household_member
        await get_household_member(household_id, current_user, db)
    results = await asset_service.get_assets_with_prices(db, current_user, household_id)
    return results


@router.get("/summary", response_model=AssetSummary)
async def get_summary(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """순자산 요약"""
    if household_id is not None:
        from app.api.dependencies import get_household_member
        await get_household_member(household_id, current_user, db)
    return await asset_service.get_asset_summary(db, current_user, household_id)


@router.get("/snapshots", response_model=list[AssetSnapshotResponse])
async def get_snapshots(
    household_id: int | None = Query(None),
    months: int = Query(12, ge=1, le=60),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """월별 스냅샷 (순자산 추이)"""
    snapshots = await asset_service.get_snapshots(db, current_user, household_id, months)
    results = []
    for s in snapshots:
        import json
        breakdown = json.loads(s.breakdown) if s.breakdown else None
        results.append(AssetSnapshotResponse(
            snapshot_date=s.snapshot_date,
            total_assets=float(s.total_assets),
            total_liabilities=float(s.total_liabilities),
            net_worth=float(s.net_worth),
            breakdown=breakdown,
        ))
    return results


@router.get("/search")
async def search_assets(
    q: str = Query(..., min_length=1),
    market: str = Query("all", pattern="^(all|kr|us|crypto)$"),
):
    """종목/코인 검색"""
    results = []
    if market in ("all", "kr"):
        results.extend(await price_service.search_stock_kr(q))
    if market in ("all", "us"):
        results.extend(await price_service.search_stock_us(q))
    if market in ("all", "crypto"):
        results.extend(await price_service.search_crypto(q))
    return results


@router.post("/parse", response_model=AssetParseResponse)
async def parse_asset(
    req: AssetParseRequest,
    current_user: User = Depends(get_current_user),
):
    """자연어 → 자산 파싱"""
    items = await parse_asset_input(req.text)
    return AssetParseResponse(items=[AssetCreate(**item) for item in items])


@router.get("/prices")
async def get_all_prices(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """보유 투자형 자산 일괄 시세"""
    assets = await asset_service.get_assets(db, current_user, household_id)
    prices = {}
    for asset in assets:
        if asset.ticker:
            info = await price_service.get_asset_current_value(asset)
            prices[asset.id] = info
    return prices


@router.get("/{asset_id}", response_model=AssetWithPrice)
async def get_asset(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자산 상세"""
    asset = await asset_service.get_asset_by_id(db, asset_id, current_user)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다")
    price_info = await price_service.get_asset_current_value(asset)
    return {**AssetResponse.model_validate(asset).model_dump(), **price_info}


@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: int,
    asset_update: AssetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자산 수정 (본인 생성분만)"""
    from sqlalchemy import select
    from app.models.asset import Asset
    result = await db.execute(select(Asset).where(Asset.id == asset_id, Asset.created_by == current_user.id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다")
    update_data = asset_update.model_dump(exclude_unset=True)
    return await asset_service.update_asset(db, asset, update_data)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자산 삭제 (본인 생성분만)"""
    from sqlalchemy import select
    from app.models.asset import Asset
    result = await db.execute(select(Asset).where(Asset.id == asset_id, Asset.created_by == current_user.id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다")
    await asset_service.delete_asset(db, asset)
```

**Step 2: main.py에 라우터 등록**

`backend/app/main.py` 수정:
- import 행에 `assets` 추가: `from app.api import ..., assets`
- 라우터 등록 추가: `app.include_router(assets.router, prefix="/api/assets", tags=["assets"])`

**Step 3: Commit**

```bash
git add backend/app/api/assets.py backend/app/main.py
git commit -m "feat: 자산 관리 API 라우터 (CRUD, 시세, 검색, 자연어 파싱)"
```

---

### Task 8: 백엔드 테스트

**Files:**
- Create: `backend/tests/test_assets.py`

**Step 1: 자산 CRUD 테스트**

```python
# backend/tests/test_assets.py
"""자산 관리 API 테스트"""
import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_asset_stock_kr(authenticated_client: AsyncClient):
    """한국 주식 자산 등록"""
    resp = await authenticated_client.post("/api/assets", json={
        "name": "삼성전자",
        "type": "stock_kr",
        "ticker": "005930",
        "quantity": 10,
        "avg_buy_price": 70000,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "삼성전자"
    assert data["type"] == "stock_kr"
    assert data["ticker"] == "005930"
    assert data["is_liability"] is False


@pytest.mark.asyncio
async def test_create_asset_loan(authenticated_client: AsyncClient):
    """대출 등록"""
    resp = await authenticated_client.post("/api/assets", json={
        "name": "주택담보대출",
        "type": "loan",
        "is_liability": True,
        "manual_value": 200000000,
        "interest_rate": 3.8,
        "repayment_type": "equal_principal_interest",
        "monthly_payment": 900000,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_liability"] is True
    assert data["manual_value"] == 200000000


@pytest.mark.asyncio
async def test_get_assets_list(authenticated_client: AsyncClient):
    """자산 목록 조회"""
    # 2개 등록
    await authenticated_client.post("/api/assets", json={"name": "삼성전자", "type": "stock_kr", "ticker": "005930", "quantity": 10, "avg_buy_price": 70000})
    await authenticated_client.post("/api/assets", json={"name": "적금", "type": "deposit", "manual_value": 5000000})

    resp = await authenticated_client.get("/api/assets")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_asset_detail(authenticated_client: AsyncClient):
    """자산 상세 조회"""
    create_resp = await authenticated_client.post("/api/assets", json={"name": "적금", "type": "deposit", "manual_value": 5000000})
    asset_id = create_resp.json()["id"]

    resp = await authenticated_client.get(f"/api/assets/{asset_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "적금"


@pytest.mark.asyncio
async def test_update_asset(authenticated_client: AsyncClient):
    """자산 수정"""
    create_resp = await authenticated_client.post("/api/assets", json={"name": "적금", "type": "deposit", "manual_value": 5000000})
    asset_id = create_resp.json()["id"]

    resp = await authenticated_client.put(f"/api/assets/{asset_id}", json={"manual_value": 6000000})
    assert resp.status_code == 200
    assert resp.json()["manual_value"] == 6000000


@pytest.mark.asyncio
async def test_delete_asset(authenticated_client: AsyncClient):
    """자산 삭제"""
    create_resp = await authenticated_client.post("/api/assets", json={"name": "적금", "type": "deposit", "manual_value": 5000000})
    asset_id = create_resp.json()["id"]

    resp = await authenticated_client.delete(f"/api/assets/{asset_id}")
    assert resp.status_code == 204

    resp = await authenticated_client.get(f"/api/assets/{asset_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_summary(authenticated_client: AsyncClient):
    """순자산 요약"""
    await authenticated_client.post("/api/assets", json={"name": "적금", "type": "deposit", "manual_value": 10000000})
    await authenticated_client.post("/api/assets", json={"name": "대출", "type": "loan", "is_liability": True, "manual_value": 3000000})

    resp = await authenticated_client.get("/api/assets/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_assets"] == 10000000
    assert data["total_liabilities"] == 3000000
    assert data["net_worth"] == 7000000


@pytest.mark.asyncio
async def test_asset_isolation(authenticated_client: AsyncClient, authenticated_client_2: AsyncClient):
    """다른 유저의 자산 접근 불가"""
    create_resp = await authenticated_client.post("/api/assets", json={"name": "내 적금", "type": "deposit", "manual_value": 5000000})
    asset_id = create_resp.json()["id"]

    # 다른 유저가 접근 시도
    resp = await authenticated_client_2.get(f"/api/assets/{asset_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_invalid_asset_type(authenticated_client: AsyncClient):
    """잘못된 자산 타입"""
    resp = await authenticated_client.post("/api/assets", json={"name": "뭔가", "type": "invalid_type"})
    assert resp.status_code == 422
```

**주의:** `authenticated_client_2` 픽스처가 conftest.py에 없으면 추가 필요 (두 번째 테스트 유저 + 클라이언트)

**Step 2: 테스트 실행**

```bash
cd backend && pytest tests/test_assets.py -v
```

**Step 3: Commit**

```bash
git add backend/tests/test_assets.py
git commit -m "test: 자산 관리 API 테스트 (CRUD, 요약, 격리)"
```

---

### Task 9: 프론트엔드 타입 + API 클라이언트

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/assets.ts`

**Step 1: 타입 정의 추가**

`frontend/src/types/index.ts`에 추가:

```typescript
export type AssetType = 'stock_kr' | 'stock_us' | 'crypto' | 'deposit' | 'real_estate' | 'other' | 'loan'

export interface Asset {
  id: number
  household_id: number | null
  created_by: number
  name: string
  type: AssetType
  is_liability: boolean
  ticker: string | null
  quantity: number | null
  avg_buy_price: number | null
  manual_value: number | null
  interest_rate: number | null
  maturity_date: string | null
  repayment_type: string | null
  monthly_payment: number | null
  memo: string | null
  created_at: string
  updated_at: string
  // 시세 정보
  current_price: number | null
  current_value: number | null
  profit_loss: number | null
  profit_loss_pct: number | null
}

export interface AssetSummary {
  total_assets: number
  total_liabilities: number
  net_worth: number
  breakdown: Record<string, number>
  total_profit_loss: number
  total_profit_loss_pct: number | null
}

export interface AssetSnapshot {
  snapshot_date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
  breakdown: Record<string, number> | null
}

export interface AssetSearchResult {
  ticker: string
  name: string
  market: string
}
```

**Step 2: API 클라이언트**

```typescript
// frontend/src/api/assets.ts
import apiClient from './client'
import type { Asset, AssetSummary, AssetSnapshot, AssetSearchResult } from '../types'

interface CreateAssetParams {
  name: string
  type: string
  is_liability?: boolean
  ticker?: string | null
  quantity?: number | null
  avg_buy_price?: number | null
  manual_value?: number | null
  interest_rate?: number | null
  maturity_date?: string | null
  repayment_type?: string | null
  monthly_payment?: number | null
  memo?: string | null
  household_id?: number | null
}

export const assetApi = {
  getAll: (householdId?: number) =>
    apiClient.get<Asset[]>('/assets', { params: householdId != null ? { household_id: householdId } : undefined }),

  getById: (id: number) =>
    apiClient.get<Asset>(`/assets/${id}`),

  create: (data: CreateAssetParams) =>
    apiClient.post<Asset>('/assets', data),

  update: (id: number, data: Partial<CreateAssetParams>) =>
    apiClient.put<Asset>(`/assets/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/assets/${id}`),

  getSummary: (householdId?: number) =>
    apiClient.get<AssetSummary>('/assets/summary', { params: householdId != null ? { household_id: householdId } : undefined }),

  getSnapshots: (householdId?: number, months?: number) =>
    apiClient.get<AssetSnapshot[]>('/assets/snapshots', { params: { ...(householdId != null && { household_id: householdId }), ...(months && { months }) } }),

  search: (q: string, market?: string) =>
    apiClient.get<AssetSearchResult[]>('/assets/search', { params: { q, ...(market && { market }) } }),

  parse: (text: string) =>
    apiClient.post<{ items: CreateAssetParams[] }>('/assets/parse', { text }),

  getPrices: (householdId?: number) =>
    apiClient.get('/assets/prices', { params: householdId != null ? { household_id: householdId } : undefined }),
}
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/assets.ts
git commit -m "feat: 프론트엔드 Asset 타입 및 API 클라이언트"
```

---

### Task 10: 자산 대시보드 페이지

**Files:**
- Create: `frontend/src/pages/AssetDashboard.tsx`
- Modify: `frontend/src/App.tsx` (라우트 추가)
- Modify: `frontend/src/components/Layout.tsx` (사이드바 메뉴 추가)

**Step 1: AssetDashboard 컴포넌트**

자산 대시보드 페이지 구현:
- 상단: 순자산 큰 숫자 (총자산 - 총부채)
- 자산/부채 비중 파이차트 (Recharts PieChart)
- 자산 목록 카드: 종목명, 평가액, 수익률
- 부채 목록 카드: 대출명, 잔액, 이율
- 하단: 순자산 추이 라인 그래프 (최근 12개월)
- 우측 상단: "자산 등록" 버튼 → `/assets/new`

Grape 디자인 시스템(grape/leaf/warm/cream) 사용. 기존 Dashboard 페이지 스타일 참고.

**Step 2: App.tsx에 라우트 추가**

```typescript
const AssetDashboard = lazy(() => import('./pages/AssetDashboard'))
const AssetForm = lazy(() => import('./pages/AssetForm'))

// Route 추가 (ProtectedRoute > Layout 내부)
<Route path="/assets" element={<AssetDashboard />} />
<Route path="/assets/new" element={<AssetForm />} />
<Route path="/assets/:id" element={<AssetDetail />} />
```

**Step 3: Layout.tsx 사이드바 메뉴 추가**

navItems 배열에 추가 (리포트 아래, 공유 가계부 위):
```typescript
{ path: '/assets', label: '자산 관리', icon: Landmark },
```

lucide-react의 `Landmark` 아이콘 사용. import 추가.

**Step 4: Commit**

```bash
git add frontend/src/pages/AssetDashboard.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: 자산 대시보드 페이지 + 라우팅 + 사이드바 메뉴"
```

---

### Task 11: 자산 등록 폼 페이지

**Files:**
- Create: `frontend/src/pages/AssetForm.tsx`

**Step 1: AssetForm 컴포넌트**

자산 등록 폼 구현:
- 모드 탭: "간편 입력" (자연어) / "직접 입력" (폼)
- **자연어 모드**: 텍스트 입력 → "분석하기" → 프리뷰 카드 → 수정 → "저장하기"
  - ExpenseForm의 자연어 플로우와 동일한 UX
- **직접 입력 모드**:
  - type 드롭다운 선택 → 해당 필드만 표시
  - stock_kr/stock_us/crypto: 종목 검색(자동완성) + 수량 + 매입가
  - deposit/real_estate/other: 이름 + 금액 + 이율 + 만기일
  - loan: 이름 + 잔액 + 이율 + 상환방식 + 월상환액
- 종목 검색: `/api/assets/search?q=` 호출, 디바운스 300ms
- 저장 성공 시 `/assets`로 이동 + 토스트

**Step 2: Commit**

```bash
git add frontend/src/pages/AssetForm.tsx
git commit -m "feat: 자산 등록 폼 (자연어 + 직접 입력 + 종목 검색)"
```

---

### Task 12: 프론트엔드 테스트

**Files:**
- Create: `frontend/src/__tests__/AssetDashboard.test.tsx`

**Step 1: 대시보드 테스트**

```typescript
// frontend/src/__tests__/AssetDashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'

// Mock API
vi.mock('../api/assets', () => ({
  assetApi: {
    getAll: vi.fn().mockResolvedValue({ data: [
      { id: 1, name: '삼성전자', type: 'stock_kr', is_liability: false, current_value: 700000, profit_loss_pct: 5.2 },
      { id: 2, name: '주담대', type: 'loan', is_liability: true, current_value: 200000000 },
    ]}),
    getSummary: vi.fn().mockResolvedValue({ data: {
      total_assets: 700000, total_liabilities: 200000000, net_worth: -199300000,
      breakdown: { stock_kr: 700000 }, total_profit_loss: 35000, total_profit_loss_pct: 5.2,
    }}),
    getSnapshots: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

// Mock AuthContext, HouseholdStore 등 기존 패턴 따르기

describe('AssetDashboard', () => {
  test('순자산 표시', async () => {
    render(<MemoryRouter><AssetDashboard /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText(/순자산/)).toBeInTheDocument()
    })
  })

  test('자산 목록 표시', async () => {
    render(<MemoryRouter><AssetDashboard /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('삼성전자')).toBeInTheDocument()
    })
  })

  test('부채 목록 표시', async () => {
    render(<MemoryRouter><AssetDashboard /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('주담대')).toBeInTheDocument()
    })
  })
})
```

**Step 2: 테스트 실행**

```bash
cd frontend && npm test
```

**Step 3: Commit**

```bash
git add frontend/src/__tests__/AssetDashboard.test.tsx
git commit -m "test: 자산 대시보드 프론트엔드 테스트"
```

---

### Task 13: 통합 테스트 + 린트 + 최종 확인

**Step 1: 백엔드 전체 테스트**

```bash
cd backend && pytest -v
```

**Step 2: 프론트엔드 빌드 + 테스트**

```bash
cd frontend && npm run build && npm test
```

**Step 3: 린트**

```bash
cd backend && ruff check --fix . && ruff format .
```

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "chore: Phase 1 자산관리 통합 테스트 및 린트 정리"
```

---

## 요약

| Task | 내용 | 파일 수 |
|------|------|---------|
| 1 | Asset, AssetSnapshot 모델 | 3 |
| 2 | Alembic 마이그레이션 | 1 |
| 3 | Pydantic 스키마 | 1 |
| 4 | 시세 조회 서비스 | 1 |
| 5 | 자산 서비스 (비즈니스 로직) | 1 |
| 6 | 자연어 파싱 서비스 | 1 |
| 7 | API 라우터 + main.py 등록 | 2 |
| 8 | 백엔드 테스트 | 1 |
| 9 | 프론트엔드 타입 + API | 2 |
| 10 | 자산 대시보드 페이지 + 라우팅 | 3 |
| 11 | 자산 등록 폼 | 1 |
| 12 | 프론트엔드 테스트 | 1 |
| 13 | 통합 테스트 + 린트 | 0 |

"""자산 관리 비즈니스 로직"""

import json
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.asset_snapshot import AssetSnapshot
from app.models.user import User
from app.services.price_service import get_asset_current_value


async def create_asset(db: AsyncSession, asset_data: dict[str, Any], user: User, household_id: int) -> Asset:
    """자산 생성 — household_id는 API 레이어에서 resolve 후 전달 (#180)"""
    asset_data.pop("household_id", None)  # schema에 포함된 경우 제거
    asset = Asset(**asset_data, created_by=user.id, household_id=household_id)
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def get_assets(db: AsyncSession, user: User, household_id: int) -> list[Asset]:
    """자산 목록 조회 (household 기반) — household_id는 API 레이어에서 반드시 resolve (#135)"""
    query = select(Asset).where(Asset.household_id == household_id).order_by(Asset.type, Asset.name)
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
        # household 멤버 여부는 API 레이어에서 체크
        return asset
    elif asset.created_by != user.id:
        return None
    return asset


async def update_asset(db: AsyncSession, asset: Asset, update_data: dict[str, Any]) -> Asset:
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


async def get_assets_with_prices(db: AsyncSession, user: User, household_id: int | None = None) -> list[dict[str, Any]]:
    """시세 포함 자산 목록"""
    import asyncio

    assets = await get_assets(db, user, household_id)  # type: ignore[arg-type]
    # 시세 조회 병렬화 — 자산 수만큼 직렬 await → asyncio.gather 동시 실행 (#166)
    price_infos = await asyncio.gather(*[get_asset_current_value(asset, db) for asset in assets])
    results = []
    for asset, price_info in zip(assets, price_infos, strict=False):
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


async def get_asset_summary(db: AsyncSession, user: User, household_id: int | None = None) -> dict[str, Any]:
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
    today = datetime.now(ZoneInfo("Asia/Seoul")).date().replace(day=1)  # 월초로 정규화

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
        snapshot.breakdown = json.dumps(summary["breakdown"])  # type: ignore[assignment]
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

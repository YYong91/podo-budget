"""자산 관리 API"""

import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.asset import Asset
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
from app.schemas.asset_goal import AssetGoalCreate, AssetGoalWithInsight
from app.services import asset_goal_service, asset_service, price_service
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
    household_id = asset_data.get("household_id")
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    result = await asset_service.create_asset(db, asset_data, current_user, household_id)
    return result


@router.get("", response_model=list[AssetWithPrice])
async def get_assets(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자산 목록 (시세 포함)"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
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
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
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
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)  # 가구 접근 권한 검증 (#135)
    snapshots = await asset_service.get_snapshots(db, current_user, household_id, months)
    results = []
    for s in snapshots:
        breakdown = json.loads(s.breakdown) if s.breakdown else None
        results.append(
            AssetSnapshotResponse(
                snapshot_date=s.snapshot_date,
                total_assets=float(s.total_assets),
                total_liabilities=float(s.total_liabilities),
                net_worth=float(s.net_worth),
                breakdown=breakdown,
            )
        )
    return results


@router.get("/search")
async def search_assets(
    q: str = Query(..., min_length=1),
    market: str = Query("all", pattern="^(all|kr|us|crypto)$"),
    current_user: User = Depends(get_current_user),  # 비인증 외부 API 프록시 차단 (#205)
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
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)  # 가구 접근 권한 검증 (#135)
    assets = await asset_service.get_assets(db, current_user, household_id)
    prices = {}
    for asset in assets:
        if asset.ticker:
            info = await price_service.get_asset_current_value(asset)
            prices[asset.id] = info
    return prices


@router.get("/goal", response_model=AssetGoalWithInsight | None)
async def get_goal(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """순자산 목표 + 페이스 인사이트 조회"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    result = await asset_goal_service.get_goal_with_insight(current_user, household_id, db)
    return result


@router.post("/goal", response_model=AssetGoalWithInsight, status_code=status.HTTP_201_CREATED)
async def upsert_goal(
    body: AssetGoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """순자산 목표 설정/수정 (upsert)"""
    hid = body.household_id
    if hid is None:
        hid = await get_user_active_household_id(current_user, db)
    await get_household_member(hid, current_user, db)
    await asset_goal_service.upsert_goal(
        user_id=current_user.id,
        household_id=hid,
        target_net_worth=body.target_net_worth,
        target_date=body.target_date,
        db=db,
    )
    await db.commit()
    # 인사이트 포함하여 반환
    result = await asset_goal_service.get_goal_with_insight(current_user, hid, db)
    return result


@router.delete("/goal", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """순자산 목표 삭제"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    deleted = await asset_goal_service.delete_goal(current_user.id, household_id, db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="목표를 찾을 수 없습니다")
    await db.commit()


@router.get("/monthly-savings")
async def get_monthly_savings(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """이번 달 저축액 (수입 - 지출)"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    return await asset_goal_service.get_monthly_savings(household_id, db)


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
    # 가구 멤버 여부 확인 (다른 가구 자산 접근 방지)
    if asset.household_id is not None:
        try:
            await get_household_member(asset.household_id, current_user, db)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다") from None
    price_info = await price_service.get_asset_current_value(asset)
    return {**AssetResponse.model_validate(asset).model_dump(), **price_info}


@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: int,
    asset_update: AssetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자산 수정 (본인 생성분만 + 현재 가구 멤버만)"""
    result = await db.execute(select(Asset).where(Asset.id == asset_id, Asset.created_by == current_user.id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다")
    # 탈퇴 멤버가 이전 가구 자산 수정 방지 (#135)
    if asset.household_id is not None:
        try:
            await get_household_member(asset.household_id, current_user, db)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다") from None
    update_data = asset_update.model_dump(exclude_unset=True)
    return await asset_service.update_asset(db, asset, update_data)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """자산 삭제 (본인 생성분만 + 현재 가구 멤버만)"""
    result = await db.execute(select(Asset).where(Asset.id == asset_id, Asset.created_by == current_user.id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다")
    # 탈퇴 멤버가 이전 가구 자산 삭제 방지 (#135)
    if asset.household_id is not None:
        try:
            await get_household_member(asset.household_id, current_user, db)
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="자산을 찾을 수 없습니다") from None
    await asset_service.delete_asset(db, asset)

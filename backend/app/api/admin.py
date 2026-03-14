"""Admin 대시보드 API 라우트

시스템 전체 통계 조회와 사용자 관리 기능을 제공합니다.
모든 엔드포인트는 ADMIN_USER_ID 사용자만 접근 가능합니다.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminUserDetailResponse,
    AdminUserListResponse,
    AdminUserUpdateRequest,
    FeedbackStatsResponse,
    HouseholdStatsResponse,
    OverviewStatsResponse,
    TransactionStatsResponse,
)
from app.services import admin_service

router = APIRouter()


@router.get("/stats/overview", response_model=OverviewStatsResponse)
async def get_overview_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """사용자 현황 통계 — 총 유저, DAU/MAU, 신규 가입, 리텐션"""
    return await admin_service.get_overview_stats(db)


@router.get("/stats/transactions", response_model=TransactionStatsResponse)
async def get_transaction_stats(
    days: int = Query(30, ge=1, le=365, description="조회 기간 (일)"),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """거래 통계 — 일별 추이, 카테고리 분포, 평균 금액"""
    return await admin_service.get_transaction_stats(db, days=days)


@router.get("/stats/households", response_model=HouseholdStatsResponse)
async def get_household_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """가구 현황 통계 — 가구 수, 멤버 분포, 초대 현황"""
    return await admin_service.get_household_stats(db)


@router.get("/stats/feedback", response_model=FeedbackStatsResponse)
async def get_feedback_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """피드백 통계 — 상태별/유형별 분포"""
    return await admin_service.get_feedback_stats(db)


@router.get("/users", response_model=AdminUserListResponse)
async def get_user_list(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: str | None = Query(None, description="이름/이메일 검색"),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """사용자 목록 조회 (페이지네이션, 검색)"""
    return await admin_service.get_user_list(db, page=page, page_size=page_size, search=search)


@router.get("/users/{user_id}", response_model=AdminUserDetailResponse)
async def get_user_detail(
    user_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """사용자 상세 정보 조회"""
    result = await admin_service.get_user_detail(db, user_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다",
        )
    return result


@router.patch("/users/{user_id}", response_model=AdminUserDetailResponse)
async def update_user(
    user_id: int,
    data: AdminUserUpdateRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """사용자 정보 수정 (활성/비활성 토글)"""
    success = await admin_service.update_user(db, user_id, is_active=data.is_active)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다",
        )
    # 수정 후 상세 정보 반환
    result = await admin_service.get_user_detail(db, user_id)
    return result

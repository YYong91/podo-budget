"""Admin 대시보드 API 라우트

운영 중심 대시보드 통합 통계 조회와 사용자 관리 기능을 제공합니다.
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
    DashboardStatsResponse,
)
from app.services import admin_service

router = APIRouter()


@router.get("/stats/dashboard", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """운영 대시보드 통합 현황 — 헬스카드, 최근 활동 피드, 이탈 감지"""
    return await admin_service.get_dashboard_stats(db)


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

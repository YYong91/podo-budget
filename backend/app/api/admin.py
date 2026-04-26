"""Admin 대시보드 API 라우트

운영 중심 대시보드 통합 통계 조회와 사용자 관리 기능을 제공합니다.
모든 엔드포인트는 ADMIN_USER_ID 사용자만 접근 가능합니다.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy import select as sa_select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.monthly_report import MonthlyReport
from app.models.user import User
from app.schemas.admin import (
    AdminUserDetailResponse,
    AdminUserListResponse,
    AdminUserUpdateRequest,
    DashboardStatsResponse,
)
from app.services import admin_service
from app.services.report_scheduler import phase1_enqueue_pending, phase2_process_pending

router = APIRouter()


@router.get("/stats/dashboard", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> object:
    """운영 대시보드 통합 현황 — 헬스카드, 최근 활동 피드, 이탈 감지"""
    return await admin_service.get_dashboard_stats(db)


@router.get("/users", response_model=AdminUserListResponse)
@limiter.limit("30/minute")  # 토큰 탈취 시 대량 조회 방지 (#234)
async def get_user_list(
    request: Request,
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: str | None = Query(None, description="이름/이메일 검색"),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> object:
    """사용자 목록 조회 (페이지네이션, 검색)"""
    return await admin_service.get_user_list(db, page=page, page_size=page_size, search=search)


@router.get("/users/{user_id}", response_model=AdminUserDetailResponse)
async def get_user_detail(
    user_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> object:
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
) -> object:
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


@router.post("/reports/{report_id}/retry", status_code=200)
async def retry_report(
    report_id: int,
    background_tasks: BackgroundTasks,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """failed/pending 상태 리포트 LLM 재시도"""
    report = await db.scalar(sa_select(MonthlyReport).where(MonthlyReport.id == report_id))
    if not report:
        raise HTTPException(status_code=404, detail="리포트를 찾을 수 없습니다")
    if report.status not in ("failed", "pending"):
        raise HTTPException(status_code=400, detail=f"재시도 불가 상태: {report.status}")

    report.status = "pending"
    report.attempt_count = 0
    await db.commit()

    background_tasks.add_task(phase2_process_pending, report.month)
    return {"id": report_id, "status": "retrying"}


@router.post("/reports/manual-trigger", status_code=200)
async def manual_trigger_reports(
    background_tasks: BackgroundTasks,
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """특정 월 결산 리포트 수동 생성 (디버깅/초기 배포용)"""
    queued = await phase1_enqueue_pending(db, month)
    background_tasks.add_task(phase2_process_pending, month)
    return {"queued": queued, "month": month}

"""피드백 API 라우트

사용자가 기능 요청이나 버그 신고를 제출하고,
관리자(ADMIN_USER_ID)가 전체 피드백을 조회/상태 변경할 수 있습니다.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.feedback import Feedback
from app.models.user import User
from app.schemas.feedback import FeedbackCreate, FeedbackResponse, FeedbackStatusUpdate

router = APIRouter()


def _to_response(feedback: Feedback, username: str | None = None) -> FeedbackResponse:
    """Feedback ORM 객체를 응답 스키마로 변환"""
    return FeedbackResponse(
        id=feedback.id,
        user_id=feedback.user_id,
        type=feedback.type,
        title=feedback.title,
        content=feedback.content,
        status=feedback.status,
        username=username,
        created_at=feedback.created_at,
        updated_at=feedback.updated_at,
    )


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    data: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """피드백 제출 — 인증된 유저 누구나"""
    feedback = Feedback(
        user_id=current_user.id,
        type=data.type,
        title=data.title,
        content=data.content,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return _to_response(feedback, username=current_user.username)


@router.get("/mine", response_model=list[FeedbackResponse])
async def get_my_feedbacks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내가 보낸 피드백 목록"""
    result = await db.execute(select(Feedback).where(Feedback.user_id == current_user.id).order_by(Feedback.created_at.desc()))
    feedbacks = result.scalars().all()
    return [_to_response(f, username=current_user.username) for f in feedbacks]


@router.get("", response_model=list[FeedbackResponse])
async def get_all_feedbacks(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """전체 피드백 조회 — 관리자(ADMIN_USER_ID)만"""
    if current_user.id != settings.ADMIN_USER_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자만 접근할 수 있습니다",
        )
    result = await db.execute(
        select(Feedback, User.username).join(User, Feedback.user_id == User.id).order_by(Feedback.created_at.desc()).offset(skip).limit(limit)
    )
    rows = result.all()
    return [_to_response(f, username=username) for f, username in rows]


@router.patch("/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback_status(
    feedback_id: int,
    data: FeedbackStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """피드백 상태 변경 — 관리자만"""
    if current_user.id != settings.ADMIN_USER_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자만 접근할 수 있습니다",
        )
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="피드백을 찾을 수 없습니다",
        )
    feedback.status = data.status
    await db.commit()
    await db.refresh(feedback)

    # username 조회
    user_result = await db.execute(select(User.username).where(User.id == feedback.user_id))
    username = user_result.scalar_one_or_none()
    return _to_response(feedback, username=username)

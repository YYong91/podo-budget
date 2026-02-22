"""인증 관련 API 라우트

podo-auth SSO 연동 후 자체 인증 엔드포인트는 제거되었습니다.
- 로그인/회원가입: auth.podonest.com 으로 리다이렉트 (프론트엔드에서 처리)
- GET /me: 현재 로그인한 사용자 정보 조회 (podo-auth JWT 검증 후 Shadow User 반환)
- POST /telegram-link-code: 텔레그램 연동 코드 발급 (15분 유효)
- DELETE /telegram/link: 텔레그램 연동 해제
"""

import secrets
import string
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import MessageResponse, TelegramLinkCodeResponse, UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회

    podo-auth JWT를 검증하고 로컬 Shadow User 정보를 반환합니다.
    Authorization: Bearer <token> 헤더가 필요합니다.

    Returns:
        현재 사용자 정보 (로컬 Integer ID 포함)
    """
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "is_telegram_linked": current_user.telegram_chat_id is not None,
    }


@router.post("/telegram-link-code", response_model=TelegramLinkCodeResponse)
async def generate_telegram_link_code(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """텔레그램 연동용 단기 코드 발급 (15분 유효)

    재발급 시 이전 코드를 덮어씁니다.

    Returns:
        연동 코드와 만료 시각
    """
    code = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    expires_at = datetime.now(UTC) + timedelta(minutes=15)
    current_user.telegram_link_code = code
    current_user.telegram_link_code_expires_at = expires_at
    await db.commit()
    return TelegramLinkCodeResponse(code=code, expires_at=expires_at)


@router.delete("/telegram/link", response_model=MessageResponse)
async def unlink_telegram(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """텔레그램 연동 해제

    telegram_chat_id와 연동 코드를 모두 초기화합니다.

    Returns:
        성공 메시지
    """
    current_user.telegram_chat_id = None
    current_user.telegram_link_code = None
    current_user.telegram_link_code_expires_at = None
    await db.commit()
    return MessageResponse(message="텔레그램 연동이 해제되었습니다.")

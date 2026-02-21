"""인증 관련 API 라우트

podo-auth SSO 연동 후 자체 인증 엔드포인트는 제거되었습니다.
- 로그인/회원가입: auth.podonest.com 으로 리다이렉트 (프론트엔드에서 처리)
- GET /me: 현재 로그인한 사용자 정보 조회 (podo-auth JWT 검증 후 Shadow User 반환)
"""

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.models.user import User
from app.schemas.auth import UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회

    podo-auth JWT를 검증하고 로컬 Shadow User 정보를 반환합니다.
    Authorization: Bearer <token> 헤더가 필요합니다.

    Returns:
        현재 사용자 정보 (로컬 Integer ID 포함)
    """
    return current_user

"""인증 관련 Pydantic 스키마

podo-auth SSO 연동 후 사용되는 응답 DTO들입니다.
자체 로그인/회원가입은 podo-auth에서 처리하므로 요청 스키마가 없습니다.
"""

from datetime import datetime

from pydantic import BaseModel


class UserResponse(BaseModel):
    """사용자 정보 응답 스키마

    비밀번호 같은 민감 정보는 제외하고 반환합니다.
    """

    id: int
    username: str
    email: str | None
    is_active: bool
    created_at: datetime
    is_telegram_linked: bool = False  # 텔레그램 연동 여부

    class Config:
        from_attributes = True  # SQLAlchemy 모델을 Pydantic으로 변환 허용


class MessageResponse(BaseModel):
    """간단한 메시지 응답 스키마"""

    message: str


class TelegramLinkCodeResponse(BaseModel):
    """텔레그램 연동 코드 응답"""

    code: str
    expires_at: datetime

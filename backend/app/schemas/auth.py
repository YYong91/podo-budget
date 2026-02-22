"""인증 관련 Pydantic 스키마

JWT 인증에 사용되는 요청/응답 DTO들입니다.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """회원가입 요청 스키마

    Attributes:
        username: 닉네임 (1-50자)
        password: 비밀번호 (8자 이상)
        email: 이메일 주소 (필수, 로그인에 사용)
    """

    username: str = Field(..., min_length=1, max_length=50, description="닉네임")
    password: str = Field(..., min_length=8, description="비밀번호 (8자 이상)")
    email: EmailStr = Field(..., description="이메일 (로그인에 사용)")


class LoginRequest(BaseModel):
    """로그인 요청 스키마"""

    email: EmailStr = Field(..., description="이메일")
    password: str = Field(..., description="비밀번호")


class TokenResponse(BaseModel):
    """JWT 토큰 응답 스키마

    Attributes:
        access_token: JWT 액세스 토큰 (Bearer 방식으로 사용)
        token_type: 토큰 타입 (항상 "bearer")
    """

    access_token: str = Field(..., description="JWT 액세스 토큰")
    token_type: str = Field(default="bearer", description="토큰 타입")


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


class ForgotPasswordRequest(BaseModel):
    """비밀번호 찾기 요청 스키마"""

    email: EmailStr = Field(..., description="등록된 이메일 주소")


class ResetPasswordRequest(BaseModel):
    """비밀번호 재설정 요청 스키마"""

    token: str = Field(..., description="비밀번호 재설정 토큰")
    new_password: str = Field(..., min_length=8, description="새 비밀번호 (8자 이상)")


class MessageResponse(BaseModel):
    """간단한 메시지 응답 스키마"""

    message: str


class TelegramLinkCodeResponse(BaseModel):
    """텔레그램 연동 코드 응답"""

    code: str
    expires_at: datetime

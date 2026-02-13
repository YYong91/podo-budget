"""인증 관련 Pydantic 스키마

JWT 인증에 사용되는 요청/응답 DTO들입니다.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    """회원가입 요청 스키마

    Attributes:
        username: 사용자명 (3-50자, 영문/숫자/언더스코어)
        password: 비밀번호 (8자 이상)
        email: 이메일 주소 (선택, 가구 초대 시스템용)
    """

    username: str = Field(..., min_length=3, max_length=50, description="사용자명")
    password: str = Field(..., min_length=8, description="비밀번호 (8자 이상)")
    email: str | None = Field(None, max_length=255, description="이메일 (선택, 가구 초대용)")


class LoginRequest(BaseModel):
    """로그인 요청 스키마"""

    username: str = Field(..., description="사용자명")
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

    class Config:
        from_attributes = True  # SQLAlchemy 모델을 Pydantic으로 변환 허용

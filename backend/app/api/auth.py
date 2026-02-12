"""인증 관련 API 라우트

회원가입, 로그인, 사용자 정보 조회 엔드포인트를 제공합니다.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, get_current_user, hash_password, verify_password
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserCreate, UserResponse

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """회원가입

    새 사용자를 생성합니다. 비밀번호는 bcrypt로 해싱되어 저장됩니다.

    Args:
        user_data: 사용자명과 비밀번호
        db: 데이터베이스 세션

    Returns:
        생성된 사용자 정보 (비밀번호 제외)

    Raises:
        HTTPException 400: 이미 존재하는 사용자명
    """
    # 중복 사용자명 체크
    result = await db.execute(select(User).where(User.username == user_data.username))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 사용자명입니다",
        )

    # 비밀번호 해싱 후 사용자 생성
    hashed_pw = hash_password(user_data.password)
    new_user = User(username=user_data.username, hashed_password=hashed_pw)

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return new_user


@router.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """로그인

    사용자명과 비밀번호로 인증하고 JWT 액세스 토큰을 발급합니다.

    Args:
        login_data: 사용자명과 비밀번호
        db: 데이터베이스 세션

    Returns:
        JWT 액세스 토큰 (유효기간 7일)

    Raises:
        HTTPException 401: 사용자명 또는 비밀번호가 틀린 경우
    """
    # 사용자 조회
    result = await db.execute(select(User).where(User.username == login_data.username))
    user = result.scalar_one_or_none()

    # 사용자 없음 또는 비밀번호 불일치
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자명 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 비활성 계정 체크
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다",
        )

    # JWT 토큰 생성 (sub 클레임에 사용자명 저장)
    access_token = create_access_token(data={"sub": user.username})

    return TokenResponse(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회

    JWT 토큰으로 인증된 사용자의 정보를 반환합니다.
    Authorization: Bearer <token> 헤더가 필요합니다.

    Args:
        current_user: JWT 토큰에서 추출한 사용자 (의존성 주입)

    Returns:
        현재 사용자 정보
    """
    return current_user

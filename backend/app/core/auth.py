"""JWT 인증 및 비밀번호 해싱

Clean Architecture의 Infrastructure 계층에 해당하는 인증 유틸리티입니다.
JWT 토큰 생성/검증, 비밀번호 해싱/검증을 담당합니다.
"""

from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

# 비밀번호 해싱 컨텍스트 (bcrypt 알고리즘 사용)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT 설정
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7일

# HTTPBearer 스키마 (Authorization: Bearer <token>)
security = HTTPBearer()


def hash_password(password: str) -> str:
    """평문 비밀번호를 bcrypt로 해싱

    Args:
        password: 평문 비밀번호

    Returns:
        bcrypt 해시 문자열 (DB에 저장할 값)
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """평문 비밀번호와 해시를 비교 검증

    Args:
        plain_password: 사용자가 입력한 평문 비밀번호
        hashed_password: DB에 저장된 해시값

    Returns:
        일치하면 True, 불일치하면 False
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """JWT 액세스 토큰 생성

    Args:
        data: 토큰 payload에 담을 데이터 (보통 {"sub": username})
        expires_delta: 토큰 만료 시간 (None이면 기본값 7일 사용)

    Returns:
        서명된 JWT 토큰 문자열
    """
    to_encode = data.copy()

    # 만료 시간 설정
    expire = datetime.now(UTC) + (expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

    to_encode.update({"exp": expire})

    # JWT 서명 및 인코딩
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """JWT 토큰에서 현재 사용자 추출 (의존성 주입용)

    FastAPI Depends()에서 사용하여 인증이 필요한 엔드포인트를 보호합니다.
    Authorization: Bearer <token> 헤더에서 토큰을 추출하고,
    토큰을 검증한 후 DB에서 사용자를 조회합니다.

    Args:
        credentials: HTTPBearer에서 추출한 토큰
        db: 데이터베이스 세션

    Returns:
        인증된 User 객체

    Raises:
        HTTPException: 토큰이 유효하지 않거나 사용자를 찾을 수 없는 경우 401
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # JWT 디코딩 및 검증
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")

        if username is None:
            raise credentials_exception

    except JWTError as err:
        raise credentials_exception from err

    # DB에서 사용자 조회
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    # 비활성화된 계정 체크
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다",
        )

    return user


def create_password_reset_token(email: str) -> str:
    """비밀번호 재설정용 JWT 토큰 생성 (1시간 만료)"""
    expire = datetime.now(UTC) + timedelta(hours=1)
    return jwt.encode(
        {"sub": email, "type": "password_reset", "exp": expire},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )


def verify_password_reset_token(token: str) -> str | None:
    """비밀번호 재설정 토큰 검증, 유효하면 이메일 반환"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            return None
        return payload.get("sub")
    except JWTError:
        return None

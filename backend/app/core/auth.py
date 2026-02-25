"""podo-auth SSO 인증 모듈 (Shadow User 패턴)

podo-auth에서 발급된 JWT를 검증하고, 로컬 users 테이블의 Shadow User를 조회/생성합니다.
기존 Integer PK 기반 FK 관계를 모두 보존하면서 SSO를 지원합니다.

플로우:
  1. podo-auth JWT 검증 (JWT_SECRET으로 서명 확인, iss="podo-auth" 검증)
  2. auth_user_id (podo-auth TSID BigInt)로 로컬 User 조회
  3. 없으면 email로 기존 유저 매칭 시도 (기존 데이터 연결)
  4. 둘 다 없으면 새 로컬 유저 자동 생성
  5. 기존 FK 관계는 users.id (Integer)로 그대로 유지
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from jose import jwt as pyjwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

# HTTPBearer 스키마 (auto_error=False → 토큰 없을 때 None 반환, 직접 401 처리)
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """podo-auth JWT에서 로컬 Shadow User 추출 (의존성 주입용)

    Args:
        credentials: HTTPBearer에서 추출한 podo-auth JWT
        db: 데이터베이스 세션

    Returns:
        로컬 User 객체 (기존 Integer PK 보존)

    Raises:
        HTTPException 401: 토큰 유효하지 않거나 유저 생성/조회 실패
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    try:
        token = credentials.credentials
        payload = pyjwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])

        # podo-auth 발급 토큰인지 검증
        if payload.get("iss") != "podo-auth":
            raise credentials_exception

        auth_user_id_str: str = payload.get("sub")
        email: str = payload.get("email")
        name: str = payload.get("name", "")

        if not auth_user_id_str or not email:
            raise credentials_exception

        auth_user_id = int(auth_user_id_str)

    except (JWTError, ValueError) as err:
        raise credentials_exception from err

    # 1단계: auth_user_id로 기존 Shadow User 조회
    result = await db.execute(select(User).where(User.auth_user_id == auth_user_id))
    user = result.scalar_one_or_none()

    if user:
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정입니다")
        return user

    # 2단계: email로 기존 유저 매칭 (기존 데이터 보존)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        # 기존 유저에 auth_user_id 연결
        user.auth_user_id = auth_user_id
        await db.commit()
        await db.refresh(user)
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정입니다")
        return user

    # 3단계: 완전히 새로운 유저 자동 생성
    new_user = User(
        auth_user_id=auth_user_id,
        username=name or email.split("@")[0],
        email=email,
        hashed_password=None,  # SSO 유저는 로컬 패스워드 없음
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

"""Supabase Auth 인증 모듈 (Shadow User 패턴) — ES256 JWKS 검증

Supabase에서 발급된 JWT를 JWKS 공개키로 검증하고,
로컬 users 테이블의 Shadow User를 조회/생성합니다.

플로우:
  1. Supabase JWKS에서 ES256 공개키 가져오기 (캐시)
  2. JWT 서명 검증 + audience=authenticated 확인
  3. auth_user_id (Supabase UUID)로 로컬 User 조회
  4. 없으면 email로 기존 유저 매칭 → 없으면 자동 생성
"""

import asyncio
import logging
from time import monotonic

import httpx
from cachetools import TTLCache
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from jose import jwt as pyjwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# JWT 사용자 캐시: auth_user_id(str) → local user.id (TTL 60초)
_auth_id_cache: TTLCache[str, int] = TTLCache(maxsize=1024, ttl=60)

# JWKS 공개키 캐시 (TTL 1시간 — 키 로테이션 대응)
_jwks_cache: dict | None = None
_jwks_cache_url: str = ""
_jwks_cache_time: float = 0.0
_JWKS_TTL_SECONDS = 3600  # 1시간
_jwks_lock = asyncio.Lock()


async def _get_jwks_key(token: str) -> dict:
    """Supabase JWKS에서 JWT kid에 매칭되는 공개키를 가져온다. TTL 1시간 캐시."""
    global _jwks_cache, _jwks_cache_url, _jwks_cache_time

    jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    now = monotonic()

    # 캐시 히트 (TTL 이내 + kid 매칭)
    if _jwks_cache and _jwks_cache_url == jwks_url and (now - _jwks_cache_time) < _JWKS_TTL_SECONDS:
        header = pyjwt.get_unverified_header(token)
        for key in _jwks_cache.get("keys", []):
            if key.get("kid") == header.get("kid"):
                return key

    # JWKS fetch (동시 요청 중 하나만 실행)
    async with _jwks_lock:
        # 락 획득 후 다시 확인 (다른 코루틴이 이미 fetch했을 수 있음)
        if _jwks_cache and _jwks_cache_url == jwks_url and (now - _jwks_cache_time) < _JWKS_TTL_SECONDS:
            header = pyjwt.get_unverified_header(token)
            for key in _jwks_cache.get("keys", []):
                if key.get("kid") == header.get("kid"):
                    return key

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(jwks_url)
            resp.raise_for_status()
            jwks_data = resp.json()
            if "keys" not in jwks_data:
                raise ValueError("JWKS 응답에 keys 필드가 없음")
            _jwks_cache = jwks_data
            _jwks_cache_url = jwks_url
            _jwks_cache_time = monotonic()

    header = pyjwt.get_unverified_header(token)
    for key in _jwks_cache.get("keys", []):
        if key.get("kid") == header.get("kid"):
            return key

    raise ValueError(f"JWKS에서 kid={header.get('kid')} 키를 찾을 수 없음")


async def _decode_token(token: str) -> dict:
    """JWT 토큰을 디코드한다. Supabase JWKS ES256 공개키로 검증."""
    jwk_key = await _get_jwks_key(token)
    return pyjwt.decode(
        token,
        jwk_key,
        algorithms=["ES256"],
        audience="authenticated",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Supabase JWT에서 로컬 Shadow User 추출 (의존성 주입용)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    try:
        token = credentials.credentials

        # JWT 디코드 (ES256 JWKS 검증)
        payload = await _decode_token(token)

        auth_user_id: str = payload.get("sub", "")
        email: str = payload.get("email", "")

        # 이름: user_metadata.name 또는 user_metadata.full_name
        user_metadata = payload.get("user_metadata", {}) or {}
        name: str = user_metadata.get("name", "") or user_metadata.get("full_name", "")

        # Supabase 토큰만 허용 (role=authenticated)
        if not auth_user_id or not email or payload.get("role") != "authenticated":
            raise credentials_exception

    except (JWTError, ValueError, httpx.HTTPError) as err:
        logger.warning("JWT 검증 실패: %s", err)
        raise credentials_exception from err

    # 캐시 히트
    if auth_user_id in _auth_id_cache:
        user = await db.get(User, _auth_id_cache[auth_user_id])
        if user:
            if not user.is_active:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정입니다")
            return user
        del _auth_id_cache[auth_user_id]

    # 1단계: auth_user_id로 기존 Shadow User 조회
    result = await db.execute(select(User).where(User.auth_user_id == auth_user_id))
    user = result.scalar_one_or_none()

    if user:
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정입니다")
        _auth_id_cache[auth_user_id] = user.id
        return user

    # 2단계: email로 기존 유저 매칭
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        logger.info(
            "Shadow User 이메일 매칭으로 Supabase 계정 연결: user_id=%s email=%s auth_user_id=%s",
            user.id,
            email,
            auth_user_id,
        )
        user.auth_user_id = auth_user_id
        await db.commit()
        await db.refresh(user)
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정입니다")
        _auth_id_cache[auth_user_id] = user.id
        return user

    # 3단계: 새 유저 자동 생성
    from sqlalchemy.exc import IntegrityError

    new_user = User(
        auth_user_id=auth_user_id,
        username=name or email.split("@")[0],
        email=email,
        hashed_password=None,
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
        _auth_id_cache[auth_user_id] = new_user.id
        return new_user
    except IntegrityError:
        await db.rollback()
        result = await db.execute(select(User).where(User.auth_user_id == auth_user_id))
        user = result.scalar_one_or_none()
        if user:
            _auth_id_cache[auth_user_id] = user.id
            return user
        raise credentials_exception from None

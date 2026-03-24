"""Rate Limiting 유틸리티

slowapi를 사용하여 API 호출 빈도를 제한합니다.
LLM API 호출 엔드포인트에 적용하여 과도한 요청을 방지합니다.

Clean Architecture의 Infrastructure 계층에 해당하며,
JWT 토큰에서 사용자 ID를 추출하여 사용자별 제한을 적용합니다.
"""

from fastapi import Request
from jose import JWTError
from jose import jwt as pyjwt
from slowapi import Limiter

from app.core.config import settings

# JWT 알고리즘은 settings에서 단일 관리 — 하드코딩 금지 (#163)


def get_user_identifier(request: Request) -> str:
    """요청에서 사용자 식별자를 추출하는 key function

    Rate limiting의 키로 사용할 식별자를 반환합니다.

    프로세스:
    1. Authorization 헤더에서 JWT 토큰 추출 시도
    2. 토큰이 유효하면 sub(username) 클레임을 식별자로 사용
    3. 토큰이 없거나 유효하지 않으면 IP 주소를 식별자로 사용

    Args:
        request: FastAPI Request 객체

    Returns:
        사용자 식별자 문자열 (username 또는 IP)

    Note:
        인증되지 않은 요청은 IP 기반 제한이 적용되므로,
        동일 IP에서 여러 사용자가 접근하면 제한이 공유될 수 있습니다.
    """
    # Authorization 헤더에서 JWT 토큰 추출 시도
    auth_header = request.headers.get("Authorization")

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")

        try:
            # Supabase JWT 디코딩 및 사용자 ID(sub) 추출
            payload = pyjwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            # Supabase 인증 토큰만 허용
            if payload.get("role") == "authenticated":
                user_id = payload.get("sub")
                if user_id:
                    # 인증된 사용자는 auth_user_id를 식별자로 사용
                    return f"user:{user_id}"

        except JWTError:
            # 토큰이 유효하지 않으면 IP로 폴백
            pass

    # 인증되지 않은 요청은 IP 주소를 식별자로 사용
    # Fly-Client-IP: Fly.io 프록시가 설정하는 실제 클라이언트 IP (클라이언트 조작 불가, #132)
    # X-Forwarded-For는 클라이언트가 임의 값을 주입할 수 있어 rate limit 우회에 악용됨
    fly_client_ip = request.headers.get("Fly-Client-IP")
    client_ip = fly_client_ip or (request.client.host if request.client else "unknown")

    return f"ip:{client_ip}"


# slowapi Limiter 인스턴스 생성
# key_func: 각 요청에서 식별자를 추출하는 함수
limiter = Limiter(key_func=get_user_identifier)

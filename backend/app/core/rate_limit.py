"""Rate Limiting 유틸리티

slowapi를 사용하여 API 호출 빈도를 제한합니다.
LLM API 호출 엔드포인트에 적용하여 과도한 요청을 방지합니다.

Clean Architecture의 Infrastructure 계층에 해당하며,
JWT 토큰에서 사용자 ID를 추출하여 사용자별 제한을 적용합니다.
"""

from fastapi import Request
from jose import JWTError, jwt
from slowapi import Limiter

from app.core.config import settings

# JWT 설정 (app/core/auth.py와 동일)
ALGORITHM = "HS256"


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
            # podo-auth JWT 디코딩 및 사용자 ID(sub) 추출
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
            # podo-auth 발급 토큰만 허용
            if payload.get("iss") == "podo-auth":
                user_id = payload.get("sub")
                if user_id:
                    # 인증된 사용자는 auth_user_id를 식별자로 사용
                    return f"user:{user_id}"

        except JWTError:
            # 토큰이 유효하지 않으면 IP로 폴백
            pass

    # 인증되지 않은 요청은 IP 주소를 식별자로 사용
    # X-Forwarded-For 헤더를 먼저 확인 (프록시/로드밸런서 뒤에 있을 때)
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")

    return f"ip:{client_ip}"


# slowapi Limiter 인스턴스 생성
# key_func: 각 요청에서 식별자를 추출하는 함수
limiter = Limiter(key_func=get_user_identifier)

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api import auth, budget, categories, chat, expenses, households, insights, invitations, kakao, telegram
from app.core.config import settings
from app.core.database import Base, engine
from app.core.exceptions import register_exception_handlers
from app.core.rate_limit import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작 및 종료 시 실행되는 lifespan 이벤트 핸들러

    시작 시:
    - 모든 모델 임포트로 SQLAlchemy 메타데이터 초기화
    - 데이터베이스 테이블 생성
    - SECRET_KEY 검증 (프로덕션 환경에서 필수)

    종료 시:
    - 리소스 정리 (현재는 없음)
    """
    import app.models  # noqa: F811, F401

    # SECRET_KEY 검증 (작업 4)
    if not settings.SECRET_KEY or settings.SECRET_KEY == "change-this-in-production":  # pragma: allowlist secret
        if not settings.DEBUG:
            raise RuntimeError("프로덕션 환경에서 SECRET_KEY를 반드시 설정해야 합니다")
        else:
            import warnings

            warnings.warn("SECRET_KEY가 설정되지 않았습니다. 프로덕션에서는 반드시 강력한 키를 설정하세요.", stacklevel=2)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# slowapi의 limiter를 FastAPI app에 등록
app.state.limiter = limiter

# CORS 설정 — 환경 변수에서 허용할 오리진 목록을 읽어옴
# 프로덕션에서는 와일드카드(*) 대신 명시적인 도메인 리스트를 사용해야 합니다
allowed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# 전역 에러 핸들러 등록
register_exception_handlers(app)


# Rate Limit 초과 시 한국어 에러 응답 핸들러
@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Rate limit 초과 시 한국어 에러 메시지 반환

    slowapi의 기본 핸들러를 오버라이드하여 사용자 친화적인 한국어 메시지를 제공합니다.

    Args:
        request: FastAPI Request 객체
        exc: RateLimitExceeded 예외

    Returns:
        429 Too Many Requests 응답 (한국어 메시지)
    """
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
            "error": "rate_limit_exceeded",
        },
    )


# API 라우터 등록
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(budget.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["expenses"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])
app.include_router(kakao.router, prefix="/api/kakao", tags=["kakao"])
app.include_router(households.router, prefix="/api/households", tags=["households"])
app.include_router(invitations.router, prefix="/api/invitations", tags=["invitations"])


@app.get("/")
async def root():
    return {
        "message": "Welcome to HomeNRich API",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """
    헬스체크 엔드포인트
    Fly.io 및 로드밸런서가 사용
    """
    return {"status": "healthy"}


@app.get("/health/db")
async def health_db():
    """
    DB 연결 체크 (상세 진단용)
    프로덕션에서는 내부 네트워크에서만 접근하도록 제한 권장
    """
    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            await session.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

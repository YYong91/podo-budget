import logging
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api import (
    accounts,
    admin,
    assets,
    auth,
    budget,
    categories,
    chat,
    e2e,
    expenses,
    feedback,
    households,
    income,
    insights,
    invitations,
    kakao,
    onboarding,
    payment_methods,
    recurring,
    stocks,
    telegram,
    webhooks,
)
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import register_exception_handlers
from app.core.rate_limit import limiter


def _setup_logging() -> None:
    """로그 레벨 설정 — DEBUG 모드에서는 DEBUG, 프로덕션에서는 INFO (#244)"""
    level = logging.DEBUG if settings.DEBUG else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


_setup_logging()  # 모듈 임포트 시 설정

# Sentry 초기화 — DSN이 설정된 경우에만 활성화
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        traces_sample_rate=1.0 if settings.DEBUG else 0.2,
        profiles_sample_rate=1.0 if settings.DEBUG else 0.1,
        send_default_pii=False,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """애플리케이션 시작 및 종료 시 실행되는 lifespan 이벤트 핸들러

    시작 시:
    - 모든 모델 임포트로 SQLAlchemy 메타데이터 초기화
    - Alembic 마이그레이션 실행 (신규 설치: 전체 스키마 생성, 기존: 증분 적용)
    - SECRET_KEY 검증 (프로덕션 환경에서 필수)

    종료 시:
    - 리소스 정리 (현재는 없음)
    """
    import app.models as _models  # noqa: F811, F401

    # JWT_SECRET 검증 (podo-auth SSO 연동)
    if settings.JWT_SECRET == "podo-jwt-secret-change-in-production":  # pragma: allowlist secret
        if not settings.DEBUG:
            raise RuntimeError("프로덕션 환경에서 JWT_SECRET을 반드시 설정해야 합니다")
        else:
            import warnings

            warnings.warn("JWT_SECRET이 기본값입니다. 프로덕션에서는 podo-auth와 동일한 JWT_SECRET을 설정하세요.", stacklevel=2)

    # Telegram 봇 웹훅 시크릿 미설정 경고
    if settings.TELEGRAM_BOT_TOKEN and not settings.TELEGRAM_WEBHOOK_SECRET:
        import warnings

        warnings.warn("TELEGRAM_WEBHOOK_SECRET이 설정되지 않았습니다. 웹훅 엔드포인트가 인증 없이 열려 있습니다.", stacklevel=2)

    # Alembic 마이그레이션 실행 — create_all 대신 사용해 기존 DB에도 스키마 변경 적용
    # asyncio.to_thread로 별도 스레드에서 실행하여 nested event loop 충돌 방지
    # (lifespan은 async context → alembic_command.upgrade 내부 asyncio.run() 충돌)
    import asyncio
    import logging
    import pathlib

    from alembic import command as alembic_command
    from alembic.config import Config as AlembicConfig

    logger = logging.getLogger(__name__)

    try:
        alembic_dir = pathlib.Path(__file__).parent.parent
        alembic_ini = alembic_dir / "alembic.ini"
        alembic_cfg = AlembicConfig(str(alembic_ini))
        alembic_cfg.set_main_option("script_location", str(alembic_dir / "alembic"))
        await asyncio.to_thread(alembic_command.upgrade, alembic_cfg, "head")
        logger.info("Alembic 마이그레이션 완료")
    except Exception:
        logger.exception("Alembic 마이그레이션 실패 — 앱은 기동하지만 스키마가 불일치할 수 있음")
    finally:
        # 마이그레이션 후 alembic 모듈 언로드 — ~10MB 회수
        import gc
        import sys as _sys

        del alembic_command, AlembicConfig
        for mod_name in [m for m in _sys.modules if m.startswith("alembic") or m.startswith("mako")]:
            del _sys.modules[mod_name]
        gc.collect()

    # sort_order=0인 카테고리를 실제 사용 횟수(지출+수입)로 초기화
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.execute(
            text("""
                UPDATE categories
                SET sort_order = (
                    SELECT COUNT(*) FROM expenses WHERE expenses.category_id = categories.id
                ) + (
                    SELECT COUNT(*) FROM incomes WHERE incomes.category_id = categories.id
                )
                WHERE sort_order = 0
            """)
        )

    yield

    # shutdown: 공유 httpx 클라이언트 정리
    from app.services.price_service import close_http_client

    await close_http_client()


# OpenAPI 태그별 설명 (#253)
_OPENAPI_TAGS = [
    {"name": "auth", "description": "podo-auth SSO 연동 — 로그인 콜백, 토큰 갱신, 소셜 계정 연동"},
    {"name": "households", "description": "가구(Household) 관리 — 생성, 조회, 멤버 초대/탈퇴"},
    {"name": "invitations", "description": "가구 초대 — 초대 링크 생성, 수락"},
    {"name": "onboarding", "description": "신규 사용자 온보딩 — 가구 상태 확인, 첫 가구 생성"},
    {"name": "expenses", "description": "지출 CRUD — 자연어 파싱 프리뷰, 직접 입력, 월간 통계"},
    {"name": "income", "description": "수입 CRUD — 자연어 파싱 프리뷰, 직접 입력, 월간 통계"},
    {"name": "categories", "description": "카테고리 관리 — 지출/수입 카테고리 CRUD, 사용 빈도 정렬"},
    {"name": "budgets", "description": "예산 — 월별 카테고리 예산 설정, 달성률 조회"},
    {"name": "recurring", "description": "정기 거래 — 구독/월세 등 정기 지출·수입 관리, 실행/건너뛰기"},
    {"name": "assets", "description": "자산 관리 — 자산 CRUD, 순자산 스냅샷, 자산 목표"},
    {"name": "accounts", "description": "계좌/카드 — 결제 수단 관리"},
    {"name": "insights", "description": "AI 재무 인사이트 — 월간 소비 패턴 분석, LLM 기반 조언"},
    {"name": "chat", "description": "자연어 채팅 — 지출·수입 자연어 입력 처리 (LLM 파싱)"},
    {"name": "telegram", "description": "텔레그램 봇 — 웹훅, 계정 연동 코드 발급"},
    {"name": "kakao", "description": "카카오 봇 — 카카오 채널 자연어 지출·수입 입력"},
    {"name": "webhooks", "description": "외부 웹훅 — 텔레그램/카카오 이벤트 수신"},
    {"name": "feedback", "description": "사용자 피드백 — 앱 내 피드백 제출"},
    {"name": "stocks", "description": "종목 검색 — 한국 주식/ETF 종목 한글명·티커 검색 (DB 기반)"},
    {"name": "admin", "description": "관리자 전용 — 사용자 목록, 피드백 관리 (admin 권한 필요)"},
]

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "포도가계부 REST API\n\n"
        '자연어 입력(예: "오늘 점심 8000원")을 LLM이 자동 분류·저장하는 AI 가계부.\n\n'
        "## 인증\n"
        "모든 API는 podo-auth SSO JWT를 사용합니다. "
        "`Authorization: Bearer <token>` 헤더 또는 `podo_access_token` 쿠키로 전달하세요.\n\n"
        "## 에러 형식\n"
        '모든 에러 응답은 `{"error": {"code": "...", "message": "..."}}` 형식을 따릅니다.'
    ),
    version="0.7.0",
    contact={"name": "포도가계부 팀", "url": "https://budget.podonest.com"},
    debug=settings.DEBUG,
    lifespan=lifespan,
    openapi_tags=_OPENAPI_TAGS,
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


# Request ID + 타이밍 미들웨어 — 모든 응답에 X-Request-ID + 처리 시간 로깅 (#244)
@app.middleware("http")
async def add_request_id(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    import time

    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]
    start = time.monotonic()
    response = await call_next(request)
    elapsed_ms = (time.monotonic() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{elapsed_ms:.0f}ms"
    # /health, /docs 등은 로깅 생략
    path = request.url.path
    if path.startswith("/api/") and elapsed_ms > 500:
        logging.getLogger("perf").warning(
            "SLOW %s %s → %dms [%s]",
            request.method,
            path,
            elapsed_ms,
            request_id,
        )
    return response


# 보안 헤더 미들웨어 — 모든 응답에 필수 보안 헤더 추가 (#235)
@app.middleware("http")
async def add_security_headers(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # HSTS는 프로덕션(HTTPS) 환경에서만 설정 (로컬 HTTP 개발 지원)
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# 전역 에러 핸들러 등록  # type: ignore[no-untyped-def]
register_exception_handlers(app)


# Rate Limit 초과 시 한국어 에러 응답 핸들러
@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded) -> object:
    """Rate limit 초과 시 한국어 에러 메시지 반환

    slowapi의 기본 핸들러를 오버라이드하여 사용자 친화적인 한국어 메시지를 제공합니다.  # type: ignore[no-untyped-def]

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
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])
app.include_router(kakao.router, prefix="/api/kakao", tags=["kakao"])
app.include_router(households.router, prefix="/api/households", tags=["households"])
app.include_router(income.router, prefix="/api/income", tags=["income"])
app.include_router(invitations.router, prefix="/api/invitations", tags=["invitations"])
app.include_router(recurring.router, prefix="/api/recurring", tags=["recurring"])
app.include_router(assets.router, prefix="/api/assets", tags=["assets"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(payment_methods.router, prefix="/api/payment-methods", tags=["payment-methods"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(stocks.router, prefix="/api/stocks", tags=["stocks"])
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])

# E2E 테스트 전용 — 라우터는 항상 등록하되, 각 엔드포인트에서 DEBUG 모드를 검사
# (DEBUG=False면 404 반환하므로 프로덕션 보안 영향 없음, 테스트 접근성 보장)
app.include_router(e2e.router, prefix="/api", tags=["e2e"])


@app.get("/")
async def root() -> object:
    return {"message": "Welcome to 포도가계부 API"}


@app.get("/health")
async def health() -> object:
    """
    헬스체크 엔드포인트
    Fly.io 및 로드밸런서가 사용
    """
    return {"status": "healthy"}


@app.get("/health/llm")
async def health_llm() -> object:
    """LLM 프로바이더 헬스체크 (#254)

    프로바이더 인스턴스 생성 가능 여부 + 인메모리 메트릭 요약 반환.
    실패 시 503 응답.
    """
    from app.core.metrics import get_metrics_summary
    from app.services.llm_service import get_llm_provider

    try:
        provider = get_llm_provider()
        provider_name = type(provider).__name__
        # LLM 관련 메트릭만 필터링
        all_metrics = get_metrics_summary()
        llm_metrics = {k: v for k, v in all_metrics.items() if k.startswith("llm.")}
        return {
            "status": "healthy",
            "provider": provider_name,
            "metrics": llm_metrics,
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)},
        )


@app.get("/health/external")
async def health_external() -> object:
    """외부 API 헬스체크 (#254)

    인메모리 메트릭 기반으로 외부 API 상태 요약 반환.
    실제 API 호출 없이 기록된 메트릭만 표시.
    """
    from app.core.metrics import get_metrics_summary

    all_metrics = get_metrics_summary()
    external_metrics = {k: v for k, v in all_metrics.items() if k.startswith("external.")}

    if not external_metrics:
        return {"status": "no_data", "metrics": {}}

    # 실패가 1건이라도 있으면 degraded
    has_failure = any(m["failure"] > 0 for m in external_metrics.values())  # type: ignore[operator]
    status = "degraded" if has_failure else "healthy"

    return {"status": status, "metrics": external_metrics}


@app.get("/health/db")
async def health_db() -> object:
    """
    DB 연결 체크 (상세 진단용)
    프로덕션에서는 내부 네트워크에서만 접근하도록 제한 권장
    """
    from sqlalchemy import text

    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected"},
        )

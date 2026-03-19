from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

LLMProviderType = Literal["openai", "anthropic", "google", "local"]


class Settings(BaseSettings):
    APP_NAME: str = "포도가계부"
    DEBUG: bool = False
    SECRET_KEY: str = ""  # 레거시 호환성 유지 (lifespan에서 검증)

    # podo-auth SSO 연동
    JWT_SECRET: str = "podo-jwt-secret-change-in-production"  # pragma: allowlist secret
    JWT_ALGORITHM: str = "HS256"
    AUTH_SERVER_URL: str = "https://auth.podonest.com"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/db.sqlite3"

    # LLM — 기본 프로바이더/모델 (모든 기능에 적용)
    LLM_PROVIDER: LLMProviderType = "anthropic"
    LLM_MODEL: str = ""  # 빈 문자열이면 프로바이더 기본 모델 사용

    # LLM — 기능별 오버라이드 (설정하면 해당 기능에만 적용, 미설정 시 기본값 사용)
    LLM_PROVIDER_PARSE: LLMProviderType | None = None
    LLM_MODEL_PARSE: str = ""
    LLM_PROVIDER_INSIGHTS: LLMProviderType | None = None
    LLM_MODEL_INSIGHTS: str = ""
    LLM_PROVIDER_OCR: LLMProviderType | None = None
    LLM_MODEL_OCR: str = ""

    # API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_SECRET: str = ""  # setWebhook의 secret_token과 일치해야 함

    # 한국투자증권 Open API (시세 조회)
    KIS_APPKEY: str = ""
    KIS_APPSECRET: str = ""

    # KakaoTalk Bot
    KAKAO_BOT_API_KEY: str = ""

    # Sentry 에러 트래킹 (DSN 미설정 시 비활성화)
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_WEBHOOK_SECRET: str = ""  # Sentry → 텔레그램 알림 webhook 인증용
    SENTRY_ALERT_CHAT_ID: str = ""  # Sentry 알림 수신할 텔레그램 채팅 ID

    # 관리자 설정
    ADMIN_USER_ID: int = 1  # 피드백 관리 등 관리자 기능용 사용자 ID

    # CORS — 허용할 프론트엔드 오리진 (쉼표로 구분)
    CORS_ORIGINS: str = "http://localhost:5173,https://budget.podonest.com"

    # Email (Resend) — 빈 문자열이면 이메일 발송 비활성화
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "포도가계부 <noreply@podonest.com>"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )


settings = Settings()

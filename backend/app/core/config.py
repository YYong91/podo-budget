import logging
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_settings_logger = logging.getLogger(__name__)

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

    # 관리자 설정 — 기본값 -1은 "미설정" 의미 (DB에 존재하지 않는 ID)
    # .env에서 실제 사용자 ID를 설정하지 않으면 관리자 기능이 비활성화됨
    ADMIN_USER_ID: int = -1

    # CORS — 허용할 프론트엔드 오리진 (쉼표로 구분)
    # 기본값은 프로덕션 도메인만. 로컬 개발 시 .env에서 http://localhost:5173 추가
    CORS_ORIGINS: str = "https://budget.podonest.com"

    # Email (Resend) — 빈 문자열이면 이메일 발송 비활성화
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "포도가계부 <noreply@podonest.com>"

    @model_validator(mode="after")
    def validate_llm_config(self) -> "Settings":
        """LLM 프로바이더 설정 교차 검증 (#242)"""
        provider = self.LLM_PROVIDER
        if provider == "openai" and not self.OPENAI_API_KEY:
            _settings_logger.warning("LLM_PROVIDER=openai 이지만 OPENAI_API_KEY가 설정되지 않았습니다")
        elif provider == "anthropic" and not self.ANTHROPIC_API_KEY:
            _settings_logger.warning("LLM_PROVIDER=anthropic 이지만 ANTHROPIC_API_KEY가 설정되지 않았습니다")
        elif provider == "google" and not self.GOOGLE_API_KEY:
            _settings_logger.warning("LLM_PROVIDER=google 이지만 GOOGLE_API_KEY가 설정되지 않았습니다")

        # CORS wildcard 경고
        if self.CORS_ORIGINS == "*":
            _settings_logger.warning("CORS_ORIGINS='*' — 모든 오리진 허용 중. 프로덕션 환경에서는 특정 도메인을 지정하세요.")

        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )


settings = Settings()

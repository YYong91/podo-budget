from typing import Literal

from pydantic_settings import BaseSettings

LLMProviderType = Literal["openai", "anthropic", "google", "local"]


class Settings(BaseSettings):
    APP_NAME: str = "HomeNRich"
    DEBUG: bool = True
    SECRET_KEY: str = "change-this-in-production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://homenrich:homenrich@localhost:5432/homenrich"  # pragma: allowlist secret

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

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

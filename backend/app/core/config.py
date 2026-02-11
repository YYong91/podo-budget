from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "HomeNRich"
    DEBUG: bool = True
    SECRET_KEY: str = "change-this-in-production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://homenrich:homenrich@localhost:5432/homenrich"  # pragma: allowlist secret

    # LLM
    LLM_PROVIDER: Literal["openai", "anthropic", "local"] = "anthropic"
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

"""
Config 설정 테스트

- Settings 클래스의 기본값 및 환경변수 로딩 검증
- Pydantic BaseSettings 동작 확인
"""

from unittest.mock import patch

import pytest

from app.core.config import Settings


def test_settings_default_values():
    """Settings 기본값 테스트"""
    with patch.dict("os.environ", {}, clear=True):
        settings = Settings()

        assert settings.APP_NAME == "HomeNRich"
        assert settings.DEBUG is True
        assert settings.SECRET_KEY == ""  # 프로덕션에서는 반드시 설정 필요
        assert settings.LLM_PROVIDER == "anthropic"
        assert "postgresql+asyncpg" in settings.DATABASE_URL


def test_settings_from_env():
    """환경변수로부터 설정 로딩 테스트"""
    env = {
        "APP_NAME": "TestApp",
        "DEBUG": "False",
        "SECRET_KEY": "test-secret",  # pragma: allowlist secret
        "LLM_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-test",  # pragma: allowlist secret
        "TELEGRAM_BOT_TOKEN": "123456:ABC",
    }

    with patch.dict("os.environ", env, clear=True):
        settings = Settings()

        assert settings.APP_NAME == "TestApp"
        assert settings.DEBUG is False
        assert settings.SECRET_KEY == "test-secret"
        assert settings.LLM_PROVIDER == "openai"
        assert settings.OPENAI_API_KEY == "sk-test"
        assert settings.TELEGRAM_BOT_TOKEN == "123456:ABC"


def test_llm_provider_literal_type():
    """LLM_PROVIDER가 Literal 타입으로 제한되는지 테스트"""
    # 유효한 값
    with patch.dict("os.environ", {"LLM_PROVIDER": "anthropic"}, clear=True):
        settings = Settings()
        assert settings.LLM_PROVIDER == "anthropic"

    with patch.dict("os.environ", {"LLM_PROVIDER": "openai"}, clear=True):
        settings = Settings()
        assert settings.LLM_PROVIDER == "openai"

    with patch.dict("os.environ", {"LLM_PROVIDER": "local"}, clear=True):
        settings = Settings()
        assert settings.LLM_PROVIDER == "local"

    # 잘못된 값 (Pydantic이 ValidationError 발생시킴)
    with patch.dict("os.environ", {"LLM_PROVIDER": "invalid"}, clear=True), pytest.raises((ValueError, Exception)):
        Settings()


def test_settings_case_sensitive():
    """Config.case_sensitive=True로 인해 대소문자 구분"""
    # 소문자 환경변수는 무시됨
    with patch.dict("os.environ", {"app_name": "lowercase"}, clear=True):
        settings = Settings()
        assert settings.APP_NAME == "HomeNRich"  # 기본값 유지

    # 대문자 환경변수는 반영됨
    with patch.dict("os.environ", {"APP_NAME": "UPPERCASE"}, clear=True):
        settings = Settings()
        assert settings.APP_NAME == "UPPERCASE"


def test_database_url_default():
    """DATABASE_URL 기본값 검증"""
    with patch.dict("os.environ", {}, clear=True):
        settings = Settings()
        assert "postgresql+asyncpg" in settings.DATABASE_URL
        assert "homenrich" in settings.DATABASE_URL
        assert "5432" in settings.DATABASE_URL

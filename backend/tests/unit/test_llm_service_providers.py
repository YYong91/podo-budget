"""LLM 서비스 프로바이더별 테스트 (#363)

OpenAI, Google 프로바이더 경로 + get_llm_provider 팩토리 심층 검증.
기능별 오버라이드, 응답 파싱 실패, 에러 처리.
"""

import importlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm_service import (
    AnthropicProvider,
    GoogleProvider,
    LocalLLMProvider,
    OpenAIProvider,
    _create_provider,
    _resolve_provider_and_model,
    get_llm_provider,
)

_has_openai = importlib.util.find_spec("openai") is not None


# ── get_llm_provider 팩토리 ───────────────────────────────────


@pytest.fixture(autouse=True)
def _clear_provider_cache():
    """테스트마다 프로바이더 캐시 초기화"""
    from app.services import llm_service

    llm_service._provider_cache.clear()
    yield
    llm_service._provider_cache.clear()


def test_get_llm_provider_google():
    """LLM_PROVIDER=google → GoogleProvider"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "google"
        mock_settings.LLM_MODEL = ""
        mock_settings.GOOGLE_API_KEY = "test-key"

        provider = get_llm_provider()
        assert isinstance(provider, GoogleProvider)


def test_get_llm_provider_caching():
    """같은 설정이면 동일 인스턴스 반환 (캐싱)"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "google"
        mock_settings.LLM_MODEL = ""

        p1 = get_llm_provider()
        p2 = get_llm_provider()
        assert p1 is p2


def test_get_llm_provider_different_features():
    """기능별 다른 프로바이더 반환"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "anthropic"
        mock_settings.LLM_MODEL = ""
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret
        mock_settings.LLM_PROVIDER_PARSE = "google"
        mock_settings.LLM_MODEL_PARSE = ""
        mock_settings.GOOGLE_API_KEY = "test-key"

        default = get_llm_provider()
        parse = get_llm_provider("parse")

        assert isinstance(default, AnthropicProvider)
        assert isinstance(parse, GoogleProvider)


# ── _resolve_provider_and_model ───────────────────────────────


def test_resolve_default():
    """feature=None이면 기본 설정 사용"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "anthropic"
        mock_settings.LLM_MODEL = "claude-3-haiku"

        provider, model = _resolve_provider_and_model()
        assert provider == "anthropic"
        assert model == "claude-3-haiku"


def test_resolve_feature_override_provider():
    """기능별 프로바이더 오버라이드"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "anthropic"
        mock_settings.LLM_MODEL = ""
        mock_settings.LLM_PROVIDER_PARSE = "openai"
        mock_settings.LLM_MODEL_PARSE = "gpt-4o"

        provider, model = _resolve_provider_and_model("parse")
        assert provider == "openai"
        assert model == "gpt-4o"


def test_resolve_feature_override_model_only():
    """기능별 모델만 오버라이드 (프로바이더는 기본값)"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "anthropic"
        mock_settings.LLM_MODEL = ""
        mock_settings.LLM_PROVIDER_INSIGHTS = None
        mock_settings.LLM_MODEL_INSIGHTS = "claude-3-opus"

        provider, model = _resolve_provider_and_model("insights")
        assert provider == "anthropic"
        assert model == "claude-3-opus"


def test_resolve_feature_no_override():
    """기능별 오버라이드가 없으면 기본값 사용"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "anthropic"
        mock_settings.LLM_MODEL = "default-model"
        mock_settings.LLM_PROVIDER_OCR = None
        mock_settings.LLM_MODEL_OCR = ""

        provider, model = _resolve_provider_and_model("ocr")
        assert provider == "anthropic"
        assert model == "default-model"


# ── _create_provider ──────────────────────────────────────────


def test_create_provider_unknown():
    """알 수 없는 프로바이더 → ValueError"""
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        _create_provider("nonexistent", "model")


def test_create_provider_local():
    """local 프로바이더 생성"""
    provider = _create_provider("local", "llama3.1")
    assert isinstance(provider, LocalLLMProvider)
    assert provider.model == "llama3.1"


# ── OpenAI Provider ───────────────────────────────────────────


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_missing_amount():
    """OpenAI 파싱 결과에 amount 없으면 에러"""
    mock_choice = MagicMock()
    mock_choice.message.content = '{"category": "식비", "description": "점심"}'
    mock_choice.finish_reason = "stop"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("점심 먹음")
            assert "error" in result
            assert result["error"] == "금액을 찾을 수 없습니다"


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_max_tokens_exceeded():
    """OpenAI max_tokens 초과(finish_reason=length) → 사용자 친화적 에러"""
    mock_choice = MagicMock()
    mock_choice.message.content = '[{"amount": 8000'  # 잘린 JSON
    mock_choice.finish_reason = "length"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("매우 긴 입력..." * 50)
            assert "error" in result
            assert "날짜별로" in result["error"]


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_json_decode_error():
    """OpenAI 응답이 유효하지 않은 JSON → JSONDecodeError 발생

    NOTE: JSONDecodeError는 ValueError의 하위 클래스이므로
    except ValueError에서 먼저 잡히고 re-raise된다 (기존 동작).
    """
    import json

    mock_choice = MagicMock()
    mock_choice.message.content = "이것은 JSON이 아닙니다"
    mock_choice.finish_reason = "stop"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            # JSONDecodeError는 ValueError 하위 클래스 → except ValueError에서 re-raise
            with pytest.raises(json.JSONDecodeError):
                await provider.parse_expense("테스트")


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_api_error():
    """OpenAI API 호출 실패 → 재시도 후 에러"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.side_effect = RuntimeError("API down")
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("테스트")
            assert "error" in result
            assert "LLM 서비스 오류" in result["error"]


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_invalid_list_item():
    """OpenAI 여러 지출 파싱 — 리스트 항목이 dict가 아닌 경우"""
    mock_choice = MagicMock()
    mock_choice.message.content = '[{"amount": 8000}, "invalid"]'
    mock_choice.finish_reason = "stop"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("여러 항목")
            assert "error" in result
            assert result["error"] == "잘못된 형식입니다"


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_list_missing_amount():
    """OpenAI 여러 지출 파싱 — 리스트 항목에 amount 없음"""
    mock_choice = MagicMock()
    mock_choice.message.content = '[{"amount": 8000, "category": "식비"}, {"category": "교통비"}]'
    mock_choice.finish_reason = "stop"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("점심 8천원, 택시")
            assert "error" in result
            assert "금액" in result["error"]


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_non_dict_non_list():
    """OpenAI 응답이 dict/list가 아닌 경우 (예: 숫자, 문자열)"""
    mock_choice = MagicMock()
    mock_choice.message.content = "12345"
    mock_choice.finish_reason = "stop"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("테스트")
            assert "error" in result
            assert result["error"] == "잘못된 형식입니다"


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_error_response():
    """OpenAI 파싱 결과에 error 키가 있으면 그대로 반환"""
    mock_choice = MagicMock()
    mock_choice.message.content = '{"error": "이해할 수 없습니다"}'
    mock_choice.finish_reason = "stop"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("???")
            assert result["error"] == "이해할 수 없습니다"


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_generate_insights_api_error():
    """OpenAI 인사이트 생성 API 실패 → 에러 메시지 반환"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.side_effect = RuntimeError("API down")
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.generate_insights({"total": 50000})
            assert "오류가 발생했습니다" in result


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_generate_insights_max_tokens_warning():
    """OpenAI 인사이트 생성 시 max_tokens 초과 경고"""
    mock_choice = MagicMock()
    mock_choice.message.content = "# 분석 결과 (잘림)"
    mock_choice.finish_reason = "length"  # max_tokens 초과
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.generate_insights({"total": 50000})
            # 경고만 로깅하고 결과는 반환
            assert result == "# 분석 결과 (잘림)"


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_generate_success():
    """OpenAI generate() 성공"""
    mock_choice = MagicMock()
    mock_choice.message.content = "생성된 텍스트"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.generate("프롬프트")
            assert result == "생성된 텍스트"


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_generate_api_error():
    """OpenAI generate() API 실패 → 빈 문자열"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.side_effect = RuntimeError("API down")
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.generate("프롬프트")
            assert result == ""


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_image_not_implemented():
    """OpenAI parse_image() → NotImplementedError"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI"):
            provider = OpenAIProvider()
            with pytest.raises(NotImplementedError):
                await provider.parse_image(b"fake_image", "image/jpeg")


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_generate_comprehensive_insights():
    """OpenAI generate_comprehensive_insights() 성공"""
    import json

    structured = {"summary": "분석 결과", "score": 75}
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps(structured, ensure_ascii=False)
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.generate_comprehensive_insights({"month": "2026-03"})
            assert result["summary"] == "분석 결과"
            assert result["score"] == 75


# ── Google Provider ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_google_provider_default_model():
    """Google 프로바이더 기본 모델 확인"""
    provider = GoogleProvider()
    assert provider.model == "gemini-2.0-flash"


@pytest.mark.asyncio
async def test_google_provider_custom_model():
    """Google 프로바이더 커스텀 모델"""
    provider = GoogleProvider(model="gemini-pro")
    assert provider.model == "gemini-pro"


@pytest.mark.asyncio
async def test_google_provider_api_key():
    """Google 프로바이더 API 키 설정"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.GOOGLE_API_KEY = "google-test-key"
        provider = GoogleProvider()
        assert provider.api_key == "google-test-key"


# ── Anthropic Provider 추가 ──────────────────────────────────


@pytest.mark.asyncio
async def test_anthropic_parse_expense_json_decode_error():
    """Anthropic 응답이 유효하지 않은 JSON → JSONDecodeError 발생

    NOTE: JSONDecodeError는 ValueError의 하위 클래스이므로
    except ValueError에서 먼저 잡히고 re-raise된다 (기존 동작).
    """
    import json

    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text="이것은 JSON이 아닙니다")]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            # JSONDecodeError는 ValueError 하위 클래스 → except ValueError에서 re-raise
            with pytest.raises(json.JSONDecodeError):
                await provider.parse_expense("테스트")


@pytest.mark.asyncio
async def test_anthropic_parse_expense_api_error():
    """Anthropic API 호출 실패 → 재시도 후 에러"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.side_effect = RuntimeError("API down")
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("테스트")
            assert "error" in result
            assert "LLM 서비스 오류" in result["error"]


@pytest.mark.asyncio
async def test_anthropic_parse_expense_non_dict_non_list():
    """Anthropic 응답이 dict/list가 아닌 경우"""
    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text='"just a string"')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("테스트")
            assert "error" in result
            assert result["error"] == "잘못된 형식입니다"


@pytest.mark.asyncio
async def test_anthropic_parse_expense_list_invalid_item():
    """Anthropic 여러 지출 — 리스트 항목이 dict가 아닌 경우"""
    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text='[{"amount": 8000}, 42]')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("테스트")
            assert "error" in result
            assert result["error"] == "잘못된 형식입니다"


@pytest.mark.asyncio
async def test_anthropic_parse_expense_list_missing_amount():
    """Anthropic 여러 지출 — 리스트 항목에 amount 없음"""
    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text='[{"amount": 8000}, {"category": "교통비"}]')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("테스트")
            assert "error" in result
            assert "금액" in result["error"]


@pytest.mark.asyncio
async def test_anthropic_generate_insights_api_error():
    """Anthropic 인사이트 생성 API 실패 → 에러 메시지 반환"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.side_effect = RuntimeError("API down")
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.generate_insights({"total": 50000})
            assert "오류가 발생했습니다" in result


@pytest.mark.asyncio
async def test_anthropic_generate_insights_max_tokens():
    """Anthropic 인사이트 max_tokens 초과 → 경고만, 결과 반환"""
    mock_response = MagicMock()
    mock_response.stop_reason = "max_tokens"
    mock_response.content = [MagicMock(text="# 잘린 분석")]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.generate_insights({"total": 50000})
            assert result == "# 잘린 분석"


@pytest.mark.asyncio
async def test_anthropic_generate_api_error():
    """Anthropic generate() API 실패 → 빈 문자열"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.side_effect = RuntimeError("API down")
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.generate("프롬프트")
            assert result == ""


@pytest.mark.asyncio
async def test_anthropic_generate_comprehensive_insights_no_tool_use():
    """Anthropic generate_comprehensive_insights — tool_use 블록 없으면 ValueError"""
    mock_block = MagicMock()
    mock_block.type = "text"

    mock_response = MagicMock()
    mock_response.content = [mock_block]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            with pytest.raises(ValueError, match="구조화된 응답"):
                await provider.generate_comprehensive_insights({"month": "2026-03"})


@pytest.mark.asyncio
async def test_anthropic_generate_comprehensive_insights_success():
    """Anthropic generate_comprehensive_insights — tool_use 블록에서 JSON 추출"""
    mock_block = MagicMock()
    mock_block.type = "tool_use"
    mock_block.input = {"summary": "좋은 결과", "score": 80}

    mock_response = MagicMock()
    mock_response.content = [mock_block]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.generate_comprehensive_insights({"month": "2026-03"})
            assert result["summary"] == "좋은 결과"
            assert result["score"] == 80


# ── Anthropic parse_image 추가 ────────────────────────────────


@pytest.mark.asyncio
async def test_anthropic_parse_image_success():
    """Anthropic parse_image() 성공"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"amount": 25000, "description": "스타벅스"}')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_image(b"fake_image_bytes", "image/jpeg")
            assert result["amount"] == 25000
            assert result["description"] == "스타벅스"


@pytest.mark.asyncio
async def test_anthropic_parse_image_error_response():
    """Anthropic parse_image() — LLM이 에러 반환"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"error": "이미지를 인식할 수 없습니다"}')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_image(b"fake", "image/png")
            assert result["error"] == "이미지를 인식할 수 없습니다"


@pytest.mark.asyncio
async def test_anthropic_parse_image_missing_amount():
    """Anthropic parse_image() — amount 없으면 에러"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"description": "스타벅스"}')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_image(b"fake", "image/png")
            assert "error" in result


@pytest.mark.asyncio
async def test_anthropic_parse_image_list():
    """Anthropic parse_image() — 여러 항목 리스트"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='[{"amount": 5000, "description": "커피"}, {"amount": 3000, "description": "빵"}]')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_image(b"fake", "image/png")
            assert isinstance(result, list)
            assert len(result) == 2


@pytest.mark.asyncio
async def test_anthropic_parse_image_json_error():
    """Anthropic parse_image() — JSON 파싱 실패"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="not json")]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_image(b"fake", "image/png")
            assert "error" in result
            assert result["error"] == "응답을 파싱할 수 없습니다"


@pytest.mark.asyncio
async def test_anthropic_parse_image_api_error():
    """Anthropic parse_image() — API 호출 실패"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.side_effect = RuntimeError("Vision API down")
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_image(b"fake", "image/png")
            assert "error" in result
            assert "이미지 인식 오류" in result["error"]


@pytest.mark.asyncio
async def test_anthropic_parse_image_non_dict_non_list():
    """Anthropic parse_image() — dict/list가 아닌 경우"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="42")]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_image(b"fake", "image/png")
            assert "error" in result
            assert result["error"] == "잘못된 형식입니다"

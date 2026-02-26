"""
LLM 서비스 단위 테스트

- get_llm_provider() 팩토리 함수 테스트
- AnthropicProvider Mock 테스트
- OpenAI, LocalLLM 프로바이더 구현 여부 테스트
"""

import importlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.llm_service import (
    AnthropicProvider,
    LocalLLMProvider,
    OpenAIProvider,
    get_llm_provider,
)

_has_openai = importlib.util.find_spec("openai") is not None


def test_get_llm_provider_anthropic():
    """LLM_PROVIDER=anthropic 설정 시 AnthropicProvider 반환"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "anthropic"
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        provider = get_llm_provider()
        assert isinstance(provider, AnthropicProvider)


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
def test_get_llm_provider_openai():
    """LLM_PROVIDER=openai 설정 시 OpenAIProvider 반환"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "openai"
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        provider = get_llm_provider()
        assert isinstance(provider, OpenAIProvider)


def test_get_llm_provider_local():
    """LLM_PROVIDER=local 설정 시 LocalLLMProvider 반환"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "local"

        provider = get_llm_provider()
        assert isinstance(provider, LocalLLMProvider)


def test_get_llm_provider_invalid():
    """잘못된 LLM_PROVIDER 설정 시 ValueError 발생"""
    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.LLM_PROVIDER = "unknown"

        with pytest.raises(ValueError, match="Unknown LLM provider"):
            get_llm_provider()


@pytest.mark.asyncio
async def test_anthropic_parse_expense_success():
    """AnthropicProvider.parse_expense() 성공 케이스 (Mock)"""
    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text='{"amount": 8000, "category": "식비", "description": "김치찌개", "date": "2026-02-11", "memo": ""}')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("점심에 김치찌개 8000원")

            assert result["amount"] == 8000
            assert result["category"] == "식비"
            assert result["description"] == "김치찌개"
            assert "error" not in result


@pytest.mark.asyncio
async def test_anthropic_parse_expense_with_json_block():
    """AnthropicProvider가 ```json 블록을 올바르게 파싱하는지 테스트"""
    json_block_text = '```json\n{"amount": 15000, "category": "교통비", "description": "택시"}\n```'
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json_block_text)]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("택시 15000원")

            assert result["amount"] == 15000
            assert result["category"] == "교통비"


@pytest.mark.asyncio
async def test_anthropic_parse_expense_error_response():
    """AnthropicProvider가 에러 응답을 반환하는 경우"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"error": "금액을 찾을 수 없습니다"}')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("그냥 텍스트")

            assert "error" in result
            assert result["error"] == "금액을 찾을 수 없습니다"


@pytest.mark.asyncio
async def test_anthropic_parse_expense_missing_amount():
    """파싱 결과에 amount가 없으면 에러 반환"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"category": "식비", "description": "김치찌개"}')]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("김치찌개")

            assert "error" in result
            assert result["error"] == "금액을 찾을 수 없습니다"


@pytest.mark.asyncio
async def test_anthropic_parse_expense_multiple():
    """여러 지출을 동시에 파싱하는 경우 (리스트 반환)"""
    mock_response = MagicMock()
    mock_response.content = [
        MagicMock(
            text='[{"amount": 8000, "category": "식비", "description": "점심", "date": "2026-02-12", "memo": ""}, '
            '{"amount": 5000, "category": "식비", "description": "커피", "date": "2026-02-12", "memo": ""}]'
        )
    ]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("점심 8천원, 커피 5천원")

            assert isinstance(result, list)
            assert len(result) == 2
            assert result[0]["amount"] == 8000
            assert result[1]["amount"] == 5000


@pytest.mark.asyncio
async def test_anthropic_generate_insights_success():
    """AnthropicProvider.generate_insights() 성공 케이스 (Mock)"""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="# 2월 지출 분석\n\n총 지출: ₩50,000")]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            expenses_data = {
                "month": "2026-02",
                "total": 50000,
                "by_category": {"식비": 30000, "교통비": 20000},
            }
            result = await provider.generate_insights(expenses_data)

            assert "지출 분석" in result
            assert "50,000" in result


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_success():
    """OpenAIProvider.parse_expense() 성공 케이스 (Mock)"""
    mock_choice = MagicMock()
    mock_choice.message.content = '{"amount": 8000, "category": "식비", "description": "김치찌개", "date": "2026-02-11", "memo": ""}'
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("점심에 김치찌개 8000원")

            assert result["amount"] == 8000
            assert result["category"] == "식비"
            assert result["description"] == "김치찌개"
            assert "error" not in result


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_with_json_block():
    """OpenAIProvider가 ```json 블록을 올바르게 파싱하는지 테스트"""
    json_block_text = '```json\n{"amount": 15000, "category": "교통비", "description": "택시"}\n```'
    mock_choice = MagicMock()
    mock_choice.message.content = json_block_text
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("택시 15000원")

            assert result["amount"] == 15000
            assert result["category"] == "교통비"


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_parse_expense_multiple():
    """OpenAI로 여러 지출을 동시에 파싱하는 경우 (리스트 반환)"""
    mock_choice = MagicMock()
    mock_choice.message.content = (
        '[{"amount": 8000, "category": "식비", "description": "점심", "date": "2026-02-12", "memo": ""}, '
        '{"amount": 5000, "category": "식비", "description": "커피", "date": "2026-02-12", "memo": ""}]'
    )
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            result = await provider.parse_expense("점심 8천원, 커피 5천원")

            assert isinstance(result, list)
            assert len(result) == 2
            assert result[0]["amount"] == 8000
            assert result[1]["amount"] == 5000


@pytest.mark.skipif(not _has_openai, reason="openai 패키지 미설치")
@pytest.mark.asyncio
async def test_openai_generate_insights_success():
    """OpenAIProvider.generate_insights() 성공 케이스 (Mock)"""
    mock_choice = MagicMock()
    mock_choice.message.content = "# 2월 지출 분석\n\n총 지출: ₩50,000"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.OPENAI_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("openai.AsyncOpenAI") as mock_openai:
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client

            provider = OpenAIProvider()
            expenses_data = {
                "month": "2026-02",
                "total": 50000,
                "by_category": {"식비": 30000, "교통비": 20000},
            }
            result = await provider.generate_insights(expenses_data)

            assert "지출 분석" in result
            assert "50,000" in result


@pytest.mark.asyncio
async def test_local_llm_provider_not_implemented():
    """LocalLLMProvider는 아직 구현되지 않음 (NotImplementedError)"""
    provider = LocalLLMProvider()

    with pytest.raises(NotImplementedError, match="구현되지 않았습니다"):
        await provider.parse_expense("테스트")

    with pytest.raises(NotImplementedError, match="구현되지 않았습니다"):
        await provider.generate_insights({})


@pytest.mark.asyncio
async def test_anthropic_parse_expense_max_tokens_exceeded():
    """max_tokens 초과 시 사용자 친화적 에러 반환 (JSON 절단 방지)"""
    mock_response = MagicMock()
    mock_response.stop_reason = "max_tokens"  # 토큰 한도 초과
    mock_response.content = [MagicMock(text='[{"amount": 11680, "category": "교통비"')]  # 잘린 JSON

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            provider = AnthropicProvider()
            result = await provider.parse_expense("매우 긴 입력..." * 50)

            assert "error" in result
            assert "날짜별로" in result["error"]


@pytest.mark.asyncio
async def test_anthropic_parse_expense_large_input():
    """다수 항목(13건) 파싱 — max_tokens=8192으로 정상 처리"""
    large_list = [
        {"amount": 11680, "category": "교통비", "description": "전기차충전", "date": "2026-02-11", "memo": ""},
        {"amount": 18100, "category": "식비", "description": "쿠팡이츠", "date": "2026-02-12", "memo": ""},
        {"amount": 13000, "category": "식비", "description": "쿠팡이츠", "date": "2026-02-12", "memo": ""},
        {"amount": 49400, "category": "쇼핑", "description": "승용 휴대폰", "date": "2026-02-14", "memo": ""},
        {"amount": 16860, "category": "쇼핑", "description": "쿠팡", "date": "2026-02-14", "memo": ""},
        {"amount": 5280, "category": "식비", "description": "파리바게뜨", "date": "2026-02-15", "memo": ""},
        {"amount": 5900, "category": "쇼핑", "description": "쿠팡", "date": "2026-02-15", "memo": ""},
        {"amount": 380000, "category": "쇼핑", "description": "모니터", "date": "2026-02-15", "memo": ""},
        {"amount": 15242, "category": "주거/통신", "description": "클라우드플레어", "date": "2026-02-16", "memo": ""},
        {"amount": 15242, "category": "주거/통신", "description": "클라우드플레어", "date": "2026-02-16", "memo": ""},
        {"amount": 16029, "category": "문화생활", "description": "클로드", "date": "2026-02-16", "memo": ""},
        {"amount": 30200, "category": "쇼핑", "description": "쿠팡", "date": "2026-02-16", "memo": ""},
        {"amount": 13100, "category": "식비", "description": "쿠팡이츠", "date": "2026-02-16", "memo": ""},
    ]
    import json as json_module

    mock_response = MagicMock()
    mock_response.stop_reason = "end_turn"
    mock_response.content = [MagicMock(text=json_module.dumps(large_list, ensure_ascii=False))]

    with patch("app.services.llm_service.settings") as mock_settings:
        mock_settings.ANTHROPIC_API_KEY = "test-key"  # pragma: allowlist secret

        with patch("anthropic.AsyncAnthropic") as mock_anthropic:
            mock_client = AsyncMock()
            mock_client.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_client

            # max_tokens 값 검증 — 2048이어야 함
            provider = AnthropicProvider()
            result = await provider.parse_expense(
                "2월11일 전기차충전 11680원\n12일 쿠팡이츠 18100원, 13000원\n"
                "14일 승용 휴대폰 49400원, 쿠팡 16860원\n15일 파리바게뜨 5280원, 쿠팡 5900원, 모니터 380000원\n"
                "16일 클라우드플레어 15242원, 클라우드플레어 15242원, 클로드 16029원, 쿠팡 30200원, 쿠팡이츠 13100원"
            )

            assert isinstance(result, list)
            assert len(result) == 13
            assert result[0]["amount"] == 11680
            assert result[0]["date"] == "2026-02-11"
            assert result[1]["date"] == "2026-02-12"  # 날짜 상속

            # max_tokens=8192(Haiku 최대)로 호출됐는지 검증
            call_kwargs = mock_client.messages.create.call_args[1]
            assert call_kwargs["max_tokens"] == 8192

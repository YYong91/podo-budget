"""OpenAI LLM 프로바이더 커버리지 테스트

services/llm_service.py 미커버 라인:
- 317-320 (OpenAI __init__)
- 335-397 (OpenAI parse_expense)
- 400 (OpenAI parse_image NotImplementedError)
- 404-426 (OpenAI generate_insights)
- 430-440 (OpenAI generate)
- 444-469 (OpenAI generate_comprehensive_insights)
"""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

openai = pytest.importorskip("openai")


def _make_provider(mock_client):
    """OpenAI 프로바이더 인스턴스를 직접 생성 (import 없이)"""
    from app.services.llm_service import OpenAIProvider

    provider = object.__new__(OpenAIProvider)
    provider.client = mock_client
    provider.model = "gpt-4o-mini"
    return provider


def _make_response(content, finish_reason="stop"):
    """OpenAI 형태의 mock response 생성"""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].finish_reason = finish_reason
    mock_response.choices[0].message.content = content
    return mock_response


@pytest.mark.asyncio
async def test_openai_parse_expense_single():
    """OpenAI 단일 지출 파싱"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(
        return_value=_make_response(json.dumps({"amount": 8000, "category": "식비", "description": "김치찌개", "date": "2026-03-25"}))
    )
    provider = _make_provider(client)
    result = await provider.parse_expense("점심 김치찌개 8000원")
    assert result["amount"] == 8000


@pytest.mark.asyncio
async def test_openai_parse_expense_multiple():
    """OpenAI 여러 지출 파싱"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(
        return_value=_make_response(
            json.dumps(
                [
                    {"amount": 8000, "category": "식비", "description": "점심", "date": "2026-03-25"},
                    {"amount": 5000, "category": "카페", "description": "커피", "date": "2026-03-25"},
                ]
            )
        )
    )
    provider = _make_provider(client)
    result = await provider.parse_expense("점심 8000원 커피 5000원")
    assert isinstance(result, list)
    assert len(result) == 2


@pytest.mark.asyncio
async def test_openai_parse_expense_error_response():
    """OpenAI 에러 응답"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response(json.dumps({"error": "이해할 수 없습니다"})))
    provider = _make_provider(client)
    result = await provider.parse_expense("asdfghjkl")
    assert "error" in result


@pytest.mark.asyncio
async def test_openai_parse_expense_max_tokens():
    """OpenAI max_tokens 초과"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response('{"amount": 8000', "length"))
    provider = _make_provider(client)
    result = await provider.parse_expense("매우 긴 입력" * 100)
    assert "error" in result
    assert "너무 길어" in result["error"]


@pytest.mark.asyncio
async def test_openai_parse_expense_json_error():
    """OpenAI JSON 파싱 실패"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response("이것은 JSON이 아닙니다"))
    provider = _make_provider(client)
    result = await provider.parse_expense("테스트")
    assert "error" in result


@pytest.mark.asyncio
async def test_openai_parse_expense_api_error():
    """OpenAI API 호출 실패"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))
    provider = _make_provider(client)
    result = await provider.parse_expense("테스트")
    assert "error" in result
    assert "LLM 서비스 오류" in result["error"]


@pytest.mark.asyncio
async def test_openai_parse_expense_no_amount():
    """OpenAI 금액 없는 응답"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response(json.dumps({"category": "식비", "description": "뭔가"})))
    provider = _make_provider(client)
    result = await provider.parse_expense("금액 없는 입력")
    assert "error" in result
    assert "금액" in result["error"]


@pytest.mark.asyncio
async def test_openai_parse_image_not_implemented():
    """OpenAI parse_image NotImplementedError"""
    client = AsyncMock()
    provider = _make_provider(client)
    with pytest.raises(NotImplementedError):
        await provider.parse_image(b"fake", "image/png")


@pytest.mark.asyncio
async def test_openai_generate_insights():
    """OpenAI 인사이트 생성"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response("# 3월 지출 분석\n이번 달 총 지출: 50만원"))
    provider = _make_provider(client)
    result = await provider.generate_insights({"month": "2026-03", "total": 500000})
    assert "지출 분석" in result


@pytest.mark.asyncio
async def test_openai_generate_insights_error():
    """OpenAI 인사이트 생성 실패"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))
    provider = _make_provider(client)
    result = await provider.generate_insights({"month": "2026-03", "total": 500000})
    assert "오류" in result


@pytest.mark.asyncio
async def test_openai_generate():
    """OpenAI 범용 텍스트 생성"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response("생성된 텍스트"))
    provider = _make_provider(client)
    result = await provider.generate("프롬프트")
    assert result == "생성된 텍스트"


@pytest.mark.asyncio
async def test_openai_generate_error():
    """OpenAI generate 실패 → 빈 문자열"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(side_effect=Exception("fail"))
    provider = _make_provider(client)
    result = await provider.generate("프롬프트")
    assert result == ""


@pytest.mark.asyncio
async def test_openai_generate_comprehensive_insights():
    """OpenAI 종합 인사이트 생성"""
    insights_data = {"summary": "잘 하고 있습니다", "highlights": [], "suggestions": []}
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response(json.dumps(insights_data)))
    provider = _make_provider(client)
    result = await provider.generate_comprehensive_insights({"month": "2026-03"})
    assert result["summary"] == "잘 하고 있습니다"


@pytest.mark.asyncio
async def test_openai_parse_expense_invalid_format():
    """OpenAI 잘못된 형식 (int 반환 등)"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response("42"))
    provider = _make_provider(client)
    result = await provider.parse_expense("테스트")
    assert "error" in result


@pytest.mark.asyncio
async def test_openai_parse_expense_list_no_amount():
    """OpenAI 리스트 중 금액 없는 항목"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response(json.dumps([{"amount": 8000, "category": "식비"}, {"category": "교통"}])))
    provider = _make_provider(client)
    result = await provider.parse_expense("여러 건")
    assert "error" in result


@pytest.mark.asyncio
async def test_openai_insights_max_tokens_warning():
    """OpenAI 인사이트 max_tokens 경고"""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=_make_response("잘린 인사이트...", "length"))
    provider = _make_provider(client)
    result = await provider.generate_insights({"month": "2026-03", "total": 500000})
    assert result == "잘린 인사이트..."

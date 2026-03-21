"""LLM 서비스 추가 단위 테스트

- LocalLLMProvider 모든 메서드 NotImplementedError 검증
- _extract_json_text() 다양한 포맷 처리
- GoogleProvider NotImplementedError 검증
"""

import pytest

from app.services.llm_service import (
    GoogleProvider,
    LocalLLMProvider,
    _extract_json_text,
)

# ──────────────────────────────────────────────
# _extract_json_text() 테스트
# ──────────────────────────────────────────────


def test_extract_json_text_plain():
    """순수 JSON 텍스트는 그대로 반환"""
    text = '{"amount": 8000, "category": "식비"}'
    result = _extract_json_text(text)
    assert result == text


def test_extract_json_text_json_block():
    """```json 블록에서 JSON 추출"""
    text = '```json\n{"amount": 8000}\n```'
    result = _extract_json_text(text)
    assert result == '{"amount": 8000}'


def test_extract_json_text_plain_block():
    """``` 블록(json 없음)에서 JSON 추출"""
    text = '```\n{"amount": 8000}\n```'
    result = _extract_json_text(text)
    assert result == '{"amount": 8000}'


def test_extract_json_text_with_whitespace():
    """앞뒤 공백 제거"""
    text = '  \n  {"amount": 8000}  \n  '
    result = _extract_json_text(text)
    assert result == '{"amount": 8000}'


def test_extract_json_text_json_block_with_extra_text():
    """```json 블록 앞뒤에 다른 텍스트가 있는 경우"""
    text = '다음은 파싱 결과입니다:\n```json\n{"amount": 5000}\n```\n감사합니다.'
    result = _extract_json_text(text)
    assert result == '{"amount": 5000}'


def test_extract_json_text_array():
    """배열 형태의 JSON도 정상 처리"""
    text = '```json\n[{"amount": 1000}, {"amount": 2000}]\n```'
    result = _extract_json_text(text)
    assert result == '[{"amount": 1000}, {"amount": 2000}]'


# ──────────────────────────────────────────────
# LocalLLMProvider — 모든 메서드 NotImplementedError
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_local_llm_parse_expense_not_implemented():
    """LocalLLMProvider.parse_expense() → NotImplementedError"""
    provider = LocalLLMProvider()
    with pytest.raises(NotImplementedError):
        await provider.parse_expense("테스트 입력")


@pytest.mark.asyncio
async def test_local_llm_parse_image_not_implemented():
    """LocalLLMProvider.parse_image() → NotImplementedError"""
    provider = LocalLLMProvider()
    with pytest.raises(NotImplementedError):
        await provider.parse_image(b"fake_image", "image/jpeg")


@pytest.mark.asyncio
async def test_local_llm_generate_insights_not_implemented():
    """LocalLLMProvider.generate_insights() → NotImplementedError"""
    provider = LocalLLMProvider()
    with pytest.raises(NotImplementedError):
        await provider.generate_insights({"total": 50000})


@pytest.mark.asyncio
async def test_local_llm_generate_not_implemented():
    """LocalLLMProvider.generate() → NotImplementedError"""
    provider = LocalLLMProvider()
    with pytest.raises(NotImplementedError):
        await provider.generate("임의 프롬프트")


@pytest.mark.asyncio
async def test_local_llm_generate_comprehensive_insights_not_implemented():
    """LocalLLMProvider.generate_comprehensive_insights() → NotImplementedError"""
    provider = LocalLLMProvider()
    with pytest.raises(NotImplementedError):
        await provider.generate_comprehensive_insights({"month": "2026-02"})


def test_local_llm_default_model():
    """LocalLLMProvider 기본 모델 이름 확인"""
    provider = LocalLLMProvider()
    assert provider.model == "llama3"


def test_local_llm_custom_model():
    """LocalLLMProvider 커스텀 모델 설정"""
    provider = LocalLLMProvider(model="llama3.1")
    assert provider.model == "llama3.1"


# ──────────────────────────────────────────────
# GoogleProvider — NotImplementedError
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_google_parse_expense_not_implemented():
    """GoogleProvider.parse_expense() → NotImplementedError"""
    provider = GoogleProvider()
    with pytest.raises(NotImplementedError):
        await provider.parse_expense("테스트")


@pytest.mark.asyncio
async def test_google_parse_image_not_implemented():
    """GoogleProvider.parse_image() → NotImplementedError"""
    provider = GoogleProvider()
    with pytest.raises(NotImplementedError):
        await provider.parse_image(b"image", "image/png")


@pytest.mark.asyncio
async def test_google_generate_insights_not_implemented():
    """GoogleProvider.generate_insights() → NotImplementedError"""
    provider = GoogleProvider()
    with pytest.raises(NotImplementedError):
        await provider.generate_insights({})


@pytest.mark.asyncio
async def test_google_generate_not_implemented():
    """GoogleProvider.generate() → NotImplementedError"""
    provider = GoogleProvider()
    with pytest.raises(NotImplementedError):
        await provider.generate("프롬프트")


@pytest.mark.asyncio
async def test_google_generate_comprehensive_insights_not_implemented():
    """GoogleProvider.generate_comprehensive_insights() → NotImplementedError"""
    provider = GoogleProvider()
    with pytest.raises(NotImplementedError):
        await provider.generate_comprehensive_insights({})

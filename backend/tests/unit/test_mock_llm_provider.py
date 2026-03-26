"""MockLLMProvider 단위 테스트

E2E 테스트용 MockLLMProvider가 결정적 응답을 올바르게 반환하는지 검증합니다.
"""

import pytest

from app.services.llm_service import MockLLMProvider, _provider_cache, get_llm_provider


@pytest.fixture
def provider():
    return MockLLMProvider()


@pytest.mark.asyncio
async def test_parse_expense_extracts_amount(provider):
    """금액이 포함된 텍스트에서 금액을 올바르게 추출"""
    result = await provider.parse_expense("점심 김치찌개 8000원")
    assert result["amount"] == 8000
    assert result["description"] == "점심 김치찌개 8000원"
    assert result["category"] == "식비"
    assert result["type"] == "expense"
    assert "date" in result


@pytest.mark.asyncio
async def test_parse_expense_comma_amount(provider):
    """쉼표가 포함된 금액도 올바르게 파싱"""
    result = await provider.parse_expense("저녁 삼겹살 25,000원")
    assert result["amount"] == 25000


@pytest.mark.asyncio
async def test_parse_expense_no_amount(provider):
    """금액이 없으면 기본값 10000 반환"""
    result = await provider.parse_expense("점심 먹었어")
    assert result["amount"] == 10000


@pytest.mark.asyncio
async def test_parse_expense_uses_provided_categories(provider):
    """카테고리 목록이 제공되면 첫 번째를 사용"""
    result = await provider.parse_expense("커피 5000원", categories=["카페", "식비", "교통"])
    assert result["category"] == "카페"


@pytest.mark.asyncio
async def test_parse_image(provider):
    """이미지 OCR 모킹 — 고정 결과 반환"""
    result = await provider.parse_image(b"fake-image-bytes", "image/png")
    assert result["amount"] == 15000
    assert result["description"] == "모킹된 영수증"


@pytest.mark.asyncio
async def test_generate_insights(provider):
    """인사이트 모킹 — 고정 텍스트 반환"""
    result = await provider.generate_insights({"total": 50000})
    assert result == "테스트 인사이트입니다."


@pytest.mark.asyncio
async def test_generate(provider):
    """범용 텍스트 생성 모킹"""
    result = await provider.generate("아무 프롬프트")
    assert "mock response" in result


@pytest.mark.asyncio
async def test_generate_comprehensive_insights(provider):
    """종합 인사이트 모킹 — 구조 확인"""
    result = await provider.generate_comprehensive_insights({"total": 100000})
    assert "summary" in result
    assert "health_score" in result
    assert result["health_score"] == 80


def test_get_llm_provider_mock(monkeypatch):
    """LLM_PROVIDER=mock 설정 시 MockLLMProvider 반환"""
    # 캐시 초기화
    _provider_cache.clear()

    monkeypatch.setattr("app.core.config.settings.LLM_PROVIDER", "mock")
    provider = get_llm_provider()
    assert isinstance(provider, MockLLMProvider)

    # 캐시 정리
    _provider_cache.clear()

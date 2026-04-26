import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.embedding_service import cosine_similarity, get_embedding


@pytest.mark.asyncio
async def test_get_embedding_returns_vector():
    """get_embedding이 1536차원 float 리스트를 반환한다"""
    mock_vector = [0.1] * 1536

    # lazy import 패턴 — sys.modules에 mock을 주입해 openai 설치 여부에 무관하게 테스트
    mock_openai = MagicMock()
    mock_client = MagicMock()
    mock_openai.AsyncOpenAI.return_value = mock_client
    mock_client.embeddings.create = AsyncMock(return_value=MagicMock(data=[MagicMock(embedding=mock_vector)]))
    with patch.dict(sys.modules, {"openai": mock_openai}):
        result = await get_embedding("쿠팡 우유")

    assert len(result) == 1536
    assert isinstance(result[0], float)


@pytest.mark.asyncio
async def test_get_embedding_empty_text_raises():
    """빈 텍스트는 ValueError를 발생시킨다 (openai 호출 전에 검증)"""
    with pytest.raises(ValueError, match="빈 텍스트"):
        await get_embedding("")


def test_cosine_similarity_identical_vectors():
    """동일 벡터의 코사인 유사도는 1.0"""
    v = [1.0, 0.0, 0.0]
    assert abs(cosine_similarity(v, v) - 1.0) < 1e-6


def test_cosine_similarity_orthogonal_vectors():
    """직교 벡터의 코사인 유사도는 0.0"""
    a = [1.0, 0.0]
    b = [0.0, 1.0]
    assert abs(cosine_similarity(a, b)) < 1e-6


def test_cosine_similarity_opposite_vectors():
    """반대 벡터의 코사인 유사도는 -1.0"""
    a = [1.0, 0.0]
    b = [-1.0, 0.0]
    assert abs(cosine_similarity(a, b) - (-1.0)) < 1e-6

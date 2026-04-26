"""OpenAI 임베딩 서비스

text-embedding-3-small으로 텍스트를 벡터화합니다.
임베딩 실패 시 None을 반환하여 상위 레이어가 graceful degradation 처리합니다.
"""

import numpy as np
from openai import AsyncOpenAI

from app.core.config import settings


async def get_embedding(text: str) -> list[float]:
    """텍스트를 OpenAI 임베딩 벡터로 변환

    Args:
        text: 임베딩할 텍스트

    Returns:
        1536차원 float 리스트

    Raises:
        ValueError: 빈 텍스트 입력 시
    """
    if not text or not text.strip():
        raise ValueError("빈 텍스트는 임베딩할 수 없습니다")

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.embeddings.create(
        model=settings.OPENAI_EMBEDDING_MODEL,
        input=text.strip(),
    )
    return response.data[0].embedding


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """두 벡터의 코사인 유사도 계산 (-1.0 ~ 1.0)"""
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)

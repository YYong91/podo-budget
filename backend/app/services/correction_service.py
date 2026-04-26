"""카테고리 정정 신호 서비스

사용자가 거래 카테고리를 수정할 때 정정 신호를 저장하고 조회합니다.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category_correction import CategoryCorrection
from app.services.embedding_service import get_embedding


async def save_correction(
    db: AsyncSession,
    input_text: str,
    category_id: int,
    household_id: int,
    user_id: int | None = None,
    source: str = "edit",
) -> CategoryCorrection | None:
    """카테고리 정정 신호 저장

    Args:
        db: DB 세션
        input_text: 거래 설명 (예: "쿠팡 우유")
        category_id: 사용자가 선택한 카테고리 ID
        household_id: 가구 ID (스코프)
        user_id: 정정한 사용자 ID
        source: 정정 경로 ("edit")

    Returns:
        저장된 CategoryCorrection 또는 None (빈 텍스트 등 저장 불필요 시)
    """
    if not input_text or not input_text.strip():
        return None

    # 임베딩 생성 (실패해도 정정 신호는 저장)
    embedding: list[float] | None = None
    try:  # noqa: SIM105 — await 포함이라 contextlib.suppress 불가
        embedding = await get_embedding(input_text.strip())
    except Exception:
        pass  # 임베딩 실패는 무시 — 정정 신호 저장이 더 중요

    correction = CategoryCorrection(
        household_id=household_id,
        user_id=user_id,
        input_text=input_text.strip(),
        category_id=category_id,
        source=source,
        embedding=embedding,
    )
    db.add(correction)
    await db.flush()
    return correction


async def get_corrections_for_household(
    db: AsyncSession,
    household_id: int,
    limit: int = 200,
) -> list[CategoryCorrection]:
    """가구의 정정 데이터 조회 (최신순)

    Phase 2 RAG에서 임베딩 검색 대상으로 사용됩니다.
    """
    result = await db.execute(
        select(CategoryCorrection)
        .where(
            CategoryCorrection.household_id == household_id,
            CategoryCorrection.category_id.isnot(None),
        )
        .order_by(CategoryCorrection.created_at.desc(), CategoryCorrection.id.desc())
        .limit(limit)
    )
    return list(result.scalars().all())

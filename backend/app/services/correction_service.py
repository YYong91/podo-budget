"""카테고리 정정 신호 서비스

사용자가 거래 카테고리를 수정할 때 정정 신호를 저장하고 조회합니다.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.category_correction import CategoryCorrection
from app.services.embedding_service import cosine_similarity, get_embedding

# 유사도 0.9 이상이면 "같은 개념의 다른 표현"으로 간주해 기존 행을 갱신
_UPSERT_SIMILARITY_THRESHOLD = 0.9


async def save_correction(
    db: AsyncSession,
    input_text: str,
    category_id: int,
    household_id: int,
    user_id: int | None = None,
    source: str = "edit",
) -> CategoryCorrection | None:
    """카테고리 정정 신호 저장 (유사도 기반 upsert)

    동일 개념의 다른 표현("스타벅스 베이글" / "베이글 스타벅스")은
    별도 행 대신 기존 행을 최신 의도로 갱신해 충돌 힌트를 방지합니다.

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

    # 유사도 기반 upsert: 임베딩이 있으면 기존 정정 중 매우 유사한 행을 갱신
    if embedding is not None:
        existing = await _find_duplicate_correction(db, embedding, household_id)
        if existing is not None:
            existing.category_id = category_id  # type: ignore[assignment]
            existing.input_text = input_text.strip()  # type: ignore[assignment]
            existing.embedding = embedding  # type: ignore[assignment]
            existing.created_at = datetime.now(UTC).replace(tzinfo=None)  # type: ignore[assignment]
            await db.flush()
            return existing

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


async def _find_duplicate_correction(
    db: AsyncSession,
    embedding: list[float],
    household_id: int,
) -> CategoryCorrection | None:
    """유사도 0.9 이상인 기존 정정 행 탐색 (가장 유사한 1건 반환)"""
    result = await db.execute(
        select(CategoryCorrection)
        .where(
            CategoryCorrection.household_id == household_id,
            CategoryCorrection.embedding.isnot(None),
        )
        .order_by(CategoryCorrection.created_at.desc())
        .limit(500)
    )
    rows = result.scalars().all()

    best: CategoryCorrection | None = None
    best_sim = _UPSERT_SIMILARITY_THRESHOLD

    for row in rows:
        if not row.embedding:
            continue
        sim = cosine_similarity(embedding, row.embedding)  # type: ignore[arg-type]
        if sim >= best_sim:
            best_sim = sim
            best = row

    return best


async def find_similar_corrections(
    db: AsyncSession,
    query_text: str,
    household_id: int,
    top_k: int = 5,
    min_similarity: float = 0.75,
) -> list[tuple[str, str]]:
    """입력 텍스트와 유사한 정정 사례를 검색 (Numpy 코사인 유사도)

    Args:
        db: DB 세션
        query_text: 새 입력 텍스트
        household_id: 가구 ID (스코프)
        top_k: 반환할 최대 결과 수
        min_similarity: 최소 유사도 임계값

    Returns:
        [(input_text, category_name), ...] — 유사도 내림차순
    """
    # 임베딩 있는 정정 데이터만 로드 (최근 500건)
    result = await db.execute(
        select(CategoryCorrection, Category.name)
        .join(Category, CategoryCorrection.category_id == Category.id)
        .where(
            CategoryCorrection.household_id == household_id,
            CategoryCorrection.embedding.isnot(None),
        )
        .order_by(CategoryCorrection.created_at.desc())
        .limit(500)
    )
    rows = result.all()

    if not rows:
        return []

    try:
        query_embedding = await get_embedding(query_text)
    except Exception:
        return []  # 임베딩 실패 시 빈 결과 반환 (graceful degradation)

    scored: list[tuple[float, str, str]] = []
    for correction, category_name in rows:
        # SQLite in-memory (테스트) 환경에서 isnot(None) 필터가 불완전할 수 있으므로 방어적 체크
        if not correction.embedding:
            continue
        sim = cosine_similarity(query_embedding, correction.embedding)
        if sim >= min_similarity:
            scored.append((sim, correction.input_text, category_name))

    scored.sort(reverse=True)
    return [(text, cat) for _, text, cat in scored[:top_k]]


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

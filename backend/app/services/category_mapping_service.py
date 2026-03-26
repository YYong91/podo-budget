"""카테고리 매핑 서비스

LLM이 제안한 카테고리 이름을 사용자의 기존 카테고리로 매핑합니다.
사용자가 한 번 매핑을 선택하면, 다음부터 같은 이름은 자동 변환됩니다.

예: LLM이 "식비"를 제안했지만 사용자가 "외식비"를 선택 → 다음부터 "식비" → "외식비" 자동 적용
"""

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.category_mapping import CategoryMapping


def _build_mapping_scope_filter(user_id: int | None, household_id: int | None) -> object:
    """매핑 접근 범위 필터 (가구 우선, 개인 폴백)"""
    conditions = [
        and_(CategoryMapping.user_id == user_id, CategoryMapping.household_id.is_(None)),
    ]
    if household_id is not None:
        conditions.append(CategoryMapping.household_id == household_id)
    return or_(*conditions)


async def get_mapped_category(
    db: AsyncSession,
    source_name: str,
    user_id: int | None = None,
    household_id: int | None = None,
) -> Category | None:
    """매핑된 카테고리를 조회 (없으면 None)

    가구 매핑을 우선 적용하고, 없으면 개인 매핑을 사용합니다.
    """
    scope_filter = _build_mapping_scope_filter(user_id, household_id)

    result = await db.execute(
        select(CategoryMapping)
        .where(CategoryMapping.source_name == source_name, scope_filter)  # type: ignore[arg-type]
        .order_by(CategoryMapping.household_id.desc().nullslast())  # 가구 매핑 우선
        .limit(1)
    )
    mapping = result.scalar_one_or_none()

    if mapping is None:
        return None

    # 매핑된 카테고리 조회
    cat_result = await db.execute(select(Category).where(Category.id == mapping.target_category_id))
    return cat_result.scalar_one_or_none()


async def save_category_mapping(
    db: AsyncSession,
    source_name: str,
    target_category_id: int,
    user_id: int | None = None,
    household_id: int | None = None,
) -> CategoryMapping:
    """카테고리 매핑 저장 (기존 매핑이 있으면 업데이트)"""
    scope_filter = _build_mapping_scope_filter(user_id, household_id)

    # 기존 매핑 조회
    result = await db.execute(select(CategoryMapping).where(CategoryMapping.source_name == source_name, scope_filter))  # type: ignore[arg-type]
    existing = result.scalar_one_or_none()

    if existing:
        existing.target_category_id = target_category_id  # type: ignore[assignment]
        await db.flush()
        return existing

    # 새 매핑 생성
    try:
        if household_id is not None:
            mapping = CategoryMapping(
                household_id=household_id,
                user_id=None,
                source_name=source_name,
                target_category_id=target_category_id,
            )
        else:
            mapping = CategoryMapping(
                user_id=user_id,
                household_id=None,
                source_name=source_name,
                target_category_id=target_category_id,
            )
        db.add(mapping)
        await db.flush()
        return mapping
    except IntegrityError:
        await db.rollback()
        # 동시 생성 → 재조회 후 업데이트
        result = await db.execute(select(CategoryMapping).where(CategoryMapping.source_name == source_name, scope_filter))  # type: ignore[arg-type]
        existing = result.scalar_one()
        existing.target_category_id = target_category_id  # type: ignore[assignment]
        await db.flush()
        return existing


async def get_category_mappings_for_prompt(
    db: AsyncSession,
    user_id: int | None = None,
    household_id: int | None = None,
) -> dict[str, str]:
    """프롬프트에 주입할 카테고리 매핑 dict 반환

    Returns:
        dict[source_name, target_category_name]: 예) {"식비": "외식비"}
    """
    scope_filter = _build_mapping_scope_filter(user_id, household_id)

    result = await db.execute(
        select(CategoryMapping.source_name, Category.name).join(Category, CategoryMapping.target_category_id == Category.id).where(scope_filter)  # type: ignore[arg-type]
    )
    return {row[0]: row[1] for row in result.all()}

"""카테고리 자동 생성 및 매칭 서비스

가계/솔로 유저별 카테고리 + 시스템 공통 카테고리를 처리합니다.
자연어 입력 시 LLM이 파싱한 카테고리 이름으로 기존 카테고리를 찾거나 새로 생성합니다.

카테고리 스코프 우선순위:
1. 시스템 카테고리 (user_id=None, household_id=None)
2. 가계 카테고리 (household_id=X)
3. 솔로 유저 개인 카테고리 (user_id=X, household_id=None)
"""

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category


def _build_scope_filter(user_id: int | None, household_id: int | None):
    """카테고리 접근 범위 필터 조건 생성 (3-scope)"""
    conditions = [
        and_(Category.household_id.is_(None), Category.user_id.is_(None)),  # 시스템
        and_(Category.user_id == user_id, Category.household_id.is_(None)),  # 솔로 폴백
    ]
    if household_id is not None:
        conditions.append(Category.household_id == household_id)  # 가계
    return or_(*conditions)


async def get_or_create_category(
    db: AsyncSession,
    category_name: str,
    user_id: int | None = None,
    household_id: int | None = None,
) -> Category:
    """카테고리 이름으로 검색하고, 없으면 자동 생성

    시스템 카테고리 → 가계 카테고리 → 솔로 개인 카테고리 순서로 검색합니다.
    없으면 household_id가 있으면 가계 카테고리로, 없으면 솔로 개인 카테고리로 생성합니다.

    동시 요청으로 UniqueConstraint 위반이 발생하면 재조회합니다.

    Args:
        db: 데이터베이스 세션
        category_name: 카테고리 이름
        user_id: 사용자 ID
        household_id: 활성 가구 ID (있으면 가계 카테고리 우선)

    Returns:
        찾았거나 생성한 카테고리 객체
    """
    scope_filter = _build_scope_filter(user_id, household_id)

    result = await db.execute(select(Category).where(Category.name == category_name, scope_filter))
    category = result.scalar_one_or_none()

    if category is None:
        try:
            if household_id is not None:
                # 가계 카테고리 생성
                category = Category(
                    household_id=household_id,
                    user_id=None,
                    name=category_name,
                    description=f"자동 생성된 카테고리: {category_name}",
                )
            else:
                # 솔로 개인 카테고리 생성
                category = Category(
                    user_id=user_id,
                    household_id=None,
                    name=category_name,
                    description=f"자동 생성된 카테고리: {category_name}",
                )
            db.add(category)
            await db.flush()
        except IntegrityError:
            # 동시 요청으로 이미 생성된 경우 → 롤백 후 재조회
            await db.rollback()
            result = await db.execute(select(Category).where(Category.name == category_name, scope_filter))
            category = result.scalar_one()

    return category

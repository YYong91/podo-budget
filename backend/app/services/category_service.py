"""카테고리 자동 생성 및 매칭 서비스

사용자별 카테고리 + 시스템 공통 카테고리를 처리합니다.
자연어 입력 시 LLM이 파싱한 카테고리 이름으로 기존 카테고리를 찾거나 새로 생성합니다.
"""

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category


async def get_or_create_category(db: AsyncSession, category_name: str, user_id: int | None = None) -> Category:
    """카테고리 이름으로 검색하고, 없으면 자동 생성

    시스템 카테고리(user_id=None) 또는 사용자의 개인 카테고리를 우선 검색합니다.
    둘 다 없으면 해당 사용자의 개인 카테고리로 자동 생성합니다.

    Args:
        db: 데이터베이스 세션
        category_name: 카테고리 이름
        user_id: 사용자 ID

    Returns:
        찾았거나 생성한 카테고리 객체
    """
    # 시스템 카테고리 또는 사용자의 개인 카테고리 검색
    result = await db.execute(
        select(Category).where(
            Category.name == category_name,
            or_(Category.user_id == None, Category.user_id == user_id),  # noqa: E711
        )
    )
    category = result.scalar_one_or_none()

    if category is None:
        # 없으면 사용자의 개인 카테고리로 자동 생성
        category = Category(
            user_id=user_id,
            name=category_name,
            description=f"자동 생성된 카테고리: {category_name}",
        )
        db.add(category)
        await db.flush()

    return category

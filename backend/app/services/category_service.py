"""카테고리 자동 생성 및 매칭 서비스"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category


async def get_or_create_category(db: AsyncSession, category_name: str) -> Category:
    """카테고리 이름으로 검색하고, 없으면 자동 생성"""
    result = await db.execute(select(Category).where(Category.name == category_name))
    category = result.scalar_one_or_none()

    if category is None:
        category = Category(name=category_name, description=f"자동 생성된 카테고리: {category_name}")
        db.add(category)
        await db.flush()

    return category

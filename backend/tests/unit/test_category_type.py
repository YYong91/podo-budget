"""카테고리 type 필드 테스트"""

import pytest
from sqlalchemy import select

from app.models.category import Category


@pytest.mark.asyncio
async def test_category_default_type(db_session):
    """카테고리 기본 type은 'expense'"""
    category = Category(name="식비")
    db_session.add(category)
    await db_session.commit()

    result = await db_session.execute(select(Category))
    cat = result.scalar_one()
    assert cat.type == "expense"


@pytest.mark.asyncio
async def test_category_income_type(db_session):
    """수입 카테고리 생성"""
    category = Category(name="급여", type="income")
    db_session.add(category)
    await db_session.commit()

    result = await db_session.execute(select(Category).where(Category.type == "income"))
    cat = result.scalar_one()
    assert cat.name == "급여"
    assert cat.type == "income"


@pytest.mark.asyncio
async def test_category_both_type(db_session):
    """양쪽 모두 사용 가능한 카테고리"""
    category = Category(name="기타", type="both")
    db_session.add(category)
    await db_session.commit()

    result = await db_session.execute(select(Category).where(Category.type == "both"))
    assert result.scalar_one().type == "both"


@pytest.mark.asyncio
async def test_filter_by_income_type(db_session):
    """수입/지출 타입 필터링"""
    db_session.add_all(
        [
            Category(name="식비", type="expense"),
            Category(name="급여", type="income"),
            Category(name="기타", type="both"),
        ]
    )
    await db_session.commit()

    # 수입에서 사용 가능한 카테고리: income + both
    result = await db_session.execute(select(Category).where(Category.type.in_(["income", "both"])).order_by(Category.name))
    cats = result.scalars().all()
    assert len(cats) == 2
    assert {c.name for c in cats} == {"급여", "기타"}

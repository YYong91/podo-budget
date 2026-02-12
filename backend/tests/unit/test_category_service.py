"""
카테고리 서비스 단위 테스트

- get_or_create_category() 함수 테스트
- 기존 카테고리 조회 / 신규 카테고리 자동 생성 검증
"""

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.services.category_service import get_or_create_category


@pytest.mark.asyncio
async def test_get_existing_category(db_session):
    """기존 카테고리가 있으면 조회만 수행 (중복 생성 안 함)"""
    # 카테고리 미리 생성
    existing = Category(name="식비", description="음식 관련")
    db_session.add(existing)
    await db_session.commit()
    await db_session.refresh(existing)

    # get_or_create_category 호출
    result = await get_or_create_category(db_session, "식비")

    assert result.id == existing.id
    assert result.name == "식비"
    assert result.description == "음식 관련"

    # DB에 카테고리가 여전히 1개만 있는지 확인 (중복 생성 안 됨)
    count_result = await db_session.execute(select(Category))
    all_categories = count_result.scalars().all()
    assert len(all_categories) == 1


@pytest.mark.asyncio
async def test_create_new_category(db_session):
    """존재하지 않는 카테고리는 자동 생성"""
    # 초기에는 카테고리 없음
    count_result = await db_session.execute(select(Category))
    assert len(count_result.scalars().all()) == 0

    # get_or_create_category 호출 (새 카테고리 생성)
    result = await get_or_create_category(db_session, "교통비")

    assert result.id is not None
    assert result.name == "교통비"
    assert result.description == "자동 생성된 카테고리: 교통비"

    # DB에 카테고리가 1개 생성됨
    count_result = await db_session.execute(select(Category))
    all_categories = count_result.scalars().all()
    assert len(all_categories) == 1


@pytest.mark.asyncio
async def test_get_or_create_multiple_times(db_session):
    """같은 이름으로 여러 번 호출해도 중복 생성 안 됨"""
    # 첫 번째 호출: 생성
    cat1 = await get_or_create_category(db_session, "문화생활")
    await db_session.commit()

    # 두 번째 호출: 조회
    cat2 = await get_or_create_category(db_session, "문화생활")
    await db_session.commit()

    # 같은 ID를 가진 동일한 카테고리
    assert cat1.id == cat2.id
    assert cat1.name == cat2.name

    # DB에는 1개만 존재
    count_result = await db_session.execute(select(Category))
    all_categories = count_result.scalars().all()
    assert len(all_categories) == 1


@pytest.mark.asyncio
async def test_category_name_case_sensitive(db_session):
    """카테고리 이름은 대소문자를 구분 (다른 카테고리로 취급)"""
    cat1 = await get_or_create_category(db_session, "식비")
    cat2 = await get_or_create_category(db_session, "식Bi")
    await db_session.commit()

    # 다른 ID를 가짐
    assert cat1.id != cat2.id

    # DB에 2개 존재
    count_result = await db_session.execute(select(Category))
    all_categories = count_result.scalars().all()
    assert len(all_categories) == 2

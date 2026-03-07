"""
카테고리 서비스 단위 테스트

- get_or_create_category() 함수 테스트
- 기존 카테고리 조회 / 신규 카테고리 자동 생성 검증
- 가계/솔로 카테고리 스코프 격리 검증
"""

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.user import User
from app.services.category_service import get_or_create_category


@pytest.mark.asyncio
async def test_get_existing_solo_category(test_user: User, db_session):
    """기존 솔로 개인 카테고리가 있으면 조회만 수행 (중복 생성 안 함)"""
    # 솔로 카테고리 미리 생성 (user_id 설정, household_id=None)
    existing = Category(user_id=test_user.id, name="식비", description="음식 관련")
    db_session.add(existing)
    await db_session.commit()
    await db_session.refresh(existing)

    result = await get_or_create_category(db_session, "식비", test_user.id)

    assert result.id == existing.id
    assert result.name == "식비"
    assert result.description == "음식 관련"

    # DB에 카테고리가 여전히 1개만 있는지 확인 (중복 생성 안 됨)
    count_result = await db_session.execute(select(Category))
    all_categories = count_result.scalars().all()
    assert len(all_categories) == 1


@pytest.mark.asyncio
async def test_create_new_solo_category(test_user: User, db_session):
    """존재하지 않는 카테고리는 솔로 개인 카테고리로 자동 생성 (household_id 없을 때)"""
    count_result = await db_session.execute(select(Category))
    assert len(count_result.scalars().all()) == 0

    result = await get_or_create_category(db_session, "교통비", test_user.id)

    assert result.id is not None
    assert result.user_id == test_user.id
    assert result.household_id is None
    assert result.name == "교통비"
    assert result.description == "자동 생성된 카테고리: 교통비"

    count_result = await db_session.execute(select(Category))
    all_categories = count_result.scalars().all()
    assert len(all_categories) == 1


@pytest.mark.asyncio
async def test_create_new_household_category(test_user: User, db_session):
    """household_id가 있으면 가계 카테고리로 자동 생성"""
    household_id = 99  # 테스트용 가계 ID (FK 제약 없음)

    result = await get_or_create_category(db_session, "교통비", test_user.id, household_id=household_id)

    assert result.id is not None
    assert result.household_id == household_id
    assert result.user_id is None  # 가계 카테고리는 user_id=None
    assert result.name == "교통비"


@pytest.mark.asyncio
async def test_get_existing_household_category(test_user: User, db_session):
    """기존 가계 카테고리가 있으면 조회만 수행"""
    household_id = 42
    existing = Category(household_id=household_id, user_id=None, name="식비")
    db_session.add(existing)
    await db_session.commit()
    await db_session.refresh(existing)

    result = await get_or_create_category(db_session, "식비", test_user.id, household_id=household_id)

    assert result.id == existing.id
    assert result.household_id == household_id

    count_result = await db_session.execute(select(Category))
    assert len(count_result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_system_category_found_for_any_user(test_user: User, db_session):
    """시스템 카테고리는 어떤 user_id/household_id로 검색해도 반환됨"""
    sys_cat = Category(name="식비", user_id=None, household_id=None)
    db_session.add(sys_cat)
    await db_session.commit()
    await db_session.refresh(sys_cat)

    # 솔로 유저 검색
    result = await get_or_create_category(db_session, "식비", test_user.id)
    assert result.id == sys_cat.id

    # 가계 유저 검색
    result2 = await get_or_create_category(db_session, "식비", test_user.id, household_id=1)
    assert result2.id == sys_cat.id

    # 중복 생성 안 됨
    count_result = await db_session.execute(select(Category))
    assert len(count_result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_household_category_not_visible_to_other_household(test_user: User, db_session):
    """다른 가구의 카테고리는 조회되지 않음 (새로 생성됨)"""
    cat_hh1 = Category(household_id=1, user_id=None, name="식비")
    db_session.add(cat_hh1)
    await db_session.commit()

    # 가구 2로 검색하면 못 찾아서 새로 생성됨
    result = await get_or_create_category(db_session, "식비", test_user.id, household_id=2)
    await db_session.commit()

    assert result.household_id == 2
    assert result.id != cat_hh1.id

    count_result = await db_session.execute(select(Category))
    assert len(count_result.scalars().all()) == 2


@pytest.mark.asyncio
async def test_get_or_create_multiple_times(test_user: User, db_session):
    """같은 이름으로 여러 번 호출해도 중복 생성 안 됨"""
    cat1 = await get_or_create_category(db_session, "문화생활", test_user.id)
    await db_session.commit()

    cat2 = await get_or_create_category(db_session, "문화생활", test_user.id)
    await db_session.commit()

    assert cat1.id == cat2.id
    assert cat1.name == cat2.name

    count_result = await db_session.execute(select(Category))
    all_categories = count_result.scalars().all()
    assert len(all_categories) == 1


@pytest.mark.asyncio
async def test_category_name_case_sensitive(test_user: User, db_session):
    """카테고리 이름은 대소문자를 구분 (다른 카테고리로 취급)"""
    cat1 = await get_or_create_category(db_session, "식비", test_user.id)
    cat2 = await get_or_create_category(db_session, "식Bi", test_user.id)
    await db_session.commit()

    assert cat1.id != cat2.id

    count_result = await db_session.execute(select(Category))
    all_categories = count_result.scalars().all()
    assert len(all_categories) == 2

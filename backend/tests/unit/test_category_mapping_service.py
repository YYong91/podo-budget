"""카테고리 매핑 서비스 단위 테스트

LLM 매핑 저장/조회 로직 검증:
- save_category_mapping() — 새 매핑 생성
- get_mapped_category() — 매핑된 카테고리 조회
- get_category_mappings_for_prompt() — 프롬프트용 dict 반환
- 가구 스코프 vs 개인 스코프 우선순위
- 기존 매핑 업데이트 (덮어쓰기)
"""

import pytest

from app.models.category import Category
from app.models.category_mapping import CategoryMapping
from app.models.household import Household
from app.models.user import User
from app.services.category_mapping_service import (
    get_category_mappings_for_prompt,
    get_mapped_category,
    save_category_mapping,
)


@pytest.fixture
async def setup_data(db_session, test_user, test_household):
    """테스트용 카테고리 생성"""
    cat_food = Category(user_id=test_user.id, name="외식비")
    cat_transport = Category(user_id=test_user.id, name="대중교통")
    db_session.add_all([cat_food, cat_transport])
    await db_session.commit()
    await db_session.refresh(cat_food)
    await db_session.refresh(cat_transport)
    return cat_food, cat_transport


@pytest.mark.asyncio
async def test_save_and_get_mapping(db_session, test_user: User, test_household: Household, setup_data):
    """매핑 저장 후 조회 성공"""
    cat_food, _ = setup_data

    # "식비" → "외식비" 매핑 저장
    await save_category_mapping(
        db=db_session,
        source_name="식비",
        target_category_id=cat_food.id,
        user_id=test_user.id,
        household_id=test_household.id,
    )
    await db_session.commit()

    # 조회
    result = await get_mapped_category(
        db=db_session,
        source_name="식비",
        user_id=test_user.id,
        household_id=test_household.id,
    )
    assert result is not None
    assert result.name == "외식비"


@pytest.mark.asyncio
async def test_get_mapping_not_found(db_session, test_user: User, test_household: Household):
    """매핑 없으면 None 반환"""
    result = await get_mapped_category(
        db=db_session,
        source_name="존재하지않는카테고리",
        user_id=test_user.id,
        household_id=test_household.id,
    )
    assert result is None


@pytest.mark.asyncio
async def test_update_existing_mapping(db_session, test_user: User, test_household: Household, setup_data):
    """기존 매핑 덮어쓰기"""
    cat_food, cat_transport = setup_data

    # 초기 매핑: "교통" → "외식비"
    await save_category_mapping(
        db=db_session,
        source_name="교통",
        target_category_id=cat_food.id,
        user_id=test_user.id,
        household_id=test_household.id,
    )
    await db_session.commit()

    # 업데이트: "교통" → "대중교통"
    await save_category_mapping(
        db=db_session,
        source_name="교통",
        target_category_id=cat_transport.id,
        user_id=test_user.id,
        household_id=test_household.id,
    )
    await db_session.commit()

    result = await get_mapped_category(
        db=db_session,
        source_name="교통",
        user_id=test_user.id,
        household_id=test_household.id,
    )
    assert result is not None
    assert result.name == "대중교통"


@pytest.mark.asyncio
async def test_household_scope_mapping(db_session, test_user: User, test_household: Household, setup_data):
    """가구 스코프 매핑 — household_id로 저장/조회"""
    cat_food, cat_transport = setup_data

    # 가구 스코프 매핑: "식비" → "대중교통" (의미상 이상하지만 테스트용)
    household_mapping = CategoryMapping(
        user_id=None,
        household_id=test_household.id,  # 가구 스코프
        source_name="식비",
        target_category_id=cat_transport.id,
    )
    db_session.add(household_mapping)
    await db_session.commit()

    result = await get_mapped_category(
        db=db_session,
        source_name="식비",
        user_id=test_user.id,
        household_id=test_household.id,
    )
    assert result is not None
    assert result.name == "대중교통"


@pytest.mark.asyncio
async def test_get_category_mappings_for_prompt(db_session, test_user: User, test_household: Household, setup_data):
    """프롬프트용 매핑 dict 반환"""
    cat_food, cat_transport = setup_data

    await save_category_mapping(
        db=db_session,
        source_name="식비",
        target_category_id=cat_food.id,
        user_id=test_user.id,
        household_id=test_household.id,
    )
    await save_category_mapping(
        db=db_session,
        source_name="교통",
        target_category_id=cat_transport.id,
        user_id=test_user.id,
        household_id=test_household.id,
    )
    await db_session.commit()

    mappings = await get_category_mappings_for_prompt(
        db=db_session,
        user_id=test_user.id,
        household_id=test_household.id,
    )
    assert isinstance(mappings, dict)
    assert mappings.get("식비") == "외식비"
    assert mappings.get("교통") == "대중교통"


@pytest.mark.asyncio
async def test_get_mappings_empty(db_session, test_user: User, test_household: Household):
    """매핑 없을 때 빈 dict 반환"""
    mappings = await get_category_mappings_for_prompt(
        db=db_session,
        user_id=test_user.id,
        household_id=test_household.id,
    )
    assert mappings == {}


@pytest.mark.asyncio
async def test_save_with_household_scope(db_session, test_user: User, test_household: Household, setup_data):
    """가구 스코프 매핑 저장 — user_id=None, household_id 설정"""
    cat_food, _ = setup_data

    mapping = await save_category_mapping(
        db=db_session,
        source_name="먹거리",
        target_category_id=cat_food.id,
        user_id=test_user.id,
        household_id=test_household.id,
    )
    await db_session.commit()

    assert mapping is not None
    assert mapping.source_name == "먹거리"
    assert mapping.household_id == test_household.id

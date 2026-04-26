import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.category_correction import CategoryCorrection
from app.models.household import Household
from app.services.correction_service import (
    get_corrections_for_household,
    save_correction,
)


@pytest.mark.asyncio
async def test_save_correction_creates_record(db_session: AsyncSession, test_household, test_user):
    """정정 저장 시 DB에 레코드가 생성된다"""
    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    correction = await save_correction(
        db_session,
        input_text="쿠팡 우유",
        category_id=category.id,
        household_id=test_household.id,
        user_id=test_user.id,
        source="edit",
    )

    assert correction.id is not None
    assert correction.input_text == "쿠팡 우유"
    assert correction.category_id == category.id
    assert correction.source == "edit"


@pytest.mark.asyncio
async def test_save_correction_empty_text_skipped(db_session: AsyncSession, test_household, test_user):
    """빈 input_text는 저장하지 않고 None 반환"""
    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    result = await save_correction(
        db_session,
        input_text="",
        category_id=category.id,
        household_id=test_household.id,
    )
    assert result is None


@pytest.mark.asyncio
async def test_get_corrections_for_household(db_session: AsyncSession, test_household, test_user):
    """가구별 정정 데이터를 최신순으로 반환한다"""
    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    for text in ["쿠팡 우유", "마켓컬리 두부", "배민 치킨"]:
        await save_correction(db_session, text, category.id, test_household.id)

    corrections = await get_corrections_for_household(db_session, test_household.id, limit=10)
    assert len(corrections) == 3
    assert corrections[0].input_text == "배민 치킨"  # 최신순


@pytest.mark.asyncio
async def test_corrections_scoped_to_household(db_session: AsyncSession, test_household, test_user):
    """다른 가구의 정정은 조회되지 않는다"""
    other_household = Household(name="다른 가구")
    db_session.add(other_household)
    await db_session.flush()

    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    await save_correction(db_session, "우리 가구 데이터", category.id, test_household.id)
    await save_correction(db_session, "다른 가구 데이터", category.id, other_household.id)

    corrections = await get_corrections_for_household(db_session, test_household.id, limit=10)
    assert len(corrections) == 1
    assert corrections[0].input_text == "우리 가구 데이터"


@pytest.mark.asyncio
async def test_save_correction_generates_embedding_when_api_key_set(db_session, test_household):
    """OPENAI_API_KEY 설정 시 임베딩이 저장된다"""
    from unittest.mock import AsyncMock, patch

    mock_vector = [0.1] * 1536
    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    with patch("app.services.correction_service.get_embedding", new=AsyncMock(return_value=mock_vector)):
        correction = await save_correction(
            db_session,
            input_text="쿠팡 두부",
            category_id=category.id,
            household_id=test_household.id,
        )

    assert correction is not None
    assert correction.embedding == mock_vector


@pytest.mark.asyncio
async def test_save_correction_graceful_degradation_on_embedding_failure(db_session, test_household):
    """임베딩 API 실패 시에도 정정 신호는 저장된다 (embedding=None)"""
    from unittest.mock import AsyncMock, patch

    category = Category(name="식비", household_id=None, user_id=None)
    db_session.add(category)
    await db_session.flush()

    with patch(
        "app.services.correction_service.get_embedding",
        new=AsyncMock(side_effect=Exception("API 오류")),
    ):
        correction = await save_correction(
            db_session,
            input_text="쿠팡 우유",
            category_id=category.id,
            household_id=test_household.id,
        )

    assert correction is not None
    assert correction.embedding is None  # 임베딩 실패해도 저장은 됨


@pytest.mark.asyncio
async def test_find_similar_corrections_returns_top_matches(db_session, test_household):
    """코사인 유사도 top-K 정정 사례를 반환한다"""
    from unittest.mock import AsyncMock, patch

    from app.models.category import Category
    from app.services.correction_service import find_similar_corrections

    food_cat = Category(name="식비", household_id=None, user_id=None)
    db_session.add(food_cat)
    await db_session.flush()

    # 유사한 벡터로 정정 데이터 생성
    milk_vector = [1.0, 0.0, 0.0] + [0.0] * 1533  # 단순 테스트 벡터
    tofu_vector = [0.9, 0.1, 0.0] + [0.0] * 1533  # 유사

    correction_milk = CategoryCorrection(
        household_id=test_household.id,
        input_text="쿠팡 우유",
        category_id=food_cat.id,
        source="edit",
        embedding=milk_vector,
    )
    correction_tofu = CategoryCorrection(
        household_id=test_household.id,
        input_text="쿠팡 두부",
        category_id=food_cat.id,
        source="edit",
        embedding=tofu_vector,
    )
    db_session.add_all([correction_milk, correction_tofu])
    await db_session.flush()

    # 우유 벡터랑 유사한 쿼리
    query_vector = [1.0, 0.0, 0.0] + [0.0] * 1533

    with patch(
        "app.services.correction_service.get_embedding",
        new=AsyncMock(return_value=query_vector),
    ):
        results = await find_similar_corrections(db_session, "마켓컬리 우유", test_household.id, top_k=3, min_similarity=0.8)

    assert len(results) >= 1
    assert any("우유" in text for text, _ in results)


@pytest.mark.asyncio
async def test_save_correction_upserts_on_high_similarity(db_session, test_household):
    """유사도 0.9 이상인 기존 정정이 있으면 새 행 추가 대신 기존 행을 갱신한다"""
    from unittest.mock import AsyncMock, patch

    food_cat = Category(name="식비", household_id=None, user_id=None)
    cafe_cat = Category(name="카페/음료", household_id=None, user_id=None)
    db_session.add_all([food_cat, cafe_cat])
    await db_session.flush()

    base_vector = [1.0, 0.0] + [0.0] * 1534  # "스타벅스 베이글" 벡터

    # 1차 저장: 스타벅스 베이글 → 식비
    with patch("app.services.correction_service.get_embedding", new=AsyncMock(return_value=base_vector)):
        first = await save_correction(db_session, "스타벅스 베이글", food_cat.id, test_household.id)
    assert first is not None
    first_id = first.id

    # 거의 동일한 벡터 (단어 순서만 다른 "베이글 스타벅스")
    similar_vector = [0.99, 0.01] + [0.0] * 1534

    # 2차 저장: 베이글 스타벅스 → 카페/음료 (upsert 기대)
    with patch("app.services.correction_service.get_embedding", new=AsyncMock(return_value=similar_vector)):
        second = await save_correction(db_session, "베이글 스타벅스", cafe_cat.id, test_household.id)

    assert second is not None
    assert second.id == first_id  # 새 행이 아닌 기존 행 갱신
    assert second.category_id == cafe_cat.id  # 카테고리가 최신 의도로 변경됨
    assert second.input_text == "베이글 스타벅스"  # 텍스트도 최신으로


@pytest.mark.asyncio
async def test_save_correction_inserts_when_not_similar(db_session, test_household):
    """유사도 0.9 미만인 경우 기존 행 갱신 없이 새 행으로 추가된다"""
    from unittest.mock import AsyncMock, patch

    food_cat = Category(name="식비", household_id=None, user_id=None)
    transport_cat = Category(name="교통", household_id=None, user_id=None)
    db_session.add_all([food_cat, transport_cat])
    await db_session.flush()

    food_vector = [1.0, 0.0] + [0.0] * 1534
    transport_vector = [0.0, 1.0] + [0.0] * 1534  # 직교 → 유사도 0.0

    with patch("app.services.correction_service.get_embedding", new=AsyncMock(return_value=food_vector)):
        first = await save_correction(db_session, "편의점 도시락", food_cat.id, test_household.id)

    with patch("app.services.correction_service.get_embedding", new=AsyncMock(return_value=transport_vector)):
        second = await save_correction(db_session, "버스 정기권", transport_cat.id, test_household.id)

    assert second is not None
    assert second.id != first.id  # 별도 행으로 추가됨


@pytest.mark.asyncio
async def test_find_similar_corrections_no_embeddings_returns_empty(db_session, test_household):
    """임베딩 없는 정정 데이터만 있을 때 빈 리스트 반환"""
    from unittest.mock import AsyncMock, patch

    from app.models.category import Category
    from app.services.correction_service import find_similar_corrections

    food_cat = Category(name="식비", household_id=None, user_id=None)
    db_session.add(food_cat)
    await db_session.flush()

    correction = CategoryCorrection(
        household_id=test_household.id,
        input_text="쿠팡 우유",
        category_id=food_cat.id,
        source="edit",
        embedding=None,  # 임베딩 없음
    )
    db_session.add(correction)
    await db_session.flush()

    with patch(
        "app.services.correction_service.get_embedding",
        new=AsyncMock(return_value=[1.0] * 1536),
    ):
        results = await find_similar_corrections(db_session, "쿠팡 두부", test_household.id)

    assert results == []

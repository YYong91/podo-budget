"""
데이터베이스 세션 및 연결 테스트

- get_db() 의존성 함수 테스트
- 비동기 세션 생성 및 트랜잭션 격리성 검증
"""

import pytest
from sqlalchemy import select

from app.models.category import Category


@pytest.mark.asyncio
async def test_get_db_session(db_session):
    """get_db() fixture가 정상적으로 세션을 제공하는지 테스트"""
    assert db_session is not None

    # 세션으로 데이터 생성 가능한지 확인
    category = Category(name="테스트", description="테스트 카테고리")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    assert category.id is not None
    assert category.name == "테스트"


@pytest.mark.asyncio
async def test_db_session_isolation(db_session):
    """각 테스트의 DB 세션이 격리되는지 테스트"""
    # 데이터 생성
    category = Category(name="격리 테스트")
    db_session.add(category)
    await db_session.commit()

    # 조회 확인
    result = await db_session.execute(select(Category))
    categories = result.scalars().all()
    assert len(categories) == 1


@pytest.mark.asyncio
async def test_db_session_rollback_on_error(db_session):
    """에러 발생 시 롤백이 정상 작동하는지 테스트"""
    # 정상 데이터 생성
    category1 = Category(name="정상 카테고리")
    db_session.add(category1)
    await db_session.commit()

    # 중복 이름으로 에러 발생 시도 (unique 제약)
    try:
        category2 = Category(name="정상 카테고리")
        db_session.add(category2)
        await db_session.commit()
    except Exception:
        await db_session.rollback()

    # 롤백 후에도 첫 번째 데이터는 유지되어야 함
    result = await db_session.execute(select(Category))
    categories = result.scalars().all()
    assert len(categories) == 1
    assert categories[0].name == "정상 카테고리"


@pytest.mark.asyncio
async def test_get_db_generator(db_session):
    """get_db() fixture가 AsyncSession을 제공하는지 테스트"""
    # db_session fixture가 이미 get_db 대체 세션을 사용하므로
    # 세션 타입과 동작만 검증
    assert db_session is not None

    category = Category(name="제너레이터 테스트")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    assert category.id is not None


@pytest.mark.asyncio
async def test_db_transaction_commit(db_session):
    """트랜잭션 커밋이 정상 작동하는지 테스트"""
    category = Category(name="커밋 테스트")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 커밋 후 ID가 할당되었는지 확인
    assert category.id is not None

    # 다시 조회하여 DB에 저장되었는지 확인
    result = await db_session.execute(select(Category).where(Category.id == category.id))
    fetched = result.scalar_one()
    assert fetched.name == "커밋 테스트"


@pytest.mark.asyncio
async def test_db_multiple_operations(db_session):
    """여러 작업을 순차적으로 수행하는 테스트"""
    # 여러 카테고리 생성
    categories = [Category(name=f"카테고리{i}") for i in range(5)]
    db_session.add_all(categories)
    await db_session.commit()

    # 모두 조회
    result = await db_session.execute(select(Category))
    all_categories = result.scalars().all()
    assert len(all_categories) == 5

    # 하나 수정
    first = all_categories[0]
    first.name = "수정된 이름"
    await db_session.commit()

    # 수정 확인
    result = await db_session.execute(select(Category).where(Category.id == first.id))
    updated = result.scalar_one()
    assert updated.name == "수정된 이름"

    # 하나 삭제
    await db_session.delete(all_categories[1])
    await db_session.commit()

    # 삭제 확인
    result = await db_session.execute(select(Category))
    remaining = result.scalars().all()
    assert len(remaining) == 4

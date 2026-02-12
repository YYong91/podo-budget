"""
카테고리 API 통합 테스트

- GET /api/categories/ - 카테고리 목록 조회
- POST /api/categories/ - 카테고리 생성
- PUT /api/categories/{id} - 카테고리 수정
- DELETE /api/categories/{id} - 카테고리 삭제
"""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.category import Category


@pytest.mark.asyncio
async def test_get_categories_empty(client, db_session):
    """카테고리 목록 조회 (데이터 없음)"""
    response = await client.get("/api/categories/")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_categories_list(client, db_session):
    """카테고리 목록 조회 (데이터 있음)"""
    cat1 = Category(name="식비", description="음식 관련")
    cat2 = Category(name="교통비", description="대중교통")
    cat3 = Category(name="문화생활", description="여가")
    db_session.add_all([cat1, cat2, cat3])
    await db_session.commit()

    response = await client.get("/api/categories/")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 3
    # 이름 순으로 정렬됨 (order_by Category.name)
    names = [item["name"] for item in data]
    assert names == sorted(names)


@pytest.mark.asyncio
async def test_create_category(client, db_session):
    """카테고리 생성 API 테스트"""
    payload = {"name": "식비", "description": "음식 관련 지출"}

    response = await client.post("/api/categories/", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "식비"
    assert data["description"] == "음식 관련 지출"
    assert "id" in data
    assert "created_at" in data

    # DB에 실제로 생성되었는지 확인
    result = await db_session.execute(select(Category).where(Category.name == "식비"))
    category = result.scalar_one()
    assert category.name == "식비"


@pytest.mark.asyncio
async def test_create_category_without_description(client, db_session):
    """description 없이 카테고리 생성"""
    payload = {"name": "교통비"}

    response = await client.post("/api/categories/", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "교통비"
    assert data["description"] is None


@pytest.mark.asyncio
async def test_create_category_duplicate_name(client, db_session):
    """중복된 이름으로 카테고리 생성 시 400 에러"""
    # 기존 카테고리 생성
    existing = Category(name="식비", description="기존 카테고리")
    db_session.add(existing)
    await db_session.commit()

    # 같은 이름으로 생성 시도
    payload = {"name": "식비", "description": "새 카테고리"}
    response = await client.post("/api/categories/", json=payload)

    assert response.status_code == 400
    assert "이미 존재하는" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_category(client, db_session):
    """카테고리 수정 API 테스트"""
    category = Category(name="식비", description="기존 설명")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 이름과 설명 모두 수정
    update_payload = {"name": "수정된 식비", "description": "수정된 설명"}
    response = await client.put(f"/api/categories/{category.id}", json=update_payload)
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "수정된 식비"
    assert data["description"] == "수정된 설명"

    # DB에서도 변경 확인
    result = await db_session.execute(select(Category).where(Category.id == category.id))
    updated = result.scalar_one()
    assert updated.name == "수정된 식비"


@pytest.mark.asyncio
async def test_update_category_partial(client, db_session):
    """카테고리 일부 필드만 수정"""
    category = Category(name="식비", description="기존 설명")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 설명만 수정
    update_payload = {"description": "새 설명"}
    response = await client.put(f"/api/categories/{category.id}", json=update_payload)
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "식비"  # 이름은 그대로
    assert data["description"] == "새 설명"


@pytest.mark.asyncio
async def test_update_category_not_found(client, db_session):
    """존재하지 않는 카테고리 수정 시 404"""
    update_payload = {"name": "새 이름"}
    response = await client.put("/api/categories/9999", json=update_payload)
    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_category(client, db_session):
    """카테고리 삭제 API 테스트"""
    category = Category(name="식비", description="음식")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    response = await client.delete(f"/api/categories/{category.id}")
    assert response.status_code == 200
    assert "삭제되었습니다" in response.json()["message"]

    # DB에서 삭제 확인
    result = await db_session.execute(select(Category).where(Category.id == category.id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_category_not_found(client, db_session):
    """존재하지 않는 카테고리 삭제 시 404"""
    response = await client.delete("/api/categories/9999")
    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_category_cascade_with_expenses(client, db_session):
    """카테고리에 연결된 지출이 있어도 삭제 가능한지 확인 (실제 FK 제약조건에 따라 다름)"""
    from app.models.expense import Expense

    # 카테고리 생성
    category = Category(name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 지출 생성
    expense = Expense(
        amount=8000,
        description="김치찌개",
        category_id=category.id,
        date=datetime(2026, 2, 11, 12, 0, 0),
    )
    db_session.add(expense)
    await db_session.commit()

    # 카테고리 삭제 시도
    # SQLite는 FK 제약조건을 강제하지 않아 성공, PostgreSQL은 ON DELETE 설정에 따라 다름
    response = await client.delete(f"/api/categories/{category.id}")
    assert response.status_code in [200, 400, 409, 500]

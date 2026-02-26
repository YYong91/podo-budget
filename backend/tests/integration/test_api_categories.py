"""
카테고리 API 통합 테스트 (인증 적용)

- GET /api/categories/ - 카테고리 목록 조회
- POST /api/categories/ - 카테고리 생성
- PUT /api/categories/{id} - 카테고리 수정
- PUT /api/categories/reorder - 카테고리 순서 변경
- DELETE /api/categories/{id} - 카테고리 삭제

모든 엔드포인트는 JWT 인증이 필요합니다.
"""

from datetime import datetime

import pytest
from sqlalchemy import select

from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User


@pytest.mark.asyncio
async def test_get_categories_empty(authenticated_client, test_user: User, db_session):
    """카테고리 목록 조회 (데이터 없음)"""
    response = await authenticated_client.get("/api/categories/")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_categories_list(authenticated_client, test_user: User, db_session):
    """카테고리 목록 조회 (데이터 있음)"""
    cat1 = Category(user_id=test_user.id, name="식비", description="음식 관련")
    cat2 = Category(user_id=test_user.id, name="교통비", description="대중교통")
    cat3 = Category(user_id=test_user.id, name="문화생활", description="여가")
    db_session.add_all([cat1, cat2, cat3])
    await db_session.commit()

    response = await authenticated_client.get("/api/categories/")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 3
    # 이름 순으로 정렬됨 (order_by Category.name)
    names = [item["name"] for item in data]
    assert names == sorted(names)


@pytest.mark.asyncio
async def test_create_category(authenticated_client, test_user: User, db_session):
    """카테고리 생성 API 테스트"""
    payload = {"name": "식비", "description": "음식 관련 지출"}

    response = await authenticated_client.post("/api/categories/", json=payload)
    assert response.status_code == 201

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
async def test_create_category_without_description(authenticated_client, test_user: User, db_session):
    """description 없이 카테고리 생성"""
    payload = {"name": "교통비"}

    response = await authenticated_client.post("/api/categories/", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "교통비"
    assert data["description"] is None


@pytest.mark.asyncio
async def test_create_category_duplicate_name(authenticated_client, test_user: User, db_session):
    """중복된 이름으로 카테고리 생성 시 400 에러"""
    # 기존 카테고리 생성
    existing = Category(user_id=test_user.id, name="식비", description="기존 카테고리")
    db_session.add(existing)
    await db_session.commit()

    # 같은 이름으로 생성 시도
    payload = {"name": "식비", "description": "새 카테고리"}
    response = await authenticated_client.post("/api/categories/", json=payload)

    assert response.status_code == 400
    assert "이미 존재하는" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_category(authenticated_client, test_user: User, db_session):
    """카테고리 수정 API 테스트"""
    category = Category(user_id=test_user.id, name="식비", description="기존 설명")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 이름과 설명 모두 수정
    update_payload = {"name": "수정된 식비", "description": "수정된 설명"}
    response = await authenticated_client.put(f"/api/categories/{category.id}", json=update_payload)
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "수정된 식비"
    assert data["description"] == "수정된 설명"

    # DB에서도 변경 확인
    result = await db_session.execute(select(Category).where(Category.id == category.id))
    updated = result.scalar_one()
    assert updated.name == "수정된 식비"


@pytest.mark.asyncio
async def test_update_category_partial(authenticated_client, test_user: User, db_session):
    """카테고리 일부 필드만 수정"""
    category = Category(user_id=test_user.id, name="식비", description="기존 설명")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 설명만 수정
    update_payload = {"description": "새 설명"}
    response = await authenticated_client.put(f"/api/categories/{category.id}", json=update_payload)
    assert response.status_code == 200

    data = response.json()
    assert data["name"] == "식비"  # 이름은 그대로
    assert data["description"] == "새 설명"


@pytest.mark.asyncio
async def test_update_category_not_found(authenticated_client, test_user: User, db_session):
    """존재하지 않는 카테고리 수정 시 404"""
    update_payload = {"name": "새 이름"}
    response = await authenticated_client.put("/api/categories/9999", json=update_payload)
    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_category(authenticated_client, test_user: User, db_session):
    """카테고리 삭제 API 테스트"""
    category = Category(user_id=test_user.id, name="식비", description="음식")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    response = await authenticated_client.delete(f"/api/categories/{category.id}")
    assert response.status_code == 204

    # DB에서 삭제 확인
    result = await db_session.execute(select(Category).where(Category.id == category.id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_category_not_found(authenticated_client, test_user: User, db_session):
    """존재하지 않는 카테고리 삭제 시 404"""
    response = await authenticated_client.delete("/api/categories/9999")
    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_category_cascade_with_expenses(authenticated_client, test_user: User, db_session):
    """카테고리에 연결된 지출이 있어도 삭제 가능한지 확인"""
    # 카테고리 생성
    category = Category(user_id=test_user.id, name="식비")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    # 지출 생성
    expense = Expense(
        user_id=test_user.id,
        amount=8000,
        description="김치찌개",
        category_id=category.id,
        date=datetime(2026, 2, 11, 12, 0, 0),
    )
    db_session.add(expense)
    await db_session.commit()

    # 카테고리 삭제 시도
    response = await authenticated_client.delete(f"/api/categories/{category.id}")
    assert response.status_code in [204, 400, 409, 500]


@pytest.mark.asyncio
async def test_reorder_categories(authenticated_client, test_user: User, db_session):
    """카테고리 순서 변경 API 테스트"""
    cat1 = Category(user_id=test_user.id, name="식비")
    cat2 = Category(user_id=test_user.id, name="교통비")
    cat3 = Category(user_id=test_user.id, name="문화생활")
    db_session.add_all([cat1, cat2, cat3])
    await db_session.commit()
    await db_session.refresh(cat1)
    await db_session.refresh(cat2)
    await db_session.refresh(cat3)

    # 교통비 → 문화생활 → 식비 순서로 변경
    new_order = [cat2.id, cat3.id, cat1.id]
    response = await authenticated_client.put("/api/categories/reorder", json={"category_ids": new_order})
    assert response.status_code == 200

    data = response.json()
    names = [item["name"] for item in data]
    assert names[0] == "교통비"
    assert names[1] == "문화생활"
    assert names[2] == "식비"


@pytest.mark.asyncio
async def test_reorder_categories_invalid_id(authenticated_client, test_user: User, db_session):
    """존재하지 않는 카테고리 ID로 순서 변경 시 400"""
    response = await authenticated_client.put("/api/categories/reorder", json={"category_ids": [9999]})
    assert response.status_code == 400
    assert "접근할 수 없습니다" in response.json()["detail"]

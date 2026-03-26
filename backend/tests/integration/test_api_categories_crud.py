"""카테고리 CRUD 커버리지 테스트

api/categories.py 미커버 라인: 61-68, 82-96, 112-134, 151-172, 188-204
"""

import pytest

from app.models.category import Category


@pytest.mark.asyncio
async def test_create_category(authenticated_client, test_user, test_household, db_session):
    """카테고리 생성"""
    resp = await authenticated_client.post(
        "/api/categories",
        json={"name": "테스트카테고리", "type": "expense"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "테스트카테고리"
    assert data["is_system"] is False


@pytest.mark.asyncio
async def test_create_duplicate_category(authenticated_client, test_user, test_household, db_session):
    """중복 카테고리 생성 → 400"""
    cat = Category(name="식비", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.commit()

    resp = await authenticated_client.post(
        "/api/categories",
        json={"name": "식비", "type": "expense"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reorder_categories(authenticated_client, test_user, test_household, db_session):
    """카테고리 순서 변경"""
    cats = []
    for name in ("A카테고리", "B카테고리", "C카테고리"):
        cat = Category(name=name, type="expense", household_id=test_household.id)
        db_session.add(cat)
        cats.append(cat)
    await db_session.commit()
    for c in cats:
        await db_session.refresh(c)

    resp = await authenticated_client.put(
        "/api/categories/reorder",
        json={"category_ids": [cats[2].id, cats[0].id, cats[1].id]},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_reorder_inaccessible_category(authenticated_client, test_user, test_household, db_session):
    """접근 불가 카테고리 순서 변경 → 400"""
    resp = await authenticated_client.put(
        "/api/categories/reorder",
        json={"category_ids": [99999]},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_category(authenticated_client, test_user, test_household, db_session):
    """카테고리 수정"""
    cat = Category(name="원본", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    resp = await authenticated_client.put(
        f"/api/categories/{cat.id}",
        json={"name": "수정됨"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "수정됨"


@pytest.mark.asyncio
async def test_update_category_not_found(authenticated_client, test_user, test_household, db_session):
    """존재하지 않는 카테고리 수정 → 404"""
    resp = await authenticated_client.put("/api/categories/99999", json={"name": "테스트"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_system_category(authenticated_client, test_user, test_household, db_session):
    """시스템 카테고리 수정 → 403"""
    cat = Category(name="시스템카테고리", type="expense", user_id=None, household_id=None)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    resp = await authenticated_client.put(f"/api/categories/{cat.id}", json={"name": "변경"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_category(authenticated_client, test_user, test_household, db_session):
    """카테고리 삭제"""
    cat = Category(name="삭제용", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    resp = await authenticated_client.delete(f"/api/categories/{cat.id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_category_not_found(authenticated_client, test_user, test_household, db_session):
    """존재하지 않는 카테고리 삭제 → 404"""
    resp = await authenticated_client.delete("/api/categories/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_system_category(authenticated_client, test_user, test_household, db_session):
    """시스템 카테고리 삭제 → 403"""
    cat = Category(name="시스템", type="expense", user_id=None, household_id=None)
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)

    resp = await authenticated_client.delete(f"/api/categories/{cat.id}")
    assert resp.status_code == 403

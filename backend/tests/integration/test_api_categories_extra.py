"""카테고리 API 추가 통합 테스트

시스템 카테고리(user_id=None) 보호 테스트:
- 시스템 카테고리 수정 시도 → 403
- 시스템 카테고리 삭제 시도 → 403
- 다른 사용자 카테고리 수정/삭제 시도 → 404 (IDOR 방지)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.user import User


@pytest.mark.asyncio
async def test_update_system_category_forbidden(authenticated_client: AsyncClient, test_user: User, db_session: AsyncSession):
    """시스템 카테고리(user_id=None)는 수정할 수 없음 → 403"""
    # 시스템 카테고리 생성 (user_id=None)
    system_cat = Category(user_id=None, name="식비", description="시스템 기본")
    db_session.add(system_cat)
    await db_session.commit()
    await db_session.refresh(system_cat)

    response = await authenticated_client.put(
        f"/api/categories/{system_cat.id}",
        json={"name": "수정된 식비"},
    )

    assert response.status_code == 403
    assert "시스템 카테고리는 수정할 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_system_category_forbidden(authenticated_client: AsyncClient, test_user: User, db_session: AsyncSession):
    """시스템 카테고리(user_id=None)는 삭제할 수 없음 → 403"""
    # 시스템 카테고리 생성 (user_id=None)
    system_cat = Category(user_id=None, name="교통비", description="시스템 기본")
    db_session.add(system_cat)
    await db_session.commit()
    await db_session.refresh(system_cat)

    response = await authenticated_client.delete(f"/api/categories/{system_cat.id}")

    assert response.status_code == 403
    assert "시스템 카테고리는 삭제할 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_other_user_category_not_found(authenticated_client: AsyncClient, test_user: User, test_user2: User, db_session: AsyncSession):
    """다른 사용자의 카테고리 수정 시도 → 404 (IDOR 방지)"""
    # 다른 사용자(test_user2)의 카테고리 생성
    other_cat = Category(user_id=test_user2.id, name="다른사람 카테고리")
    db_session.add(other_cat)
    await db_session.commit()
    await db_session.refresh(other_cat)

    # test_user로 인증된 클라이언트가 수정 시도
    response = await authenticated_client.put(
        f"/api/categories/{other_cat.id}",
        json={"name": "내꺼로 변경"},
    )

    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_other_user_category_not_found(authenticated_client: AsyncClient, test_user: User, test_user2: User, db_session: AsyncSession):
    """다른 사용자의 카테고리 삭제 시도 → 404 (IDOR 방지)"""
    # 다른 사용자(test_user2)의 카테고리 생성
    other_cat = Category(user_id=test_user2.id, name="다른사람 카테고리")
    db_session.add(other_cat)
    await db_session.commit()
    await db_session.refresh(other_cat)

    response = await authenticated_client.delete(f"/api/categories/{other_cat.id}")

    assert response.status_code == 404
    assert "찾을 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_categories_includes_system_and_user(authenticated_client: AsyncClient, test_user: User, db_session: AsyncSession):
    """카테고리 목록에 시스템 카테고리 + 개인 카테고리 모두 포함"""
    # 시스템 카테고리 생성
    system_cat = Category(user_id=None, name="교통비")
    db_session.add(system_cat)

    # 개인 카테고리 생성
    user_cat = Category(user_id=test_user.id, name="커피")
    db_session.add(user_cat)

    await db_session.commit()

    response = await authenticated_client.get("/api/categories/")
    assert response.status_code == 200

    data = response.json()
    names = [c["name"] for c in data]
    assert "교통비" in names
    assert "커피" in names

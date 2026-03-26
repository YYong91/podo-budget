"""카테고리 is_savings 플래그 테스트

카테고리에 저축성 지출 여부를 표시하는 is_savings 필드를 테스트한다.
- 기본값은 false
- 수정으로 true 변경 가능
- 목록 조회 시 필드 포함
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_category_create_default_is_savings_false(authenticated_client: AsyncClient) -> None:
    """카테고리 생성 시 is_savings 기본값이 false인지 확인"""
    response = await authenticated_client.post(
        "/api/categories",
        json={
            "name": "테스트카테고리",
            "type": "expense",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_savings"] is False


@pytest.mark.asyncio
async def test_category_create_with_is_savings_true(authenticated_client: AsyncClient) -> None:
    """카테고리 생성 시 is_savings=true로 설정 가능한지 확인"""
    response = await authenticated_client.post(
        "/api/categories",
        json={
            "name": "적금",
            "type": "expense",
            "is_savings": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["is_savings"] is True


@pytest.mark.asyncio
async def test_category_update_is_savings(authenticated_client: AsyncClient) -> None:
    """카테고리 수정 시 is_savings를 true로 변경 가능한지 확인"""
    # 먼저 카테고리 생성
    create_resp = await authenticated_client.post(
        "/api/categories",
        json={
            "name": "투자",
            "type": "expense",
        },
    )
    assert create_resp.status_code == 201
    cat_id = create_resp.json()["id"]
    assert create_resp.json()["is_savings"] is False

    # is_savings를 true로 수정
    update_resp = await authenticated_client.put(
        f"/api/categories/{cat_id}",
        json={
            "is_savings": True,
        },
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["is_savings"] is True


@pytest.mark.asyncio
async def test_category_list_includes_is_savings(authenticated_client: AsyncClient) -> None:
    """카테고리 목록 조회 시 is_savings 필드가 포함되는지 확인"""
    # 저축성 카테고리 생성
    await authenticated_client.post(
        "/api/categories",
        json={
            "name": "적금",
            "type": "expense",
            "is_savings": True,
        },
    )
    # 일반 카테고리 생성
    await authenticated_client.post(
        "/api/categories",
        json={
            "name": "식비테스트",
            "type": "expense",
        },
    )

    response = await authenticated_client.get("/api/categories", params={"type": "expense"})
    assert response.status_code == 200
    categories = response.json()

    # 모든 카테고리에 is_savings 필드가 존재
    for cat in categories:
        assert "is_savings" in cat

    # 저축성 카테고리 확인
    savings_cats = [c for c in categories if c["name"] == "적금"]
    assert len(savings_cats) == 1
    assert savings_cats[0]["is_savings"] is True

    # 일반 카테고리 확인
    normal_cats = [c for c in categories if c["name"] == "식비테스트"]
    assert len(normal_cats) == 1
    assert normal_cats[0]["is_savings"] is False

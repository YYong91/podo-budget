"""계좌 API 통합 테스트"""

import pytest

from app.models.user import User

# --- Helper ---


def _account_payload(**overrides):
    """계좌 생성 페이로드"""
    base = {
        "name": "KB국민은행",
        "type": "bank",
        "institution": "국민은행",
        "memo": "급여 계좌",
    }
    base.update(overrides)
    return base


# --- CRUD ---


@pytest.mark.asyncio
async def test_create_account(authenticated_client, test_user: User):
    """계좌 등록 성공"""
    response = await authenticated_client.post("/api/accounts", json=_account_payload())
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "KB국민은행"
    assert data["type"] == "bank"
    assert data["institution"] == "국민은행"
    assert data["memo"] == "급여 계좌"
    assert data["created_by"] == test_user.id


@pytest.mark.asyncio
async def test_create_brokerage_account(authenticated_client):
    """증권 계좌 등록"""
    response = await authenticated_client.post(
        "/api/accounts",
        json=_account_payload(name="키움증권", type="brokerage", institution="키움"),
    )
    assert response.status_code == 201
    assert response.json()["type"] == "brokerage"


@pytest.mark.asyncio
async def test_create_account_invalid_type(authenticated_client):
    """유효하지 않은 계좌 타입으로 생성 시 422"""
    response = await authenticated_client.post(
        "/api/accounts",
        json=_account_payload(type="invalid_type"),
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_accounts(authenticated_client, test_user: User):
    """계좌 목록 조회"""
    # 계좌 2개 생성
    await authenticated_client.post("/api/accounts", json=_account_payload())
    await authenticated_client.post(
        "/api/accounts",
        json=_account_payload(name="키움증권", type="brokerage"),
    )

    response = await authenticated_client.get("/api/accounts")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_account_by_id(authenticated_client):
    """계좌 단건 조회"""
    create_res = await authenticated_client.post("/api/accounts", json=_account_payload())
    account_id = create_res.json()["id"]

    response = await authenticated_client.get(f"/api/accounts/{account_id}")
    assert response.status_code == 200
    assert response.json()["id"] == account_id
    assert response.json()["name"] == "KB국민은행"


@pytest.mark.asyncio
async def test_get_nonexistent_account(authenticated_client):
    """존재하지 않는 계좌 조회 시 404"""
    response = await authenticated_client.get("/api/accounts/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_account(authenticated_client):
    """계좌 수정"""
    create_res = await authenticated_client.post("/api/accounts", json=_account_payload())
    account_id = create_res.json()["id"]

    response = await authenticated_client.put(
        f"/api/accounts/{account_id}",
        json={"name": "KB국민은행 수정", "memo": "수정된 메모"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "KB국민은행 수정"
    assert response.json()["memo"] == "수정된 메모"


@pytest.mark.asyncio
async def test_update_nonexistent_account(authenticated_client):
    """존재하지 않는 계좌 수정 시 404"""
    response = await authenticated_client.put(
        "/api/accounts/99999",
        json={"name": "없는 계좌"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_account(authenticated_client):
    """계좌 삭제"""
    create_res = await authenticated_client.post("/api/accounts", json=_account_payload())
    account_id = create_res.json()["id"]

    response = await authenticated_client.delete(f"/api/accounts/{account_id}")
    assert response.status_code == 204

    # 삭제 후 조회하면 404
    get_res = await authenticated_client.get(f"/api/accounts/{account_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_account(authenticated_client):
    """존재하지 않는 계좌 삭제 시 404"""
    response = await authenticated_client.delete("/api/accounts/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_other_user_cannot_modify_account(
    authenticated_client,
    authenticated_client2,
    test_user: User,
    test_user2: User,
):
    """다른 사용자의 계좌를 수정/삭제할 수 없다"""
    # user1이 계좌 생성
    create_res = await authenticated_client.post("/api/accounts", json=_account_payload())
    account_id = create_res.json()["id"]

    # user2가 수정 시도 → 404 (권한 없음)
    put_res = await authenticated_client2.put(
        f"/api/accounts/{account_id}",
        json={"name": "해킹 시도"},
    )
    assert put_res.status_code == 404

    # user2가 삭제 시도 → 404 (권한 없음)
    del_res = await authenticated_client2.delete(f"/api/accounts/{account_id}")
    assert del_res.status_code == 404

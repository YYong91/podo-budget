"""계좌 CRUD 커버리지 테스트

api/accounts.py 미커버 라인: 27-28, 40-41, 52-60, 76-79, 94-97
"""

import pytest

from app.models.account import Account


@pytest.mark.asyncio
async def test_create_account(authenticated_client, test_user, test_household, db_session):
    """계좌 등록"""
    resp = await authenticated_client.post(
        "/api/accounts",
        json={
            "name": "KB국민은행",
            "type": "bank",
            "institution": "KB",
            "memo": "주거래",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "KB국민은행"
    assert data["type"] == "bank"


@pytest.mark.asyncio
async def test_get_accounts(authenticated_client, test_user, test_household, db_session):
    """계좌 목록 조회"""
    acc = Account(
        household_id=test_household.id,
        created_by=test_user.id,
        name="키움증권",
        type="brokerage",
    )
    db_session.add(acc)
    await db_session.commit()

    resp = await authenticated_client.get("/api/accounts")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_get_account_detail(authenticated_client, test_user, test_household, db_session):
    """계좌 상세 조회"""
    acc = Account(
        household_id=test_household.id,
        created_by=test_user.id,
        name="업비트",
        type="crypto_exchange",
    )
    db_session.add(acc)
    await db_session.commit()
    await db_session.refresh(acc)

    resp = await authenticated_client.get(f"/api/accounts/{acc.id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "업비트"


@pytest.mark.asyncio
async def test_get_account_not_found(authenticated_client):
    """존재하지 않는 계좌 조회 → 404"""
    resp = await authenticated_client.get("/api/accounts/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_account(authenticated_client, test_user, test_household, db_session):
    """계좌 수정"""
    acc = Account(
        household_id=test_household.id,
        created_by=test_user.id,
        name="원본",
        type="bank",
    )
    db_session.add(acc)
    await db_session.commit()
    await db_session.refresh(acc)

    resp = await authenticated_client.put(
        f"/api/accounts/{acc.id}",
        json={"name": "수정됨", "memo": "메모 추가"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "수정됨"


@pytest.mark.asyncio
async def test_update_account_not_found(authenticated_client):
    """존재하지 않는 계좌 수정 → 404"""
    resp = await authenticated_client.put("/api/accounts/99999", json={"name": "테스트"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_account(authenticated_client, test_user, test_household, db_session):
    """계좌 삭제"""
    acc = Account(
        household_id=test_household.id,
        created_by=test_user.id,
        name="삭제할 계좌",
        type="other",
    )
    db_session.add(acc)
    await db_session.commit()
    await db_session.refresh(acc)

    resp = await authenticated_client.delete(f"/api/accounts/{acc.id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_account_not_found(authenticated_client):
    """존재하지 않는 계좌 삭제 → 404"""
    resp = await authenticated_client.delete("/api/accounts/99999")
    assert resp.status_code == 404

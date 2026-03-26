"""E2E cleanup 엔드포인트 통합 테스트

/api/e2e/cleanup이 유저의 데이터를 올바르게 삭제하는지 검증합니다.
DEBUG=True를 설정하여 엔드포인트가 활성화된 상태에서 테스트합니다.
"""

from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.income import Income
from app.models.user import User


@pytest.fixture(autouse=True)
def _enable_debug(monkeypatch):
    """E2E 엔드포인트가 DEBUG 모드에서만 동작하므로 활성화"""
    monkeypatch.setattr("app.core.config.settings.DEBUG", True)


@pytest.mark.asyncio
async def test_e2e_cleanup_deletes_user_data(authenticated_client, test_user: User, test_household: Household, db_session: AsyncSession):
    """cleanup이 해당 유저의 가구 데이터를 전부 삭제"""
    # 테스트 데이터 생성
    category = Category(name="테스트 카테고리", type="expense", household_id=test_household.id)
    db_session.add(category)
    await db_session.flush()

    expense = Expense(
        amount=8000,
        description="cleanup 테스트 지출",
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=category.id,
        date=datetime.now(),
    )
    income = Income(
        amount=3000000,
        description="cleanup 테스트 수입",
        user_id=test_user.id,
        household_id=test_household.id,
        date=datetime.now(),
    )
    db_session.add_all([expense, income])
    await db_session.commit()

    # cleanup 호출
    response = await authenticated_client.post(
        "/api/e2e/cleanup",
        json={"user_id": test_user.id},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["deleted"]["expenses"] >= 1
    assert data["deleted"]["incomes"] >= 1
    assert data["deleted"]["categories"] >= 1


@pytest.mark.asyncio
async def test_e2e_cleanup_no_data(authenticated_client, test_user: User):
    """데이터가 없는 유저의 cleanup은 빈 결과 반환"""
    response = await authenticated_client.post(
        "/api/e2e/cleanup",
        json={"user_id": test_user.id},
    )
    assert response.status_code == 200

    data = response.json()
    # 데이터가 없으므로 0건 삭제
    for count in data["deleted"].values():
        assert count == 0


@pytest.mark.asyncio
async def test_e2e_cleanup_nonexistent_user(authenticated_client):
    """존재하지 않는 유저 ID는 빈 결과 반환"""
    response = await authenticated_client.post(
        "/api/e2e/cleanup",
        json={"user_id": 99999},
    )
    assert response.status_code == 200
    assert response.json()["deleted"] == {}


@pytest.mark.asyncio
async def test_e2e_cleanup_blocked_in_production(authenticated_client, monkeypatch):
    """DEBUG=False면 404 반환"""
    monkeypatch.setattr("app.core.config.settings.DEBUG", False)
    response = await authenticated_client.post(
        "/api/e2e/cleanup",
        json={"user_id": 1},
    )
    assert response.status_code == 404

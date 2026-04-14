"""인사이트 API 커버리지 테스트

api/insights.py 미커버 라인: 62-118
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.models.category import Category
from app.models.expense import Expense


@pytest.mark.asyncio
async def test_generate_insights_no_data(authenticated_client, test_user, test_household, db_session):
    """지출 데이터 없을 때 인사이트"""
    resp = await authenticated_client.post(
        "/api/insights/generate?month=2026-03",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "기록된 지출이 없습니다" in data["insights"]


@pytest.mark.asyncio
async def test_generate_insights_with_data(authenticated_client, test_user, test_household, db_session, mock_llm_generate_insights):
    """지출 데이터 있을 때 인사이트 생성"""
    cat = Category(name="식비", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=500000,
        description="식비",
        category_id=cat.id,
        date=datetime(2026, 3, 15),
    )
    db_session.add(exp)
    await db_session.commit()

    resp = await authenticated_client.post(
        "/api/insights/generate?month=2026-03",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["month"] == "2026-03"
    assert data["insights"] is not None


@pytest.mark.asyncio
async def test_generate_comprehensive_insights(authenticated_client, test_user, test_household, db_session):
    """종합 재무 인사이트 생성"""
    mock_result = {
        "findings": [{"what": "식비가 줄었습니다", "so_what": "절약 효과", "now_what": "유지하세요"}],
        "action_items": [{"title": "저축 늘리기", "description": "매달 10만원씩"}],
        "encouragement": "잘 하고 있습니다!",
    }

    # LLM 프로바이더 캐시 클리어 후 모킹
    from app.services.llm_service import _provider_cache

    _provider_cache.clear()

    with patch("app.services.llm_service._create_provider") as mock_create:
        mock_llm = AsyncMock()
        # API는 generate_comprehensive_insights_v2를 호출한다 (V2 전환 후)
        mock_llm.generate_comprehensive_insights_v2.return_value = mock_result
        mock_create.return_value = mock_llm

        resp = await authenticated_client.post(
            "/api/insights/generate-comprehensive",
            json={
                "month": "2026-03",
                "expense_total": 500000,
                "income_total": 3000000,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["month"] == "2026-03"

    _provider_cache.clear()

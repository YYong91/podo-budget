"""피드백 CRUD 커버리지 테스트

api/feedback.py 미커버 라인: 62-77, 87-88, 107-108, 125-138
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import settings
from app.models.feedback import Feedback


@pytest.mark.asyncio
async def test_create_feedback(authenticated_client, test_user, test_household, db_session):
    """피드백 제출"""
    with patch("app.api.feedback.notify_admin_feedback", new_callable=AsyncMock):
        resp = await authenticated_client.post(
            "/api/feedback",
            json={
                "type": "feature",
                "title": "새 기능 요청",
                "content": "다크모드 추가해주세요",
            },
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "새 기능 요청"
    assert data["status"] == "new"


@pytest.mark.asyncio
async def test_get_my_feedbacks(authenticated_client, test_user, test_household, db_session):
    """내 피드백 목록 조회"""
    fb = Feedback(
        user_id=test_user.id,
        type="bug",
        title="버그",
        content="테스트 버그",
    )
    db_session.add(fb)
    await db_session.commit()

    resp = await authenticated_client.get("/api/feedback/mine")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "버그"


@pytest.mark.asyncio
async def test_get_all_feedbacks_admin(authenticated_client, test_user, test_household, db_session):
    """관리자 전체 피드백 조회"""
    fb = Feedback(user_id=test_user.id, type="feature", title="요청", content="내용")
    db_session.add(fb)
    await db_session.commit()

    original = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = test_user.id
    try:
        resp = await authenticated_client.get("/api/feedback")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
    finally:
        settings.ADMIN_USER_ID = original


@pytest.mark.asyncio
async def test_get_all_feedbacks_non_admin(authenticated_client, test_user, test_household, db_session):
    """비관리자 전체 피드백 조회 → 403"""
    original = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = 99999
    try:
        resp = await authenticated_client.get("/api/feedback")
        assert resp.status_code == 403
    finally:
        settings.ADMIN_USER_ID = original


@pytest.mark.asyncio
async def test_update_feedback_status(authenticated_client, test_user, test_household, db_session):
    """피드백 상태 변경 (관리자)"""
    fb = Feedback(user_id=test_user.id, type="bug", title="버그", content="버그 내용")
    db_session.add(fb)
    await db_session.commit()
    await db_session.refresh(fb)

    original = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = test_user.id
    try:
        resp = await authenticated_client.patch(
            f"/api/feedback/{fb.id}",
            json={"status": "done"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "done"
    finally:
        settings.ADMIN_USER_ID = original


@pytest.mark.asyncio
async def test_update_feedback_status_non_admin(authenticated_client, test_user, test_household, db_session):
    """비관리자 피드백 상태 변경 → 403"""
    fb = Feedback(user_id=test_user.id, type="bug", title="버그", content="내용")
    db_session.add(fb)
    await db_session.commit()
    await db_session.refresh(fb)

    original = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = 99999
    try:
        resp = await authenticated_client.patch(f"/api/feedback/{fb.id}", json={"status": "done"})
        assert resp.status_code == 403
    finally:
        settings.ADMIN_USER_ID = original


@pytest.mark.asyncio
async def test_update_feedback_not_found(authenticated_client, test_user, test_household, db_session):
    """존재하지 않는 피드백 상태 변경 → 404"""
    original = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = test_user.id
    try:
        resp = await authenticated_client.patch("/api/feedback/99999", json={"status": "done"})
        assert resp.status_code == 404
    finally:
        settings.ADMIN_USER_ID = original

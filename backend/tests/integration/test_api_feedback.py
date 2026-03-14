"""피드백 API 통합 테스트"""

import pytest

from app.models.user import User

# --- Helper ---


def _feedback_payload(**overrides):
    """피드백 생성 페이로드"""
    base = {
        "type": "feature",
        "title": "다크모드 추가",
        "content": "다크모드를 추가해주세요. 밤에 눈이 피로합니다.",
    }
    base.update(overrides)
    return base


# --- 피드백 제출 ---


@pytest.mark.asyncio
async def test_create_feedback(authenticated_client, test_user: User):
    """피드백 제출 성공"""
    response = await authenticated_client.post("/api/feedback", json=_feedback_payload())
    assert response.status_code == 201

    data = response.json()
    assert data["title"] == "다크모드 추가"
    assert data["type"] == "feature"
    assert data["content"] == "다크모드를 추가해주세요. 밤에 눈이 피로합니다."
    assert data["status"] == "new"
    assert data["user_id"] == test_user.id


@pytest.mark.asyncio
async def test_create_bug_feedback(authenticated_client, test_user: User):
    """버그 신고 제출"""
    response = await authenticated_client.post(
        "/api/feedback",
        json=_feedback_payload(type="bug", title="카테고리 에러", content="카테고리가 표시되지 않습니다"),
    )
    assert response.status_code == 201
    assert response.json()["type"] == "bug"


@pytest.mark.asyncio
async def test_create_feedback_validation(authenticated_client):
    """필수 필드 누락 시 422 에러"""
    response = await authenticated_client.post("/api/feedback", json={"type": "feature"})
    assert response.status_code == 422


# --- 내 피드백 조회 ---


@pytest.mark.asyncio
async def test_get_my_feedbacks(authenticated_client, test_user: User):
    """내 피드백 목록 조회"""
    # 피드백 2개 생성
    await authenticated_client.post("/api/feedback", json=_feedback_payload())
    await authenticated_client.post(
        "/api/feedback",
        json=_feedback_payload(type="bug", title="버그 보고", content="버그입니다"),
    )

    response = await authenticated_client.get("/api/feedback/mine")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 2
    # 두 피드백 모두 포함되어 있는지 확인
    titles = {d["title"] for d in data}
    assert titles == {"다크모드 추가", "버그 보고"}


@pytest.mark.asyncio
async def test_get_my_feedbacks_empty(authenticated_client):
    """피드백이 없을 때 빈 목록 반환"""
    response = await authenticated_client.get("/api/feedback/mine")
    assert response.status_code == 200
    assert response.json() == []


# --- 관리자 전체 조회 ---


@pytest.mark.asyncio
async def test_admin_get_all_feedbacks(authenticated_client, test_user: User, db_session):
    """관리자: 전체 피드백 조회"""
    # test_user.id를 ADMIN_USER_ID로 설정
    from app.core.config import settings

    original_admin_id = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = test_user.id
    try:
        # 피드백 생성
        await authenticated_client.post("/api/feedback", json=_feedback_payload())

        response = await authenticated_client.get("/api/feedback")
        assert response.status_code == 200

        data = response.json()
        assert len(data) >= 1
        # username이 포함되어야 함
        assert data[0]["username"] is not None
    finally:
        settings.ADMIN_USER_ID = original_admin_id


@pytest.mark.asyncio
async def test_non_admin_cannot_get_all_feedbacks(authenticated_client, test_user: User):
    """비관리자: 전체 피드백 조회 시 403"""
    from app.core.config import settings

    # ADMIN_USER_ID를 test_user가 아닌 다른 ID로 설정
    original_admin_id = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = test_user.id + 9999
    try:
        response = await authenticated_client.get("/api/feedback")
        assert response.status_code == 403
    finally:
        settings.ADMIN_USER_ID = original_admin_id


# --- 상태 변경 ---


@pytest.mark.asyncio
async def test_admin_update_feedback_status(authenticated_client, test_user: User):
    """관리자: 피드백 상태 변경"""
    from app.core.config import settings

    original_admin_id = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = test_user.id
    try:
        # 피드백 생성
        create_res = await authenticated_client.post("/api/feedback", json=_feedback_payload())
        feedback_id = create_res.json()["id"]

        # 상태 변경: new → read
        response = await authenticated_client.patch(
            f"/api/feedback/{feedback_id}",
            json={"status": "read"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "read"

        # 상태 변경: read → done
        response = await authenticated_client.patch(
            f"/api/feedback/{feedback_id}",
            json={"status": "done"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "done"
    finally:
        settings.ADMIN_USER_ID = original_admin_id


@pytest.mark.asyncio
async def test_non_admin_cannot_update_status(authenticated_client, test_user: User):
    """비관리자: 상태 변경 시 403"""
    from app.core.config import settings

    original_admin_id = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = test_user.id
    try:
        create_res = await authenticated_client.post("/api/feedback", json=_feedback_payload())
        feedback_id = create_res.json()["id"]
    finally:
        settings.ADMIN_USER_ID = test_user.id + 9999

    try:
        response = await authenticated_client.patch(
            f"/api/feedback/{feedback_id}",
            json={"status": "read"},
        )
        assert response.status_code == 403
    finally:
        settings.ADMIN_USER_ID = original_admin_id


@pytest.mark.asyncio
async def test_update_nonexistent_feedback(authenticated_client, test_user: User):
    """존재하지 않는 피드백 상태 변경 시 404"""
    from app.core.config import settings

    original_admin_id = settings.ADMIN_USER_ID
    settings.ADMIN_USER_ID = test_user.id
    try:
        response = await authenticated_client.patch(
            "/api/feedback/99999",
            json={"status": "read"},
        )
        assert response.status_code == 404
    finally:
        settings.ADMIN_USER_ID = original_admin_id

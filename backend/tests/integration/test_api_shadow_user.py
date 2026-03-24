"""Shadow User 3단계 조회 로직 통합 테스트

Supabase Auth 기반 Shadow User 패턴 검증:
  1단계: auth_user_id로 기존 유저 조회
  2단계: email 매칭으로 기존 유저 연결
  3단계: 완전히 새로운 유저 자동 생성

테스트 방식: GET /api/auth/me — JWT 검증 후 Shadow User 반환
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from tests.conftest import create_test_token


@pytest.mark.asyncio
async def test_step1_auth_user_id_lookup(authenticated_client, test_user: User, db_session: AsyncSession):
    """1단계: auth_user_id로 기존 Shadow User 조회"""
    # test_user는 이미 TEST_AUTH_USER_ID_1로 등록됨
    response = await authenticated_client.get("/api/auth/me")
    assert response.status_code == 200

    data = response.json()
    # 기존 유저 ID를 그대로 반환해야 함 (새 유저 생성 X)
    assert data["id"] == test_user.id
    assert data["email"] == test_user.email


@pytest.mark.asyncio
async def test_step2_email_matching(client: AsyncClient, db_session: AsyncSession):
    """2단계: email 매칭으로 기존 유저에 auth_user_id 연결"""
    # auth_user_id 없는 기존 유저
    existing_user = User(
        username="legacy_user",
        email="legacy@example.com",
        hashed_password="hashed",
        is_active=True,
    )
    db_session.add(existing_user)
    await db_session.commit()
    await db_session.refresh(existing_user)

    original_id = existing_user.id
    new_auth_id = "5500000000001"

    # 같은 이메일로 Supabase 로그인
    token = create_test_token(
        auth_user_id=new_auth_id,
        email="legacy@example.com",
        name="레거시유저",
    )

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    data = response.json()
    # 새 유저가 아닌 기존 유저 ID를 반환
    assert data["id"] == original_id

    # DB에서 auth_user_id가 연결됐는지 확인
    result = await db_session.execute(select(User).where(User.id == original_id))
    updated_user = result.scalar_one()
    assert updated_user.auth_user_id == new_auth_id


@pytest.mark.asyncio
async def test_step3_new_user_creation(client, db_session: AsyncSession):
    """3단계: 완전히 새로운 유저 자동 생성"""
    brand_new_auth_id = "5500000000002"

    # 이 auth_user_id도, 이메일도 DB에 없는 상태
    token = create_test_token(
        auth_user_id=brand_new_auth_id,
        email="brandnew@example.com",
        name="브랜드뉴",
    )

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    data = response.json()
    assert data["email"] == "brandnew@example.com"
    assert "id" in data

    # DB에 실제로 생성됐는지 확인
    result = await db_session.execute(select(User).where(User.auth_user_id == brand_new_auth_id))
    new_user = result.scalar_one_or_none()
    assert new_user is not None
    assert new_user.email == "brandnew@example.com"


@pytest.mark.asyncio
async def test_step3_new_user_name_from_email_prefix(client, db_session: AsyncSession):
    """3단계: name이 없을 때 이메일 prefix를 username으로 사용"""
    auth_id = "5500000000003"

    # name을 빈 문자열로 설정
    from datetime import UTC, datetime, timedelta

    from jose import jwt

    from app.core.config import settings

    expire = datetime.now(UTC) + timedelta(days=7)
    payload = {
        "sub": str(auth_id),
        "email": "prefix.test@example.com",
        "name": "",  # 빈 이름
        "role": "authenticated",
        "iss": "https://test.supabase.co/auth/v1",
        "exp": expire,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    data = response.json()
    # username이 이메일 prefix(prefix.test)로 설정되어야 함
    assert "prefix" in data["username"] or data["username"] == "prefix.test"


@pytest.mark.asyncio
async def test_cache_hit_returns_same_user(authenticated_client, test_user: User):
    """캐시 히트 시에도 동일한 사용자 반환 (auth_user_id 캐시 검증)"""
    # 같은 토큰으로 두 번 요청 → 캐시 히트
    r1 = await authenticated_client.get("/api/auth/me")
    r2 = await authenticated_client.get("/api/auth/me")

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["id"] == r2.json()["id"]


@pytest.mark.asyncio
async def test_step2_email_matching_updates_in_db(client, db_session: AsyncSession):
    """2단계 매칭 후 auth_user_id가 DB에 영속적으로 저장됨"""
    old_user = User(
        username="old_sso_user",
        email="old_sso@example.com",
        hashed_password=None,
        is_active=True,
    )
    db_session.add(old_user)
    await db_session.commit()
    await db_session.refresh(old_user)

    new_auth_id = "5500000000004"
    token = create_test_token(auth_user_id=new_auth_id, email="old_sso@example.com", name="구유저")

    # 로그인 → 2단계 매칭 트리거
    await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    # 세션 갱신 후 확인
    await db_session.refresh(old_user)
    assert old_user.auth_user_id == new_auth_id

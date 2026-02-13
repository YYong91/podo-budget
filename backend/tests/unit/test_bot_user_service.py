"""
bot_user_service.py 단위 테스트

봇 플랫폼 사용자 생성 및 관리 로직을 테스트합니다.
- 새 사용자 자동 생성
- 기존 사용자 재사용
- username 형식 검증
- 비밀번호 해시 생성 확인
"""

import pytest
from sqlalchemy import select

from app.models.user import User
from app.services.bot_user_service import get_or_create_bot_user


@pytest.mark.asyncio
async def test_create_new_bot_user(db_session):
    """새로운 봇 사용자가 정상적으로 생성되는지 확인"""
    # 봇 사용자 생성
    user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="12345")

    assert user is not None
    assert user.id is not None
    assert user.username == "telegram_12345"
    assert user.is_active is True
    assert user.email is None  # 봇 사용자는 이메일 없음
    assert user.hashed_password is not None  # 비밀번호 해시는 있어야 함
    assert len(user.hashed_password) > 0


@pytest.mark.asyncio
async def test_reuse_existing_bot_user(db_session):
    """동일한 플랫폼 사용자 ID로 두 번 호출하면 같은 User를 반환해야 함"""
    # 첫 번째 호출: 새 사용자 생성
    user1 = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="12345")
    await db_session.commit()

    # 두 번째 호출: 기존 사용자 재사용
    user2 = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="12345")

    # 같은 사용자여야 함
    assert user1.id == user2.id
    assert user1.username == user2.username

    # DB에는 한 명만 존재해야 함
    result = await db_session.execute(select(User))
    users = result.scalars().all()
    assert len(users) == 1


@pytest.mark.asyncio
async def test_different_platform_users_are_isolated(db_session):
    """서로 다른 플랫폼 사용자 ID는 각각 별도의 User로 생성되어야 함"""
    # Telegram 사용자 1
    user1 = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="11111")
    await db_session.commit()

    # Telegram 사용자 2
    user2 = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="22222")
    await db_session.commit()

    # 서로 다른 User여야 함
    assert user1.id != user2.id
    assert user1.username == "telegram_11111"
    assert user2.username == "telegram_22222"

    # DB에 두 명 존재
    result = await db_session.execute(select(User))
    users = result.scalars().all()
    assert len(users) == 2


@pytest.mark.asyncio
async def test_different_platforms_same_user_id_are_isolated(db_session):
    """같은 사용자 ID라도 플랫폼이 다르면 별도의 User로 생성되어야 함"""
    # Telegram 사용자
    telegram_user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="12345")
    await db_session.commit()

    # Kakao 사용자 (같은 ID)
    kakao_user = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id="12345")
    await db_session.commit()

    # 서로 다른 User여야 함
    assert telegram_user.id != kakao_user.id
    assert telegram_user.username == "telegram_12345"
    assert kakao_user.username == "kakao_12345"

    # DB에 두 명 존재
    result = await db_session.execute(select(User))
    users = result.scalars().all()
    assert len(users) == 2


@pytest.mark.asyncio
async def test_username_format(db_session):
    """username 형식이 {platform}_{platform_user_id} 규칙을 따르는지 확인"""
    # Telegram
    telegram_user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="123456789")
    assert telegram_user.username == "telegram_123456789"

    # Kakao
    kakao_user = await get_or_create_bot_user(db_session, platform="kakao", platform_user_id="kakao_test_user")
    assert kakao_user.username == "kakao_kakao_test_user"


@pytest.mark.asyncio
async def test_bot_user_has_valid_password_hash(db_session):
    """봇 사용자도 유효한 비밀번호 해시를 가져야 함 (User 모델 제약 충족)"""
    user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="99999")

    # 비밀번호 해시가 bcrypt 형식인지 확인 ($2b$로 시작)
    assert user.hashed_password.startswith("$2b$")


@pytest.mark.asyncio
async def test_bot_user_is_active_by_default(db_session):
    """봇 사용자는 기본적으로 활성 상태여야 함"""
    user = await get_or_create_bot_user(db_session, platform="telegram", platform_user_id="55555")
    assert user.is_active is True


@pytest.mark.asyncio
async def test_multiple_calls_no_duplicate_users(db_session):
    """같은 플랫폼 사용자에 대한 여러 호출이 중복 User를 생성하지 않는지 확인"""
    platform = "telegram"
    platform_user_id = "77777"

    # 여러 번 호출
    user1 = await get_or_create_bot_user(db_session, platform=platform, platform_user_id=platform_user_id)
    await db_session.commit()

    user2 = await get_or_create_bot_user(db_session, platform=platform, platform_user_id=platform_user_id)
    await db_session.commit()

    user3 = await get_or_create_bot_user(db_session, platform=platform, platform_user_id=platform_user_id)
    await db_session.commit()

    # 모두 같은 User
    assert user1.id == user2.id == user3.id

    # DB에는 한 명만
    result = await db_session.execute(select(User).where(User.username == f"{platform}_{platform_user_id}"))
    users = result.scalars().all()
    assert len(users) == 1

"""봇 플랫폼 사용자 관리 서비스

Telegram, Kakao 등 봇 플랫폼에서 오는 사용자를 자동으로 생성하고 관리합니다.
각 플랫폼의 사용자 ID를 기반으로 username을 생성하여 사용자를 격리합니다.

WHY: 봇 사용자 간 데이터 격리를 위해 각 플랫폼 사용자마다 고유한 User를 생성합니다.
"""

import logging
import secrets

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)

# 비밀번호 해싱 컨텍스트 (봇 사용자는 로그인하지 않지만 User 모델 제약 충족용)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def get_or_create_bot_user(db: AsyncSession, platform: str, platform_user_id: str) -> User:
    """봇 플랫폼 사용자를 찾거나 생성한다

    1) telegram_chat_id로 연동된 기존 계정이 있으면 해당 유저 반환
    2) 없으면 봇 전용 유저(telegram_xxx)를 찾거나 생성

    Args:
        db: 데이터베이스 세션
        platform: 플랫폼 이름 (예: "telegram", "kakao")
        platform_user_id: 플랫폼에서 제공한 사용자 ID

    Returns:
        찾았거나 새로 생성한 User 객체
    """
    # 1) telegram_chat_id로 연동된 기존 계정 확인
    if platform == "telegram":
        result = await db.execute(select(User).where(User.telegram_chat_id == platform_user_id))
        linked_user = result.scalar_one_or_none()
        if linked_user:
            return linked_user

    # 2) 봇 전용 유저 검색/생성
    username = f"{platform}_{platform_user_id}"
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None:
        random_password = secrets.token_urlsafe(32)
        hashed_password = pwd_context.hash(random_password)

        user = User(
            username=username,
            email=None,
            hashed_password=hashed_password,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        logger.info(f"새 봇 사용자 생성: {username} (user_id={user.id})")

    return user


async def link_telegram_account_by_code(db: AsyncSession, code: str, telegram_chat_id: str) -> tuple[bool, str]:
    """코드로 텔레그램 계정을 웹 계정에 연동한다.

    Args:
        db: 데이터베이스 세션
        code: 웹에서 발급된 단기 연동 코드
        telegram_chat_id: 연동할 Telegram chat ID

    Returns:
        (success: bool, message: str)
    """
    from datetime import UTC, datetime

    now = datetime.now(UTC)

    # 코드로 사용자 조회
    result = await db.execute(select(User).where(User.telegram_link_code == code))
    user = result.scalar_one_or_none()

    if user is None:
        return False, "❌ 유효하지 않은 코드입니다. 웹에서 새 코드를 발급해주세요."

    # 만료 확인
    if user.telegram_link_code_expires_at is None or user.telegram_link_code_expires_at < now:
        user.telegram_link_code = None
        user.telegram_link_code_expires_at = None
        await db.commit()
        return False, "⏰ 코드가 만료되었습니다. 웹에서 새 코드를 발급해주세요."

    # 이미 다른 계정에 연동된 chat_id인지 확인
    existing = await db.execute(select(User).where(User.telegram_chat_id == telegram_chat_id))
    existing_user = existing.scalar_one_or_none()
    if existing_user and existing_user.id != user.id:
        return False, "⚠️ 이 텔레그램 계정은 이미 다른 웹 계정에 연동되어 있습니다."

    # 연동 설정 후 코드 삭제
    user.telegram_chat_id = telegram_chat_id
    user.telegram_link_code = None
    user.telegram_link_code_expires_at = None
    await db.commit()

    logger.info(f"텔레그램 코드 연동 완료: user_id={user.id} ← chat_id={telegram_chat_id}")
    return True, f"✅ 연동 완료! 이제 이 채팅의 지출이 '{user.username}' 계정에 기록됩니다."


async def link_telegram_account(db: AsyncSession, username: str, password: str, telegram_chat_id: str) -> User | None:
    """Telegram 계정을 기존 웹 계정에 연동

    Args:
        db: 데이터베이스 세션
        username: 웹 계정 사용자명
        password: 웹 계정 비밀번호
        telegram_chat_id: Telegram chat ID

    Returns:
        연동 성공 시 User 객체, 실패 시 None
    """
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if not user or not pwd_context.verify(password, user.hashed_password):
        return None

    user.telegram_chat_id = telegram_chat_id
    await db.commit()
    await db.refresh(user)
    logger.info(f"Telegram 연동 완료: {username} ← chat_id={telegram_chat_id}")
    return user

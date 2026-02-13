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

    각 봇 플랫폼(telegram, kakao 등)에서 오는 사용자를 User 테이블에서 관리합니다.
    username을 "{platform}_{platform_user_id}" 형식으로 생성하여 고유성을 보장합니다.

    WHY: 봇을 통해 입력한 지출이 사용자별로 격리되어야 합니다.
         Expense.user_id가 없으면 모든 봇 사용자의 데이터가 섞이게 됩니다.

    Args:
        db: 데이터베이스 세션
        platform: 플랫폼 이름 (예: "telegram", "kakao")
        platform_user_id: 플랫폼에서 제공한 사용자 ID (예: Telegram chat_id, Kakao user.id)

    Returns:
        찾았거나 새로 생성한 User 객체

    Example:
        >>> user = await get_or_create_bot_user(db, "telegram", "123456789")
        >>> print(user.username)
        "telegram_123456789"
    """
    # username 규칙: {platform}_{platform_user_id}
    username = f"{platform}_{platform_user_id}"

    # 기존 사용자 검색
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None:
        # 새 사용자 생성
        # 봇 사용자는 로그인하지 않으므로 랜덤 비밀번호 해시 생성
        random_password = secrets.token_urlsafe(32)
        hashed_password = pwd_context.hash(random_password)

        user = User(
            username=username,
            email=None,  # 봇 사용자는 이메일 없음
            hashed_password=hashed_password,
            is_active=True,
        )
        db.add(user)
        await db.flush()  # ID를 즉시 할당받기 위해 flush 사용
        await db.refresh(user)  # relationship 로드

        logger.info(f"새 봇 사용자 생성: {username} (user_id={user.id})")

    return user

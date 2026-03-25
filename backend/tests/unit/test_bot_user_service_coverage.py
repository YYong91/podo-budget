"""bot_user_service.py 커버리지 강화 테스트 (#400)

누락 시나리오:
- 텔레그램 코드 연동: 코드 매칭 성공
- 텔레그램 코드 연동: 코드 없음(실패)
- 텔레그램 코드 연동: 코드 만료
- 텔레그램 코드 연동: 이미 다른 계정에 연동된 chat_id
- 카카오 코드 연동: 코드 매칭 성공
- 카카오 코드 연동: 코드 없음(실패)
- 카카오 코드 연동: 코드 만료
- 카카오 코드 연동: 이미 다른 계정에 연동된 kakao_user_id
- _migrate_bot_user_data: 봇 유저 없음 → 0
- _migrate_bot_user_data: 봇 유저 있음 → 이관
- get_or_create_bot_user: 텔레그램 연동된 기존 계정 반환
- get_or_create_bot_user: 카카오 연동된 기존 계정 반환
- get_or_create_bot_user: auto_create_household=True
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.user import User
from app.services.bot_user_service import (
    _migrate_bot_user_data,
    get_or_create_bot_user,
    link_kakao_account_by_code,
    link_telegram_account_by_code,
)

# ── Helper ──────────────────────────────────────────────


async def _create_user_with_household(
    db: AsyncSession,
    username: str,
    email: str | None = None,
    **kwargs,
) -> tuple[User, Household]:
    """테스트용 유저 + 가구 생성"""
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    user = User(
        username=username,
        email=email,
        hashed_password=pwd_context.hash("test"),
        is_active=True,
        **kwargs,
    )
    db.add(user)
    await db.flush()

    household = Household(name="내 가계부", currency="KRW")
    db.add(household)
    await db.flush()

    member = HouseholdMember(household_id=household.id, user_id=user.id, role="owner")
    db.add(member)
    await db.flush()

    return user, household


async def _create_expense(db: AsyncSession, user_id: int, household_id: int, amount: float) -> Expense:
    """테스트용 지출 생성"""
    result = await db.execute(select(Category).where(Category.name == "식비", Category.household_id == household_id))
    category = result.scalar_one_or_none()
    if not category:
        category = Category(name="식비", household_id=household_id)
        db.add(category)
        await db.flush()

    expense = Expense(
        user_id=user_id,
        household_id=household_id,
        amount=amount,
        description=f"테스트 {amount}원",
        category_id=category.id,
        date=datetime.now(),
    )
    db.add(expense)
    await db.flush()
    return expense


# ── get_or_create_bot_user: 연동된 텔레그램 유저 반환 ───


@pytest.mark.asyncio
async def test_get_or_create_returns_linked_telegram_user(db_session: AsyncSession):
    """telegram_chat_id로 연동된 기존 계정 반환"""
    user, _ = await _create_user_with_household(
        db_session,
        username="web_user",
        email="web@example.com",
        telegram_chat_id="12345",
    )
    await db_session.commit()

    result = await get_or_create_bot_user(db_session, "telegram", "12345")
    assert result.id == user.id
    assert result.username == "web_user"  # 봇 유저가 아닌 웹 유저 반환


# ── get_or_create_bot_user: 연동된 카카오 유저 반환 ─────


@pytest.mark.asyncio
async def test_get_or_create_returns_linked_kakao_user(db_session: AsyncSession):
    """kakao_user_id로 연동된 기존 계정 반환"""
    user, _ = await _create_user_with_household(
        db_session,
        username="web_kakao_user",
        email="kakao_web@example.com",
        kakao_user_id="kakao_999",
    )
    await db_session.commit()

    result = await get_or_create_bot_user(db_session, "kakao", "kakao_999")
    assert result.id == user.id
    assert result.username == "web_kakao_user"


# ── get_or_create_bot_user: auto_create_household ──────


@pytest.mark.asyncio
async def test_get_or_create_auto_creates_household(db_session: AsyncSession):
    """auto_create_household=True → 가구 자동 생성"""
    user = await get_or_create_bot_user(db_session, "telegram", "newuser1", auto_create_household=True)
    await db_session.commit()

    assert user.username == "telegram_newuser1"

    # 가구 멤버 확인
    result = await db_session.execute(select(HouseholdMember).where(HouseholdMember.user_id == user.id))
    members = result.scalars().all()
    assert len(members) == 1
    assert members[0].role == "owner"


# ── link_telegram_account_by_code: 성공 ─────────────────


@pytest.mark.asyncio
async def test_link_telegram_success(db_session: AsyncSession):
    """텔레그램 코드 매칭 → 연동 성공"""
    user, household = await _create_user_with_household(
        db_session,
        username="tg_link_user",
        email="tg_link@example.com",
        telegram_link_code="ABC123",
        telegram_link_code_expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    await db_session.commit()

    success, msg = await link_telegram_account_by_code(db_session, "ABC123", "telegram_chat_999")

    assert success is True
    assert "연동 완료" in msg

    # DB에서 연동 확인
    await db_session.refresh(user)
    assert user.telegram_chat_id == "telegram_chat_999"
    assert user.telegram_link_code is None


# ── link_telegram_account_by_code: 유효하지 않은 코드 ───


@pytest.mark.asyncio
async def test_link_telegram_invalid_code(db_session: AsyncSession):
    """잘못된 코드 → 실패"""
    success, msg = await link_telegram_account_by_code(db_session, "INVALID", "chat_123")

    assert success is False
    assert "유효하지 않은" in msg


# ── link_telegram_account_by_code: 만료된 코드 ──────────


@pytest.mark.asyncio
async def test_link_telegram_expired_code(db_session: AsyncSession):
    """만료된 코드 → 실패"""
    user, _ = await _create_user_with_household(
        db_session,
        username="tg_expired_user",
        email="tg_expired@example.com",
        telegram_link_code="EXP001",
        telegram_link_code_expires_at=datetime.now(UTC) - timedelta(hours=1),
    )
    await db_session.commit()

    success, msg = await link_telegram_account_by_code(db_session, "EXP001", "chat_999")

    assert success is False
    assert "만료" in msg

    # 코드가 삭제되었는지 확인
    await db_session.refresh(user)
    assert user.telegram_link_code is None


# ── link_telegram_account_by_code: expires_at=None ──────


@pytest.mark.asyncio
async def test_link_telegram_expires_at_none(db_session: AsyncSession):
    """expires_at이 None → 만료 처리"""
    user, _ = await _create_user_with_household(
        db_session,
        username="tg_no_exp_user",
        email="tg_no_exp@example.com",
        telegram_link_code="NOE001",
        telegram_link_code_expires_at=None,
    )
    await db_session.commit()

    success, msg = await link_telegram_account_by_code(db_session, "NOE001", "chat_000")

    assert success is False
    assert "만료" in msg


# ── link_telegram_account_by_code: 이미 다른 계정에 연동 ─


@pytest.mark.asyncio
async def test_link_telegram_already_linked_other_account(db_session: AsyncSession):
    """이미 다른 계정에 연동된 chat_id → 실패"""
    # 다른 유저가 이미 이 chat_id 사용
    other_user, _ = await _create_user_with_household(
        db_session,
        username="other_tg_user",
        email="other_tg@example.com",
        telegram_chat_id="already_taken_chat",
    )
    # 연동 시도할 유저
    user, _ = await _create_user_with_household(
        db_session,
        username="try_link_user",
        email="try_link@example.com",
        telegram_link_code="TRY001",
        telegram_link_code_expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    await db_session.commit()

    success, msg = await link_telegram_account_by_code(db_session, "TRY001", "already_taken_chat")

    assert success is False
    assert "이미 다른" in msg


# ── link_telegram_account_by_code: 데이터 이관 포함 ─────


@pytest.mark.asyncio
async def test_link_telegram_with_data_migration(db_session: AsyncSession):
    """텔레그램 연동 시 봇 유저 데이터 이관"""
    # 봇 유저 + 지출 데이터 생성
    bot_user, bot_household = await _create_user_with_household(db_session, username="telegram_chat_mig")
    await _create_expense(db_session, bot_user.id, bot_household.id, 5000)
    await _create_expense(db_session, bot_user.id, bot_household.id, 3000)

    # 웹 유저 생성 (연동 코드 설정)
    web_user, web_household = await _create_user_with_household(
        db_session,
        username="web_mig_user",
        email="web_mig@example.com",
        telegram_link_code="MIG001",
        telegram_link_code_expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    await db_session.commit()

    success, msg = await link_telegram_account_by_code(db_session, "MIG001", "chat_mig")

    assert success is True
    assert "이관" in msg  # migrated count > 0

    # 봇 유저의 지출이 웹 유저로 이관
    result = await db_session.execute(select(Expense).where(Expense.user_id == web_user.id))
    assert len(result.scalars().all()) == 2


# ── link_kakao_account_by_code: 성공 ────────────────────


@pytest.mark.asyncio
async def test_link_kakao_success(db_session: AsyncSession):
    """카카오 코드 매칭 → 연동 성공"""
    user, household = await _create_user_with_household(
        db_session,
        username="kakao_link_user",
        email="kakao_link@example.com",
        kakao_link_code="KAK001",
        kakao_link_code_expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    await db_session.commit()

    success, msg = await link_kakao_account_by_code(db_session, "KAK001", "kakao_user_777")

    assert success is True
    assert "연동 완료" in msg

    await db_session.refresh(user)
    assert user.kakao_user_id == "kakao_user_777"
    assert user.kakao_link_code is None


# ── link_kakao_account_by_code: 유효하지 않은 코드 ──────


@pytest.mark.asyncio
async def test_link_kakao_invalid_code(db_session: AsyncSession):
    """잘못된 카카오 코드 → 실패"""
    success, msg = await link_kakao_account_by_code(db_session, "BADCODE", "kakao_123")

    assert success is False
    assert "유효하지 않은" in msg


# ── link_kakao_account_by_code: 만료된 코드 ─────────────


@pytest.mark.asyncio
async def test_link_kakao_expired_code(db_session: AsyncSession):
    """만료된 카카오 코드 → 실패"""
    user, _ = await _create_user_with_household(
        db_session,
        username="kakao_exp_user",
        email="kakao_exp@example.com",
        kakao_link_code="KEXP01",
        kakao_link_code_expires_at=datetime.now(UTC) - timedelta(hours=1),
    )
    await db_session.commit()

    success, msg = await link_kakao_account_by_code(db_session, "KEXP01", "kakao_exp_999")

    assert success is False
    assert "만료" in msg


# ── link_kakao_account_by_code: expires_at=None ──────


@pytest.mark.asyncio
async def test_link_kakao_expires_at_none(db_session: AsyncSession):
    """kakao_link_code_expires_at이 None → 만료 처리"""
    user, _ = await _create_user_with_household(
        db_session,
        username="kakao_no_exp",
        email="kakao_no_exp@example.com",
        kakao_link_code="KNE001",
        kakao_link_code_expires_at=None,
    )
    await db_session.commit()

    success, msg = await link_kakao_account_by_code(db_session, "KNE001", "kakao_no_exp_999")

    assert success is False
    assert "만료" in msg


# ── link_kakao_account_by_code: 이미 다른 계정에 연동 ───


@pytest.mark.asyncio
async def test_link_kakao_already_linked_other_account(db_session: AsyncSession):
    """이미 다른 계정에 연동된 kakao_user_id → 실패"""
    other_user, _ = await _create_user_with_household(
        db_session,
        username="other_kakao_user",
        email="other_kakao@example.com",
        kakao_user_id="taken_kakao_id",
    )
    user, _ = await _create_user_with_household(
        db_session,
        username="try_kakao_user",
        email="try_kakao@example.com",
        kakao_link_code="TKA001",
        kakao_link_code_expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    await db_session.commit()

    success, msg = await link_kakao_account_by_code(db_session, "TKA001", "taken_kakao_id")

    assert success is False
    assert "이미 다른" in msg


# ── link_kakao_account_by_code: 데이터 이관 포함 ────────


@pytest.mark.asyncio
async def test_link_kakao_with_data_migration(db_session: AsyncSession):
    """카카오 연동 시 봇 유저 데이터 이관"""
    # 봇 유저 + 지출 데이터
    bot_user, bot_household = await _create_user_with_household(db_session, username="kakao_chat_mig")
    await _create_expense(db_session, bot_user.id, bot_household.id, 7000)

    # 웹 유저 (연동 코드 설정)
    web_user, web_household = await _create_user_with_household(
        db_session,
        username="web_kakao_mig",
        email="web_kakao_mig@example.com",
        kakao_link_code="KMG001",
        kakao_link_code_expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    await db_session.commit()

    success, msg = await link_kakao_account_by_code(db_session, "KMG001", "chat_mig")

    assert success is True
    assert "이관" in msg

    result = await db_session.execute(select(Expense).where(Expense.user_id == web_user.id))
    assert len(result.scalars().all()) == 1


# ── _migrate_bot_user_data: 봇 유저 없음 → 0 ───────────


@pytest.mark.asyncio
async def test_migrate_bot_user_data_no_bot_user(db_session: AsyncSession):
    """봇 유저가 없으면 이관 0건"""
    web_user, _ = await _create_user_with_household(db_session, username="no_bot_web", email="no_bot@example.com")
    await db_session.commit()

    count = await _migrate_bot_user_data(db_session, "telegram", "nonexistent_chat", web_user=web_user)
    assert count == 0


# ── _migrate_bot_user_data: 봇 유저 데이터 이관 ─────────


@pytest.mark.asyncio
async def test_migrate_bot_user_data_with_expenses_and_incomes(db_session: AsyncSession):
    """봇 유저의 지출+수입이 웹 유저로 이관"""
    bot_user, bot_household = await _create_user_with_household(db_session, username="telegram_chat_bot")
    await _create_expense(db_session, bot_user.id, bot_household.id, 10000)

    # 수입도 생성
    income = Income(user_id=bot_user.id, household_id=bot_household.id, amount=500000, description="급여", date=datetime.now())
    db_session.add(income)
    await db_session.flush()

    web_user, web_household = await _create_user_with_household(db_session, username="web_bot_user", email="web_bot@example.com")
    await db_session.commit()

    count = await _migrate_bot_user_data(db_session, "telegram", "chat_bot", web_user=web_user)
    await db_session.commit()

    assert count >= 1  # 지출 1건 이관 (수입은 count에 포함 안 됨)

    # 웹 유저에게 지출 이관됨
    result = await db_session.execute(select(Expense).where(Expense.user_id == web_user.id))
    assert len(result.scalars().all()) == 1

    # 수입도 이관됨
    result = await db_session.execute(select(Income).where(Income.user_id == web_user.id))
    assert len(result.scalars().all()) == 1


# ── link_telegram: 같은 계정 재연동(self) ────────────────


@pytest.mark.asyncio
async def test_link_telegram_same_account_relink(db_session: AsyncSession):
    """같은 유저의 chat_id 재연동 → 성공 (기존 연동 유지)"""
    user, _ = await _create_user_with_household(
        db_session,
        username="relink_user",
        email="relink@example.com",
        telegram_chat_id="same_chat",
        telegram_link_code="REL001",
        telegram_link_code_expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    await db_session.commit()

    # 같은 chat_id로 재연동 → existing_user.id == user.id이므로 패스
    success, msg = await link_telegram_account_by_code(db_session, "REL001", "same_chat")
    assert success is True


# ── link_telegram: naive datetime expires_at 처리 ───────


@pytest.mark.asyncio
async def test_link_telegram_naive_datetime_expires_at(db_session: AsyncSession):
    """expires_at이 naive datetime(tzinfo 없음)인 경우 UTC로 간주하여 정상 처리"""
    # naive datetime으로 설정 (미래 시간)
    naive_future = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=1)

    user, _ = await _create_user_with_household(
        db_session,
        username="naive_dt_user",
        email="naive_dt@example.com",
        telegram_link_code="NAI001",
        telegram_link_code_expires_at=naive_future,
    )
    await db_session.commit()

    success, msg = await link_telegram_account_by_code(db_session, "NAI001", "naive_chat")
    assert success is True

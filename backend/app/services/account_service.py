"""계좌 관리 비즈니스 로직"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.user import User


async def get_user_active_household_id(user: User, db: AsyncSession) -> int | None:
    from app.api.dependencies import get_user_active_household_id as _get

    return await _get(user, db)


async def create_account(db: AsyncSession, account_data: dict, user: User) -> Account:
    """계좌 생성"""
    household_id = account_data.pop("household_id", None)
    if household_id is None:
        household_id = await get_user_active_household_id(user, db)

    account = Account(**account_data, created_by=user.id, household_id=household_id)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_accounts(db: AsyncSession, user: User, household_id: int | None = None) -> list[Account]:
    """계좌 목록 조회"""
    query = select(Account).where(Account.household_id == household_id) if household_id is not None else select(Account).where(Account.created_by == user.id)
    query = query.order_by(Account.type, Account.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_account_by_id(db: AsyncSession, account_id: int, user: User) -> Account | None:
    """계좌 상세 조회 (권한 체크)"""
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        return None
    if account.household_id:
        return account
    elif account.created_by != user.id:
        return None
    return account


async def update_account(db: AsyncSession, account: Account, update_data: dict) -> Account:
    """계좌 수정"""
    for key, value in update_data.items():
        setattr(account, key, value)
    await db.commit()
    await db.refresh(account)
    return account


async def delete_account(db: AsyncSession, account: Account) -> None:
    """계좌 삭제"""
    await db.delete(account)
    await db.commit()

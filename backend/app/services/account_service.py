"""계좌 관리 비즈니스 로직"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.user import User


async def create_account(db: AsyncSession, account_data: dict[str, Any], user: User, household_id: int) -> Account:
    """계좌 생성 — household_id는 API 레이어에서 resolve 후 전달 (#193)"""
    account_data.pop("household_id", None)  # schema에 포함된 경우 제거
    account = Account(**account_data, created_by=user.id, household_id=household_id)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_accounts(db: AsyncSession, household_id: int) -> list[Account]:
    """계좌 목록 조회 — household_id는 API 레이어에서 resolve 후 전달 (#193)"""
    query = select(Account).where(Account.household_id == household_id).order_by(Account.type, Account.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_account_by_id(db: AsyncSession, account_id: int, user: User) -> Account | None:
    """계좌 상세 조회 — household 멤버십은 API 레이어에서 get_household_member()로 검증 (#137)"""
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        return None
    # household 없는 레거시 데이터: created_by 기반 소유권 확인
    if account.household_id is None and account.created_by != user.id:
        return None
    return account


async def update_account(db: AsyncSession, account: Account, update_data: dict[str, Any]) -> Account:
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

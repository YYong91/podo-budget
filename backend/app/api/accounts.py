"""계좌 관리 API"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.account import AccountCreate, AccountResponse, AccountUpdate
from app.services import account_service

router = APIRouter()


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """계좌 등록"""
    account_data = account.model_dump()
    household_id = account_data.get("household_id")
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    return await account_service.create_account(db, account_data, current_user, household_id)


@router.get("", response_model=list[AccountResponse])
async def get_accounts(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """계좌 목록"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    return await account_service.get_accounts(db, household_id)


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """계좌 상세"""
    account = await account_service.get_account_by_id(db, account_id, current_user)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="계좌를 찾을 수 없습니다")
    # household 멤버십 검증 — IDOR 방지 (#137)
    if account.household_id is not None:
        try:
            await get_household_member(account.household_id, current_user, db)  # type: ignore[arg-type]
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="계좌를 찾을 수 없습니다") from None
    return account


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    account_update: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """계좌 수정"""
    from sqlalchemy import select

    from app.models.account import Account

    result = await db.execute(select(Account).where(Account.id == account_id, Account.created_by == current_user.id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="계좌를 찾을 수 없습니다")
    return await account_service.update_account(db, account, account_update.model_dump(exclude_unset=True))


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """계좌 삭제"""
    from sqlalchemy import select

    from app.models.account import Account

    result = await db.execute(select(Account).where(Account.id == account_id, Account.created_by == current_user.id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="계좌를 찾을 수 없습니다")
    await account_service.delete_account(db, account)

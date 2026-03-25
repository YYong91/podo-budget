"""정기 거래 CRUD + execute/skip/pending API

정기적으로 반복되는 지출/수입을 관리합니다.
사용자 접속 시 pending 항목을 조회하여 대시보드에 표시하고,
등록(execute) 또는 건너뛰기(skip) 선택이 가능합니다.
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.expense import Expense
from app.models.income import Income
from app.models.recurring_transaction import RecurringTransaction
from app.models.user import User
from app.schemas.recurring_transaction import (
    ExecuteResponse,
    RecurringTransactionCreate,
    RecurringTransactionResponse,
    RecurringTransactionUpdate,
    SkipResponse,
)
from app.services.recurring_service import (
    calculate_initial_due_date,
    calculate_next_due_date,
    execute_recurring,
    skip_recurring,
)

logger = logging.getLogger(__name__)

router = APIRouter()


async def _get_source_record(
    db: AsyncSession,
    source_id: int,
    record_type: str,
    household_id: int,
) -> Expense | Income:
    """source_id로 원본 거래를 조회하고 소유권/타입을 검증한다"""
    model = Expense if record_type == "expense" else Income
    result = await db.execute(select(model).where(model.id == source_id, model.household_id == household_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="원본 거래를 찾을 수 없습니다",
        )
    return record


@router.post("", response_model=RecurringTransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring(
    data: RecurringTransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """정기 거래 생성"""
    household_id = data.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    await get_household_member(household_id, current_user, db)

    next_due = calculate_initial_due_date(
        data.start_date,
        data.frequency,
        data.day_of_month,
        data.day_of_week,
        data.month_of_year,
    )

    # source_id 검증 (있으면 원본 거래 조회)
    source_record = None
    if data.source_id is not None:
        source_record = await _get_source_record(db, data.source_id, data.type, household_id)

        # 이미 기록된 거래에서 등록하는 것이므로 next_due가 오늘 이전이면 다음 주기로 보정
        today = datetime.now(ZoneInfo("Asia/Seoul")).date()
        if next_due <= today:
            next_due = calculate_next_due_date(
                next_due,
                data.frequency,
                data.interval,
                data.day_of_month,
                data.day_of_week,
                data.month_of_year,
            )

    recurring = RecurringTransaction(
        user_id=current_user.id,
        household_id=household_id,
        type=data.type,
        amount=data.amount,
        description=data.description,
        category_id=data.category_id,
        frequency=data.frequency,
        interval=data.interval,
        day_of_month=data.day_of_month,
        day_of_week=data.day_of_week,
        month_of_year=data.month_of_year,
        start_date=data.start_date,
        end_date=data.end_date,
        next_due_date=next_due,
    )
    db.add(recurring)
    await db.flush()  # ID 생성 (commit 전에 recurring.id 확보)

    # 원본 거래에 새 정기 거래 FK 연결
    if source_record is not None:
        source_record.recurring_transaction_id = recurring.id

    await db.commit()
    await db.refresh(recurring)
    logger.info("정기 거래 생성: user=%s, description=%s, amount=%s", current_user.id, data.description, data.amount)
    return recurring


@router.get("", response_model=list[RecurringTransactionResponse])
async def get_recurring_list(
    type: str | None = Query(None, pattern="^(expense|income)$"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """정기 거래 목록 조회"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    query = select(RecurringTransaction).where(RecurringTransaction.household_id == household_id)

    if type is not None:
        query = query.where(RecurringTransaction.type == type)

    query = query.order_by(RecurringTransaction.next_due_date.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/pending", response_model=list[RecurringTransactionResponse])
async def get_pending_recurring(
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """처리 대기 중인 정기 거래 조회 (next_due_date <= today)"""
    today = datetime.now(ZoneInfo("Asia/Seoul")).date()

    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    query = select(RecurringTransaction).where(
        RecurringTransaction.household_id == household_id,
        RecurringTransaction.next_due_date <= today,
        RecurringTransaction.is_active.is_(True),
    )

    query = query.order_by(RecurringTransaction.next_due_date.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{recurring_id}", response_model=RecurringTransactionResponse)
async def get_recurring(
    recurring_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """정기 거래 상세 조회"""
    recurring = await _get_user_recurring(recurring_id, current_user, db)
    return recurring


@router.put("/{recurring_id}", response_model=RecurringTransactionResponse)
async def update_recurring(
    recurring_id: int,
    data: RecurringTransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """정기 거래 수정"""
    recurring = await _get_user_recurring(recurring_id, current_user, db)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(recurring, key, value)

    await db.commit()
    await db.refresh(recurring)
    return recurring


@router.delete("/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring(
    recurring_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """정기 거래 삭제"""
    recurring = await _get_user_recurring(recurring_id, current_user, db)
    await db.delete(recurring)
    await db.commit()


@router.post("/{recurring_id}/execute", response_model=ExecuteResponse, status_code=status.HTTP_201_CREATED)
async def execute_recurring_transaction(
    recurring_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """정기 거래 실행 → Expense 또는 Income 생성"""
    # 권한 확인 (가구 멤버십 포함)
    await _get_user_recurring(recurring_id, current_user, db)

    # FOR UPDATE 잠금으로 더블 클릭/네트워크 재시도 시 중복 실행 방지 (#136)
    result = await db.execute(select(RecurringTransaction).where(RecurringTransaction.id == recurring_id).with_for_update())
    recurring = result.scalar_one()

    if not recurring.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비활성화된 정기 거래는 실행할 수 없습니다",
        )

    created_id = await execute_recurring(recurring, db)

    return ExecuteResponse(
        message=f"{recurring.description} {float(recurring.amount):,.0f}원이 {'지출' if recurring.type == 'expense' else '수입'}으로 등록되었습니다",
        created_id=created_id,
        type=recurring.type,
        next_due_date=recurring.next_due_date,
    )


@router.post("/{recurring_id}/skip", response_model=SkipResponse)
async def skip_recurring_transaction(
    recurring_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """정기 거래 건너뛰기 → next_due_date만 갱신"""
    recurring = await _get_user_recurring(recurring_id, current_user, db)

    if not recurring.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비활성화된 정기 거래는 건너뛸 수 없습니다",
        )

    new_due = await skip_recurring(recurring, db)

    return {"next_due_date": str(new_due)}


async def _get_user_recurring(
    recurring_id: int,
    current_user: User,
    db: AsyncSession,
) -> RecurringTransaction:
    """사용자의 정기 거래 조회 (본인 또는 가구 멤버)"""
    result = await db.execute(select(RecurringTransaction).where(RecurringTransaction.id == recurring_id))
    recurring = result.scalar_one_or_none()

    if not recurring:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="정기 거래를 찾을 수 없습니다",
        )

    # 접근 권한 확인: 가구 멤버인지 검증
    if recurring.household_id is not None:
        try:
            await get_household_member(recurring.household_id, current_user, db)
        except HTTPException:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="정기 거래를 찾을 수 없습니다",
            ) from None
    else:
        # 레거시 데이터: household_id 없는 정기 거래는 본인 것만 조회
        if recurring.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="정기 거래를 찾을 수 없습니다",
            )

    return recurring

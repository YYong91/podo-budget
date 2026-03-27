"""결제수단 CRUD API 라우트

결제수단(카드, 현금 등) 관리 및 월별 사용액 통계 조회.
household_id 기반 데이터 소유권. soft delete (is_active=false).
is_default 설정 시 동일 사용자의 기존 기본값 자동 해제.
"""

import logging
from calendar import monthrange
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.expense import Expense
from app.models.payment_method import PaymentMethod
from app.models.user import User
from app.schemas.payment_method import (
    PaymentMethodCreate,
    PaymentMethodReorderRequest,
    PaymentMethodResponse,
    PaymentMethodUpdate,
    PaymentMethodUsage,
)

logger = logging.getLogger(__name__)

router = APIRouter()


async def get_default_payment_method_id(
    db: AsyncSession,
    household_id: int,
    user_id: int,
) -> int | None:
    """사용자의 기본 결제수단 ID 반환. 없으면 None."""
    result = await db.execute(
        select(PaymentMethod.id).where(
            PaymentMethod.household_id == household_id,
            PaymentMethod.created_by == user_id,
            PaymentMethod.is_default == True,  # noqa: E712
            PaymentMethod.is_active == True,  # noqa: E712
        )
    )
    return result.scalar_one_or_none()


async def _clear_default_for_user(
    db: AsyncSession,
    household_id: int,
    user_id: int,
    exclude_id: int | None = None,
) -> None:
    """사용자의 기존 기본 결제수단 해제 (새 기본 설정 전 호출)"""
    stmt = (
        update(PaymentMethod)
        .where(
            PaymentMethod.household_id == household_id,
            PaymentMethod.created_by == user_id,
            PaymentMethod.is_default == True,  # noqa: E712
        )
        .values(is_default=False)
    )
    if exclude_id is not None:
        stmt = stmt.where(PaymentMethod.id != exclude_id)
    await db.execute(stmt)


@router.post("", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_method(
    payload: PaymentMethodCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """결제수단 생성"""
    household_id = payload.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    # is_default 설정 시 기존 기본값 해제
    if payload.is_default:
        await _clear_default_for_user(db, household_id, current_user.id)  # type: ignore[arg-type]

    pm = PaymentMethod(
        household_id=household_id,
        created_by=current_user.id,
        name=payload.name,
        type=payload.type,
        monthly_target=payload.monthly_target,
        is_default=payload.is_default,
        display_order=payload.display_order,
    )
    db.add(pm)
    await db.commit()
    await db.refresh(pm)
    logger.info("결제수단 생성: user=%s, name=%s", current_user.id, pm.name)
    return pm


@router.get("", response_model=list[PaymentMethodResponse])
async def list_payment_methods(
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """활성 결제수단 목록 조회"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    result = await db.execute(
        select(PaymentMethod)
        .where(
            PaymentMethod.household_id == household_id,
            PaymentMethod.is_active == True,  # noqa: E712
        )
        .order_by(PaymentMethod.display_order, PaymentMethod.created_at)
    )
    return result.scalars().all()


@router.post("/reorder", response_model=list[PaymentMethodResponse])
async def reorder_payment_methods(
    payload: PaymentMethodReorderRequest,
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """결제수단 순서 변경 — ID 목록 순서대로 display_order 재할당"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    # 요청된 ID들이 실제 해당 가구의 활성 결제수단인지 검증
    result = await db.execute(
        select(PaymentMethod).where(
            PaymentMethod.id.in_(payload.payment_method_ids),
            PaymentMethod.household_id == household_id,
            PaymentMethod.is_active == True,  # noqa: E712
        )
    )
    found_pms: dict[int, PaymentMethod] = {int(pm.id): pm for pm in result.scalars().all()}

    # 중복 ID 검증
    if len(set(payload.payment_method_ids)) != len(payload.payment_method_ids):
        raise HTTPException(status_code=400, detail="중복된 결제수단 ID가 있습니다")

    if len(found_pms) != len(payload.payment_method_ids):
        raise HTTPException(
            status_code=400,
            detail="일부 결제수단을 찾을 수 없습니다",
        )

    # display_order 재할당
    for idx, pm_id in enumerate(payload.payment_method_ids):
        found_pms[pm_id].display_order = idx  # type: ignore[assignment]

    await db.commit()
    for pm in found_pms.values():
        await db.refresh(pm)

    # 정렬된 목록 반환
    return sorted(found_pms.values(), key=lambda p: int(p.display_order))


@router.put("/{payment_method_id}", response_model=PaymentMethodResponse)
async def update_payment_method(
    payment_method_id: int,
    payload: PaymentMethodUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """결제수단 수정"""
    result = await db.execute(select(PaymentMethod).where(PaymentMethod.id == payment_method_id))
    pm = result.scalar_one_or_none()
    if not pm:
        raise HTTPException(status_code=404, detail="결제수단을 찾을 수 없습니다")

    # 가구 멤버 검증
    await get_household_member(pm.household_id, current_user, db)  # type: ignore[arg-type]

    update_data = payload.model_dump(exclude_unset=True)

    # is_default 변경 시 본인 결제수단만 가능
    if update_data.get("is_default") is True and pm.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="다른 사용자의 결제수단을 기본으로 설정할 수 없습니다")

    # is_default 설정 시 기존 기본값 해제
    if update_data.get("is_default") is True:
        await _clear_default_for_user(db, pm.household_id, current_user.id, exclude_id=pm.id)  # type: ignore[arg-type]

    for key, value in update_data.items():
        setattr(pm, key, value)

    await db.commit()
    await db.refresh(pm)
    return pm


@router.delete("/{payment_method_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_method(
    payment_method_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """결제수단 soft delete (is_active=false)"""
    result = await db.execute(select(PaymentMethod).where(PaymentMethod.id == payment_method_id))
    pm = result.scalar_one_or_none()
    if not pm:
        raise HTTPException(status_code=404, detail="결제수단을 찾을 수 없습니다")

    await get_household_member(pm.household_id, current_user, db)  # type: ignore[arg-type]

    pm.is_active = False  # type: ignore[assignment]
    pm.is_default = False  # type: ignore[assignment]  # 삭제 시 기본 해제
    await db.commit()


@router.get("/stats/monthly", response_model=list[PaymentMethodUsage])
async def get_monthly_usage(
    month: str = Query(..., description="조회 월 (YYYY-MM)"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """결제수단별 월 사용액 조회"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    # 월 기간 계산
    year, mon = map(int, month.split("-"))
    _, last_day = monthrange(year, mon)
    start = datetime(year, mon, 1)
    end = datetime(year, mon, last_day, 23, 59, 59)

    # 활성 결제수단 + 해당 월 지출 합계 조회
    stmt = (
        select(
            PaymentMethod.id,
            PaymentMethod.name,
            PaymentMethod.type,
            PaymentMethod.monthly_target,
            func.coalesce(func.sum(Expense.amount), 0).label("spent_amount"),
        )
        .outerjoin(
            Expense,
            (Expense.payment_method_id == PaymentMethod.id) & (Expense.date >= start) & (Expense.date <= end),
        )
        .where(
            PaymentMethod.household_id == household_id,
            PaymentMethod.is_active == True,  # noqa: E712
        )
        .group_by(PaymentMethod.id)
        .order_by(PaymentMethod.name)
    )
    result = await db.execute(stmt)
    rows = result.all()

    usage_list = []
    for row in rows:
        target = float(row.monthly_target) if row.monthly_target is not None else None
        spent = float(row.spent_amount)
        usage_pct = round(spent / target * 100, 1) if target else None
        remaining = round(target - spent, 2) if target else None
        usage_list.append(
            PaymentMethodUsage(
                id=row.id,
                name=row.name,
                type=row.type,
                monthly_target=target,
                spent_amount=spent,
                usage_percentage=usage_pct,
                remaining=remaining,
            )
        )
    return usage_list

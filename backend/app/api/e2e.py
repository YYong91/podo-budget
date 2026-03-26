"""E2E 테스트 전용 엔드포인트

DEBUG=True일 때만 활성화됩니다. 프로덕션에서는 등록되지 않습니다.
- /api/e2e/setup: 테스트 유저 생성 + JWT 발급
- /api/e2e/cleanup: 특정 유저의 테스트 데이터 전체 삭제
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.recurring_transaction import RecurringTransaction
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class E2ESetupRequest(BaseModel):
    username: str = "e2e-test-user"
    email: str = "e2e@test.com"


class E2ESetupResponse(BaseModel):
    token: str
    user_id: int
    household_id: int


@router.post("/e2e/setup", response_model=E2ESetupResponse)
async def e2e_setup(request: E2ESetupRequest) -> object:
    """E2E 테스트 유저 생성 + JWT 발급"""
    if not settings.DEBUG:
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.email == request.email))
            user = result.scalar_one_or_none()

            if not user:
                # 고유한 auth_user_id 생성 (UNIQUE 제약 충돌 방지, String 타입)
                auth_user_id = str(uuid.uuid4())
                user = User(
                    username=request.username,
                    email=request.email,
                    auth_user_id=auth_user_id,
                )
                db.add(user)
                await db.flush()

                household = Household(name="E2E 테스트 가구")
                db.add(household)
                await db.flush()

                member = HouseholdMember(
                    household_id=household.id,
                    user_id=user.id,
                    role="owner",
                    joined_at=datetime.now(UTC).replace(tzinfo=None),
                )
                db.add(member)
                await db.commit()
                await db.refresh(user)
                household_id = household.id
            else:
                result = await db.execute(select(HouseholdMember.household_id).where(HouseholdMember.user_id == user.id).limit(1))
                household_id = result.scalar_one_or_none() or 1  # type: ignore[assignment]

            payload = {
                "sub": str(user.auth_user_id),
                "email": user.email,
                "username": user.username,
                "iss": "podo-auth",
                "exp": datetime.now(UTC) + timedelta(hours=1),
            }
            token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

            return E2ESetupResponse(token=token, user_id=user.id, household_id=household_id)
    except Exception as e:
        logger.error(f"E2E setup 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="E2E setup failed — check server logs") from e


class E2ECleanupRequest(BaseModel):
    user_id: int


class E2ECleanupResponse(BaseModel):
    deleted: dict[str, int]


@router.post("/e2e/cleanup", response_model=E2ECleanupResponse)
async def e2e_cleanup(request: E2ECleanupRequest, db: AsyncSession = Depends(get_db)) -> object:
    """E2E 테스트 데이터 정리 — 특정 유저의 모든 데이터를 삭제

    household_id를 통해 해당 가구에 속한 지출/수입/카테고리/예산/정기거래를 삭제합니다.
    DEBUG 모드에서만 동작합니다.
    Depends(get_db)를 사용하여 테스트에서 DB 세션 오버라이드 가능.
    """
    if not settings.DEBUG:
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        # 유저의 가구 ID 조회
        result = await db.execute(select(HouseholdMember.household_id).where(HouseholdMember.user_id == request.user_id))
        household_ids = [row[0] for row in result.fetchall()]

        if not household_ids:
            return E2ECleanupResponse(deleted={})

        deleted: dict[str, int] = {}

        # 삭제 순서: FK 의존성을 고려 (자식 → 부모)
        for model, name in [
            (Expense, "expenses"),
            (Income, "incomes"),
            (Budget, "budgets"),
            (RecurringTransaction, "recurring_transactions"),
            (Category, "categories"),
        ]:
            result = await db.execute(
                delete(model).where(model.household_id.in_(household_ids))  # type: ignore[attr-defined]
            )
            deleted[name] = result.rowcount or 0

        await db.commit()

        logger.info(f"E2E cleanup 완료: user_id={request.user_id}, deleted={deleted}")
        return E2ECleanupResponse(deleted=deleted)

    except Exception as e:
        logger.error(f"E2E cleanup 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="E2E cleanup failed — check server logs") from e

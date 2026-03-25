"""E2E 테스트 전용 엔드포인트

DEBUG=True일 때만 활성화됩니다. 프로덕션에서는 등록되지 않습니다.
테스트 유저 생성 + JWT 발급을 한번에 처리합니다.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.household import Household
from app.models.household_member import HouseholdMember
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
async def e2e_setup(request: E2ESetupRequest):
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
                household_id = result.scalar_one_or_none() or 1

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

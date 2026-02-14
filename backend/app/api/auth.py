"""인증 관련 API 라우트

회원가입, 로그인, 사용자 정보 조회, 계정 삭제 엔드포인트를 제공합니다.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, get_current_user, hash_password, verify_password
from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserCreate, UserResponse

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """회원가입

    새 사용자를 생성합니다. 비밀번호는 bcrypt로 해싱되어 저장됩니다.
    이메일은 선택 사항이며, 제공 시 가구 초대 시스템에서 사용됩니다.

    Args:
        user_data: 사용자명, 비밀번호, 이메일(선택)
        db: 데이터베이스 세션

    Returns:
        생성된 사용자 정보 (비밀번호 제외)

    Raises:
        HTTPException 400: 이미 존재하는 사용자명 또는 이메일
    """
    # 중복 사용자명 체크
    result = await db.execute(select(User).where(User.username == user_data.username))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 사용자명입니다",
        )

    # 이메일 중복 체크 (이메일이 제공된 경우만)
    if user_data.email:
        result = await db.execute(select(User).where(User.email == user_data.email))
        existing_email = result.scalar_one_or_none()

        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 사용 중인 이메일입니다",
            )

    # 비밀번호 해싱 후 사용자 생성
    hashed_pw = hash_password(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_pw,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return new_user


@router.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """로그인

    사용자명과 비밀번호로 인증하고 JWT 액세스 토큰을 발급합니다.

    Args:
        login_data: 사용자명과 비밀번호
        db: 데이터베이스 세션

    Returns:
        JWT 액세스 토큰 (유효기간 7일)

    Raises:
        HTTPException 401: 사용자명 또는 비밀번호가 틀린 경우
    """
    # 사용자 조회
    result = await db.execute(select(User).where(User.username == login_data.username))
    user = result.scalar_one_or_none()

    # 사용자 없음 또는 비밀번호 불일치
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자명 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 비활성 계정 체크
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다",
        )

    # JWT 토큰 생성 (sub 클레임에 사용자명 저장)
    access_token = create_access_token(data={"sub": user.username})

    return TokenResponse(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회

    JWT 토큰으로 인증된 사용자의 정보를 반환합니다.
    Authorization: Bearer <token> 헤더가 필요합니다.

    Args:
        current_user: JWT 토큰에서 추출한 사용자 (의존성 주입)

    Returns:
        현재 사용자 정보
    """
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """계정 삭제 (회원 탈퇴)

    현재 로그인한 사용자의 계정을 완전히 삭제합니다.
    연관된 모든 데이터(지출, 예산, 카테고리, 가구 멤버십)도 함께 삭제됩니다.

    삭제 순서 (FK 제약조건 준수):
    1. 사용자의 Expense (지출) 전체 삭제
    2. 사용자의 Budget (예산) 전체 삭제
    3. 사용자의 Category (카테고리) 전체 삭제
    4. 사용자가 속한 HouseholdMember (가구 멤버십) 소프트 삭제 (left_at 설정)
    5. 사용자가 보낸 HouseholdInvitation (초대) 삭제
    6. 사용자가 만든 Household 중 멤버가 0명인 것 소프트 삭제 (deleted_at 설정)
    7. 최종적으로 User 삭제

    Args:
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        204 No Content (성공 시 빈 응답)

    Note:
        트랜잭션으로 감싸져 있어 하나라도 실패하면 전체 롤백됩니다.
        가구의 소유자(owner)인 경우, 가구의 다른 멤버가 있으면 가구는 유지됩니다.
    """
    user_id = current_user.id

    try:
        # 1. 사용자의 지출(Expense) 전체 삭제
        await db.execute(delete(Expense).where(Expense.user_id == user_id))

        # 2. 사용자의 예산(Budget) 전체 삭제
        await db.execute(delete(Budget).where(Budget.user_id == user_id))

        # 3. 사용자의 카테고리(Category) 전체 삭제
        await db.execute(delete(Category).where(Category.user_id == user_id))

        # 4. 사용자가 속한 HouseholdMember 소프트 삭제 (left_at 설정)
        await db.execute(update(HouseholdMember).where(HouseholdMember.user_id == user_id, HouseholdMember.left_at.is_(None)).values(left_at=datetime.now(UTC)))

        # 5. 사용자가 보낸 초대(HouseholdInvitation) 삭제
        # inviter_id와 invitee_user_id 모두 체크
        await db.execute(delete(HouseholdInvitation).where((HouseholdInvitation.inviter_id == user_id) | (HouseholdInvitation.invitee_user_id == user_id)))

        # 6. 사용자가 소유한 가구 중 활성 멤버가 0명인 것 소프트 삭제
        # 사용자가 owner인 가구 조회 (deleted_at이 None인 것만)
        result = await db.execute(
            select(Household)
            .join(HouseholdMember, Household.id == HouseholdMember.household_id)
            .where(
                HouseholdMember.user_id == user_id,
                HouseholdMember.role == "owner",
                Household.deleted_at.is_(None),
            )
        )
        owned_households = result.scalars().all()

        for household in owned_households:
            # 해당 가구의 활성 멤버 수 확인 (left_at이 None인 멤버)
            member_count_result = await db.execute(
                select(HouseholdMember).where(HouseholdMember.household_id == household.id, HouseholdMember.left_at.is_(None))
            )
            active_members = member_count_result.scalars().all()

            # 활성 멤버가 0명이면 가구 소프트 삭제
            # (현재 사용자의 멤버십은 이미 소프트 삭제되었으므로 0명으로 카운트됨)
            if len(active_members) == 0:
                await db.execute(update(Household).where(Household.id == household.id).values(deleted_at=datetime.now(UTC)))

        # 7. 최종적으로 User 삭제
        await db.execute(delete(User).where(User.id == user_id))

        # 모든 변경사항 커밋
        await db.commit()

    except Exception as e:
        # 실패 시 롤백
        await db.rollback()
        import logging

        logging.getLogger(__name__).error(f"계정 삭제 실패 (user_id={user_id}): {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="계정 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        ) from e

    # 204 No Content는 빈 응답 반환
    return None

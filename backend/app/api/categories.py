"""카테고리 CRUD API 라우트

사용자별 카테고리 + 시스템 공통 카테고리를 관리합니다.
- user_id=None: 시스템 카테고리 (모든 사용자가 조회 가능, 수정/삭제 불가)
- user_id={user_id}: 개인 카테고리 (해당 사용자만 조회/수정/삭제 가능)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate

router = APIRouter()


@router.get("/", response_model=list[CategoryResponse])
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """카테고리 목록 조회

    시스템 공통 카테고리(user_id=None) + 현재 사용자의 개인 카테고리를 반환합니다.

    Args:
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        카테고리 목록 (시스템 카테고리 + 개인 카테고리)
    """
    result = await db.execute(
        select(Category)
        .where(or_(Category.user_id == None, Category.user_id == current_user.id))  # noqa: E711
        .order_by(Category.name)
    )
    return result.scalars().all()


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """카테고리 생성

    현재 사용자의 개인 카테고리를 생성합니다.
    user_id는 자동으로 현재 로그인한 사용자로 설정됩니다.

    Args:
        category: 카테고리 생성 데이터
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        생성된 카테고리 정보

    Raises:
        HTTPException 400: 같은 이름의 카테고리가 이미 존재하는 경우
    """
    # 중복 이름 체크 (시스템 카테고리 + 사용자의 개인 카테고리 모두 확인)
    existing = await db.execute(
        select(Category).where(
            Category.name == category.name,
            or_(Category.user_id == None, Category.user_id == current_user.id),  # noqa: E711
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 존재하는 카테고리입니다")

    db_category = Category(**category.model_dump(), user_id=current_user.id)
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """카테고리 수정

    현재 로그인한 사용자의 개인 카테고리만 수정할 수 있습니다.
    시스템 카테고리(user_id=None)는 수정할 수 없습니다.

    Args:
        category_id: 카테고리 ID
        category: 수정할 필드들
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        수정된 카테고리 정보

    Raises:
        HTTPException 404: 카테고리를 찾을 수 없거나 소유자가 아닌 경우
        HTTPException 403: 시스템 카테고리를 수정하려는 경우
    """
    result = await db.execute(select(Category).where(Category.id == category_id))
    db_category = result.scalar_one_or_none()
    if not db_category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다")

    # 시스템 카테고리는 수정 불가
    if db_category.user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="시스템 카테고리는 수정할 수 없습니다")

    # 소유자 확인
    if db_category.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다")

    update_data = category.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_category, key, value)

    await db.commit()
    await db.refresh(db_category)
    return db_category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """카테고리 삭제

    현재 로그인한 사용자의 개인 카테고리만 삭제할 수 있습니다.
    시스템 카테고리(user_id=None)는 삭제할 수 없습니다.

    Args:
        category_id: 카테고리 ID
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Raises:
        HTTPException 404: 카테고리를 찾을 수 없거나 소유자가 아닌 경우
        HTTPException 403: 시스템 카테고리를 삭제하려는 경우
    """
    result = await db.execute(select(Category).where(Category.id == category_id))
    db_category = result.scalar_one_or_none()
    if not db_category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다")

    # 시스템 카테고리는 삭제 불가
    if db_category.user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="시스템 카테고리는 삭제할 수 없습니다")

    # 소유자 확인
    if db_category.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다")

    await db.delete(db_category)
    await db.commit()

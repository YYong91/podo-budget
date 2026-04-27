"""카테고리 CRUD API 라우트

카테고리 스코프:
- user_id=None, household_id=None: 시스템 카테고리 (전체 공유, 수정/삭제 불가)
- household_id=X: 가계 카테고리 (가구 멤버 공유)
- user_id=X, household_id=None: 솔로 유저 개인 카테고리 (가구 미소속 폴백)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryReorderRequest, CategoryResponse, CategoryUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


def _to_response(cat: Category) -> CategoryResponse:
    """Category ORM → CategoryResponse 변환 (is_system 계산 포함)"""
    resp = CategoryResponse.model_validate(cat)
    resp.is_system = cat.user_id is None and cat.household_id is None
    return resp


async def _get_household_id(current_user: User, db: AsyncSession) -> int:
    """현재 사용자의 활성 가구 ID 조회 (필수)"""
    return await get_user_active_household_id(current_user, db)


def _build_accessible_filter(user_id: int, household_id: int) -> object:
    """접근 가능한 카테고리 필터 (3-scope)"""
    conditions = [
        and_(Category.household_id.is_(None), Category.user_id.is_(None)),  # 시스템
        and_(Category.user_id == user_id, Category.household_id.is_(None)),  # 솔로 폴백
        Category.household_id == household_id,  # 가계
    ]
    return or_(*conditions)


@router.get("", response_model=list[CategoryResponse])
async def get_categories(
    type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """카테고리 목록 조회

    시스템 카테고리 + 가계/솔로 카테고리를 반환합니다.
    ?type=expense 또는 ?type=income으로 필터링 가능. both 타입은 양쪽에 포함.
    """
    household_id = await _get_household_id(current_user, db)
    scope_filter = _build_accessible_filter(current_user.id, household_id)  # type: ignore[arg-type]

    query = select(Category).where(scope_filter)  # type: ignore[arg-type]
    if type in ("expense", "income"):
        query = query.where(Category.type.in_([type, "both"]))

    result = await db.execute(query.order_by(Category.sort_order.desc(), Category.name))
    return [_to_response(cat) for cat in result.scalars().all()]


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """카테고리 생성

    가구가 있으면 가계 카테고리로, 없으면 솔로 개인 카테고리로 생성합니다.
    """
    household_id = await _get_household_id(current_user, db)
    scope_filter = _build_accessible_filter(current_user.id, household_id)  # type: ignore[arg-type]

    # 중복 이름 체크
    existing = await db.execute(select(Category).where(Category.name == category.name, scope_filter))  # type: ignore[arg-type]
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 존재하는 카테고리입니다")

    # 가구 소속이 필수이므로 항상 가계 카테고리로 생성, sort_order 100으로 초기화 (시스템 카테고리 최대값 18보다 높음)
    db_category = Category(**category.model_dump(), household_id=household_id, user_id=None, sort_order=100)

    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    logger.info("카테고리 생성: user=%s, name=%s", current_user.id, category.name)
    return _to_response(db_category)


@router.put("/reorder", response_model=list[CategoryResponse])
async def reorder_categories(
    request: CategoryReorderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """카테고리 순서 변경

    전달받은 category_ids 순서대로 sort_order를 설정합니다.
    첫 번째 ID가 가장 높은 sort_order를 받아 목록 최상단에 표시됩니다.
    시스템 카테고리는 글로벌 공유이므로 sort_order 변경 불가.
    """
    household_id = await _get_household_id(current_user, db)
    scope_filter = _build_accessible_filter(current_user.id, household_id)  # type: ignore[arg-type]

    result = await db.execute(select(Category).where(scope_filter))  # type: ignore[arg-type]
    accessible = {cat.id: cat for cat in result.scalars().all()}

    for cat_id in request.category_ids:
        if cat_id not in accessible:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"카테고리 ID {cat_id}에 접근할 수 없습니다",
            )

    # 커스텀 카테고리만 sort_order 재배정 (시스템은 고정, 100 이상 유지)
    custom_ids_in_order = [
        cat_id
        for cat_id in request.category_ids
        if accessible[cat_id].user_id is not None or accessible[cat_id].household_id is not None  # type: ignore[index]
    ]
    total_custom = len(custom_ids_in_order)
    for idx, cat_id in enumerate(custom_ids_in_order):
        # 커스텀 카테고리는 sort_order 100 이상 유지 (시스템 카테고리 최대값 18과 분리)
        accessible[cat_id].sort_order = max(100, 100 + total_custom - idx)  # type: ignore[index, assignment]

    await db.commit()

    result = await db.execute(select(Category).where(scope_filter).order_by(Category.sort_order.desc(), Category.name))  # type: ignore[arg-type]
    return [_to_response(cat) for cat in result.scalars().all()]


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """카테고리 수정

    가계 카테고리(household_id) 또는 솔로 개인 카테고리(user_id)만 수정 가능합니다.
    시스템 카테고리는 수정할 수 없습니다.
    """
    household_id = await _get_household_id(current_user, db)

    result = await db.execute(select(Category).where(Category.id == category_id))
    db_category = result.scalar_one_or_none()
    if not db_category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다")

    # 시스템 카테고리는 수정 불가
    if db_category.user_id is None and db_category.household_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="시스템 카테고리는 수정할 수 없습니다")

    # 소유권 확인: 가계 카테고리(멤버이면 OK) 또는 솔로 개인 카테고리(본인만)
    is_household_owner = db_category.household_id == household_id
    is_solo_owner = db_category.user_id == current_user.id
    if not (is_household_owner or is_solo_owner):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다")

    update_data = category.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_category, key, value)

    await db.commit()
    await db.refresh(db_category)
    return _to_response(db_category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """카테고리 삭제

    가계 카테고리(household_id) 또는 솔로 개인 카테고리(user_id)만 삭제 가능합니다.
    시스템 카테고리는 삭제할 수 없습니다.
    """
    household_id = await _get_household_id(current_user, db)

    result = await db.execute(select(Category).where(Category.id == category_id))
    db_category = result.scalar_one_or_none()
    if not db_category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다")

    # 시스템 카테고리는 삭제 불가
    if db_category.user_id is None and db_category.household_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="시스템 카테고리는 삭제할 수 없습니다")

    # 소유권 확인
    is_household_owner = db_category.household_id == household_id
    is_solo_owner = db_category.user_id == current_user.id
    if not (is_household_owner or is_solo_owner):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="카테고리를 찾을 수 없습니다")

    await db.delete(db_category)
    await db.commit()

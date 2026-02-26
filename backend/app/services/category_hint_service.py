"""카테고리 히스토리 기반 추천 서비스

과거 지출/수입 내역에서 설명→카테고리 패턴을 추출합니다.
LLM 프롬프트에 주입하여 카테고리 자동 인식 정확도를 높입니다.
"""

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.expense import Expense
from app.models.income import Income


async def get_user_categories(
    db: AsyncSession,
    user_id: int,
) -> list[str]:
    """사용자의 카테고리 목록 반환 (시스템 카테고리 + 개인 카테고리)"""
    result = await db.execute(
        select(Category.name)
        .where(or_(Category.user_id == None, Category.user_id == user_id))  # noqa: E711
        .order_by(Category.name)
    )
    return [row[0] for row in result.all()]


async def get_category_hints(
    db: AsyncSession,
    user_id: int,
    household_id: int | None = None,
    limit: int = 60,
) -> dict[str, str]:
    """과거 거래 패턴에서 설명→카테고리 매핑 추출

    최신 거래부터 limit건을 조회하여 설명→카테고리 패턴을 빌드합니다.
    동일 설명이 여러 번 나타나면 가장 최근 카테고리를 사용합니다.

    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        household_id: 가구 ID (있으면 가구 스코프로 조회)
        limit: 지출 기록 조회 건수 (기본 60)

    Returns:
        dict[설명, 카테고리명]: 예) {"쿠팡이츠": "식비", "전기차충전": "교통비"}
    """
    hints: dict[str, str] = {}

    # 스코프 필터 (가구 vs 개인)
    if household_id is not None:
        exp_scope = Expense.household_id == household_id
        inc_scope = Income.household_id == household_id
    else:
        exp_scope = Expense.user_id == user_id
        inc_scope = Income.user_id == user_id

    # 지출 히스토리에서 패턴 추출 (최신 순)
    exp_result = await db.execute(
        select(Expense.description, Category.name)
        .join(Category, Expense.category_id == Category.id)
        .where(exp_scope, Expense.category_id.isnot(None))
        .order_by(Expense.date.desc())
        .limit(limit)
    )
    for description, category_name in exp_result.all():
        # 가장 최근 패턴 우선 — 이미 있으면 스킵
        if description not in hints:
            hints[description] = category_name

    # 수입 히스토리에서 패턴 추출 (수입은 적게 조회)
    inc_result = await db.execute(
        select(Income.description, Category.name)
        .join(Category, Income.category_id == Category.id)
        .where(inc_scope, Income.category_id.isnot(None))
        .order_by(Income.date.desc())
        .limit(max(10, limit // 5))
    )
    for description, category_name in inc_result.all():
        if description not in hints:
            hints[description] = category_name

    return hints

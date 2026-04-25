"""지출 CRUD API 라우트

사용자별로 지출 데이터를 격리하여 관리합니다.
모든 엔드포인트는 JWT 인증이 필요하며, 각 사용자는 자신의 지출만 조회/수정할 수 있습니다.

공유 가계부(Household) 연동:
- household_id가 있으면 해당 가구의 공유 지출로 기록
- household_id가 없으면 사용자의 활성 가구를 자동 감지
- 가구 멤버 전체의 지출을 함께 조회할 수 있음
"""

import logging
from calendar import monthrange
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.api.payment_methods import get_default_payment_method_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User
from app.schemas.chat import ChatResponse, ParsedExpenseItem
from app.schemas.expense import (
    CategoryChange,
    CategoryStats,
    ChangeInfo,
    ComparisonResponse,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    MonthlyStatsResponse,
    PeriodTotal,
    SearchSummary,
    StatsPeriod,
    StatsResponse,
    TrendPoint,
)
from app.services.llm_service import get_llm_provider
from app.utils.date_utils import get_month_range, get_week_label, get_week_range, get_year_range

logger = logging.getLogger(__name__)

router = APIRouter()


def _escape_like(value: str) -> str:
    """LIKE 패턴 특수문자 이스케이프"""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _apply_expense_filters(  # type: ignore[no-untyped-def]
    stmt,
    *,
    query: str | None,
    start_date: str | None,
    end_date: str | None,
    category_id: int | None,
    member_user_id: int | None,
    min_amount: int | None = None,
    max_amount: int | None = None,
) -> object:
    """지출 공통 필터 적용"""
    if member_user_id is not None:
        stmt = stmt.where(Expense.user_id == member_user_id)
    if query:
        stmt = stmt.where(Expense.description.ilike(f"%{_escape_like(query)}%", escape="\\"))
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        stmt = stmt.where(Expense.date >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        if len(end_date) == 10:
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        stmt = stmt.where(Expense.date <= end_dt)
    if category_id is not None:
        stmt = stmt.where(Expense.category_id == category_id)
    if min_amount is not None:
        stmt = stmt.where(Expense.amount >= min_amount)
    if max_amount is not None:
        stmt = stmt.where(Expense.amount <= max_amount)
    return stmt


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """지출 직접 생성

    인증된 사용자의 지출을 생성합니다.
    household_id가 지정되면 해당 가구의 공유 지출로, 없으면 활성 가구를 자동 감지합니다.
    """
    # household_id 결정: 요청에서 받거나 활성 가구 자동 감지
    household_id = expense.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    # 가구 멤버 검증
    await get_household_member(household_id, current_user, db)

    expense_data = expense.model_dump(exclude={"household_id"})

    # 기본 결제수단 자동 적용 — 명시적 지정이 없으면 사용자 기본값 폴백
    # exclude_auto_payment=true 카테고리(저축/투자, 세금 등)는 기본 결제수단 자동 적용 제외
    if expense_data.get("payment_method_id") is None:
        should_auto_apply = True
        if expense_data.get("category_id"):
            cat_result = await db.execute(select(Category.exclude_auto_payment).where(Category.id == expense_data["category_id"]))
            exclude = cat_result.scalar_one_or_none()
            if exclude:
                should_auto_apply = False
        if should_auto_apply:
            expense_data["payment_method_id"] = await get_default_payment_method_id(db, household_id, current_user.id)  # type: ignore[arg-type]

    db_expense = Expense(**expense_data, user_id=current_user.id, household_id=household_id)
    db.add(db_expense)
    await db.commit()
    await db.refresh(db_expense)
    logger.info("지출 생성: user=%s, amount=%s", current_user.id, expense.amount)
    return db_expense


@router.get("", response_model=list[ExpenseResponse])
async def get_expenses(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    start_date: str | None = Query(None, description="시작일 YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS"),
    end_date: str | None = Query(None, description="종료일 YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS"),
    category_id: int | None = None,
    household_id: int | None = None,
    member_user_id: int | None = Query(None, description="가구 내 특정 멤버의 지출만 조회"),
    query: str | None = Query(None, description="설명(description) 텍스트 검색"),
    min_amount: int | None = Query(None, ge=1, description="최소 금액 (원 단위)"),
    max_amount: int | None = Query(None, ge=1, description="최대 금액 (원 단위)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """지출 목록 조회 (필터링, 페이지네이션)

    household_id가 있으면 해당 가구 전체 멤버의 지출을 조회합니다.
    없으면 현재 사용자의 지출만 조회합니다 (하위 호환).
    """
    # household_id 미지정 시 활성 가구 자동 감지
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    # 가구 멤버 검증 후 가구 전체 멤버의 지출 조회
    await get_household_member(household_id, current_user, db)
    stmt = select(Expense).where(Expense.household_id == household_id)
    stmt = _apply_expense_filters(  # type: ignore[assignment]
        stmt,
        query=query,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        member_user_id=member_user_id,
        min_amount=min_amount,
        max_amount=max_amount,
    )

    stmt = stmt.order_by(Expense.date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


def _build_scope_filter(household_id: int) -> object:
    """가구 스코프 필터 생성"""
    return Expense.household_id == household_id


# ── 통계 API ──


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    period: StatsPeriod = Query(..., description="통계 기간: weekly, monthly, yearly"),
    date: str | None = Query(None, description="기준 날짜 YYYY-MM-DD (기본: 오늘)", alias="date"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """기간별 통계 조회 (주간/월간/연간)"""
    from datetime import date as date_type

    # 기준 날짜 파싱
    ref_date = date_type.fromisoformat(date) if date else date_type.today()

    # 기간 범위 결정
    if period == StatsPeriod.weekly:
        start_d, end_d = get_week_range(ref_date)
        label = get_week_label(ref_date)
    elif period == StatsPeriod.monthly:
        start_d, end_d = get_month_range(ref_date)
        label = f"{ref_date.year}년 {ref_date.month}월"
    else:  # yearly
        start_d, end_d = get_year_range(ref_date)
        label = f"{ref_date.year}년"

    start_dt = datetime(start_d.year, start_d.month, start_d.day)
    end_dt = datetime(end_d.year, end_d.month, end_d.day, 23, 59, 59)

    # household_id 미지정 시 활성 가구 자동 감지
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    scope_filter = _build_scope_filter(household_id)
    stats_filter = Expense.exclude_from_stats == False  # noqa: E712
    base_where = [scope_filter, stats_filter, Expense.date >= start_dt, Expense.date <= end_dt]

    # 총합 + 건수
    total_result = await db.execute(
        select(
            func.coalesce(func.sum(Expense.amount), 0),
            func.count(Expense.id),
        ).where(*base_where)  # type: ignore[arg-type]
    )
    row = total_result.one()
    total = float(row[0])
    count = int(row[1])

    # 카테고리별
    cat_result = await db.execute(
        select(
            Category.name,
            func.sum(Expense.amount).label("amount"),
            func.count(Expense.id).label("cnt"),
        )
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(*base_where)  # type: ignore[arg-type]
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
    )
    by_category = []
    for r in cat_result.all():
        amt = float(r.amount)
        by_category.append(
            CategoryStats(
                category=r.name or "미분류",
                amount=amt,
                count=int(r.cnt),
                percentage=round(amt / total * 100, 1) if total > 0 else 0,
            )
        )

    # 트렌드
    trend: list[TrendPoint] = []
    if period == StatsPeriod.yearly:
        # 월별 12포인트 — 단일 GROUP BY 쿼리 (12번 직렬 → 1번, #164)
        month_col = func.extract("month", Expense.date).label("month")
        monthly_result = await db.execute(
            select(month_col, func.coalesce(func.sum(Expense.amount), 0).label("amount")).where(*base_where).group_by(month_col).order_by(month_col)  # type: ignore[arg-type]
        )
        monthly_map = {int(r.month): float(r.amount) for r in monthly_result.all()}
        for m in range(1, 13):
            trend.append(TrendPoint(label=f"{m}월", amount=monthly_map.get(m, 0.0)))
    else:
        # 일별
        day_col = func.date(Expense.date).label("day")
        daily_result = await db.execute(select(day_col, func.sum(Expense.amount).label("amount")).where(*base_where).group_by(day_col).order_by(day_col))  # type: ignore[arg-type]
        for r in daily_result.all():
            if r.day is not None:
                day_str = str(r.day)[:10]
                trend.append(
                    TrendPoint(
                        label=day_str[5:].replace("-", "/"),
                        amount=float(r.amount),
                    )
                )

    return StatsResponse(
        period=period.value,
        label=label,
        start_date=str(start_d),
        end_date=str(end_d),
        total=total,
        count=count,
        by_category=by_category,
        trend=trend,
    )


@router.get("/stats/comparison", response_model=ComparisonResponse)
async def get_stats_comparison(
    period: str = Query(
        ...,
        description="비교 기간: monthly 또는 yearly",
        pattern=r"^(monthly|yearly)$",
    ),
    date: str | None = Query(None, description="기준 날짜 YYYY-MM-DD (기본: 오늘)", alias="date"),
    months: int = Query(3, ge=2, le=12, description="비교할 개월 수"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """기간 비교 (전월 대비 + N개월 트렌드)"""
    from datetime import date as date_type

    ref_date = date_type.fromisoformat(date) if date else date_type.today()

    # household_id 미지정 시 활성 가구 자동 감지
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    scope_filter = _build_scope_filter(household_id)

    excl_filter = Expense.exclude_from_stats == False  # noqa: E712

    async def _month_total(year: int, month: int, end_day: int | None = None) -> float:
        m_start = datetime(year, month, 1)
        _, m_last = monthrange(year, month)
        actual_end = min(end_day, m_last) if end_day is not None else m_last
        m_end = datetime(year, month, actual_end, 23, 59, 59)
        r = await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(scope_filter, excl_filter, Expense.date >= m_start, Expense.date <= m_end)  # type: ignore[arg-type]
        )
        return float(r.scalar())  # type: ignore[arg-type]

    async def _month_by_category(year: int, month: int, end_day: int | None = None) -> dict[str, float]:
        m_start = datetime(year, month, 1)
        _, m_last = monthrange(year, month)
        actual_end = min(end_day, m_last) if end_day is not None else m_last
        m_end = datetime(year, month, actual_end, 23, 59, 59)
        r = await db.execute(
            select(Category.name, func.sum(Expense.amount).label("amount"))
            .join(Category, Expense.category_id == Category.id, isouter=True)
            .where(scope_filter, excl_filter, Expense.date >= m_start, Expense.date <= m_end)  # type: ignore[arg-type]
            .group_by(Category.name)
        )
        return {row.name or "미분류": float(row.amount) for row in r.all()}

    if period == "monthly":
        cur_y, cur_m = ref_date.year, ref_date.month
        prev_m = cur_m - 1 if cur_m > 1 else 12
        prev_y = cur_y if cur_m > 1 else cur_y - 1

        # 진행 중인 달이면 오늘까지만 집계 (전달은 전체 월 기준으로 비교)
        today = date_type.today()
        is_current_month = cur_y == today.year and cur_m == today.month
        end_day = today.day if is_current_month else None

        current_total = await _month_total(cur_y, cur_m, end_day)
        previous_total = await _month_total(prev_y, prev_m)  # 전달은 전체 월

        if is_current_month:
            current_label = f"{cur_y}년 {cur_m}월 ({today.day}일까지)"
            previous_label = f"{prev_y}년 {prev_m}월"
        else:
            current_label = f"{cur_y}년 {cur_m}월"
            previous_label = f"{prev_y}년 {prev_m}월"

        # N개월 트렌드 (현재 월 포함 과거 N개월) — 단일 GROUP BY 쿼리 (#164)
        trend_data: list[PeriodTotal] = []
        y, m = cur_y, cur_m
        for _ in range(months - 1):
            m -= 1
            if m < 1:
                m = 12
                y -= 1
        start_y, start_m = y, m
        _, end_last = monthrange(cur_y, cur_m)
        trend_start = datetime(start_y, start_m, 1)
        trend_end = datetime(cur_y, cur_m, end_last, 23, 59, 59)

        yr_col = func.extract("year", Expense.date).label("year")
        mo_col = func.extract("month", Expense.date).label("month")
        trend_result = await db.execute(
            select(yr_col, mo_col, func.coalesce(func.sum(Expense.amount), 0).label("amount"))
            .where(scope_filter, excl_filter, Expense.date >= trend_start, Expense.date <= trend_end)  # type: ignore[arg-type]
            .group_by(yr_col, mo_col)
            .order_by(yr_col, mo_col)
        )
        trend_map = {(int(r.year), int(r.month)): float(r.amount) for r in trend_result.all()}
        for _ in range(months):
            trend_data.append(PeriodTotal(label=f"{y}년 {m}월", total=trend_map.get((y, m), 0.0)))
            m += 1
            if m > 12:
                m = 1
                y += 1

        # 카테고리별 비교 (동일 end_day 적용)
        cur_cats = await _month_by_category(cur_y, cur_m, end_day)
        prev_cats = await _month_by_category(prev_y, prev_m, end_day)
        all_cats = set(cur_cats.keys()) | set(prev_cats.keys())
        by_cat_comparison = []
        for cat in sorted(all_cats):
            c = cur_cats.get(cat, 0)
            p = prev_cats.get(cat, 0)
            change_pct = round((c - p) / p * 100, 1) if p > 0 else None
            by_cat_comparison.append(
                CategoryChange(
                    category=cat,
                    current=c,
                    previous=p,
                    change_amount=round(c - p, 2),
                    change_percentage=change_pct,
                )
            )
    else:  # yearly
        cur_y = ref_date.year
        prev_y = cur_y - 1

        # 필요한 연도 목록 수집 (current, previous, trend)
        trend_years = [cur_y - y_offset for y_offset in range(months - 1, -1, -1)]
        years_needed = list({cur_y, prev_y, *trend_years})

        # 연도별 합계를 단일 쿼리로 조회 (기존 24-60회 → 1회)
        year_totals_result = await db.execute(
            select(extract("year", Expense.date).label("year"), func.coalesce(func.sum(Expense.amount), 0).label("total"))
            .where(scope_filter, excl_filter, extract("year", Expense.date).in_(years_needed))  # type: ignore[arg-type]
            .group_by(extract("year", Expense.date))
        )
        year_totals: dict[int, float] = {int(row.year): float(row.total) for row in year_totals_result.all()}

        current_total = year_totals.get(cur_y, 0.0)
        previous_total = year_totals.get(prev_y, 0.0)
        current_label = f"{cur_y}년"
        previous_label = f"{prev_y}년"

        trend_data = [PeriodTotal(label=f"{y}년", total=year_totals.get(y, 0.0)) for y in trend_years]

        by_cat_comparison = []

    # 변화량 계산
    change_amount = round(current_total - previous_total, 2)
    change_pct = round(change_amount / previous_total * 100, 1) if previous_total > 0 else None

    return ComparisonResponse(
        current=PeriodTotal(label=current_label, total=current_total),
        previous=PeriodTotal(label=previous_label, total=previous_total),
        change=ChangeInfo(amount=change_amount, percentage=change_pct),
        trend=trend_data,
        by_category_comparison=by_cat_comparison,
    )


@router.get("/stats/monthly", response_model=MonthlyStatsResponse)
async def get_monthly_stats(
    month: str = Query(..., description="YYYY-MM 형식", pattern=r"^\d{4}-\d{2}$"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """월별 지출 통계 (총합, 카테고리별 합계)

    household_id가 있으면 가구 전체 멤버의 월별 통계를 집계합니다.
    """

    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)

    # household_id 미지정 시 활성 가구 자동 감지
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)
    scope_filter = Expense.household_id == household_id

    excl_filter = Expense.exclude_from_stats == False  # noqa: E712

    # 총합
    total_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(scope_filter, excl_filter, Expense.date >= start, Expense.date < end)
    )
    total = total_result.scalar()

    # 카테고리별 합계
    category_result = await db.execute(
        select(Category.name, func.sum(Expense.amount).label("amount"))
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(scope_filter, excl_filter, Expense.date >= start, Expense.date < end)
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
    )
    by_category = [{"category": row.name or "미분류", "amount": float(row.amount)} for row in category_result.all()]

    # 일별 추이
    day_col = func.date(Expense.date).label("day")
    daily_result = await db.execute(
        select(day_col, func.sum(Expense.amount).label("amount"))
        .where(scope_filter, excl_filter, Expense.date >= start, Expense.date < end)
        .group_by(day_col)
        .order_by(day_col)
    )
    daily_trend = [{"date": str(row.day)[:10], "amount": float(row.amount)} for row in daily_result.all() if row.day is not None]

    return {
        "month": month,
        "total": float(total),  # type: ignore[arg-type]
        "by_category": by_category,
        "daily_trend": daily_trend,
    }


@router.post("/ocr", response_model=ChatResponse)
@limiter.limit("5/minute")  # LLM 크레딧 보호 (#234)
async def parse_expense_image(
    request: Request,
    file: UploadFile = File(...),
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """결제 스크린샷/영수증 이미지 OCR로 지출 파싱 (프리뷰 전용)

    이미지를 Claude Vision API로 분석하여 지출 정보를 추출합니다.
    저장하지 않고 파싱 결과만 반환합니다 (chat preview와 동일한 형식).
    """
    # Content-Type 검증
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 파일만 업로드 가능합니다 (jpeg, png, gif, webp)",
        )

    # 파일 크기 검증 (10MB 제한)
    MAX_SIZE = 10 * 1024 * 1024
    image_bytes = await file.read()
    if len(image_bytes) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일 크기는 10MB 이하여야 합니다",
        )

    # 매직 바이트 검증 — Content-Type 스푸핑 방지 (#237)
    # content_type 헤더는 클라이언트가 임의로 설정 가능하므로 실제 파일 내용으로 검증
    MAGIC_BYTES: dict[str, list[bytes]] = {
        "image/jpeg": [b"\xff\xd8\xff"],
        "image/png": [b"\x89PNG\r\n"],
        "image/gif": [b"GIF87a", b"GIF89a"],
        "image/webp": [b"RIFF"],  # RIFF....WEBP 구조
    }
    valid_magic = MAGIC_BYTES.get(file.content_type, [])
    if valid_magic and not any(image_bytes.startswith(m) for m in valid_magic):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 파일 내용이 올바르지 않습니다",
        )

    # household_id 미지정 시 활성 가구 자동 감지
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    # OCR 프로바이더로 이미지 파싱 (anthropic 기본값)
    try:
        llm = get_llm_provider("ocr")
        parsed = await llm.parse_image(image_bytes, file.content_type)
    except NotImplementedError as exc:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="현재 설정된 LLM 프로바이더는 이미지 OCR을 지원하지 않습니다",
        ) from exc

    # 에러 응답 처리
    if isinstance(parsed, dict) and "error" in parsed:
        return ChatResponse(
            message=parsed["error"],
            parsed_expenses=None,
            parsed_items=None,
            expenses_created=None,
            incomes_created=None,
            insights=None,
        )

    # 파싱 결과를 ParsedExpenseItem 리스트로 변환
    from datetime import datetime

    items = [parsed] if isinstance(parsed, dict) else parsed
    parsed_items = [
        ParsedExpenseItem(
            amount=item["amount"],
            description=item.get("description", ""),
            category=item.get("category", "기타"),
            date=item.get("date", datetime.now().strftime("%Y-%m-%d")),
            memo=item.get("memo", ""),
            household_id=household_id,
            type=item.get("type", "expense"),
        )
        for item in items
    ]

    count = len(parsed_items)
    total = sum(item.amount for item in parsed_items)

    return ChatResponse(
        message=f"{count}건의 지출을 인식했습니다 (총 ₩{total:,.0f}). 확인 후 저장해주세요.",
        parsed_expenses=parsed_items,
        parsed_items=parsed_items,
        expenses_created=None,
        incomes_created=None,
        insights=None,
    )


@router.get("/search/summary", response_model=SearchSummary)
async def get_expenses_search_summary(
    query: str | None = Query(None, description="설명(description) 텍스트 검색"),
    start_date: str | None = Query(None, description="시작일"),
    end_date: str | None = Query(None, description="종료일"),
    category_id: int | None = None,
    household_id: int | None = None,
    member_user_id: int | None = Query(None, description="가구 내 특정 멤버"),
    min_amount: int | None = Query(None, ge=1, description="최소 금액 (원 단위)"),
    max_amount: int | None = Query(None, ge=1, description="최대 금액 (원 단위)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """검색 결과 합계 (건수 + 총액)"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    stmt = select(func.count(), func.coalesce(func.sum(Expense.amount), 0)).where(Expense.household_id == household_id)
    stmt = _apply_expense_filters(  # type: ignore[assignment]
        stmt,
        query=query,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        member_user_id=member_user_id,
        min_amount=min_amount,
        max_amount=max_amount,
    )

    result = await db.execute(stmt)
    count, total = result.one()
    return SearchSummary(total_count=count, total_amount=float(total))


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """특정 지출 조회

    지출의 household_id가 있으면 가구 멤버인지 확인합니다.
    없으면 본인 지출인지 확인합니다.
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    # 접근 권한 확인: 가구 멤버인지 검증
    if expense.household_id is not None:
        try:
            await get_household_member(expense.household_id, current_user, db)  # type: ignore[arg-type]
        except HTTPException:
            # 가구 멤버가 아닌 경우 404 반환 (존재 여부 노출 방지)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다") from None
    else:
        # 레거시 데이터: household_id 없는 지출은 본인 것만 조회
        if expense.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_update: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """지출 수정

    본인 거래는 무조건 수정 가능.
    타인 거래는 admin/owner만 수정 가능, member는 403.
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    if expense.household_id is None:
        # 레거시 데이터(마이그레이션 이전): household_id=None → 본인 확인만으로 수정 허용 (#147)
        if expense.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")
    else:
        # 가구 멤버 검증 (비멤버는 존재 여부 노출 방지를 위해 404)
        try:
            member = await get_household_member(expense.household_id, current_user, db)  # type: ignore[arg-type]
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다") from None

        # 본인 거래가 아니면 admin/owner만 수정 가능
        if expense.user_id != current_user.id and member.role not in ("admin", "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 항목을 수정할 권한이 없습니다",
            )

    old_category_id = expense.category_id
    update_data = expense_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(expense, key, value)

    await db.commit()
    await db.refresh(expense)

    # 카테고리가 변경된 경우 정정 신호 캡처 (Phase 2 임베딩의 학습 데이터)
    new_category_id = update_data.get("category_id")
    if new_category_id is not None and new_category_id != old_category_id and expense.description:
        from app.services.correction_service import save_correction

        await save_correction(
            db,
            input_text=expense.description,
            category_id=new_category_id,
            household_id=expense.household_id,
            user_id=current_user.id,
            source="edit",
        )
        await db.commit()

    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """지출 삭제

    본인 거래는 무조건 삭제 가능.
    타인 거래는 admin/owner만 삭제 가능, member는 403.
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    if expense.household_id is None:
        # 레거시 데이터(마이그레이션 이전): household_id=None → 본인 확인만으로 삭제 허용 (#147)
        if expense.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")
    else:
        # 가구 멤버 검증 (비멤버는 존재 여부 노출 방지를 위해 404)
        try:
            member = await get_household_member(expense.household_id, current_user, db)  # type: ignore[arg-type]
        except HTTPException:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다") from None

        # 본인 거래가 아니면 admin/owner만 삭제 가능
        if expense.user_id != current_user.id and member.role not in ("admin", "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 항목을 삭제할 권한이 없습니다",
            )

    await db.delete(expense)
    await db.commit()
    logger.info("지출 삭제: user=%s, expense_id=%s", current_user.id, expense_id)

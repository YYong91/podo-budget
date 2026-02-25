"""지출 CRUD API 라우트

사용자별로 지출 데이터를 격리하여 관리합니다.
모든 엔드포인트는 JWT 인증이 필요하며, 각 사용자는 자신의 지출만 조회/수정할 수 있습니다.

공유 가계부(Household) 연동:
- household_id가 있으면 해당 가구의 공유 지출로 기록
- household_id가 없으면 사용자의 활성 가구를 자동 감지
- 가구 멤버 전체의 지출을 함께 조회할 수 있음
"""

from calendar import monthrange
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
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
    PeriodTotal,
    StatsPeriod,
    StatsResponse,
    TrendPoint,
)
from app.services.llm_service import get_llm_provider

router = APIRouter()


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 직접 생성

    인증된 사용자의 지출을 생성합니다.
    household_id가 지정되면 해당 가구의 공유 지출로, 없으면 활성 가구를 자동 감지합니다.
    """
    # household_id 결정: 요청에서 받거나 활성 가구 자동 감지
    household_id = expense.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    # 가구가 있으면 멤버 검증
    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    expense_data = expense.model_dump(exclude={"household_id"})
    db_expense = Expense(**expense_data, user_id=current_user.id, household_id=household_id)
    db.add(db_expense)
    await db.commit()
    await db.refresh(db_expense)
    return db_expense


@router.get("/", response_model=list[ExpenseResponse])
async def get_expenses(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    start_date: str | None = Query(None, description="시작일 YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS"),
    end_date: str | None = Query(None, description="종료일 YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS"),
    category_id: int | None = None,
    household_id: int | None = None,
    member_user_id: int | None = Query(None, description="가구 내 특정 멤버의 지출만 조회"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 목록 조회 (필터링, 페이지네이션)

    household_id가 있으면 해당 가구 전체 멤버의 지출을 조회합니다.
    없으면 현재 사용자의 지출만 조회합니다 (하위 호환).
    """
    if household_id is not None:
        # 가구 멤버 검증
        await get_household_member(household_id, current_user, db)
        # 가구 전체 멤버의 지출 조회
        query = select(Expense).where(Expense.household_id == household_id)
        # 특정 멤버 필터링
        if member_user_id is not None:
            query = query.where(Expense.user_id == member_user_id)
    else:
        # 하위 호환: 본인 지출만 조회
        query = select(Expense).where(Expense.user_id == current_user.id)

    # 필터 적용 (YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS 모두 허용)
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        query = query.where(Expense.date >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        # 날짜만 입력된 경우 (YYYY-MM-DD) 해당 날짜 23:59:59까지 포함
        if len(end_date) == 10:
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        query = query.where(Expense.date <= end_dt)
    if category_id is not None:
        query = query.where(Expense.category_id == category_id)

    query = query.order_by(Expense.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ── 날짜 유틸 ──


def _get_week_range(d: date) -> tuple[date, date]:
    """주어진 날짜가 속한 주의 월요일~일요일 반환"""
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _get_week_label(d: date) -> str:
    """주차 라벨 생성 (예: '2월 3주차')"""
    first_day = d.replace(day=1)
    week_num = (d.day + first_day.weekday() - 1) // 7 + 1
    return f"{d.month}월 {week_num}주차"


def _get_month_range(d: date) -> tuple[date, date]:
    """주어진 날짜가 속한 월의 첫날~마지막날 반환"""
    first = d.replace(day=1)
    _, last_day = monthrange(d.year, d.month)
    last = d.replace(day=last_day)
    return first, last


def _get_year_range(d: date) -> tuple[date, date]:
    """주어진 날짜가 속한 연도의 첫날~마지막날 반환"""
    return date(d.year, 1, 1), date(d.year, 12, 31)


def _build_scope_filter(household_id: int | None, current_user: User):
    """가구 또는 개인 스코프 필터 생성"""
    if household_id is not None:
        return Expense.household_id == household_id
    return Expense.user_id == current_user.id


# ── 통계 API ──


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    period: StatsPeriod = Query(..., description="통계 기간: weekly, monthly, yearly"),
    date: str | None = Query(None, description="기준 날짜 YYYY-MM-DD (기본: 오늘)", alias="date"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """기간별 통계 조회 (주간/월간/연간)"""
    from datetime import date as date_type

    from app.models.category import Category

    # 기준 날짜 파싱
    ref_date = date_type.fromisoformat(date) if date else date_type.today()

    # 기간 범위 결정
    if period == StatsPeriod.weekly:
        start_d, end_d = _get_week_range(ref_date)
        label = _get_week_label(ref_date)
    elif period == StatsPeriod.monthly:
        start_d, end_d = _get_month_range(ref_date)
        label = f"{ref_date.year}년 {ref_date.month}월"
    else:  # yearly
        start_d, end_d = _get_year_range(ref_date)
        label = f"{ref_date.year}년"

    start_dt = datetime(start_d.year, start_d.month, start_d.day)
    end_dt = datetime(end_d.year, end_d.month, end_d.day, 23, 59, 59)

    # 스코프 필터
    if household_id is not None:
        await get_household_member(household_id, current_user, db)
    scope_filter = _build_scope_filter(household_id, current_user)
    stats_filter = Expense.exclude_from_stats == False  # noqa: E712
    base_where = [scope_filter, stats_filter, Expense.date >= start_dt, Expense.date <= end_dt]

    # 총합 + 건수
    total_result = await db.execute(
        select(
            func.coalesce(func.sum(Expense.amount), 0),
            func.count(Expense.id),
        ).where(*base_where)
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
        .where(*base_where)
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
        # 월별 12포인트
        for m in range(1, 13):
            m_start = datetime(ref_date.year, m, 1)
            _, m_last = monthrange(ref_date.year, m)
            m_end = datetime(ref_date.year, m, m_last, 23, 59, 59)
            r = await db.execute(
                select(func.coalesce(func.sum(Expense.amount), 0)).where(scope_filter, stats_filter, Expense.date >= m_start, Expense.date <= m_end)
            )
            trend.append(TrendPoint(label=f"{m}월", amount=float(r.scalar())))
    else:
        # 일별
        day_col = func.date(Expense.date).label("day")
        daily_result = await db.execute(select(day_col, func.sum(Expense.amount).label("amount")).where(*base_where).group_by(day_col).order_by(day_col))
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
):
    """기간 비교 (전월 대비 + N개월 트렌드)"""
    from datetime import date as date_type

    from app.models.category import Category

    ref_date = date_type.fromisoformat(date) if date else date_type.today()

    # 스코프 필터
    if household_id is not None:
        await get_household_member(household_id, current_user, db)
    scope_filter = _build_scope_filter(household_id, current_user)

    excl_filter = Expense.exclude_from_stats == False  # noqa: E712

    async def _month_total(year: int, month: int) -> float:
        m_start = datetime(year, month, 1)
        _, m_last = monthrange(year, month)
        m_end = datetime(year, month, m_last, 23, 59, 59)
        r = await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(scope_filter, excl_filter, Expense.date >= m_start, Expense.date <= m_end)
        )
        return float(r.scalar())

    async def _month_by_category(year: int, month: int) -> dict[str, float]:
        m_start = datetime(year, month, 1)
        _, m_last = monthrange(year, month)
        m_end = datetime(year, month, m_last, 23, 59, 59)
        r = await db.execute(
            select(Category.name, func.sum(Expense.amount).label("amount"))
            .join(Category, Expense.category_id == Category.id, isouter=True)
            .where(scope_filter, excl_filter, Expense.date >= m_start, Expense.date <= m_end)
            .group_by(Category.name)
        )
        return {row.name or "미분류": float(row.amount) for row in r.all()}

    if period == "monthly":
        cur_y, cur_m = ref_date.year, ref_date.month
        prev_m = cur_m - 1 if cur_m > 1 else 12
        prev_y = cur_y if cur_m > 1 else cur_y - 1

        current_total = await _month_total(cur_y, cur_m)
        previous_total = await _month_total(prev_y, prev_m)

        current_label = f"{cur_y}년 {cur_m}월"
        previous_label = f"{prev_y}년 {prev_m}월"

        # N개월 트렌드 (현재 월 포함 과거 N개월)
        trend_data: list[PeriodTotal] = []
        y, m = cur_y, cur_m
        # months-1 만큼 뒤로
        for _ in range(months - 1):
            m -= 1
            if m < 1:
                m = 12
                y -= 1
        # 시작점부터 현재까지 순서대로
        for _ in range(months):
            t = await _month_total(y, m)
            trend_data.append(PeriodTotal(label=f"{y}년 {m}월", total=t))
            m += 1
            if m > 12:
                m = 1
                y += 1

        # 카테고리별 비교
        cur_cats = await _month_by_category(cur_y, cur_m)
        prev_cats = await _month_by_category(prev_y, prev_m)
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

        current_total = 0.0
        previous_total = 0.0
        for m in range(1, 13):
            current_total += await _month_total(cur_y, m)
            previous_total += await _month_total(prev_y, m)

        current_label = f"{cur_y}년"
        previous_label = f"{prev_y}년"

        trend_data = []
        for y_offset in range(months - 1, -1, -1):
            y = cur_y - y_offset
            y_total = 0.0
            for m in range(1, 13):
                y_total += await _month_total(y, m)
            trend_data.append(PeriodTotal(label=f"{y}년", total=y_total))

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


@router.get("/stats/monthly")
async def get_monthly_stats(
    month: str = Query(..., description="YYYY-MM 형식", pattern=r"^\d{4}-\d{2}$"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """월별 지출 통계 (총합, 카테고리별 합계)

    household_id가 있으면 가구 전체 멤버의 월별 통계를 집계합니다.
    """
    from app.models.category import Category

    year, mon = map(int, month.split("-"))
    start = datetime(year, mon, 1)
    end = datetime(year + 1, 1, 1) if mon == 12 else datetime(year, mon + 1, 1)

    # 필터 조건: 가구 또는 개인
    if household_id is not None:
        await get_household_member(household_id, current_user, db)
        scope_filter = Expense.household_id == household_id
    else:
        scope_filter = Expense.user_id == current_user.id

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

    # 일별 추이 (DATE() 함수 — SQLite/PostgreSQL 모두 지원)
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
        "total": float(total),
        "by_category": by_category,
        "daily_trend": daily_trend,
    }


@router.post("/ocr", response_model=ChatResponse)
async def parse_expense_image(
    file: UploadFile = File(...),
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """결제 스크린샷/영수증 이미지 OCR로 지출 파싱 (프리뷰 전용)

    이미지를 Claude Vision API로 분석하여 지출 정보를 추출합니다.
    저장하지 않고 파싱 결과만 반환합니다 (chat preview와 동일한 형식).
    """
    # 이미지 파일 타입 검증
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

    # 가구 멤버 검증 (household_id가 있는 경우)
    if household_id is not None:
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


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """특정 지출 조회

    지출의 household_id가 있으면 가구 멤버인지 확인합니다.
    없으면 본인 지출인지 확인합니다.
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    # 접근 권한 확인
    if expense.household_id is not None:
        # 가구 지출이면 멤버인지 확인
        await get_household_member(expense.household_id, current_user, db)
    elif expense.user_id != current_user.id:
        # 개인 지출이면 본인 것인지 확인
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_update: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 수정

    본인이 입력한 지출만 수정할 수 있습니다 (user_id == current_user.id).
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.user_id == current_user.id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    update_data = expense_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(expense, key, value)

    await db.commit()
    await db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 삭제

    본인이 입력한 지출만 삭제할 수 있습니다 (user_id == current_user.id).
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.user_id == current_user.id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    await db.delete(expense)
    await db.commit()

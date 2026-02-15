# 통계/리포트 강화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기존 인사이트 페이지를 확장하여 주간/월간/연간 통계 탭 + 전월 대비 비교 + 3개월 트렌드 비교 기능 제공

**Architecture:** Backend에 2개의 새 API 엔드포인트(stats, comparison)를 추가하고, Frontend의 InsightsPage를 탭 기반 UI로 리디자인한다. 기존 `/api/expenses/stats/monthly`와 AI 인사이트는 그대로 유지한다.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (async) / React 19 + TypeScript + Chart.js (Bar chart 추가) + Tailwind CSS v4

---

## Task 1: Backend — Pydantic 응답 스키마 추가

**Files:**
- Modify: `backend/app/schemas/expense.py`

**Step 1: 스키마 코드 추가**

`backend/app/schemas/expense.py` 파일 끝에 아래 스키마들을 추가한다:

```python
from enum import Enum


class StatsPeriod(str, Enum):
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


class CategoryStats(BaseModel):
    """카테고리별 통계"""
    category: str
    amount: float
    count: int
    percentage: float


class TrendPoint(BaseModel):
    """추이 데이터 포인트"""
    label: str
    amount: float


class StatsResponse(BaseModel):
    """기간별 통계 응답"""
    period: str
    label: str
    start_date: str
    end_date: str
    total: float
    count: int
    by_category: list[CategoryStats]
    trend: list[TrendPoint]


class PeriodTotal(BaseModel):
    """기간별 총액"""
    label: str
    total: float


class CategoryChange(BaseModel):
    """카테고리별 변화"""
    category: str
    current: float
    previous: float
    change_amount: float
    change_percentage: float | None


class ChangeInfo(BaseModel):
    """변화량 정보"""
    amount: float
    percentage: float | None


class ComparisonResponse(BaseModel):
    """기간 비교 응답"""
    current: PeriodTotal
    previous: PeriodTotal
    change: ChangeInfo
    trend: list[PeriodTotal]
    by_category_comparison: list[CategoryChange]
```

**Step 2: 린트 확인**

Run: `cd /Users/yyong/Developer/homenrich && uv run ruff check backend/app/schemas/expense.py --fix && uv run ruff format backend/app/schemas/expense.py`
Expected: No errors

**Step 3: 커밋**

```bash
git add backend/app/schemas/expense.py
git commit -m "feat: 통계/비교 API 응답 스키마 추가"
```

---

## Task 2: Backend — Stats API 엔드포인트

**Files:**
- Modify: `backend/app/api/expenses.py`
- Test: `backend/tests/integration/test_api_stats.py`

**Step 1: 테스트 파일 작성**

`backend/tests/integration/test_api_stats.py` 파일을 생성한다:

```python
"""
통계 API 통합 테스트

- GET /api/expenses/stats — 주간/월간/연간 통계
- GET /api/expenses/stats/comparison — 기간 비교
"""

from datetime import datetime

import pytest

from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User


# ── 헬퍼: 테스트 데이터 생성 ──


async def create_test_expenses(db_session, user: User):
    """3개월분 테스트 지출 데이터 생성 (2026-01, 02, 03)"""
    cat_food = Category(user_id=user.id, name="식비")
    cat_transport = Category(user_id=user.id, name="교통비")
    db_session.add_all([cat_food, cat_transport])
    await db_session.commit()
    await db_session.refresh(cat_food)
    await db_session.refresh(cat_transport)

    expenses = [
        # 2026-01
        Expense(user_id=user.id, amount=10000, description="1월 식비1", category_id=cat_food.id, date=datetime(2026, 1, 5)),
        Expense(user_id=user.id, amount=5000, description="1월 교통1", category_id=cat_transport.id, date=datetime(2026, 1, 10)),
        Expense(user_id=user.id, amount=15000, description="1월 식비2", category_id=cat_food.id, date=datetime(2026, 1, 20)),
        # 2026-02
        Expense(user_id=user.id, amount=8000, description="2월 식비1", category_id=cat_food.id, date=datetime(2026, 2, 3)),
        Expense(user_id=user.id, amount=12000, description="2월 식비2", category_id=cat_food.id, date=datetime(2026, 2, 15)),
        Expense(user_id=user.id, amount=3000, description="2월 교통1", category_id=cat_transport.id, date=datetime(2026, 2, 15)),
        Expense(user_id=user.id, amount=7000, description="2월 식비3", category_id=cat_food.id, date=datetime(2026, 2, 20)),
        # 2026-03
        Expense(user_id=user.id, amount=20000, description="3월 식비1", category_id=cat_food.id, date=datetime(2026, 3, 1)),
        Expense(user_id=user.id, amount=6000, description="3월 교통1", category_id=cat_transport.id, date=datetime(2026, 3, 10)),
    ]
    db_session.add_all(expenses)
    await db_session.commit()
    return cat_food, cat_transport


# ── Stats API 테스트 ──


class TestStatsAPI:
    """GET /api/expenses/stats 테스트"""

    @pytest.mark.asyncio
    async def test_monthly_stats(self, authenticated_client, test_user, db_session):
        """월간 통계 조회"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-02-15")
        assert response.status_code == 200

        data = response.json()
        assert data["period"] == "monthly"
        assert data["label"] == "2026년 2월"
        assert data["start_date"] == "2026-02-01"
        assert data["end_date"] == "2026-02-28"
        assert data["total"] == 30000.0  # 8000 + 12000 + 3000 + 7000
        assert data["count"] == 4

    @pytest.mark.asyncio
    async def test_monthly_stats_by_category(self, authenticated_client, test_user, db_session):
        """월간 카테고리별 통계"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-02-15")
        data = response.json()

        categories = {c["category"]: c for c in data["by_category"]}
        assert categories["식비"]["amount"] == 27000.0  # 8000 + 12000 + 7000
        assert categories["교통비"]["amount"] == 3000.0
        assert categories["식비"]["percentage"] == 90.0
        assert categories["교통비"]["percentage"] == 10.0

    @pytest.mark.asyncio
    async def test_monthly_stats_trend(self, authenticated_client, test_user, db_session):
        """월간 일별 트렌드"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2026-02-15")
        data = response.json()

        # trend는 일별 데이터 포인트
        trend_labels = [t["label"] for t in data["trend"]]
        assert "02/03" in trend_labels
        assert "02/15" in trend_labels
        assert "02/20" in trend_labels

    @pytest.mark.asyncio
    async def test_weekly_stats(self, authenticated_client, test_user, db_session):
        """주간 통계 조회"""
        await create_test_expenses(db_session, test_user)

        # 2026-02-15은 일요일 → 해당 주: 02/09(월) ~ 02/15(일)
        response = await authenticated_client.get("/api/expenses/stats?period=weekly&date=2026-02-15")
        assert response.status_code == 200

        data = response.json()
        assert data["period"] == "weekly"
        assert "주차" in data["label"]

    @pytest.mark.asyncio
    async def test_yearly_stats(self, authenticated_client, test_user, db_session):
        """연간 통계 조회"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats?period=yearly&date=2026-06-15")
        assert response.status_code == 200

        data = response.json()
        assert data["period"] == "yearly"
        assert data["label"] == "2026년"
        assert data["total"] == 86000.0  # 전체 합계
        # trend는 월별 12포인트
        assert len(data["trend"]) == 12

    @pytest.mark.asyncio
    async def test_stats_empty_period(self, authenticated_client, test_user, db_session):
        """데이터 없는 기간 조회"""
        response = await authenticated_client.get("/api/expenses/stats?period=monthly&date=2025-01-15")
        assert response.status_code == 200

        data = response.json()
        assert data["total"] == 0
        assert data["count"] == 0
        assert data["by_category"] == []

    @pytest.mark.asyncio
    async def test_stats_invalid_period(self, authenticated_client, test_user, db_session):
        """잘못된 period 값"""
        response = await authenticated_client.get("/api/expenses/stats?period=daily&date=2026-02-15")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_stats_default_date(self, authenticated_client, test_user, db_session):
        """date 미지정 시 오늘 기준"""
        response = await authenticated_client.get("/api/expenses/stats?period=monthly")
        assert response.status_code == 200

        data = response.json()
        assert data["period"] == "monthly"
        # label에 현재 연/월이 포함되어야 함
        now = datetime.now()
        assert str(now.year) in data["label"]


class TestComparisonAPI:
    """GET /api/expenses/stats/comparison 테스트"""

    @pytest.mark.asyncio
    async def test_monthly_comparison(self, authenticated_client, test_user, db_session):
        """월간 비교 (전월 대비)"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-02-15")
        assert response.status_code == 200

        data = response.json()
        assert data["current"]["total"] == 30000.0  # 2월
        assert data["previous"]["total"] == 30000.0  # 1월 (10000+5000+15000)
        assert data["change"]["amount"] == 0.0
        assert data["change"]["percentage"] == 0.0

    @pytest.mark.asyncio
    async def test_comparison_trend(self, authenticated_client, test_user, db_session):
        """3개월 트렌드"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-03-15&months=3")
        assert response.status_code == 200

        data = response.json()
        assert len(data["trend"]) == 3
        # 1월, 2월, 3월 순서
        assert data["trend"][0]["total"] == 30000.0  # 1월
        assert data["trend"][1]["total"] == 30000.0  # 2월
        assert data["trend"][2]["total"] == 26000.0  # 3월

    @pytest.mark.asyncio
    async def test_comparison_by_category(self, authenticated_client, test_user, db_session):
        """카테고리별 비교"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2026-02-15")
        data = response.json()

        categories = {c["category"]: c for c in data["by_category_comparison"]}
        assert "식비" in categories
        assert categories["식비"]["current"] == 27000.0  # 2월
        assert categories["식비"]["previous"] == 25000.0  # 1월

    @pytest.mark.asyncio
    async def test_comparison_no_previous_data(self, authenticated_client, test_user, db_session):
        """이전 기간 데이터 없을 때"""
        await create_test_expenses(db_session, test_user)

        response = await authenticated_client.get("/api/expenses/stats/comparison?period=monthly&date=2025-06-15")
        assert response.status_code == 200

        data = response.json()
        assert data["current"]["total"] == 0
        assert data["previous"]["total"] == 0
        assert data["change"]["percentage"] is None

    @pytest.mark.asyncio
    async def test_comparison_invalid_period(self, authenticated_client, test_user, db_session):
        """잘못된 period 값 (weekly는 비교 미지원)"""
        response = await authenticated_client.get("/api/expenses/stats/comparison?period=weekly&date=2026-02-15")
        assert response.status_code == 422
```

**Step 2: 테스트 실행 (실패 확인)**

Run: `cd /Users/yyong/Developer/homenrich/backend && uv run pytest tests/integration/test_api_stats.py -v`
Expected: FAIL (엔드포인트가 아직 없으므로 404)

**Step 3: API 엔드포인트 구현**

`backend/app/api/expenses.py`의 `get_monthly_stats` 함수 바로 위 (line 98)에 아래 코드를 추가한다:

```python
from calendar import monthrange
from datetime import date, timedelta

from app.schemas.expense import (
    CategoryChange,
    CategoryStats,
    ChangeInfo,
    ComparisonResponse,
    PeriodTotal,
    StatsPeriod,
    StatsResponse,
    TrendPoint,
)


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


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    period: StatsPeriod = Query(..., description="통계 기간: weekly, monthly, yearly"),
    date: str | None = Query(None, description="기준 날짜 YYYY-MM-DD (기본: 오늘)"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """기간별 통계 조회 (주간/월간/연간)"""
    from app.models.category import Category
    from datetime import date as date_type

    # 기준 날짜 파싱
    if date:
        ref_date = date_type.fromisoformat(date)
    else:
        ref_date = date_type.today()

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
        scope_filter = Expense.household_id == household_id
    else:
        scope_filter = Expense.user_id == current_user.id

    base_where = [scope_filter, Expense.date >= start_dt, Expense.date <= end_dt]

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
        by_category.append(CategoryStats(
            category=r.name or "미분류",
            amount=amt,
            count=int(r.cnt),
            percentage=round(amt / total * 100, 1) if total > 0 else 0,
        ))

    # 트렌드
    trend: list[TrendPoint] = []
    if period == StatsPeriod.yearly:
        # 월별 12포인트
        for m in range(1, 13):
            m_start = datetime(ref_date.year, m, 1)
            _, m_last = monthrange(ref_date.year, m)
            m_end = datetime(ref_date.year, m, m_last, 23, 59, 59)
            r = await db.execute(
                select(func.coalesce(func.sum(Expense.amount), 0))
                .where(scope_filter, Expense.date >= m_start, Expense.date <= m_end)
            )
            trend.append(TrendPoint(label=f"{m}월", amount=float(r.scalar())))
    else:
        # 일별
        day_col = func.date(Expense.date).label("day")
        daily_result = await db.execute(
            select(day_col, func.sum(Expense.amount).label("amount"))
            .where(*base_where)
            .group_by(day_col)
            .order_by(day_col)
        )
        for r in daily_result.all():
            if r.day is not None:
                day_str = str(r.day)[:10]  # YYYY-MM-DD
                trend.append(TrendPoint(
                    label=day_str[5:].replace("-", "/"),  # MM/DD
                    amount=float(r.amount),
                ))

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
    period: str = Query(..., description="비교 기간: monthly 또는 yearly", pattern=r"^(monthly|yearly)$"),
    date: str | None = Query(None, description="기준 날짜 YYYY-MM-DD (기본: 오늘)"),
    months: int = Query(3, ge=2, le=12, description="비교할 개월 수"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """기간 비교 (전월 대비 + N개월 트렌드)"""
    from datetime import date as date_type

    if date:
        ref_date = date_type.fromisoformat(date)
    else:
        ref_date = date_type.today()

    # 스코프 필터
    if household_id is not None:
        await get_household_member(household_id, current_user, db)
        scope_filter = Expense.household_id == household_id
    else:
        scope_filter = Expense.user_id == current_user.id

    async def _month_total(year: int, month: int) -> float:
        """특정 월의 총액 계산"""
        m_start = datetime(year, month, 1)
        _, m_last = monthrange(year, month)
        m_end = datetime(year, month, m_last, 23, 59, 59)
        r = await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0))
            .where(scope_filter, Expense.date >= m_start, Expense.date <= m_end)
        )
        return float(r.scalar())

    async def _month_by_category(year: int, month: int) -> dict[str, float]:
        """특정 월의 카테고리별 합계"""
        from app.models.category import Category

        m_start = datetime(year, month, 1)
        _, m_last = monthrange(year, month)
        m_end = datetime(year, month, m_last, 23, 59, 59)
        r = await db.execute(
            select(Category.name, func.sum(Expense.amount).label("amount"))
            .join(Category, Expense.category_id == Category.id, isouter=True)
            .where(scope_filter, Expense.date >= m_start, Expense.date <= m_end)
            .group_by(Category.name)
        )
        return {row.name or "미분류": float(row.amount) for row in r.all()}

    if period == "monthly":
        # 현재 월 / 이전 월
        cur_y, cur_m = ref_date.year, ref_date.month
        prev_m = cur_m - 1 if cur_m > 1 else 12
        prev_y = cur_y if cur_m > 1 else cur_y - 1

        current_total = await _month_total(cur_y, cur_m)
        previous_total = await _month_total(prev_y, prev_m)

        current_label = f"{cur_y}년 {cur_m}월"
        previous_label = f"{prev_y}년 {prev_m}월"

        # N개월 트렌드
        trend_data: list[PeriodTotal] = []
        y, m = cur_y, cur_m
        for _ in range(months):
            m -= 1
            if m < 1:
                m = 12
                y -= 1
        # 시작점부터 현재까지
        for _ in range(months):
            m += 1
            if m > 12:
                m = 1
                y += 1
            t = await _month_total(y, m)
            trend_data.append(PeriodTotal(label=f"{y}년 {m}월", total=t))

        # 카테고리별 비교
        cur_cats = await _month_by_category(cur_y, cur_m)
        prev_cats = await _month_by_category(prev_y, prev_m)
        all_cats = set(cur_cats.keys()) | set(prev_cats.keys())
        by_cat_comparison = []
        for cat in sorted(all_cats):
            c = cur_cats.get(cat, 0)
            p = prev_cats.get(cat, 0)
            change_pct = round((c - p) / p * 100, 1) if p > 0 else None
            by_cat_comparison.append(CategoryChange(
                category=cat,
                current=c,
                previous=p,
                change_amount=round(c - p, 2),
                change_percentage=change_pct,
            ))

    else:  # yearly
        cur_y = ref_date.year
        prev_y = cur_y - 1

        current_total = 0
        previous_total = 0
        for m in range(1, 13):
            current_total += await _month_total(cur_y, m)
            previous_total += await _month_total(prev_y, m)

        current_label = f"{cur_y}년"
        previous_label = f"{prev_y}년"

        # yearly인 경우 months 파라미터는 연 수로 해석
        trend_data = []
        for y_offset in range(months - 1, -1, -1):
            y = cur_y - y_offset
            y_total = sum([await _month_total(y, m) for m in range(1, 13)])
            trend_data.append(PeriodTotal(label=f"{y}년", total=y_total))

        by_cat_comparison = []  # yearly는 카테고리별 비교 미제공

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
```

> **중요**: 새 엔드포인트 `/stats`와 `/stats/comparison`은 기존 `/stats/monthly` **위에** 등록해야 한다. FastAPI 라우터는 선언 순서대로 매칭하는데, `/{expense_id}` 패턴이 `/stats`를 잡아먹지 않도록 `/stats` 경로들을 `/{expense_id}` 앞에 배치해야 한다.

**Step 4: import 추가 확인**

`expenses.py` 상단의 import에 추가가 필요한 것들:
- `from calendar import monthrange`
- `from datetime import date, timedelta` (기존 `datetime` import 옆에)
- 스키마 import 추가

**Step 5: 린트 + 테스트 실행**

Run: `cd /Users/yyong/Developer/homenrich && uv run ruff check backend/ --fix && uv run ruff format backend/`
Run: `cd /Users/yyong/Developer/homenrich/backend && uv run pytest tests/integration/test_api_stats.py -v`
Expected: 대부분 PASS (경계 케이스에 따라 일부 조정 필요할 수 있음)

**Step 6: 커밋**

```bash
git add backend/app/api/expenses.py backend/tests/integration/test_api_stats.py
git commit -m "feat: 주간/월간/연간 통계 + 비교 API 추가"
```

---

## Task 3: Backend — 기존 테스트 회귀 확인

**Step 1: 전체 백엔드 테스트 실행**

Run: `cd /Users/yyong/Developer/homenrich/backend && uv run pytest tests/ -v`
Expected: 기존 299개 + 새 테스트 = 모두 PASS (5 skip 유지)

기존 테스트가 깨지면 라우트 순서 문제일 수 있다. `/stats`와 `/stats/comparison`이 `/{expense_id}` 앞에 위치하는지 확인한다.

**Step 2: 수정 필요 시 고치고 커밋**

```bash
git add -A
git commit -m "fix: 통계 API 라우트 순서 및 테스트 수정"
```

---

## Task 4: Frontend — 타입 정의 + API 클라이언트

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/insights.ts`

**Step 1: 타입 추가**

`frontend/src/types/index.ts`에 아래 타입들을 추가한다:

```typescript
/* 통계 관련 타입 */

export interface CategoryStats {
  category: string
  amount: number
  count: number
  percentage: number
}

export interface TrendPoint {
  label: string
  amount: number
}

export interface StatsResponse {
  period: string
  label: string
  start_date: string
  end_date: string
  total: number
  count: number
  by_category: CategoryStats[]
  trend: TrendPoint[]
}

export interface PeriodTotal {
  label: string
  total: number
}

export interface CategoryChange {
  category: string
  current: number
  previous: number
  change_amount: number
  change_percentage: number | null
}

export interface ComparisonResponse {
  current: PeriodTotal
  previous: PeriodTotal
  change: {
    amount: number
    percentage: number | null
  }
  trend: PeriodTotal[]
  by_category_comparison: CategoryChange[]
}
```

**Step 2: API 클라이언트 추가**

`frontend/src/api/insights.ts`를 수정하여 통계/비교 API 호출을 추가한다:

```typescript
/* 인사이트 + 통계 API */

import apiClient from './client'
import type { InsightsResponse, StatsResponse, ComparisonResponse } from '../types'

export const insightsApi = {
  /** LLM 호출이 포함되므로 60초 타임아웃 적용 */
  generate: (month: string) =>
    apiClient.post<InsightsResponse>('/insights/generate', null, {
      params: { month },
      timeout: 60000,
    }),
}

export const statsApi = {
  /** 기간별 통계 조회 */
  getStats: (period: string, date?: string, householdId?: number) =>
    apiClient.get<StatsResponse>('/expenses/stats', {
      params: {
        period,
        ...(date && { date }),
        ...(householdId != null && { household_id: householdId }),
      },
    }),

  /** 기간 비교 */
  getComparison: (period: string, date?: string, months?: number, householdId?: number) =>
    apiClient.get<ComparisonResponse>('/expenses/stats/comparison', {
      params: {
        period,
        ...(date && { date }),
        ...(months && { months }),
        ...(householdId != null && { household_id: householdId }),
      },
    }),
}
```

**Step 3: MSW 핸들러 추가**

`frontend/src/mocks/handlers.ts`에 새 API 핸들러를 추가한다:

```typescript
/**
 * GET /api/expenses/stats - 기간별 통계
 */
http.get(`${BASE_URL}/expenses/stats`, () => {
  return HttpResponse.json({
    period: 'monthly',
    label: '2024년 1월',
    start_date: '2024-01-01',
    end_date: '2024-01-31',
    total: 61500,
    count: 3,
    by_category: [
      { category: '쇼핑', amount: 50000, count: 1, percentage: 81.3 },
      { category: '식비', amount: 8000, count: 1, percentage: 13.0 },
      { category: '교통', amount: 3500, count: 1, percentage: 5.7 },
    ],
    trend: [
      { label: '01/14', amount: 50000 },
      { label: '01/15', amount: 11500 },
    ],
  })
}),

/**
 * GET /api/expenses/stats/comparison - 기간 비교
 */
http.get(`${BASE_URL}/expenses/stats/comparison`, () => {
  return HttpResponse.json({
    current: { label: '2024년 1월', total: 61500 },
    previous: { label: '2023년 12월', total: 55000 },
    change: { amount: 6500, percentage: 11.8 },
    trend: [
      { label: '2023년 11월', total: 48000 },
      { label: '2023년 12월', total: 55000 },
      { label: '2024년 1월', total: 61500 },
    ],
    by_category_comparison: [
      { category: '식비', current: 8000, previous: 12000, change_amount: -4000, change_percentage: -33.3 },
      { category: '교통', current: 3500, previous: 3000, change_amount: 500, change_percentage: 16.7 },
      { category: '쇼핑', current: 50000, previous: 40000, change_amount: 10000, change_percentage: 25.0 },
    ],
  })
}),
```

> **주의**: 이 핸들러는 기존 `expenses/stats/monthly` 핸들러보다 **앞에** 배치해야 한다 (MSW는 순서대로 매칭).

**Step 4: 픽스쳐 데이터 추가**

`frontend/src/mocks/fixtures.ts`에 추가:

```typescript
import type { StatsResponse, ComparisonResponse } from '../types'

export const mockStats: StatsResponse = {
  period: 'monthly',
  label: '2024년 1월',
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  total: 61500,
  count: 3,
  by_category: [
    { category: '쇼핑', amount: 50000, count: 1, percentage: 81.3 },
    { category: '식비', amount: 8000, count: 1, percentage: 13.0 },
    { category: '교통', amount: 3500, count: 1, percentage: 5.7 },
  ],
  trend: [
    { label: '01/14', amount: 50000 },
    { label: '01/15', amount: 11500 },
  ],
}

export const mockComparison: ComparisonResponse = {
  current: { label: '2024년 1월', total: 61500 },
  previous: { label: '2023년 12월', total: 55000 },
  change: { amount: 6500, percentage: 11.8 },
  trend: [
    { label: '2023년 11월', total: 48000 },
    { label: '2023년 12월', total: 55000 },
    { label: '2024년 1월', total: 61500 },
  ],
  by_category_comparison: [
    { category: '식비', current: 8000, previous: 12000, change_amount: -4000, change_percentage: -33.3 },
    { category: '교통', current: 3500, previous: 3000, change_amount: 500, change_percentage: 16.7 },
    { category: '쇼핑', current: 50000, previous: 40000, change_amount: 10000, change_percentage: 25.0 },
  ],
}
```

**Step 5: 린트 확인**

Run: `cd /Users/yyong/Developer/homenrich/frontend && npm run lint`
Expected: No errors

**Step 6: 커밋**

```bash
git add frontend/src/types/index.ts frontend/src/api/insights.ts frontend/src/mocks/fixtures.ts frontend/src/mocks/handlers.ts
git commit -m "feat: 통계 API 타입/클라이언트/모킹 추가"
```

---

## Task 5: Frontend — ChangeIndicator 컴포넌트

**Files:**
- Create: `frontend/src/components/stats/ChangeIndicator.tsx`
- Test: `frontend/src/components/stats/__tests__/ChangeIndicator.test.tsx`

**Step 1: 테스트 작성**

`frontend/src/components/stats/__tests__/ChangeIndicator.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChangeIndicator from '../ChangeIndicator'

describe('ChangeIndicator', () => {
  it('많이 늘음 (+20% 이상) 표시', () => {
    render(<ChangeIndicator percentage={35.2} />)
    expect(screen.getByText('많이 늘음')).toBeInTheDocument()
    expect(screen.getByText('+35.2%')).toBeInTheDocument()
  })

  it('조금 늘음 (+5% ~ +20%) 표시', () => {
    render(<ChangeIndicator percentage={8.3} />)
    expect(screen.getByText('조금 늘음')).toBeInTheDocument()
  })

  it('보통 (-5% ~ +5%) 표시', () => {
    render(<ChangeIndicator percentage={2.1} />)
    expect(screen.getByText('보통')).toBeInTheDocument()
  })

  it('줄음 (-20% ~ -5%) 표시', () => {
    render(<ChangeIndicator percentage={-12.5} />)
    expect(screen.getByText('줄음')).toBeInTheDocument()
  })

  it('많이 줄음 (-20% 미만) 표시', () => {
    render(<ChangeIndicator percentage={-28.0} />)
    expect(screen.getByText('많이 줄음')).toBeInTheDocument()
  })

  it('null percentage일 때 비교 불가 표시', () => {
    render(<ChangeIndicator percentage={null} />)
    expect(screen.getByText('비교 불가')).toBeInTheDocument()
  })

  it('0% 일 때 보통 표시', () => {
    render(<ChangeIndicator percentage={0} />)
    expect(screen.getByText('보통')).toBeInTheDocument()
  })

  it('경계값 +5% 정확히 일 때 보통 표시', () => {
    render(<ChangeIndicator percentage={5.0} />)
    expect(screen.getByText('보통')).toBeInTheDocument()
  })

  it('compact 모드일 때 라벨 없이 아이콘+퍼센트만 표시', () => {
    const { container } = render(<ChangeIndicator percentage={15} compact />)
    expect(screen.queryByText('조금 늘음')).not.toBeInTheDocument()
    expect(screen.getByText('+15.0%')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="change-icon"]')).toBeInTheDocument()
  })
})
```

**Step 2: 컴포넌트 구현**

`frontend/src/components/stats/ChangeIndicator.tsx`:

```typescript
/**
 * @file ChangeIndicator.tsx
 * @description 변화량을 5단계로 시각화하는 컴포넌트
 */

interface ChangeIndicatorProps {
  percentage: number | null
  compact?: boolean
}

type ChangeLevel = {
  label: string
  icon: string
  colorClass: string
}

function getChangeLevel(pct: number): ChangeLevel {
  if (pct > 20) return { label: '많이 늘음', icon: '▲▲', colorClass: 'text-rose-600' }
  if (pct > 5) return { label: '조금 늘음', icon: '▲', colorClass: 'text-rose-400' }
  if (pct >= -5) return { label: '보통', icon: '─', colorClass: 'text-stone-400' }
  if (pct >= -20) return { label: '줄음', icon: '▼', colorClass: 'text-emerald-400' }
  return { label: '많이 줄음', icon: '▼▼', colorClass: 'text-emerald-600' }
}

export default function ChangeIndicator({ percentage, compact = false }: ChangeIndicatorProps) {
  if (percentage === null) {
    return <span className="text-sm text-stone-300">비교 불가</span>
  }

  const level = getChangeLevel(percentage)
  const sign = percentage > 0 ? '+' : ''

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-sm font-medium ${level.colorClass}`}>
        <span data-testid="change-icon">{level.icon}</span>
        <span>{sign}{percentage.toFixed(1)}%</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${level.colorClass}`}>
      <span data-testid="change-icon">{level.icon}</span>
      <span>{level.label}</span>
      <span className="text-xs opacity-75">({sign}{percentage.toFixed(1)}%)</span>
    </span>
  )
}
```

**Step 3: 테스트 실행**

Run: `cd /Users/yyong/Developer/homenrich/frontend && npx vitest run src/components/stats/__tests__/ChangeIndicator.test.tsx`
Expected: ALL PASS

**Step 4: 커밋**

```bash
git add frontend/src/components/stats/ChangeIndicator.tsx frontend/src/components/stats/__tests__/ChangeIndicator.test.tsx
git commit -m "feat: ChangeIndicator 5단계 변화량 표시 컴포넌트"
```

---

## Task 6: Frontend — PeriodNavigator 컴포넌트

**Files:**
- Create: `frontend/src/components/stats/PeriodNavigator.tsx`
- Test: `frontend/src/components/stats/__tests__/PeriodNavigator.test.tsx`

**Step 1: 테스트 작성**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PeriodNavigator from '../PeriodNavigator'

describe('PeriodNavigator', () => {
  it('라벨을 표시한다', () => {
    render(<PeriodNavigator label="2026년 2월" onPrev={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('2026년 2월')).toBeInTheDocument()
  })

  it('이전 버튼 클릭 시 onPrev 호출', async () => {
    const onPrev = vi.fn()
    const user = userEvent.setup()
    render(<PeriodNavigator label="2026년 2월" onPrev={onPrev} onNext={vi.fn()} />)
    await user.click(screen.getByLabelText('이전 기간'))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('다음 버튼 클릭 시 onNext 호출', async () => {
    const onNext = vi.fn()
    const user = userEvent.setup()
    render(<PeriodNavigator label="2026년 2월" onPrev={vi.fn()} onNext={onNext} />)
    await user.click(screen.getByLabelText('다음 기간'))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
```

**Step 2: 컴포넌트 구현**

```typescript
/**
 * @file PeriodNavigator.tsx
 * @description ◀ 기간 ▶ 네비게이션 컴포넌트
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PeriodNavigatorProps {
  label: string
  onPrev: () => void
  onNext: () => void
}

export default function PeriodNavigator({ label, onPrev, onNext }: PeriodNavigatorProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={onPrev}
        aria-label="이전 기간"
        className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-stone-600" />
      </button>
      <span className="text-lg font-semibold text-stone-800 min-w-[160px] text-center">
        {label}
      </span>
      <button
        onClick={onNext}
        aria-label="다음 기간"
        className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-stone-600" />
      </button>
    </div>
  )
}
```

**Step 3: 테스트 + 커밋**

Run: `cd /Users/yyong/Developer/homenrich/frontend && npx vitest run src/components/stats/__tests__/PeriodNavigator.test.tsx`

```bash
git add frontend/src/components/stats/PeriodNavigator.tsx frontend/src/components/stats/__tests__/PeriodNavigator.test.tsx
git commit -m "feat: PeriodNavigator 기간 네비게이션 컴포넌트"
```

---

## Task 7: Frontend — StatsSummaryCards 컴포넌트

**Files:**
- Create: `frontend/src/components/stats/StatsSummaryCards.tsx`
- Test: `frontend/src/components/stats/__tests__/StatsSummaryCards.test.tsx`

**Step 1: 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatsSummaryCards from '../StatsSummaryCards'

const mockData = {
  total: 580000,
  count: 42,
  trend: [
    { label: '02/01', amount: 25000 },
    { label: '02/02', amount: 18000 },
  ],
  changePercentage: -6.5 as number | null,
}

describe('StatsSummaryCards', () => {
  it('총 지출을 표시한다', () => {
    render(<StatsSummaryCards {...mockData} />)
    expect(screen.getByText('총 지출')).toBeInTheDocument()
    expect(screen.getByText('₩580,000')).toBeInTheDocument()
  })

  it('건수를 표시한다', () => {
    render(<StatsSummaryCards {...mockData} />)
    expect(screen.getByText('건 수')).toBeInTheDocument()
    expect(screen.getByText('42건')).toBeInTheDocument()
  })

  it('일 평균을 표시한다', () => {
    render(<StatsSummaryCards {...mockData} />)
    expect(screen.getByText('일 평균')).toBeInTheDocument()
  })

  it('전기 대비 변화량을 표시한다', () => {
    render(<StatsSummaryCards {...mockData} />)
    expect(screen.getByText('전기 대비')).toBeInTheDocument()
    expect(screen.getByText('줄음')).toBeInTheDocument()
  })

  it('변화량이 null이면 비교 불가 표시', () => {
    render(<StatsSummaryCards {...mockData} changePercentage={null} />)
    expect(screen.getByText('비교 불가')).toBeInTheDocument()
  })
})
```

**Step 2: 컴포넌트 구현**

```typescript
/**
 * @file StatsSummaryCards.tsx
 * @description 통계 요약 카드 4개 (총 지출, 전기 대비, 건수, 일 평균)
 */

import ChangeIndicator from './ChangeIndicator'
import type { TrendPoint } from '../../types'

interface StatsSummaryCardsProps {
  total: number
  count: number
  trend: TrendPoint[]
  changePercentage: number | null
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function StatsSummaryCards({ total, count, trend, changePercentage }: StatsSummaryCardsProps) {
  const avgDaily = trend.length > 0 ? Math.round(total / trend.length) : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 shadow-sm p-4 sm:p-5">
        <p className="text-sm text-amber-700/70">총 지출</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 mt-1">{formatAmount(total)}</p>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <p className="text-sm text-stone-500">전기 대비</p>
        <div className="mt-2">
          <ChangeIndicator percentage={changePercentage} />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <p className="text-sm text-stone-500">건 수</p>
        <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">{count}건</p>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <p className="text-sm text-stone-500">일 평균</p>
        <p className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">{formatAmount(avgDaily)}</p>
      </div>
    </div>
  )
}
```

**Step 3: 테스트 + 커밋**

Run: `cd /Users/yyong/Developer/homenrich/frontend && npx vitest run src/components/stats/__tests__/StatsSummaryCards.test.tsx`

```bash
git add frontend/src/components/stats/StatsSummaryCards.tsx frontend/src/components/stats/__tests__/StatsSummaryCards.test.tsx
git commit -m "feat: StatsSummaryCards 요약 카드 컴포넌트"
```

---

## Task 8: Frontend — TrendChart + ComparisonChart + CategoryBreakdown

**Files:**
- Create: `frontend/src/components/stats/TrendChart.tsx`
- Create: `frontend/src/components/stats/ComparisonChart.tsx`
- Create: `frontend/src/components/stats/CategoryBreakdown.tsx`
- Test: `frontend/src/components/stats/__tests__/Charts.test.tsx`

**Step 1: TrendChart 구현**

```typescript
/**
 * @file TrendChart.tsx
 * @description 추이 라인차트 (일별/월별)
 */

import { useRef } from 'react'
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { TrendPoint } from '../../types'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend)

interface TrendChartProps {
  data: TrendPoint[]
  title?: string
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function TrendChart({ data, title = '지출 추이' }: TrendChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null)

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <h3 className="text-base font-semibold text-stone-700 mb-4">{title}</h3>
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-sm text-stone-400">데이터가 없습니다</p>
        </div>
      </div>
    )
  }

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [{
      data: data.map((d) => d.amount),
      borderColor: '#D97706',
      backgroundColor: 'rgba(217, 119, 6, 0.1)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#D97706',
      tension: 0.3,
      fill: true,
    }],
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-stone-700 mb-4">{title}</h3>
      <div className="h-[250px]">
        <Line
          ref={chartRef}
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatAmount(ctx.parsed.y ?? 0) } } },
            scales: {
              x: { ticks: { font: { size: 11 } }, grid: { display: false } },
              y: { ticks: { font: { size: 11 }, callback: (v) => `${(Number(v) / 1000).toFixed(0)}k` } },
            },
          }}
        />
      </div>
    </div>
  )
}
```

**Step 2: ComparisonChart 구현**

```typescript
/**
 * @file ComparisonChart.tsx
 * @description 기간 비교 막대 차트
 */

import { useRef } from 'react'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { PeriodTotal } from '../../types'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

interface ComparisonChartProps {
  data: PeriodTotal[]
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function ComparisonChart({ data }: ComparisonChartProps) {
  const chartRef = useRef<ChartJS<'bar'>>(null)

  if (data.length === 0) return null

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [{
      data: data.map((d) => d.total),
      backgroundColor: data.map((_, i) =>
        i === data.length - 1 ? '#D97706' : '#E7E5E4'
      ),
      borderRadius: 8,
      barThickness: 40,
    }],
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-stone-700 mb-4">기간 비교</h3>
      <div className="h-[200px]">
        <Bar
          ref={chartRef}
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatAmount(ctx.parsed.x ?? 0) } } },
            scales: {
              x: { ticks: { callback: (v) => `${(Number(v) / 10000).toFixed(0)}만` } },
              y: { ticks: { font: { size: 12 } } },
            },
          }}
        />
      </div>
    </div>
  )
}
```

**Step 3: CategoryBreakdown 구현**

```typescript
/**
 * @file CategoryBreakdown.tsx
 * @description 카테고리별 지출 프로그레스바 + 전기 대비 변화량
 */

import ChangeIndicator from './ChangeIndicator'
import type { CategoryStats, CategoryChange } from '../../types'

interface CategoryBreakdownProps {
  categories: CategoryStats[]
  comparisons?: CategoryChange[]
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function CategoryBreakdown({ categories, comparisons = [] }: CategoryBreakdownProps) {
  const compMap = new Map(comparisons.map((c) => [c.category, c]))

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <h3 className="text-base font-semibold text-stone-700 mb-4">카테고리별 지출</h3>
        <p className="text-sm text-stone-400 text-center py-4">데이터가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-stone-700 mb-4">카테고리별 지출</h3>
      <div className="space-y-3">
        {categories.map((cat) => {
          const comp = compMap.get(cat.category)
          return (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">{cat.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-900">{formatAmount(cat.amount)}</span>
                  {comp && <ChangeIndicator percentage={comp.change_percentage} compact />}
                </div>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-600 h-2 rounded-full transition-all"
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
              <div className="text-xs text-stone-400 text-right">{cat.percentage}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 4: 차트 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TrendChart from '../TrendChart'
import ComparisonChart from '../ComparisonChart'
import CategoryBreakdown from '../CategoryBreakdown'

// Chart.js는 canvas를 모킹해야 하므로 렌더링 자체만 확인
describe('TrendChart', () => {
  it('데이터가 없으면 빈 상태를 표시한다', () => {
    render(<TrendChart data={[]} />)
    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument()
  })

  it('제목을 표시한다', () => {
    render(<TrendChart data={[{ label: '02/01', amount: 10000 }]} title="일별 추이" />)
    expect(screen.getByText('일별 추이')).toBeInTheDocument()
  })
})

describe('ComparisonChart', () => {
  it('데이터가 없으면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<ComparisonChart data={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('제목을 표시한다', () => {
    render(<ComparisonChart data={[{ label: '1월', total: 50000 }]} />)
    expect(screen.getByText('기간 비교')).toBeInTheDocument()
  })
})

describe('CategoryBreakdown', () => {
  it('카테고리별 이름과 금액을 표시한다', () => {
    render(
      <CategoryBreakdown
        categories={[
          { category: '식비', amount: 50000, count: 10, percentage: 80 },
          { category: '교통', amount: 12500, count: 5, percentage: 20 },
        ]}
      />
    )
    expect(screen.getByText('식비')).toBeInTheDocument()
    expect(screen.getByText('₩50,000')).toBeInTheDocument()
    expect(screen.getByText('교통')).toBeInTheDocument()
  })

  it('비교 데이터가 있으면 변화량을 표시한다', () => {
    render(
      <CategoryBreakdown
        categories={[{ category: '식비', amount: 50000, count: 10, percentage: 100 }]}
        comparisons={[{ category: '식비', current: 50000, previous: 40000, change_amount: 10000, change_percentage: 25.0 }]}
      />
    )
    expect(screen.getByText('+25.0%')).toBeInTheDocument()
  })

  it('카테고리가 없으면 빈 상태를 표시한다', () => {
    render(<CategoryBreakdown categories={[]} />)
    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument()
  })
})
```

**Step 5: 테스트 실행 + 커밋**

Run: `cd /Users/yyong/Developer/homenrich/frontend && npx vitest run src/components/stats/__tests__/Charts.test.tsx`

```bash
git add frontend/src/components/stats/TrendChart.tsx frontend/src/components/stats/ComparisonChart.tsx frontend/src/components/stats/CategoryBreakdown.tsx frontend/src/components/stats/__tests__/Charts.test.tsx
git commit -m "feat: TrendChart, ComparisonChart, CategoryBreakdown 차트 컴포넌트"
```

---

## Task 9: Frontend — InsightsPage 탭 리디자인

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`
- Test: `frontend/src/pages/__tests__/InsightsPage.test.tsx` (기존 테스트 수정)

**Step 1: InsightsPage 리디자인**

기존 InsightsPage.tsx를 탭 구조로 리팩토링한다. 핵심 구조:

```typescript
/**
 * @file InsightsPage.tsx
 * @description 인사이트/통계 페이지
 * 주간/월간/연간 통계 탭 + AI 인사이트 탭
 */

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, BarChart3, Calendar, CalendarDays, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { insightsApi, statsApi } from '../api/insights'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import PeriodNavigator from '../components/stats/PeriodNavigator'
import StatsSummaryCards from '../components/stats/StatsSummaryCards'
import TrendChart from '../components/stats/TrendChart'
import ComparisonChart from '../components/stats/ComparisonChart'
import CategoryBreakdown from '../components/stats/CategoryBreakdown'
import type { InsightsResponse, StatsResponse, ComparisonResponse } from '../types'

type TabType = 'weekly' | 'monthly' | 'yearly' | 'ai'

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'weekly', label: '주간', icon: <Calendar className="w-4 h-4" /> },
  { id: 'monthly', label: '월간', icon: <CalendarDays className="w-4 h-4" /> },
  { id: 'yearly', label: '연간', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'ai', label: 'AI 인사이트', icon: <Sparkles className="w-4 h-4" /> },
]

// ── 날짜 유틸 ──

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDate(dateStr: string, tab: TabType, direction: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (tab === 'weekly') d.setDate(d.getDate() + direction * 7)
  else if (tab === 'monthly') d.setMonth(d.getMonth() + direction)
  else d.setFullYear(d.getFullYear() + direction)
  return toDateStr(d)
}

// ── AI 인사이트 섹션 (기존 코드 유지) ──

// ... (기존 renderMarkdown, renderBoldText 함수 유지)
// ... (기존 AI 인사이트 UI 유지)

// ── 통계 탭 컴포넌트 ──

function StatsTab({ period, dateStr, householdId }: { period: string; dateStr: string; householdId: number | undefined }) {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const requests = [
          statsApi.getStats(period, dateStr, householdId),
        ]
        // 주간은 비교 데이터 없음
        if (period !== 'weekly') {
          requests.push(statsApi.getComparison(period, dateStr, 3, householdId) as any)
        }
        const results = await Promise.all(requests)
        setStats(results[0].data)
        if (results[1]) setComparison(results[1].data)
        else setComparison(null)
      } catch {
        toast.error('통계를 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [period, dateStr, householdId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    )
  }

  if (!stats || stats.total === 0) {
    return <EmptyState title="이 기간에 기록된 지출이 없습니다" description="다른 기간을 선택해보세요." />
  }

  return (
    <div className="space-y-6">
      <StatsSummaryCards
        total={stats.total}
        count={stats.count}
        trend={stats.trend}
        changePercentage={comparison?.change.percentage ?? null}
      />
      <TrendChart data={stats.trend} />
      {comparison && comparison.trend.length > 0 && (
        <ComparisonChart data={comparison.trend} />
      )}
      <CategoryBreakdown
        categories={stats.by_category}
        comparisons={comparison?.by_category_comparison}
      />
    </div>
  )
}

// ── 메인 페이지 ──

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('monthly')
  const [dateStr, setDateStr] = useState(toDateStr(new Date()))
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // AI 인사이트 상태 (기존)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const handlePrev = useCallback(() => {
    setDateStr((d) => shiftDate(d, activeTab, -1))
  }, [activeTab])

  const handleNext = useCallback(() => {
    setDateStr((d) => shiftDate(d, activeTab, 1))
  }, [activeTab])

  // 탭 변경 시 날짜 리셋
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    if (tab !== 'ai') setDateStr(toDateStr(new Date()))
  }

  // ... (기존 AI 인사이트 handleGenerate 유지)

  // 현재 탭의 라벨 생성
  const getNavLabel = () => {
    const d = new Date(dateStr + 'T00:00:00')
    if (activeTab === 'weekly') {
      const weekNum = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)
      return `${d.getMonth() + 1}월 ${weekNum}주차`
    }
    if (activeTab === 'monthly') return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    return `${d.getFullYear()}년`
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-amber-600" />
        <h1 className="text-2xl font-bold text-stone-900">리포트</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 기간 네비게이션 (AI 탭 제외) */}
      {activeTab !== 'ai' && (
        <PeriodNavigator label={getNavLabel()} onPrev={handlePrev} onNext={handleNext} />
      )}

      {/* 통계 탭 콘텐츠 */}
      {activeTab !== 'ai' && (
        <StatsTab
          period={activeTab}
          dateStr={dateStr}
          householdId={activeHouseholdId ?? undefined}
        />
      )}

      {/* AI 인사이트 탭 콘텐츠 — 기존 UI 그대로 유지 */}
      {activeTab === 'ai' && (
        // ... 기존 AI 인사이트 섹션 JSX (월 선택 + 버튼 + 결과 + 로딩)
      )}
    </div>
  )
}
```

> **중요**: 기존 AI 인사이트 관련 코드(renderMarkdown, renderBoldText, handleGenerate, 관련 JSX)는 그대로 유지하고, `activeTab === 'ai'` 조건 안으로 이동시킨다.

**Step 2: 기존 InsightsPage 테스트 수정**

기존 테스트의 `renderInsightsPage`에 MSW 핸들러가 새 API를 모킹하도록 해야 하고, 기존 AI 관련 테스트는 AI 탭을 클릭한 뒤 실행하도록 수정한다:

```typescript
// 기존 테스트의 AI 관련 블록에 탭 전환 추가:
it('AI 탭의 인사이트 생성 버튼을 표시한다', async () => {
  const user = userEvent.setup()
  renderInsightsPage()
  await user.click(screen.getByText('AI 인사이트'))
  expect(screen.getByRole('button', { name: '인사이트 생성' })).toBeInTheDocument()
})
```

새로 추가할 테스트:
```typescript
describe('탭 전환', () => {
  it('기본 탭은 월간이다', () => {
    renderInsightsPage()
    // 기간 네비게이터가 표시됨
    expect(screen.getByLabelText('이전 기간')).toBeInTheDocument()
  })

  it('주간 탭 클릭 시 주간 통계를 표시한다', async () => {
    const user = userEvent.setup()
    renderInsightsPage()
    await user.click(screen.getByText('주간'))
    // 주간 레이블에 "주차"가 포함됨
    await waitFor(() => {
      expect(screen.getByText(/주차/)).toBeInTheDocument()
    })
  })

  it('연간 탭 클릭 시 연간 통계를 표시한다', async () => {
    const user = userEvent.setup()
    renderInsightsPage()
    await user.click(screen.getByText('연간'))
    await waitFor(() => {
      expect(screen.getByText(/\d{4}년$/)).toBeInTheDocument()
    })
  })
})
```

**Step 3: 테스트 실행**

Run: `cd /Users/yyong/Developer/homenrich/frontend && npx vitest run src/pages/__tests__/InsightsPage.test.tsx`
Expected: ALL PASS

**Step 4: 커밋**

```bash
git add frontend/src/pages/InsightsPage.tsx frontend/src/pages/__tests__/InsightsPage.test.tsx
git commit -m "feat: InsightsPage 탭 기반 리디자인 (주간/월간/연간/AI)"
```

---

## Task 10: 전체 테스트 + 린트 + 빌드 검증

**Step 1: 백엔드 전체 테스트**

Run: `cd /Users/yyong/Developer/homenrich/backend && uv run pytest tests/ -v`
Expected: ALL PASS (기존 299 + 새 ~12 = ~311)

**Step 2: 프론트엔드 전체 테스트**

Run: `cd /Users/yyong/Developer/homenrich/frontend && npx vitest run`
Expected: ALL PASS (기존 343 + 새 ~25 = ~368)

**Step 3: 프론트엔드 린트 + 빌드**

Run: `cd /Users/yyong/Developer/homenrich/frontend && npm run lint && npm run build`
Expected: No errors

**Step 4: 최종 커밋 (필요 시)**

```bash
git add -A
git commit -m "fix: 통계 기능 린트/빌드 에러 수정"
```

---

## Task 11: 문서 업데이트 + PR

**Step 1: IMPLEMENTATION_STATUS.md 업데이트**

인사이트/통계 섹션에 새 기능 반영:

```markdown
### 통계/리포트
| 기능 | 상태 | 테스트 | 비고 |
|------|------|--------|------|
| 주간/월간/연간 통계 | 완료 | 있음 | 탭 UI + 기간 네비게이션 |
| 기간 비교 (전월/3개월) | 완료 | 있음 | 카테고리별 변화량 포함 |
| 5단계 변화량 표시 | 완료 | 있음 | 많이 늘음~많이 줄음 |
| AI 인사이트 | 완료 | 있음 | 별도 탭으로 유지 |
```

**Step 2: PR 생성**

```bash
git checkout -b feature/statistics-report
git push -u origin feature/statistics-report
gh pr create --title "feat: 통계/리포트 강화 (주간/월간/연간 + 비교)" --body "..."
```

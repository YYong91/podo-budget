"""budget_service 단위 테스트 (#359)

get_budget_alerts, get_category_overview의 비즈니스 로직을
AsyncSession 모킹으로 검증합니다. DB 없이 순수 로직 테스트.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.budget_service import get_budget_alerts, get_category_overview

# ── 헬퍼 ──────────────────────────────────────────────────────


def _make_budget(**kwargs) -> MagicMock:
    """테스트용 Budget 객체 생성"""
    b = MagicMock()
    now = datetime.now(UTC).replace(tzinfo=None)
    b.id = kwargs.get("id", 1)
    b.household_id = kwargs.get("household_id", 1)
    b.category_id = kwargs.get("category_id", 10)
    b.amount = Decimal(str(kwargs.get("amount", 100000)))
    b.period = kwargs.get("period", "monthly")
    b.start_date = kwargs.get("start_date", now - timedelta(days=10))
    b.end_date = kwargs.get("end_date")
    b.alert_threshold = kwargs.get("alert_threshold", 0.8)
    b.created_at = kwargs.get("created_at", now)
    return b


def _make_category(**kwargs) -> MagicMock:
    """테스트용 Category 객체 생성"""
    c = MagicMock()
    c.id = kwargs.get("id", 10)
    c.name = kwargs.get("name", "식비")
    c.type = kwargs.get("type", "expense")
    c.household_id = kwargs.get("household_id")
    c.user_id = kwargs.get("user_id")
    return c


def _mock_scalars(items: list) -> MagicMock:
    """db.execute(...).scalars().all() 모킹"""
    result = MagicMock()
    result.scalars.return_value.all.return_value = items
    return result


def _mock_rows(rows: list) -> MagicMock:
    """db.execute(...).all() 모킹 (group_by 결과)"""
    result = MagicMock()
    result.all.return_value = rows
    return result


def _make_expense_row(category_id: int, total: float) -> MagicMock:
    """지출 집계 행 — (category_id, total)"""
    row = MagicMock()
    row.category_id = category_id
    row.total = total
    return row


def _make_spending_row(category_id: int, year: int, month: int, amount: float) -> MagicMock:
    """월별 지출 집계 행"""
    row = MagicMock()
    row.category_id = category_id
    row.year = year
    row.month = month
    row.amount = amount
    return row


# ── get_budget_alerts ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_budget_alerts_empty_budgets():
    """예산이 없으면 빈 리스트 반환"""
    db = AsyncMock()
    db.execute.return_value = _mock_scalars([])

    alerts = await get_budget_alerts(db, household_id=1)
    assert alerts == []


@pytest.mark.asyncio
async def test_get_budget_alerts_future_start_date_filtered():
    """시작일이 미래인 예산은 필터링된다"""
    future_budget = _make_budget(start_date=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=30))

    db = AsyncMock()
    db.execute.return_value = _mock_scalars([future_budget])

    alerts = await get_budget_alerts(db, household_id=1)
    assert alerts == []


@pytest.mark.asyncio
async def test_get_budget_alerts_exceeded():
    """지출이 예산을 초과하면 is_exceeded=True"""
    budget = _make_budget(id=1, category_id=10, amount=100000, alert_threshold=0.8)
    category = _make_category(id=10, name="식비")

    # 지출 합계: 120,000 > 예산 100,000
    expense_row = _make_expense_row(category_id=10, total=120000.0)

    db = AsyncMock()
    # 1) budgets 조회, 2) categories 조회, 3) expenses 집계
    db.execute.side_effect = [
        _mock_scalars([budget]),
        _mock_scalars([category]),
        _mock_rows([expense_row]),
    ]

    alerts = await get_budget_alerts(db, household_id=1)
    assert len(alerts) == 1
    assert alerts[0].is_exceeded is True
    assert alerts[0].spent_amount == 120000.0
    assert alerts[0].remaining_amount == -20000.0
    assert alerts[0].usage_percentage == 120.0


@pytest.mark.asyncio
async def test_get_budget_alerts_warning():
    """지출이 임계값(80%) 이상이면 is_warning=True"""
    budget = _make_budget(id=1, category_id=10, amount=100000, alert_threshold=0.8)
    category = _make_category(id=10, name="식비")

    # 지출 85,000 → 85% ≥ 80% 임계값
    expense_row = _make_expense_row(category_id=10, total=85000.0)

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([budget]),
        _mock_scalars([category]),
        _mock_rows([expense_row]),
    ]

    alerts = await get_budget_alerts(db, household_id=1)
    assert len(alerts) == 1
    assert alerts[0].is_warning is True
    assert alerts[0].is_exceeded is False


@pytest.mark.asyncio
async def test_get_budget_alerts_no_spending():
    """지출이 없으면 spent_amount=0, is_exceeded/is_warning=False"""
    budget = _make_budget(id=1, category_id=10, amount=100000, alert_threshold=0.8)
    category = _make_category(id=10, name="식비")

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([budget]),
        _mock_scalars([category]),
        _mock_rows([]),  # 지출 없음
    ]

    alerts = await get_budget_alerts(db, household_id=1)
    assert len(alerts) == 1
    assert alerts[0].spent_amount == 0.0
    assert alerts[0].is_exceeded is False
    assert alerts[0].is_warning is False
    assert alerts[0].remaining_amount == 100000.0


@pytest.mark.asyncio
async def test_get_budget_alerts_zero_budget_amount():
    """예산 금액이 0이면 usage_percentage=0 (ZeroDivisionError 방지)"""
    budget = _make_budget(id=1, category_id=10, amount=0, alert_threshold=0.8)
    category = _make_category(id=10, name="식비")

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([budget]),
        _mock_scalars([category]),
        _mock_rows([]),
    ]

    alerts = await get_budget_alerts(db, household_id=1)
    assert len(alerts) == 1
    assert alerts[0].usage_percentage == 0


@pytest.mark.asyncio
async def test_get_budget_alerts_missing_category_skipped():
    """카테고리 매핑이 없는 예산은 건너뛴다"""
    budget = _make_budget(id=1, category_id=999)  # 존재하지 않는 카테고리

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([budget]),
        _mock_scalars([]),  # 카테고리 없음
        _mock_rows([]),
    ]

    alerts = await get_budget_alerts(db, household_id=1)
    assert alerts == []


@pytest.mark.asyncio
async def test_get_budget_alerts_sort_order():
    """정렬 순서: 초과 > 경고 > 사용률 내림차순"""
    budget_exceeded = _make_budget(id=1, category_id=10, amount=100000, alert_threshold=0.8)
    budget_warning = _make_budget(id=2, category_id=20, amount=200000, alert_threshold=0.8)
    budget_normal = _make_budget(id=3, category_id=30, amount=300000, alert_threshold=0.8)

    cat1 = _make_category(id=10, name="식비")
    cat2 = _make_category(id=20, name="교통비")
    cat3 = _make_category(id=30, name="쇼핑")

    # 식비: 120% 초과, 교통비: 85% 경고, 쇼핑: 30% 정상
    expense_rows = [
        _make_expense_row(10, 120000.0),
        _make_expense_row(20, 170000.0),
        _make_expense_row(30, 90000.0),
    ]

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([budget_exceeded, budget_warning, budget_normal]),
        _mock_scalars([cat1, cat2, cat3]),
        _mock_rows(expense_rows),
    ]

    alerts = await get_budget_alerts(db, household_id=1)
    assert len(alerts) == 3
    # 초과 먼저
    assert alerts[0].is_exceeded is True
    assert alerts[0].category_name == "식비"
    # 경고 다음
    assert alerts[1].is_warning is True
    assert alerts[1].category_name == "교통비"
    # 정상 마지막
    assert alerts[2].is_exceeded is False
    assert alerts[2].is_warning is False


@pytest.mark.asyncio
async def test_get_budget_alerts_multiple_periods():
    """monthly/weekly/daily 예산이 혼재해도 각각의 period_start로 처리"""
    budget_monthly = _make_budget(id=1, category_id=10, amount=100000, period="monthly")
    budget_daily = _make_budget(id=2, category_id=20, amount=10000, period="daily")

    cat1 = _make_category(id=10, name="식비")
    cat2 = _make_category(id=20, name="교통비")

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([budget_monthly, budget_daily]),
        _mock_scalars([cat1, cat2]),
        # period_start별로 2번 호출됨
        _mock_rows([_make_expense_row(10, 50000.0)]),
        _mock_rows([_make_expense_row(20, 8000.0)]),
    ]

    alerts = await get_budget_alerts(db, household_id=1)
    assert len(alerts) == 2


@pytest.mark.asyncio
async def test_get_budget_alerts_weekly_period():
    """weekly 예산 period_start 계산 검증"""
    budget = _make_budget(id=1, category_id=10, amount=50000, period="weekly")
    category = _make_category(id=10, name="식비")

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([budget]),
        _mock_scalars([category]),
        _mock_rows([]),
    ]

    alerts = await get_budget_alerts(db, household_id=1)
    assert len(alerts) == 1
    assert alerts[0].spent_amount == 0.0


# ── get_category_overview ──────────────────────────────────────


@pytest.mark.asyncio
async def test_get_category_overview_empty():
    """카테고리가 없으면 빈 리스트 반환"""
    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([]),  # categories
        _mock_scalars([]),  # budgets
        _mock_rows([]),  # spending
    ]

    result = await get_category_overview(db, household_id=1, user_id=1)
    assert result == []


@pytest.mark.asyncio
async def test_get_category_overview_with_budget():
    """예산이 설정된 카테고리는 예산 정보가 포함된다"""
    cat = _make_category(id=10, name="식비")
    budget = _make_budget(id=1, category_id=10, amount=200000, alert_threshold=0.8)

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([cat]),  # categories
        _mock_scalars([budget]),  # budgets
        _mock_rows([]),  # spending (없음)
    ]

    result = await get_category_overview(db, household_id=1, user_id=1)
    assert len(result) == 1
    assert result[0].category_id == 10
    assert result[0].category_name == "식비"
    assert result[0].current_budget_id == 1
    assert result[0].current_budget_amount == 200000.0
    assert result[0].alert_threshold == 0.8
    assert result[0].monthly_spending == []


@pytest.mark.asyncio
async def test_get_category_overview_no_budget():
    """예산이 없는 카테고리는 budget 필드가 None"""
    cat = _make_category(id=10, name="교통비")

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([cat]),  # categories
        _mock_scalars([]),  # budgets (없음)
        _mock_rows([]),  # spending
    ]

    result = await get_category_overview(db, household_id=1, user_id=1)
    assert len(result) == 1
    assert result[0].current_budget_id is None
    assert result[0].current_budget_amount is None
    assert result[0].alert_threshold is None


@pytest.mark.asyncio
async def test_get_category_overview_with_spending():
    """최근 3개월 지출이 있으면 monthly_spending에 포함"""
    cat = _make_category(id=10, name="식비")
    now = datetime.now(UTC).replace(tzinfo=None)

    spending_rows = [
        _make_spending_row(10, now.year, now.month, 150000.0),
    ]

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([cat]),
        _mock_scalars([]),
        _mock_rows(spending_rows),
    ]

    result = await get_category_overview(db, household_id=1, user_id=1)
    assert len(result) == 1
    assert len(result[0].monthly_spending) == 1
    assert result[0].monthly_spending[0].amount == 150000.0


@pytest.mark.asyncio
async def test_get_category_overview_multiple_categories():
    """여러 카테고리가 있으면 모두 반환"""
    cat1 = _make_category(id=10, name="식비")
    cat2 = _make_category(id=20, name="교통비")
    cat3 = _make_category(id=30, name="쇼핑")

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([cat1, cat2, cat3]),
        _mock_scalars([]),
        _mock_rows([]),
    ]

    result = await get_category_overview(db, household_id=1, user_id=1)
    assert len(result) == 3


@pytest.mark.asyncio
async def test_get_category_overview_budget_dedup():
    """같은 카테고리에 여러 예산이 있으면 가장 최근 것만 매핑"""
    cat = _make_category(id=10, name="식비")
    now = datetime.now(UTC).replace(tzinfo=None)
    # budgets 쿼리는 created_at DESC로 정렬됨
    budget_new = _make_budget(id=2, category_id=10, amount=300000, created_at=now)
    budget_old = _make_budget(id=1, category_id=10, amount=200000, created_at=now - timedelta(days=30))

    db = AsyncMock()
    db.execute.side_effect = [
        _mock_scalars([cat]),
        _mock_scalars([budget_new, budget_old]),  # 최신 먼저
        _mock_rows([]),
    ]

    result = await get_category_overview(db, household_id=1, user_id=1)
    assert result[0].current_budget_id == 2  # 최신 예산
    assert result[0].current_budget_amount == 300000.0

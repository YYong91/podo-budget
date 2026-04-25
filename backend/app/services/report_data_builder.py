"""월간 결산 리포트 데이터 집계 서비스

기존 InsightsPage.tsx가 7~8개 API를 호출해 조립하던 로직을 백엔드로 이관.
ComprehensiveInsightsRequest 스키마와 호환되는 dict를 반환한다.

주요 설계 결정:
- Expense.date / Income.date 가 DateTime 타입이므로, date 경계는 datetime으로 변환
- Category.is_savings 플래그를 기반으로 저축성 지출을 집계
- RecurringTransaction.next_due_date (Date) 기준으로 당월 예정 금액 집계
"""

import logging
import math
from datetime import date, datetime, time

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.income import Income
from app.models.recurring_transaction import RecurringTransaction
from app.services.report_month_utils import month_boundaries

logger = logging.getLogger(__name__)

# 재무 건강 점수 등급 기준 (overall 0~100 기준)
_GRADE_THRESHOLDS = [
    (97, "A+"),
    (90, "A"),
    (80, "B+"),
    (70, "B"),
    (60, "C+"),
    (50, "C"),
    (40, "D"),
]


def _date_to_datetime_range(start: date, end: date) -> tuple[datetime, datetime]:
    """date 경계를 DateTime 필드 비교용 datetime으로 변환

    Expense.date / Income.date가 DateTime 컬럼이므로
    date 경계를 midnight datetime으로 변환해야 올바른 범위 필터가 적용된다.
    """
    return datetime.combine(start, time.min), datetime.combine(end, time.min)


def _previous_month(month: str) -> str:
    """YYYY-MM → 직전 월 YYYY-MM"""
    year, mon = map(int, month.split("-"))
    if mon == 1:
        return f"{year - 1}-12"
    return f"{year}-{mon - 1:02d}"


async def _sum_expenses(db: AsyncSession, household_id: int, start: date, end: date) -> float:
    """기간 내 지출 합계 (exclude_from_stats=True 제외)"""
    dt_start, dt_end = _date_to_datetime_range(start, end)
    result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            and_(
                Expense.household_id == household_id,
                Expense.date >= dt_start,
                Expense.date < dt_end,
                Expense.exclude_from_stats.is_(False),
            )
        )
    )
    return float(result.scalar())


async def _sum_income(db: AsyncSession, household_id: int, start: date, end: date) -> float:
    """기간 내 수입 합계 (exclude_from_stats=True 제외)"""
    dt_start, dt_end = _date_to_datetime_range(start, end)
    result = await db.execute(
        select(func.coalesce(func.sum(Income.amount), 0)).where(
            and_(
                Income.household_id == household_id,
                Income.date >= dt_start,
                Income.date < dt_end,
                Income.exclude_from_stats.is_(False),
            )
        )
    )
    return float(result.scalar())


async def _top_expense_categories(
    db: AsyncSession,
    household_id: int,
    start: date,
    end: date,
    expense_total: float,
    limit: int = 5,
) -> list[dict]:
    """카테고리별 지출 집계 TOP N

    각 항목: {category_id, category_name, amount, ratio}
    """
    dt_start, dt_end = _date_to_datetime_range(start, end)
    rows = await db.execute(
        select(
            Expense.category_id,
            Category.name,
            func.sum(Expense.amount).label("total"),
        )
        .outerjoin(Category, Expense.category_id == Category.id)
        .where(
            and_(
                Expense.household_id == household_id,
                Expense.date >= dt_start,
                Expense.date < dt_end,
                Expense.exclude_from_stats.is_(False),
            )
        )
        .group_by(Expense.category_id, Category.name)
        .order_by(func.sum(Expense.amount).desc())
        .limit(limit)
    )
    items = []
    for row in rows:
        amount = float(row.total)
        ratio = round(amount / expense_total * 100, 1) if expense_total > 0 else 0.0
        items.append(
            {
                "category_id": row.category_id,
                "category_name": row.name or "미분류",
                "amount": amount,
                "ratio": ratio,
            }
        )
    return items


async def _budget_summary(db: AsyncSession, household_id: int, start: date, end: date) -> dict:
    """활성 예산 대비 실제 지출 요약

    반환: {total_budget, total_spent, items: [{category_id, name, budget, spent}]}
    """
    dt_start, dt_end = _date_to_datetime_range(start, end)

    # 활성 예산: period=monthly이고 해당 월과 겹치는 예산
    budgets = await db.execute(
        select(Budget.id, Budget.category_id, Budget.amount, Category.name)
        .outerjoin(Category, Budget.category_id == Category.id)
        .where(
            and_(
                Budget.household_id == household_id,
                Budget.period == "monthly",
                Budget.start_date <= dt_end,
            )
        )
    )
    budget_rows = budgets.all()

    if not budget_rows:
        return {"total_budget": 0.0, "total_spent": 0.0, "items": []}

    # 예산별 실제 지출 집계
    category_ids = [r.category_id for r in budget_rows]
    spent_rows = await db.execute(
        select(
            Expense.category_id,
            func.sum(Expense.amount).label("spent"),
        )
        .where(
            and_(
                Expense.household_id == household_id,
                Expense.date >= dt_start,
                Expense.date < dt_end,
                Expense.exclude_from_stats.is_(False),
                Expense.category_id.in_(category_ids),
            )
        )
        .group_by(Expense.category_id)
    )
    spent_map = {r.category_id: float(r.spent) for r in spent_rows}

    items = []
    total_budget = 0.0
    total_spent = 0.0
    for row in budget_rows:
        budget_amount = float(row.amount)
        spent_amount = spent_map.get(row.category_id, 0.0)
        total_budget += budget_amount
        total_spent += spent_amount
        items.append(
            {
                "category_id": row.category_id,
                "name": row.name or "미분류",
                "budget": budget_amount,
                "spent": spent_amount,
            }
        )

    return {
        "total_budget": total_budget,
        "total_spent": total_spent,
        "items": items,
    }


async def _expense_income_trend(db: AsyncSession, household_id: int, current_month: str, months: int = 3) -> list[dict]:
    """최근 N개월 지출/수입 추이

    반환: [{month, expense, income}, ...]  최신 월 포함 N개월 (오름차순)
    """
    # 현재 월 포함 이전 (months-1)개월 수집
    trend_months: list[str] = []
    m = current_month
    for _ in range(months):
        trend_months.insert(0, m)
        m = _previous_month(m)

    result = []
    for month in trend_months:
        s, e = month_boundaries(month)
        expense = await _sum_expenses(db, household_id, s, e)
        income = await _sum_income(db, household_id, s, e)
        result.append({"month": month, "expense": expense, "income": income})
    return result


async def _savings_total(db: AsyncSession, household_id: int, start: date, end: date) -> float:
    """저축성 카테고리(is_savings=True) 지출 합계

    Category.is_savings 플래그를 기반으로 집계 — "savings" 타입은 없음.
    """
    dt_start, dt_end = _date_to_datetime_range(start, end)
    result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0))
        .join(Category, Expense.category_id == Category.id)
        .where(
            and_(
                Expense.household_id == household_id,
                Expense.date >= dt_start,
                Expense.date < dt_end,
                Expense.exclude_from_stats.is_(False),
                Category.is_savings.is_(True),
            )
        )
    )
    return float(result.scalar())


async def _recurring_total(db: AsyncSession, household_id: int, start: date, end: date) -> dict:
    """당월 정기 거래 예정 금액 합계

    next_due_date가 해당 월 범위 내에 있는 활성 정기 거래를 집계.
    반환: {expense: float, income: float}
    """
    rows = await db.execute(
        select(RecurringTransaction.type, func.sum(RecurringTransaction.amount).label("total"))
        .where(
            and_(
                RecurringTransaction.household_id == household_id,
                RecurringTransaction.is_active.is_(True),
                RecurringTransaction.next_due_date >= start,
                RecurringTransaction.next_due_date < end,
            )
        )
        .group_by(RecurringTransaction.type)
    )
    totals = {"expense": 0.0, "income": 0.0}
    for row in rows:
        totals[row.type] = float(row.total)
    return totals


def _calc_financial_score(
    income_total: float,
    expense_total: float,
    savings_total: float,
    budget: dict,
    trend: list[dict],
) -> dict:
    """재무 건강 점수 계산 (0~100)

    4가지 지표:
    1. 저축률 점수: savings_total / income_total 비율 기반 (0~30점)
    2. 예산 준수율 점수: spent / budget 비율 기반 (0~30점)
    3. 지출 안정성 점수: 직전 3개월 변동계수(CV) 기반 (0~20점)
    4. 흑자율 점수: (income - expense) / income 기반 (0~20점)

    grade: A+ / A / B+ / B / C+ / C / D / F
    """
    scores: dict[str, float] = {}

    # 1. 저축률 점수 (0~30) — 저축/수입 비율 20% 이상이면 만점
    if income_total > 0:
        savings_ratio = savings_total / income_total
        scores["savings"] = min(savings_ratio / 0.20, 1.0) * 30
    else:
        scores["savings"] = 0.0

    # 2. 예산 준수율 점수 (0~30) — 예산이 없으면 중간 점수 15점
    total_budget = budget.get("total_budget", 0.0)
    total_spent = budget.get("total_spent", 0.0)
    if total_budget > 0:
        usage_ratio = total_spent / total_budget
        # 사용률이 80% 이하이면 만점, 100% 초과 시 0점
        scores["budget"] = max(0.0, min(1.0, (1.0 - usage_ratio) / 0.20)) * 30
    else:
        scores["budget"] = 15.0  # 예산 미설정 중간 점수

    # 3. 지출 안정성 점수 (0~20) — 변동계수(CV) 낮을수록 안정적
    expense_values = [t["expense"] for t in trend if t["expense"] > 0]
    if len(expense_values) >= 2:
        mean = sum(expense_values) / len(expense_values)
        variance = sum((v - mean) ** 2 for v in expense_values) / len(expense_values)
        cv = math.sqrt(variance) / mean if mean > 0 else 0.0
        # CV 0.1 이하 만점, 0.5 이상 0점
        scores["stability"] = max(0.0, min(1.0, 1.0 - (cv - 0.1) / 0.4)) * 20
    else:
        scores["stability"] = 10.0  # 데이터 부족 시 중간 점수

    # 4. 흑자율 점수 (0~20) — (수입 - 지출) / 수입 30% 이상이면 만점
    if income_total > 0:
        surplus_ratio = (income_total - expense_total) / income_total
        scores["surplus"] = min(max(surplus_ratio / 0.30, 0.0), 1.0) * 20
    else:
        scores["surplus"] = 0.0

    overall = round(sum(scores.values()), 1)

    grade = "F"
    for threshold, g in _GRADE_THRESHOLDS:
        if overall >= threshold:
            grade = g
            break

    return {
        "overall": overall,
        "grade": grade,
        "details": {k: round(v, 1) for k, v in scores.items()},
    }


async def build_report_data(db: AsyncSession, household_id: int, month: str) -> dict:
    """ComprehensiveInsightsRequest 호환 dict 생성

    Args:
        db: AsyncSession
        household_id: 대상 가구 ID
        month: YYYY-MM 형식 월 문자열

    Returns:
        월간 결산 집계 dict — InsightsPage 및 MonthlyReport 스키마와 호환
    """
    start, end = month_boundaries(month)
    prev_month = _previous_month(month)
    prev_start, prev_end = month_boundaries(prev_month)

    expense_total = await _sum_expenses(db, household_id, start, end)
    income_total = await _sum_income(db, household_id, start, end)
    prev_expense = await _sum_expenses(db, household_id, prev_start, prev_end)
    prev_income = await _sum_income(db, household_id, prev_start, prev_end)

    top_categories = await _top_expense_categories(db, household_id, start, end, expense_total)
    budget = await _budget_summary(db, household_id, start, end)
    trend = await _expense_income_trend(db, household_id, month, months=3)
    savings_total = await _savings_total(db, household_id, start, end)
    recurring_total = await _recurring_total(db, household_id, start, end)

    # 저축률: (수입 - 지출) / 수입 * 100
    savings_rate = (income_total - expense_total) / income_total * 100 if income_total > 0 else 0.0

    financial_score = _calc_financial_score(
        income_total=income_total,
        expense_total=expense_total,
        savings_total=savings_total,
        budget=budget,
        trend=trend,
    )

    return {
        "month": month,
        "income_total": income_total,
        "expense_total": expense_total,
        "top_expense_categories": top_categories,
        "budget": budget,
        "savings_rate": round(savings_rate, 2),
        "trend": trend,
        "savings_total": savings_total,
        "recurring_total": recurring_total,
        "previous_month_expense": prev_expense,
        "previous_month_income": prev_income,
        "financial_score": financial_score,
    }

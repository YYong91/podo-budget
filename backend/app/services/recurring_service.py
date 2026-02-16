"""정기 거래 서비스

next_due_date 계산 및 정기 거래 실행 로직을 담당합니다.
"""

from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.income import Income
from app.models.recurring_transaction import RecurringTransaction


def calculate_next_due_date(
    current_due: date,
    frequency: str,
    interval: int | None = None,
    day_of_month: int | None = None,
    day_of_week: int | None = None,
    month_of_year: int | None = None,
) -> date:
    """다음 실행 예정일 계산"""
    if frequency == "weekly":
        return current_due + timedelta(days=7)
    elif frequency == "monthly":
        if current_due.month == 12:
            next_month = 1
            next_year = current_due.year + 1
        else:
            next_month = current_due.month + 1
            next_year = current_due.year

        # day_of_month가 해당 월의 마지막 날보다 크면 마지막 날로 조정
        _, last_day = monthrange(next_year, next_month)
        actual_day = min(day_of_month or current_due.day, last_day)
        return date(next_year, next_month, actual_day)
    elif frequency == "yearly":
        next_year = current_due.year + 1
        month = month_of_year or current_due.month
        _, last_day = monthrange(next_year, month)
        actual_day = min(day_of_month or current_due.day, last_day)
        return date(next_year, month, actual_day)
    elif frequency == "custom":
        return current_due + timedelta(days=interval or 1)
    else:
        raise ValueError(f"알 수 없는 빈도: {frequency}")


def calculate_initial_due_date(
    start_date: date,
    frequency: str,
    day_of_month: int | None = None,
    day_of_week: int | None = None,
    month_of_year: int | None = None,
) -> date:
    """최초 실행 예정일 계산

    start_date 이후의 첫 번째 실행일을 계산합니다.
    """
    if frequency == "weekly":
        days_ahead = (day_of_week or 0) - start_date.weekday()
        if days_ahead < 0:
            days_ahead += 7
        return start_date + timedelta(days=days_ahead)
    elif frequency == "monthly":
        day = day_of_month or start_date.day
        _, last_day = monthrange(start_date.year, start_date.month)
        actual_day = min(day, last_day)
        candidate = start_date.replace(day=actual_day)
        if candidate < start_date:
            return calculate_next_due_date(candidate, "monthly", day_of_month=day)
        return candidate
    elif frequency == "yearly":
        month = month_of_year or start_date.month
        day = day_of_month or start_date.day
        _, last_day = monthrange(start_date.year, month)
        actual_day = min(day, last_day)
        candidate = date(start_date.year, month, actual_day)
        if candidate < start_date:
            return date(start_date.year + 1, month, actual_day)
        return candidate
    elif frequency == "custom":
        return start_date
    else:
        raise ValueError(f"알 수 없는 빈도: {frequency}")


async def execute_recurring(
    recurring: RecurringTransaction,
    db: AsyncSession,
    amount_override: float | None = None,
) -> int:
    """정기 거래 실행 → Expense 또는 Income 생성

    Returns:
        생성된 Expense/Income의 ID
    """
    amount = amount_override or float(recurring.amount)

    if recurring.type == "expense":
        record = Expense(
            user_id=recurring.user_id,
            household_id=recurring.household_id,
            amount=amount,
            description=recurring.description,
            category_id=recurring.category_id,
            raw_input=f"[정기] {recurring.description}",
            date=recurring.next_due_date,
        )
    else:
        record = Income(
            user_id=recurring.user_id,
            household_id=recurring.household_id,
            amount=amount,
            description=recurring.description,
            category_id=recurring.category_id,
            raw_input=f"[정기] {recurring.description}",
            date=recurring.next_due_date,
        )

    db.add(record)

    # next_due_date 갱신
    new_due = calculate_next_due_date(
        recurring.next_due_date,
        recurring.frequency,
        recurring.interval,
        recurring.day_of_month,
        recurring.day_of_week,
        recurring.month_of_year,
    )
    # end_date 초과 시 비활성화
    if recurring.end_date and new_due > recurring.end_date:
        recurring.is_active = False
    recurring.next_due_date = new_due

    await db.commit()
    await db.refresh(record)
    return record.id


async def skip_recurring(recurring: RecurringTransaction, db: AsyncSession) -> date:
    """정기 거래 건너뛰기 → next_due_date만 갱신

    Returns:
        갱신된 next_due_date
    """
    new_due = calculate_next_due_date(
        recurring.next_due_date,
        recurring.frequency,
        recurring.interval,
        recurring.day_of_month,
        recurring.day_of_week,
        recurring.month_of_year,
    )
    if recurring.end_date and new_due > recurring.end_date:
        recurring.is_active = False
    recurring.next_due_date = new_due
    await db.commit()
    return new_due

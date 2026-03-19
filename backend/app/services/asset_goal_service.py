"""순자산 목표 비즈니스 로직"""

from datetime import date, timedelta

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_goal import AssetGoal
from app.models.asset_snapshot import AssetSnapshot
from app.models.expense import Expense
from app.models.income import Income
from app.models.user import User
from app.services.asset_service import get_asset_summary


async def get_goal(user_id: int, household_id: int, db: AsyncSession) -> AssetGoal | None:
    """활성 목표 조회 (사용자/가구 당 최신 1개)"""
    result = await db.execute(
        select(AssetGoal).where(AssetGoal.user_id == user_id, AssetGoal.household_id == household_id).order_by(AssetGoal.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def upsert_goal(
    user_id: int,
    household_id: int,
    target_net_worth: float,
    target_date: date,
    db: AsyncSession,
) -> AssetGoal:
    """목표 upsert: 기존 있으면 업데이트, 없으면 생성"""
    existing = await get_goal(user_id, household_id, db)
    if existing:
        existing.target_net_worth = target_net_worth
        existing.target_date = target_date
        await db.flush()
        await db.refresh(existing)
        return existing
    goal = AssetGoal(
        user_id=user_id,
        household_id=household_id,
        target_net_worth=target_net_worth,
        target_date=target_date,
    )
    db.add(goal)
    await db.flush()
    await db.refresh(goal)
    return goal


async def delete_goal(user_id: int, household_id: int, db: AsyncSession) -> bool:
    """목표 삭제"""
    goal = await get_goal(user_id, household_id, db)
    if not goal:
        return False
    await db.delete(goal)
    return True


async def get_goal_with_insight(
    user: User,
    household_id: int,
    db: AsyncSession,
) -> dict | None:
    """목표 + 페이스 인사이트 계산"""
    goal = await get_goal(user.id, household_id, db)
    if not goal:
        return None

    # 현재 순자산 (get_asset_summary는 db, user, household_id를 받음)
    summary = await get_asset_summary(db, user, household_id)
    current_nw = summary["net_worth"]
    target_nw = float(goal.target_net_worth)

    # 진행률
    progress_pct = min((current_nw / target_nw * 100) if target_nw > 0 else 0, 100)

    # 남은 개월
    today = date.today()
    days_left = (goal.target_date - today).days
    months_left = max(days_left / 30.0, 0.1)
    remaining = target_nw - current_nw

    # 월 필요 저축액
    monthly_required = remaining / months_left if remaining > 0 else 0

    # 최근 4개월 스냅샷으로 평균 월간 순자산 증가율 계산
    snapshots = await _get_recent_snapshots(user.id, household_id, db, months=4)
    avg_monthly_growth = _calc_avg_monthly_growth(snapshots)

    # 예상 도달일
    estimated_date = None
    if avg_monthly_growth and avg_monthly_growth > 0 and remaining > 0:
        months_needed = remaining / avg_monthly_growth
        estimated_date = today + timedelta(days=int(months_needed * 30))

    # 페이스 판정
    if remaining <= 0:
        pace_status = "ahead"
        pace_message = "목표를 달성했어요!"
    elif estimated_date and estimated_date <= goal.target_date:
        diff_months = (goal.target_date - estimated_date).days // 30
        pace_status = "ahead"
        pace_message = f"목표보다 {diff_months}개월 빠른 페이스!" if diff_months > 0 else "순항 중! 이 페이스를 유지하세요"
    elif estimated_date:
        pace_status = "behind"
        pace_message = f"현재 페이스로는 {estimated_date.year}년 {estimated_date.month}월 예상"
    else:
        pace_status = "on_track"
        pace_message = "스냅샷이 쌓이면 예상 도달일을 알려드릴게요"

    return {
        **{c.name: getattr(goal, c.name) for c in goal.__table__.columns},
        "progress_pct": round(progress_pct, 1),
        "monthly_required": round(monthly_required),
        "estimated_date": estimated_date,
        "pace_status": pace_status,
        "pace_message": pace_message,
    }


async def _get_recent_snapshots(user_id: int, household_id: int, db: AsyncSession, months: int = 4) -> list[AssetSnapshot]:
    """최근 N개월 스냅샷 조회"""
    result = await db.execute(
        select(AssetSnapshot)
        .where(AssetSnapshot.user_id == user_id, AssetSnapshot.household_id == household_id)
        .order_by(AssetSnapshot.snapshot_date.desc())
        .limit(months)
    )
    return list(result.scalars().all())


def _calc_avg_monthly_growth(snapshots: list[AssetSnapshot]) -> float | None:
    """최근 스냅샷에서 월평균 순자산 증가율 계산"""
    if len(snapshots) < 2:
        return None
    newest = float(snapshots[0].net_worth)
    oldest = float(snapshots[-1].net_worth)
    months = len(snapshots) - 1
    return (newest - oldest) / months if months > 0 else None


async def get_monthly_savings(household_id: int, db: AsyncSession) -> dict:
    """이번 달 수입 - 지출 = 순저축액 (exclude_from_stats 항목 제외, #182)"""
    today = date.today()
    year = today.year
    month = today.month

    # 이번 달 수입 합산 (통계 제외 항목 제외)
    income_q = select(func.coalesce(func.sum(Income.amount), 0)).where(
        extract("year", Income.date) == year,
        extract("month", Income.date) == month,
        Income.household_id == household_id,
        Income.exclude_from_stats.is_(False),
    )
    # 이번 달 지출 합산 (통계 제외 항목 제외)
    expense_q = select(func.coalesce(func.sum(Expense.amount), 0)).where(
        extract("year", Expense.date) == year,
        extract("month", Expense.date) == month,
        Expense.household_id == household_id,
        Expense.exclude_from_stats.is_(False),
    )

    income_result = await db.execute(income_q)
    expense_result = await db.execute(expense_q)
    total_income = float(income_result.scalar_one())
    total_expense = float(expense_result.scalar_one())

    return {
        "year": year,
        "month": month,
        "total_income": total_income,
        "total_expense": total_expense,
        "net_savings": total_income - total_expense,
    }

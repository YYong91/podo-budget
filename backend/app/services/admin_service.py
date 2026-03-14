"""Admin 대시보드 서비스

시스템 전체 통계 집계 쿼리와 사용자 관리 로직을 담당합니다.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.expense import Expense
from app.models.feedback import Feedback
from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.user import User
from app.schemas.admin import (
    AdminUserDetailResponse,
    AdminUserItem,
    AdminUserListResponse,
    CategoryDistribution,
    DailyCount,
    FeedbackStatsResponse,
    HouseholdStatsResponse,
    InvitationStats,
    OverviewStatsResponse,
    TransactionStatsResponse,
)


async def get_overview_stats(db: AsyncSession) -> OverviewStatsResponse:
    """사용자 현황 통계 조회"""
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

    # 총 사용자 수, 활성 사용자 수
    user_counts = await db.execute(
        select(
            func.count(User.id).label("total"),
            func.count(case((User.is_active.is_(True), User.id))).label("active"),
            func.count(case((User.telegram_chat_id.isnot(None), User.id))).label("telegram"),
        )
    )
    row = user_counts.one()
    total_users = row.total
    active_users = row.active
    telegram_linked = row.telegram

    # 신규 가입 (오늘/이번주/이번달)
    signup_counts = await db.execute(
        select(
            func.count(case((User.created_at >= today_start, User.id))).label("today"),
            func.count(case((User.created_at >= week_start, User.id))).label("week"),
            func.count(case((User.created_at >= month_start, User.id))).label("month"),
        )
    )
    signups = signup_counts.one()

    # DAU: 오늘 거래(지출 또는 수입) 기록한 유저 수
    dau_expense = select(Expense.user_id).where(Expense.created_at >= today_start)
    dau_income = select(Income.user_id).where(Income.created_at >= today_start)
    dau_union = dau_expense.union(dau_income).subquery()
    dau_result = await db.execute(select(func.count(func.distinct(dau_union.c.user_id))))
    dau = dau_result.scalar() or 0

    # MAU: 이번달 거래 기록한 유저 수
    mau_expense = select(Expense.user_id).where(Expense.created_at >= month_start)
    mau_income = select(Income.user_id).where(Income.created_at >= month_start)
    mau_union = mau_expense.union(mau_income).subquery()
    mau_result = await db.execute(select(func.count(func.distinct(mau_union.c.user_id))))
    mau = mau_result.scalar() or 0

    # 리텐션: 이번달 MAU 중 지난달에도 활성이었던 비율
    retention_rate = None
    if mau > 0:
        prev_expense = select(Expense.user_id).where(
            Expense.created_at >= prev_month_start,
            Expense.created_at < month_start,
        )
        prev_income = select(Income.user_id).where(
            Income.created_at >= prev_month_start,
            Income.created_at < month_start,
        )
        prev_union = prev_expense.union(prev_income).subquery()

        # 이번달 활성 유저와 지난달 활성 유저의 교집합
        current_users = mau_expense.union(mau_income).subquery()
        retained = await db.execute(select(func.count(func.distinct(current_users.c.user_id))).where(current_users.c.user_id.in_(select(prev_union.c.user_id))))
        retained_count = retained.scalar() or 0
        retention_rate = round(retained_count / mau * 100, 1)

    return OverviewStatsResponse(
        total_users=total_users,
        active_users=active_users,
        new_signups_today=signups.today,
        new_signups_week=signups.week,
        new_signups_month=signups.month,
        dau=dau,
        mau=mau,
        telegram_linked_count=telegram_linked,
        retention_rate=retention_rate,
    )


async def get_transaction_stats(db: AsyncSession, days: int = 30) -> TransactionStatsResponse:
    """거래 통계 조회"""
    now = datetime.now(UTC)
    start_date = now - timedelta(days=days)

    # 전체 통계
    expense_stats = await db.execute(
        select(
            func.count(Expense.id).label("count"),
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        ).where(Expense.created_at >= start_date)
    )
    e = expense_stats.one()

    income_stats = await db.execute(
        select(
            func.count(Income.id).label("count"),
            func.coalesce(func.sum(Income.amount), 0).label("total"),
        ).where(Income.created_at >= start_date)
    )
    i = income_stats.one()

    avg_expense = float(e.total) / e.count if e.count > 0 else 0
    avg_income = float(i.total) / i.count if i.count > 0 else 0

    # 일별 추이 — func.date()는 SQLite/PostgreSQL 모두 호환
    expense_daily = await db.execute(
        select(
            func.date(Expense.date).label("d"),
            func.count(Expense.id).label("count"),
            func.coalesce(func.sum(Expense.amount), 0).label("amount"),
        )
        .where(Expense.created_at >= start_date)
        .group_by(func.date(Expense.date))
        .order_by(func.date(Expense.date))
    )

    income_daily = await db.execute(
        select(
            func.date(Income.date).label("d"),
            func.count(Income.id).label("count"),
            func.coalesce(func.sum(Income.amount), 0).label("amount"),
        )
        .where(Income.created_at >= start_date)
        .group_by(func.date(Income.date))
        .order_by(func.date(Income.date))
    )

    # 일별 데이터 합치기
    expense_by_day: dict[str, tuple[int, float]] = {}
    for row in expense_daily:
        day_str = str(row.d) if row.d else "unknown"
        expense_by_day[day_str] = (row.count, float(row.amount))

    income_by_day: dict[str, tuple[int, float]] = {}
    for row in income_daily:
        day_str = str(row.d) if row.d else "unknown"
        income_by_day[day_str] = (row.count, float(row.amount))

    all_days = sorted(set(expense_by_day.keys()) | set(income_by_day.keys()))
    daily_counts = [
        DailyCount(
            date=d,
            expense_count=expense_by_day.get(d, (0, 0))[0],
            income_count=income_by_day.get(d, (0, 0))[0],
            expense_amount=expense_by_day.get(d, (0, 0.0))[1],
            income_amount=income_by_day.get(d, (0, 0.0))[1],
        )
        for d in all_days
    ]

    # 카테고리별 분포 (지출)
    expense_cat = await db.execute(
        select(
            func.coalesce(Category.name, "미분류").label("cat"),
            func.sum(Expense.amount).label("amount"),
            func.count(Expense.id).label("count"),
        )
        .outerjoin(Category, Expense.category_id == Category.id)
        .where(Expense.created_at >= start_date)
        .group_by("cat")
        .order_by(func.sum(Expense.amount).desc())
    )
    expense_total = float(e.total) if float(e.total) > 0 else 1
    expense_by_category = [
        CategoryDistribution(
            category=row.cat,
            amount=float(row.amount),
            count=row.count,
            percentage=round(float(row.amount) / expense_total * 100, 1),
        )
        for row in expense_cat
    ]

    # 카테고리별 분포 (수입)
    income_cat = await db.execute(
        select(
            func.coalesce(Category.name, "미분류").label("cat"),
            func.sum(Income.amount).label("amount"),
            func.count(Income.id).label("count"),
        )
        .outerjoin(Category, Income.category_id == Category.id)
        .where(Income.created_at >= start_date)
        .group_by("cat")
        .order_by(func.sum(Income.amount).desc())
    )
    income_total = float(i.total) if float(i.total) > 0 else 1
    income_by_category = [
        CategoryDistribution(
            category=row.cat,
            amount=float(row.amount),
            count=row.count,
            percentage=round(float(row.amount) / income_total * 100, 1),
        )
        for row in income_cat
    ]

    return TransactionStatsResponse(
        total_expense_amount=float(e.total),
        total_income_amount=float(i.total),
        total_expense_count=e.count,
        total_income_count=i.count,
        avg_expense_amount=round(avg_expense, 2),
        avg_income_amount=round(avg_income, 2),
        daily_counts=daily_counts,
        expense_by_category=expense_by_category,
        income_by_category=income_by_category,
    )


async def get_household_stats(db: AsyncSession) -> HouseholdStatsResponse:
    """가구 현황 통계 조회"""
    # 활성 가구 수
    total_result = await db.execute(select(func.count(Household.id)).where(Household.deleted_at.is_(None)))
    total_households = total_result.scalar() or 0

    # 총 활성 멤버 수
    total_members_result = await db.execute(select(func.count(HouseholdMember.id)).where(HouseholdMember.left_at.is_(None)))
    total_members = total_members_result.scalar() or 0

    # 멤버 수별 가구 분포
    member_dist_query = (
        select(
            func.count(HouseholdMember.id).label("member_count"),
        )
        .join(Household, HouseholdMember.household_id == Household.id)
        .where(
            HouseholdMember.left_at.is_(None),
            Household.deleted_at.is_(None),
        )
        .group_by(HouseholdMember.household_id)
    )
    member_dist_result = await db.execute(
        select(
            member_dist_query.subquery().c.member_count,
            func.count().label("household_count"),
        ).group_by("member_count")
    )
    member_distribution = {str(row.member_count): row.household_count for row in member_dist_result}

    # 초대 통계
    inv_result = await db.execute(
        select(
            func.count(HouseholdInvitation.id).label("total"),
            func.count(case((HouseholdInvitation.status == "pending", HouseholdInvitation.id))).label("pending"),
            func.count(case((HouseholdInvitation.status == "accepted", HouseholdInvitation.id))).label("accepted"),
            func.count(case((HouseholdInvitation.status == "rejected", HouseholdInvitation.id))).label("rejected"),
            func.count(case((HouseholdInvitation.status == "expired", HouseholdInvitation.id))).label("expired"),
        )
    )
    inv = inv_result.one()

    return HouseholdStatsResponse(
        total_households=total_households,
        total_members=total_members,
        member_distribution=member_distribution,
        invitation_stats=InvitationStats(
            total=inv.total,
            pending=inv.pending,
            accepted=inv.accepted,
            rejected=inv.rejected,
            expired=inv.expired,
        ),
    )


async def get_feedback_stats(db: AsyncSession) -> FeedbackStatsResponse:
    """피드백 통계 조회"""
    result = await db.execute(
        select(
            func.count(Feedback.id).label("total"),
            func.count(case((Feedback.status == "new", Feedback.id))).label("new"),
            func.count(case((Feedback.status == "read", Feedback.id))).label("read"),
            func.count(case((Feedback.status == "done", Feedback.id))).label("done"),
            func.count(case((Feedback.type == "feature", Feedback.id))).label("feature"),
            func.count(case((Feedback.type == "bug", Feedback.id))).label("bug"),
        )
    )
    row = result.one()

    return FeedbackStatsResponse(
        total=row.total,
        by_status={"new": row.new, "read": row.read, "done": row.done},
        by_type={"feature": row.feature, "bug": row.bug},
    )


async def get_user_list(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
) -> AdminUserListResponse:
    """사용자 목록 조회 (페이지네이션)"""
    # 기본 쿼리 — 지출/수입 건수와 마지막 활동일 서브쿼리
    expense_count_sq = select(func.count(Expense.id)).where(Expense.user_id == User.id).correlate(User).scalar_subquery()
    income_count_sq = select(func.count(Income.id)).where(Income.user_id == User.id).correlate(User).scalar_subquery()

    # 마지막 활동: 지출/수입 중 가장 최근
    last_expense = select(func.max(Expense.created_at)).where(Expense.user_id == User.id).correlate(User).scalar_subquery()
    last_income = select(func.max(Income.created_at)).where(Income.user_id == User.id).correlate(User).scalar_subquery()

    # max(last_expense, last_income) — SQLite에는 greatest()가 없으므로 case 사용
    last_activity = case(
        (last_expense.is_(None), last_income),
        (last_income.is_(None), last_expense),
        (last_expense > last_income, last_expense),
        else_=last_income,
    )

    query = select(
        User,
        expense_count_sq.label("expense_count"),
        income_count_sq.label("income_count"),
        last_activity.label("last_activity_at"),
    )

    if search:
        query = query.where(User.username.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))

    # 전체 수
    count_query = select(func.count(User.id))
    if search:
        count_query = count_query.where(User.username.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # 페이지네이션
    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    rows = result.all()

    users = [
        AdminUserItem(
            id=row.User.id,
            username=row.User.username,
            email=row.User.email,
            is_active=row.User.is_active,
            created_at=row.User.created_at,
            expense_count=row.expense_count or 0,
            income_count=row.income_count or 0,
            last_activity_at=row.last_activity_at,
            is_telegram_linked=row.User.telegram_chat_id is not None,
        )
        for row in rows
    ]

    return AdminUserListResponse(
        users=users,
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_user_detail(db: AsyncSession, user_id: int) -> AdminUserDetailResponse | None:
    """사용자 상세 정보 조회"""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        return None

    # 지출/수입 통계
    expense_stats = await db.execute(
        select(
            func.count(Expense.id).label("count"),
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        ).where(Expense.user_id == user_id)
    )
    e = expense_stats.one()

    income_stats = await db.execute(
        select(
            func.count(Income.id).label("count"),
            func.coalesce(func.sum(Income.amount), 0).label("total"),
        ).where(Income.user_id == user_id)
    )
    i = income_stats.one()

    # 가구 수
    household_count_result = await db.execute(
        select(func.count(HouseholdMember.id)).where(
            HouseholdMember.user_id == user_id,
            HouseholdMember.left_at.is_(None),
        )
    )
    household_count = household_count_result.scalar() or 0

    # 마지막 활동
    last_expense = await db.execute(select(func.max(Expense.created_at)).where(Expense.user_id == user_id))
    last_income = await db.execute(select(func.max(Income.created_at)).where(Income.user_id == user_id))
    le = last_expense.scalar()
    li = last_income.scalar()
    last_activity = max(filter(None, [le, li]), default=None)

    return AdminUserDetailResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        expense_count=e.count,
        income_count=i.count,
        total_spent=float(e.total),
        total_earned=float(i.total),
        household_count=household_count,
        is_telegram_linked=user.telegram_chat_id is not None,
        last_activity_at=last_activity,
    )


async def update_user(db: AsyncSession, user_id: int, is_active: bool | None = None) -> bool:
    """사용자 정보 수정 (현재는 활성/비활성 토글만)"""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        return False

    if is_active is not None:
        user.is_active = is_active

    await db.commit()
    return True

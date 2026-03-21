"""Admin 대시보드 서비스

운영 중심 대시보드: 현황 통합 조회, 사용자 관리 로직을 담당합니다.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, literal, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.feedback import Feedback
from app.models.household import Household
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.user import User
from app.schemas.admin import (
    AdminUserDetailResponse,
    AdminUserItem,
    AdminUserListResponse,
    DashboardStatsResponse,
    InactiveUserItem,
    RecentActivityItem,
)


async def get_dashboard_stats(db: AsyncSession) -> DashboardStatsResponse:
    """운영 대시보드 통합 현황 조회"""
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    inactive_threshold = now - timedelta(days=7)

    # 1) 사용자 카운트 (총, 활성, 텔레그램)
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
    telegram_linked_count = row.telegram

    # 2) 오늘 활성 사용자 + 거래 건수
    today_expense = select(Expense.user_id).where(Expense.created_at >= today_start)
    today_income = select(Income.user_id).where(Income.created_at >= today_start)
    today_union = today_expense.union(today_income).subquery()
    today_active_result = await db.execute(select(func.count(func.distinct(today_union.c.user_id))))
    today_active_users = today_active_result.scalar() or 0

    today_tx_result = await db.execute(
        select(
            (
                select(func.count(Expense.id)).where(Expense.created_at >= today_start).scalar_subquery()
                + select(func.count(Income.id)).where(Income.created_at >= today_start).scalar_subquery()
            ).label("total_tx")
        )
    )
    today_transaction_count = today_tx_result.scalar() or 0

    # 3) 미처리 피드백 건수
    pending_fb_result = await db.execute(select(func.count(Feedback.id)).where(Feedback.status == "new"))
    pending_feedback_count = pending_fb_result.scalar() or 0

    # 4) 가구 수
    household_result = await db.execute(select(func.count(Household.id)).where(Household.deleted_at.is_(None)))
    total_households = household_result.scalar() or 0

    # 5) 최근 활동 피드 (최신 20건) — 개별 쿼리 후 Python에서 합치기
    #    SQLite에서 UNION ALL + ORDER BY/LIMIT 서브쿼리 호환 문제 회피
    expense_q = (
        select(
            literal("expense").label("type"),
            User.username.label("username"),
            Expense.description.label("description"),
            Expense.amount.label("amount"),
            Expense.created_at.label("created_at"),
        )
        .join(User, Expense.user_id == User.id)
        .order_by(Expense.created_at.desc())
        .limit(20)
    )

    income_q = (
        select(
            literal("income").label("type"),
            User.username.label("username"),
            Income.description.label("description"),
            Income.amount.label("amount"),
            Income.created_at.label("created_at"),
        )
        .join(User, Income.user_id == User.id)
        .order_by(Income.created_at.desc())
        .limit(20)
    )

    signup_q = (
        select(
            literal("signup").label("type"),
            User.username.label("username"),
            literal("회원가입").label("description"),
            literal_column("NULL").label("amount"),
            User.created_at.label("created_at"),
        )
        .order_by(User.created_at.desc())
        .limit(20)
    )

    feedback_q = (
        select(
            literal("feedback").label("type"),
            User.username.label("username"),
            Feedback.title.label("description"),
            literal_column("NULL").label("amount"),
            Feedback.created_at.label("created_at"),
        )
        .join(User, Feedback.user_id == User.id)
        .order_by(Feedback.created_at.desc())
        .limit(20)
    )

    # 개별 쿼리 실행 후 합치기
    all_activities = []
    for q in [expense_q, income_q, signup_q, feedback_q]:
        result = await db.execute(q)
        all_activities.extend(result.all())

    # created_at 기준 정렬 후 최신 20건
    all_activities.sort(key=lambda r: r.created_at, reverse=True)
    all_activities = all_activities[:20]
    recent_activity = [
        RecentActivityItem(
            type=r.type,
            username=r.username,
            description=r.description or "",
            amount=float(r.amount) if r.amount is not None else None,
            created_at=r.created_at,
        )
        for r in all_activities
    ]

    # 6) 이탈 감지: 활성 사용자 중 7일+ 비활동 (최대 10명)
    last_expense = select(func.max(Expense.created_at)).where(Expense.user_id == User.id).correlate(User).scalar_subquery()
    last_income = select(func.max(Income.created_at)).where(Income.user_id == User.id).correlate(User).scalar_subquery()
    last_activity = case(
        (last_expense.is_(None), last_income),
        (last_income.is_(None), last_expense),
        (last_expense > last_income, last_expense),
        else_=last_income,
    )

    inactive_q = (
        select(
            User.id,
            User.username,
            last_activity.label("last_activity_at"),
        )
        .where(
            User.is_active.is_(True),
            (last_activity < inactive_threshold) | last_activity.is_(None),
        )
        .order_by(last_activity.asc().nulls_first())
        .limit(10)
    )

    inactive_result = await db.execute(inactive_q)
    inactive_users = [
        InactiveUserItem(
            id=r.id,
            username=r.username,
            last_activity_at=r.last_activity_at,
            days_inactive=(now - r.last_activity_at.replace(tzinfo=UTC)).days if r.last_activity_at else 9999,
        )
        for r in inactive_result
    ]

    return DashboardStatsResponse(
        total_users=total_users,
        active_users=active_users,
        telegram_linked_count=telegram_linked_count,
        total_households=total_households,
        today_active_users=today_active_users,
        today_transaction_count=today_transaction_count,
        pending_feedback_count=pending_feedback_count,
        recent_activity=recent_activity,
        inactive_users=inactive_users,
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
    """사용자 상세 정보 조회 — 서브쿼리 단일 쿼리 (#178)"""
    # 모든 통계를 서브쿼리로 묶어 단일 쿼리로 처리 (6쿼리 → 1쿼리)
    expense_count_sq = select(func.count(Expense.id)).where(Expense.user_id == user_id).scalar_subquery()
    expense_total_sq = select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.user_id == user_id).scalar_subquery()
    income_count_sq = select(func.count(Income.id)).where(Income.user_id == user_id).scalar_subquery()
    income_total_sq = select(func.coalesce(func.sum(Income.amount), 0)).where(Income.user_id == user_id).scalar_subquery()
    household_count_sq = (
        select(func.count(HouseholdMember.id))
        .where(
            HouseholdMember.user_id == user_id,
            HouseholdMember.left_at.is_(None),
        )
        .scalar_subquery()
    )
    last_expense_sq = select(func.max(Expense.created_at)).where(Expense.user_id == user_id).scalar_subquery()
    last_income_sq = select(func.max(Income.created_at)).where(Income.user_id == user_id).scalar_subquery()
    last_activity = case(
        (last_expense_sq.is_(None), last_income_sq),
        (last_income_sq.is_(None), last_expense_sq),
        (last_expense_sq > last_income_sq, last_expense_sq),
        else_=last_income_sq,
    )

    result = await db.execute(
        select(
            User,
            expense_count_sq.label("expense_count"),
            expense_total_sq.label("total_spent"),
            income_count_sq.label("income_count"),
            income_total_sq.label("total_earned"),
            household_count_sq.label("household_count"),
            last_activity.label("last_activity_at"),
        ).where(User.id == user_id)
    )
    row = result.one_or_none()
    if not row:
        return None

    return AdminUserDetailResponse(
        id=row.User.id,
        username=row.User.username,
        email=row.User.email,
        is_active=row.User.is_active,
        created_at=row.User.created_at,
        updated_at=row.User.updated_at,
        expense_count=row.expense_count,
        income_count=row.income_count,
        total_spent=float(row.total_spent),
        total_earned=float(row.total_earned),
        household_count=row.household_count,
        is_telegram_linked=row.User.telegram_chat_id is not None,
        last_activity_at=row.last_activity_at,
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

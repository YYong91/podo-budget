"""API 라우터 함수 직접 호출 테스트 — ASGI 트랜스포트 커버리지 누락 우회

AsyncClient를 통한 API 호출은 pytest-cov가 async 함수 본문의 커버리지를
누락시키는 문제가 있습니다. 이 파일에서는 라우터 함수를 직접 호출하여
커버리지를 확보합니다.
"""

from datetime import date, datetime, timedelta
from unittest.mock import MagicMock

import pytest

# ── Helper: 간단한 Depends 우회 ──


class FakeRequest:
    """Rate limiter가 필요한 엔드포인트용 가짜 Request"""

    def __init__(self):
        self.client = MagicMock()
        self.client.host = "127.0.0.1"
        self.state = MagicMock()
        self.scope = {"type": "http"}
        self.app = MagicMock()
        self.url = MagicMock()
        self.headers = {}


# ──────────────────────────────────────────
# expenses.py 직접 호출 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_expenses_get_stats_weekly(db_session, test_user, test_household):
    """주간 지출 통계 직접 호출"""
    from app.api.expenses import get_stats
    from app.models.category import Category
    from app.models.expense import Expense
    from app.schemas.expense import StatsPeriod

    cat = Category(name="식비통계", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=10000,
            description="점심",
            category_id=cat.id,
            date=datetime(today.year, today.month, today.day, 12, 0),
        )
    )
    await db_session.commit()

    result = await get_stats(
        period=StatsPeriod.weekly,
        date=today.isoformat(),
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.period == "weekly"
    assert result.total >= 10000


@pytest.mark.asyncio
async def test_expenses_get_stats_monthly(db_session, test_user, test_household):
    """월간 지출 통계"""
    from app.api.expenses import get_stats
    from app.schemas.expense import StatsPeriod

    result = await get_stats(
        period=StatsPeriod.monthly,
        date=date.today().isoformat(),
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.period == "monthly"


@pytest.mark.asyncio
async def test_expenses_get_stats_yearly(db_session, test_user, test_household):
    """연간 지출 통계 (12포인트 트렌드)"""
    from app.api.expenses import get_stats
    from app.models.expense import Expense
    from app.schemas.expense import StatsPeriod

    today = date.today()
    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=50000,
            description="연간",
            date=datetime(today.year, 3, 15),
        )
    )
    await db_session.commit()

    result = await get_stats(
        period=StatsPeriod.yearly,
        date=today.isoformat(),
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.period == "yearly"
    assert len(result.trend) == 12


@pytest.mark.asyncio
async def test_expenses_comparison_monthly(db_session, test_user, test_household):
    """월별 지출 비교 (과거 완료 월)"""
    from app.api.expenses import get_stats_comparison
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="비교식비", type="expense")
    db_session.add(cat)
    await db_session.flush()

    # 2달 전 데이터
    ref = date.today().replace(day=15)
    past = ref.replace(year=ref.year - 1, month=ref.month + 10) if ref.month <= 2 else ref.replace(month=ref.month - 2)

    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=30000,
            description="과거",
            category_id=cat.id,
            date=datetime(past.year, past.month, 15),
        )
    )
    await db_session.commit()

    result = await get_stats_comparison(
        period="monthly",
        date=past.isoformat(),
        months=3,
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.current is not None
    assert result.previous is not None
    assert result.trend is not None


@pytest.mark.asyncio
async def test_expenses_comparison_yearly(db_session, test_user, test_household):
    """연별 지출 비교"""
    from app.api.expenses import get_stats_comparison

    result = await get_stats_comparison(
        period="yearly",
        date=date.today().isoformat(),
        months=3,
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.current.label.endswith("년")


@pytest.mark.asyncio
async def test_expenses_monthly_stats(db_session, test_user, test_household):
    """월별 지출 상세 통계"""
    from app.api.expenses import get_monthly_stats
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="월별카테", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=25000,
            description="월별",
            category_id=cat.id,
            date=datetime(today.year, today.month, 1),
        )
    )
    await db_session.commit()

    month_str = f"{today.year}-{today.month:02d}"
    result = await get_monthly_stats(
        month=month_str,
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result["month"] == month_str
    assert result["total"] >= 25000


@pytest.mark.asyncio
async def test_expenses_search_summary(db_session, test_user, test_household):
    """검색 요약 직접 호출"""
    from app.api.expenses import get_expenses_search_summary
    from app.models.expense import Expense

    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=8000,
            description="김치찌개검색",
            date=datetime(2026, 3, 15),
        )
    )
    await db_session.commit()

    result = await get_expenses_search_summary(
        query="김치",
        start_date=None,
        end_date=None,
        category_id=None,
        household_id=test_household.id,
        member_user_id=None,
        current_user=test_user,
        db=db_session,
    )
    assert result.total_count >= 1


@pytest.mark.asyncio
async def test_expenses_get_detail(db_session, test_user, test_household):
    """지출 상세 조회"""
    from app.api.expenses import get_expense
    from app.models.expense import Expense

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="상세",
        date=datetime.now(),
    )
    db_session.add(exp)
    await db_session.commit()

    result = await get_expense(expense_id=exp.id, current_user=test_user, db=db_session)
    assert float(result.amount) == 5000


@pytest.mark.asyncio
async def test_expenses_update(db_session, test_user, test_household):
    """지출 수정"""
    from app.api.expenses import update_expense
    from app.models.expense import Expense
    from app.schemas.expense import ExpenseUpdate

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="수정전",
        date=datetime.now(),
    )
    db_session.add(exp)
    await db_session.commit()

    result = await update_expense(
        expense_id=exp.id,
        expense_update=ExpenseUpdate(amount=7000),
        current_user=test_user,
        db=db_session,
    )
    assert float(result.amount) == 7000


@pytest.mark.asyncio
async def test_expenses_delete(db_session, test_user, test_household):
    """지출 삭제"""
    from app.api.expenses import delete_expense
    from app.models.expense import Expense

    exp = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=5000,
        description="삭제용",
        date=datetime.now(),
    )
    db_session.add(exp)
    await db_session.commit()

    await delete_expense(expense_id=exp.id, current_user=test_user, db=db_session)


@pytest.mark.asyncio
async def test_expenses_get_list_with_filters(db_session, test_user, test_household):
    """필터 적용 지출 목록"""
    from app.api.expenses import get_expenses
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="필터직접", type="expense")
    db_session.add(cat)
    await db_session.flush()

    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=8000,
            description="필터대상",
            category_id=cat.id,
            date=datetime(2026, 3, 15),
        )
    )
    await db_session.commit()

    result = await get_expenses(
        skip=0,
        limit=20,
        start_date="2026-03-01",
        end_date="2026-03-31",
        category_id=cat.id,
        household_id=test_household.id,
        member_user_id=test_user.id,
        query="필터",
        current_user=test_user,
        db=db_session,
    )
    assert len(result) >= 1


# ──────────────────────────────────────────
# budget.py 직접 호출 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_budget_create(db_session, test_user, test_household):
    """예산 생성"""
    from app.api.budget import create_budget
    from app.models.category import Category
    from app.schemas.budget import BudgetCreate

    cat = Category(name="예산생성", type="expense")
    db_session.add(cat)
    await db_session.commit()

    result = await create_budget(
        budget_data=BudgetCreate(
            category_id=cat.id,
            amount=500000,
            period="monthly",
            start_date=date.today(),
        ),
        current_user=test_user,
        db=db_session,
    )
    assert float(result.amount) == 500000


@pytest.mark.asyncio
async def test_budget_update_and_delete(db_session, test_user, test_household):
    """예산 수정/삭제"""
    from app.api.budget import delete_budget, update_budget
    from app.models.budget import Budget
    from app.models.category import Category
    from app.schemas.budget import BudgetUpdate

    cat = Category(name="예산수정", type="expense")
    db_session.add(cat)
    await db_session.flush()

    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=cat.id,
        amount=100000,
        period="monthly",
        start_date=datetime(2026, 6, 1),
    )
    db_session.add(budget)
    await db_session.commit()

    result = await update_budget(
        budget_id=budget.id,
        budget_data=BudgetUpdate(amount=200000),
        current_user=test_user,
        db=db_session,
    )
    assert float(result.amount) == 200000

    await delete_budget(budget_id=budget.id, current_user=test_user, db=db_session)


@pytest.mark.asyncio
async def test_budget_monthly_stats(db_session, test_user, test_household):
    """월별 예산 대비 지출 통계"""
    from app.api.budget import get_monthly_stats
    from app.models.budget import Budget
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="예산통계", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    start = datetime(today.year, today.month, 1)

    budget = Budget(
        user_id=test_user.id,
        household_id=test_household.id,
        category_id=cat.id,
        amount=300000,
        period="monthly",
        start_date=start,
    )
    db_session.add(budget)
    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=150000,
            description="예산지출",
            category_id=cat.id,
            date=start,
        )
    )
    await db_session.commit()

    month_str = f"{today.year}-{today.month:02d}"
    result = await get_monthly_stats(
        month=month_str,
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.month == month_str
    assert len(result.categories) >= 1


@pytest.mark.asyncio
async def test_budget_monthly_stats_empty(db_session, test_user, test_household):
    """예산 없을 때 월별 통계"""
    from app.api.budget import get_monthly_stats

    today = date.today()
    month_str = f"{today.year}-{today.month:02d}"
    result = await get_monthly_stats(
        month=month_str,
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.categories == []


@pytest.mark.asyncio
async def test_budget_bulk_save(db_session, test_user, test_household):
    """예산 벌크 저장"""
    from app.api.budget import bulk_save_budgets
    from app.models.category import Category
    from app.schemas.budget import BudgetBulkItem, BudgetBulkSaveRequest

    cat = Category(name="벌크예산", type="expense")
    db_session.add(cat)
    await db_session.commit()

    today = date.today()
    month_str = f"{today.year}-{today.month:02d}"
    result = await bulk_save_budgets(
        data=BudgetBulkSaveRequest(
            month=month_str,
            budgets=[BudgetBulkItem(category_id=cat.id, amount=200000)],
            alert_threshold=0.8,
        ),
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.created >= 1


@pytest.mark.asyncio
async def test_budget_total_budget(db_session, test_user, test_household):
    """총 예산 조회/수정"""
    from app.api.budget import get_total_budget, update_total_budget
    from app.schemas.budget import TotalBudgetUpdate

    result = await get_total_budget(current_user=test_user)
    assert result is not None

    result = await update_total_budget(
        data=TotalBudgetUpdate(amount=2000000),
        current_user=test_user,
        db=db_session,
    )
    assert result.total_monthly_budget == 2000000


# ──────────────────────────────────────────
# income.py 직접 호출 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_income_stats_weekly(db_session, test_user, test_household):
    """주간 수입 통계"""
    from app.api.income import get_income_stats
    from app.models.category import Category
    from app.models.income import Income
    from app.schemas.expense import StatsPeriod

    cat = Category(name="급여수입", type="income")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    db_session.add(
        Income(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=3000000,
            description="월급",
            category_id=cat.id,
            date=datetime(today.year, today.month, today.day),
        )
    )
    await db_session.commit()

    result = await get_income_stats(
        period=StatsPeriod.weekly,
        date=today.isoformat(),
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.period == "weekly"


@pytest.mark.asyncio
async def test_income_stats_yearly(db_session, test_user, test_household):
    """연간 수입 통계 (12포인트)"""
    from app.api.income import get_income_stats
    from app.schemas.expense import StatsPeriod

    result = await get_income_stats(
        period=StatsPeriod.yearly,
        date=date.today().isoformat(),
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.period == "yearly"
    assert len(result.trend) == 12


@pytest.mark.asyncio
async def test_income_search_summary(db_session, test_user, test_household):
    """수입 검색 요약"""
    from app.api.income import get_incomes_search_summary

    result = await get_incomes_search_summary(
        query=None,
        start_date=None,
        end_date=None,
        category_id=None,
        household_id=test_household.id,
        member_user_id=None,
        current_user=test_user,
        db=db_session,
    )
    assert result.total_count >= 0


@pytest.mark.asyncio
async def test_income_crud(db_session, test_user, test_household):
    """수입 CRUD"""
    from app.api.income import delete_income, get_income, update_income
    from app.models.income import Income
    from app.schemas.income import IncomeUpdate

    inc = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=100000,
        description="직접수입",
        date=datetime.now(),
    )
    db_session.add(inc)
    await db_session.commit()

    # 상세
    result = await get_income(income_id=inc.id, current_user=test_user, db=db_session)
    assert float(result.amount) == 100000

    # 수정
    result = await update_income(
        income_id=inc.id,
        income_update=IncomeUpdate(amount=200000),
        current_user=test_user,
        db=db_session,
    )
    assert float(result.amount) == 200000

    # 삭제
    await delete_income(income_id=inc.id, current_user=test_user, db=db_session)


@pytest.mark.asyncio
async def test_income_list_with_filters(db_session, test_user, test_household):
    """수입 목록 필터"""
    from app.api.income import get_incomes
    from app.models.income import Income

    db_session.add(
        Income(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=1000000,
            description="필터수입",
            date=datetime(2026, 3, 15),
        )
    )
    await db_session.commit()

    result = await get_incomes(
        skip=0,
        limit=20,
        start_date="2026-03-01",
        end_date="2026-03-31",
        category_id=None,
        household_id=test_household.id,
        member_user_id=None,
        query="필터",
        current_user=test_user,
        db=db_session,
    )
    assert len(result) >= 1


# ──────────────────────────────────────────
# categories.py 직접 호출 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_categories_crud(db_session, test_user, test_household):
    """카테고리 CRUD 직접 호출"""
    from app.api.categories import create_category, delete_category, get_categories, update_category
    from app.schemas.category import CategoryCreate, CategoryUpdate

    # 생성
    result = await create_category(
        category=CategoryCreate(name="직접카테", type="expense"),
        current_user=test_user,
        db=db_session,
    )
    cat_id = result.id

    # 목록
    cats = await get_categories(type="expense", current_user=test_user, db=db_session)
    assert len(cats) >= 1

    # 수정
    result = await update_category(
        category_id=cat_id,
        category=CategoryUpdate(name="수정카테"),
        current_user=test_user,
        db=db_session,
    )
    assert result.name == "수정카테"

    # 삭제
    await delete_category(category_id=cat_id, current_user=test_user, db=db_session)


@pytest.mark.asyncio
async def test_categories_reorder(db_session, test_user, test_household):
    """카테고리 순서 변경"""
    from app.api.categories import create_category, reorder_categories
    from app.schemas.category import CategoryCreate, CategoryReorderRequest

    cat1 = await create_category(
        category=CategoryCreate(name="순서A", type="expense"),
        current_user=test_user,
        db=db_session,
    )
    cat2 = await create_category(
        category=CategoryCreate(name="순서B", type="expense"),
        current_user=test_user,
        db=db_session,
    )

    result = await reorder_categories(
        request=CategoryReorderRequest(category_ids=[cat2.id, cat1.id]),
        current_user=test_user,
        db=db_session,
    )
    assert len(result) >= 2


# ──────────────────────────────────────────
# recurring.py 직접 호출 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_recurring_crud(db_session, test_user, test_household):
    """정기 거래 CRUD"""
    from app.api.recurring import create_recurring, delete_recurring, get_recurring, get_recurring_list, update_recurring
    from app.schemas.recurring_transaction import RecurringTransactionCreate, RecurringTransactionUpdate

    today = date.today()
    result = await create_recurring(
        data=RecurringTransactionCreate(
            type="expense",
            amount=50000,
            description="정기직접",
            frequency="monthly",
            day_of_month=15,
            start_date=today,
        ),
        current_user=test_user,
        db=db_session,
    )
    rec_id = result.id

    # 목록
    items = await get_recurring_list(
        type="expense",
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert len(items) >= 1

    # 상세
    item = await get_recurring(recurring_id=rec_id, current_user=test_user, db=db_session)
    assert float(item.amount) == 50000

    # 수정
    result = await update_recurring(
        recurring_id=rec_id,
        data=RecurringTransactionUpdate(amount=60000),
        current_user=test_user,
        db=db_session,
    )
    assert float(result.amount) == 60000

    # 삭제
    await delete_recurring(recurring_id=rec_id, current_user=test_user, db=db_session)


@pytest.mark.asyncio
async def test_recurring_pending(db_session, test_user, test_household):
    """대기 정기 거래"""
    from app.api.recurring import get_pending_recurring

    result = await get_pending_recurring(
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_recurring_execute(db_session, test_user, test_household):
    """정기 거래 실행"""
    from app.api.recurring import execute_recurring_transaction
    from app.models.recurring_transaction import RecurringTransaction

    today = date.today()
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="expense",
        amount=30000,
        description="실행직접",
        frequency="monthly",
        day_of_month=1,
        start_date=today - timedelta(days=30),
        next_due_date=today,
        is_active=True,
    )
    db_session.add(rec)
    await db_session.commit()

    result = await execute_recurring_transaction(
        recurring_id=rec.id,
        current_user=test_user,
        db=db_session,
    )
    assert result.created_id is not None


@pytest.mark.asyncio
async def test_recurring_skip(db_session, test_user, test_household):
    """정기 거래 건너뛰기"""
    from app.api.recurring import skip_recurring_transaction
    from app.models.recurring_transaction import RecurringTransaction

    today = date.today()
    rec = RecurringTransaction(
        user_id=test_user.id,
        household_id=test_household.id,
        type="income",
        amount=20000,
        description="건너뛰기직접",
        frequency="monthly",
        day_of_month=1,
        start_date=today,
        next_due_date=today,
        is_active=True,
    )
    db_session.add(rec)
    await db_session.commit()

    result = await skip_recurring_transaction(
        recurring_id=rec.id,
        current_user=test_user,
        db=db_session,
    )
    assert "next_due_date" in result


# ──────────────────────────────────────────
# invitations.py 직접 호출 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_invitation_my_list(db_session, test_user, test_household):
    """내 초대 목록"""
    from app.api.invitations import list_my_invitations

    result = await list_my_invitations(current_user=test_user, db=db_session)
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_invitation_accept(db_session, test_user, test_household):
    """초대 수락"""
    import uuid

    from app.api.invitations import accept_invitation
    from app.models.household import Household
    from app.models.household_invitation import HouseholdInvitation
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other_hh = Household(name="수락가구")
    db_session.add(other_hh)
    await db_session.flush()

    inviter = User(auth_user_id="inv-dir-001", username="dirinviter", email="dirinviter@test.com", is_active=True)
    db_session.add(inviter)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=other_hh.id, user_id=inviter.id, role="owner"))

    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=other_hh.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    result = await accept_invitation(token=token, current_user=test_user, db=db_session)
    assert result.status == "accepted"


@pytest.mark.asyncio
async def test_invitation_reject(db_session, test_user, test_household):
    """초대 거절"""
    import uuid

    from app.api.invitations import reject_invitation
    from app.models.household import Household
    from app.models.household_invitation import HouseholdInvitation
    from app.models.household_member import HouseholdMember
    from app.models.user import User

    other_hh = Household(name="거절가구")
    db_session.add(other_hh)
    await db_session.flush()

    inviter = User(auth_user_id="inv-rej-dir", username="rejdirinv", email="rejdirinv@test.com", is_active=True)
    db_session.add(inviter)
    await db_session.flush()
    db_session.add(HouseholdMember(household_id=other_hh.id, user_id=inviter.id, role="owner"))

    token = str(uuid.uuid4())
    inv = HouseholdInvitation(
        household_id=other_hh.id,
        inviter_id=inviter.id,
        invitee_email=test_user.email,
        invitee_user_id=test_user.id,
        token=token,
        role="member",
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(inv)
    await db_session.commit()

    result = await reject_invitation(token=token, current_user=test_user, db=db_session)
    assert result.status == "rejected"


# ──────────────────────────────────────────
# insights.py 직접 호출 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_insights_generate(db_session, test_user, test_household, mock_llm_generate_insights):
    """인사이트 생성 (데이터 있음)"""
    from app.api.insights import generate_insights
    from app.models.category import Category
    from app.models.expense import Expense

    cat = Category(name="인사이트직접", type="expense")
    db_session.add(cat)
    await db_session.flush()

    today = date.today()
    db_session.add(
        Expense(
            user_id=test_user.id,
            household_id=test_household.id,
            amount=100000,
            description="인사이트지출",
            category_id=cat.id,
            date=datetime(today.year, today.month, 15),
        )
    )
    await db_session.commit()

    month_str = f"{today.year}-{today.month:02d}"
    result = await generate_insights(
        request=FakeRequest(),
        month=month_str,
        household_id=test_household.id,
        current_user=test_user,
        db=db_session,
    )
    assert result["month"] == month_str


# ──────────────────────────────────────────
# onboarding.py 직접 호출 테스트
# ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_onboarding_status(db_session, test_user, test_household):
    """온보딩 상태"""
    from app.api.onboarding import get_onboarding_status

    result = await get_onboarding_status(current_user=test_user, db=db_session)
    assert result.has_household is True


@pytest.mark.asyncio
async def test_onboarding_create_household(db_session, test_user, test_household):
    """온보딩 가구 생성 — 이미 있으면 409"""
    from fastapi import HTTPException

    from app.api.onboarding import create_default_household
    from app.schemas.onboarding import CreateDefaultHousehold

    with pytest.raises(HTTPException) as exc_info:
        await create_default_household(
            body=CreateDefaultHousehold(),
            current_user=test_user,
            db=db_session,
        )
    assert exc_info.value.status_code == 409

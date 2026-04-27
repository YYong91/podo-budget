# 월간 결산 리포트 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 매월 1일 자동으로 전월 결산 리포트를 생성하고 앱 내에서 콘텐츠 객체로 제공한다.

**Architecture:** Supabase pg_cron이 매월 1일 03:00 KST에 webhook을 호출하면, Phase 1에서 자격 통과 가구의 pending row를 생성하고 FastAPI BackgroundTasks로 Phase 2를 실행한다. Phase 2는 `SELECT FOR UPDATE SKIP LOCKED`로 원자적으로 픽업한 뒤 Semaphore(5)로 병렬 LLM 호출을 관리한다. 결과는 `MonthlyReport` 테이블에 영구 저장된다.

**Tech Stack:** FastAPI BackgroundTasks, SQLAlchemy 2.0 async, Supabase pg_cron + pg_net, HMAC-SHA256, Anthropic LLM, React Query polling, Vitest + MSW

**설계 문서:** `docs/plans/2026-04-26-monthly-report-design.md`

---

## Task 1: MonthlyReport 모델 + Alembic 마이그레이션

**Files:**
- Create: `backend/app/models/monthly_report.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/household.py`
- Create: `backend/alembic/versions/<hash>_add_monthly_reports.py`

### Step 1: MonthlyReport 모델 작성

```python
# backend/app/models/monthly_report.py
"""월간 결산 리포트 엔티티"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Index, JSON, String, Text, UniqueConstraint, func
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.household import Household


class MonthlyReport(Base):  # type: ignore[misc]
    """가구별 월간 결산 리포트

    매월 1일 03:00 KST에 자동 생성된다.
    한 가구는 한 달에 하나의 리포트만 가질 수 있다 (unique constraint).
    """

    __tablename__ = "monthly_reports"

    id: Mapped[int] = mapped_column(primary_key=True)

    # ── 식별 ──
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    month: Mapped[str] = mapped_column(
        String(7), nullable=False,
        comment="YYYY-MM 형식 (예: 2026-04)",
    )

    # ── 상태 머신 ──
    status: Mapped[str] = mapped_column(
        String(15), nullable=False, default="pending",
        comment="pending | processing | completed | failed",
    )
    attempt_count: Mapped[int] = mapped_column(
        default=0, nullable=False,
        comment="LLM 호출 시도 횟수. 0=Phase 1 완료, 1+=Phase 2 시도",
    )
    last_error: Mapped[str | None] = mapped_column(
        String(2000), nullable=True,
        comment="마지막 실패 사유 (2000자 truncate)",
    )
    trigger_source: Mapped[str] = mapped_column(
        String(15), nullable=False, default="auto",
        comment="auto | admin | retry",
    )

    # ── 데이터 스냅샷 ──
    report_data: Mapped[dict] = mapped_column(
        JSON, nullable=False,
        comment="분석 시점의 입력 스냅샷. 이후 거래 변경과 무관하게 불변.",
    )
    insights: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment="LLM 출력 (StructuredInsightsResponse 구조). completed 시에만 채워짐.",
    )
    insights_version: Mapped[int] = mapped_column(
        default=1, nullable=False,
        comment="LLM 출력 스키마 버전. 스키마 변경 시 증가하여 하위 호환 처리 기준으로 사용.",
    )

    # ── 메타 ──
    llm_tokens_used: Mapped[int | None] = mapped_column(nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(),
        server_default=func.now(), nullable=False,
    )

    household: Mapped["Household"] = relationship(back_populates="monthly_reports")

    __table_args__ = (
        UniqueConstraint(
            "household_id", "month",
            name="uq_monthly_report_household_month",
        ),
        Index("ix_monthly_reports_month_status", "month", "status"),
    )

    def __repr__(self) -> str:
        return f"<MonthlyReport(id={self.id}, household_id={self.household_id}, month={self.month}, status={self.status})>"
```

### Step 2: `__init__.py`에 MonthlyReport 추가

`backend/app/models/__init__.py`에서 다른 모델들이 import되는 패턴을 따라 추가:
```python
from app.models.monthly_report import MonthlyReport  # noqa: F401
```

### Step 3: Household 모델에 relationship 추가

`backend/app/models/household.py`에서 기존 relationships 블록 끝에 추가:
```python
# 파일 상단 TYPE_CHECKING 블록에 추가
if TYPE_CHECKING:
    from app.models.monthly_report import MonthlyReport

# relationships 블록에 추가
monthly_reports: Mapped[list["MonthlyReport"]] = relationship(
    back_populates="household",
    cascade="all, delete-orphan",
)
```

### Step 4: Alembic 마이그레이션 생성

```bash
cd backend
alembic revision --autogenerate -m "add_monthly_reports"
```

생성된 파일에서 `upgrade()`/`downgrade()` 검토 — 테이블 생성, unique constraint, index가 포함됐는지 확인.

### Step 5: 마이그레이션 적용 확인

```bash
cd backend
alembic upgrade head
```

Expected: `Running upgrade ... -> <hash>, add_monthly_reports`

### Step 6: 커밋

```bash
git add backend/app/models/monthly_report.py \
        backend/app/models/__init__.py \
        backend/app/models/household.py \
        backend/alembic/versions/*add_monthly_reports.py
git commit -m "feat: MonthlyReport 모델 + Alembic 마이그레이션 추가"
```

---

## Task 2: 환경변수 + 설정 추가

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/.env.example`

### Step 1: config.py에 신규 설정 추가

`backend/app/core/config.py`의 `Settings` 클래스에서 기존 `SENTRY_WEBHOOK_SECRET` 근처에 추가:

```python
# 월간 결산 리포트
MONTHLY_REPORT_WEBHOOK_SECRET: str = ""   # Supabase pg_cron → webhook HMAC 시크릿
MONTHLY_REPORT_AUTO_ENABLED: bool = True  # False이면 webhook 수신해도 실행 안 함 (dev용)
MONTHLY_REPORT_MAX_PER_RUN: int = 500     # Phase 2 최대 처리 가구 수 (비용 안전장치)
```

### Step 2: `.env.example`에 추가

```bash
# 월간 결산 리포트
MONTHLY_REPORT_WEBHOOK_SECRET=your-hmac-secret-here
MONTHLY_REPORT_AUTO_ENABLED=true
MONTHLY_REPORT_MAX_PER_RUN=500
```

로컬 `backend/.env`에도 동일하게 추가 (MONTHLY_REPORT_AUTO_ENABLED=false로 설정).

### Step 3: 커밋

```bash
git add backend/app/core/config.py backend/.env.example
git commit -m "feat: 월간 결산 리포트 환경변수 설정 추가"
```

---

## Task 3: 웹훅 인증 + 월/시간대 헬퍼

**Files:**
- Create: `backend/app/core/webhook_auth.py`
- Create: `backend/app/services/report_month_utils.py`
- Create: `backend/tests/unit/test_report_month_utils.py`

### Step 1: 웹훅 인증 모듈 작성

```python
# backend/app/core/webhook_auth.py
"""HMAC-SHA256 기반 웹훅 서명 검증"""

import hashlib
import hmac

from fastapi import HTTPException, Request

from app.core.config import settings


def verify_monthly_report_webhook(request: Request) -> None:
    """Supabase pg_net이 전송한 HMAC 서명 검증

    Raises:
        HTTPException: 서명 불일치 시 401
    """
    if not settings.MONTHLY_REPORT_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Webhook secret not configured")

    received = request.headers.get("x-webhook-signature", "")
    expected = hmac.new(
        settings.MONTHLY_REPORT_WEBHOOK_SECRET.encode(),
        b"monthly-report-trigger",
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(received, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
```

### Step 2: 월/시간대 헬퍼 작성 (실패 테스트 먼저)

```python
# backend/tests/unit/test_report_month_utils.py
from datetime import date
import pytest
from app.services.report_month_utils import (
    previous_month_kst,
    month_boundaries,
    month_str_from_date,
)


def test_previous_month_kst_returns_yyyy_mm():
    result = previous_month_kst()
    assert len(result) == 7
    assert result[4] == "-"


def test_month_boundaries_april():
    start, end = month_boundaries("2026-04")
    assert start == date(2026, 4, 1)
    assert end == date(2026, 5, 1)


def test_month_boundaries_december():
    start, end = month_boundaries("2026-12")
    assert start == date(2026, 12, 1)
    assert end == date(2027, 1, 1)


def test_month_str_from_date():
    assert month_str_from_date(date(2026, 4, 15)) == "2026-04"
    assert month_str_from_date(date(2026, 1, 1)) == "2026-01"
```

### Step 3: 테스트 실패 확인

```bash
cd backend && pytest tests/unit/test_report_month_utils.py -v
```
Expected: FAIL (ImportError)

### Step 4: 헬퍼 구현

```python
# backend/app/services/report_month_utils.py
"""월간 결산 리포트용 날짜/시간대 헬퍼"""

from datetime import date, datetime, timezone, timedelta


_KST = timezone(timedelta(hours=9))


def previous_month_kst() -> str:
    """현재 KST 기준 직전 마감 월을 YYYY-MM 형식으로 반환"""
    now_kst = datetime.now(_KST)
    if now_kst.month == 1:
        return f"{now_kst.year - 1}-12"
    return f"{now_kst.year}-{now_kst.month - 1:02d}"


def month_boundaries(month: str) -> tuple[date, date]:
    """YYYY-MM → (시작일 inclusive, 종료일 exclusive) 반환"""
    year, mon = map(int, month.split("-"))
    start = date(year, mon, 1)
    if mon == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, mon + 1, 1)
    return start, end


def month_str_from_date(d: date) -> str:
    """date → YYYY-MM 형식"""
    return f"{d.year}-{d.month:02d}"
```

### Step 5: 테스트 통과 확인

```bash
cd backend && pytest tests/unit/test_report_month_utils.py -v
```
Expected: 4 passed

### Step 6: 커밋

```bash
git add backend/app/core/webhook_auth.py \
        backend/app/services/report_month_utils.py \
        backend/tests/unit/test_report_month_utils.py
git commit -m "feat: 월간 결산 웹훅 인증 + 날짜 헬퍼 추가"
```

---

## Task 4: 자격 검증 서비스

**Files:**
- Create: `backend/app/services/report_eligibility.py`
- Create: `backend/tests/integration/test_report_eligibility.py`

### Step 1: 실패 테스트 작성

```python
# backend/tests/integration/test_report_eligibility.py
"""자격 검증 서비스 통합 테스트"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.household_profile import HouseholdProfile
from app.services.report_eligibility import find_eligible_households, check_household_eligibility


@pytest.mark.asyncio
async def test_eligible_with_sufficient_data(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    # HouseholdProfile 생성
    profile = HouseholdProfile(
        household_id=test_household.id,
        household_type="single",
        housing_type="monthly_rent",
        income_types=["salary"],
        age_range="30s",
    )
    db_session.add(profile)

    # 거래 15건, 카테고리 3개, 지출 20만원 이상
    for i in range(15):
        db_session.add(Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=20000,
            description=f"지출 {i}",
            date=__import__('datetime').date(2026, 3, i + 1),
            category_id=(i % 3) + 1,  # 3개 카테고리 순환
        ))
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id in result


@pytest.mark.asyncio
async def test_ineligible_no_profile(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """프로필 없는 가구는 자격 미달"""
    for i in range(20):
        db_session.add(Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=20000,
            description=f"지출 {i}",
            date=__import__('datetime').date(2026, 3, i + 1),
            category_id=(i % 4) + 1,
        ))
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id not in result


@pytest.mark.asyncio
async def test_ineligible_below_transaction_threshold(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """거래 14건이면 미달 (임계값 15건)"""
    profile = HouseholdProfile(
        household_id=test_household.id,
        household_type="single",
        housing_type="monthly_rent",
        income_types=["salary"],
        age_range="30s",
    )
    db_session.add(profile)
    for i in range(14):
        db_session.add(Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=20000,
            description=f"지출 {i}",
            date=__import__('datetime').date(2026, 3, i + 1),
            category_id=(i % 4) + 1,
        ))
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id not in result


@pytest.mark.asyncio
async def test_exclude_from_stats_not_counted(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """exclude_from_stats=True 거래는 임계값 카운트에서 제외"""
    profile = HouseholdProfile(
        household_id=test_household.id,
        household_type="single",
        housing_type="monthly_rent",
        income_types=["salary"],
        age_range="30s",
    )
    db_session.add(profile)
    # 실제 거래 10건 + exclude 거래 5건 = 합계 15건이지만 자격은 미달이어야 함
    for i in range(10):
        db_session.add(Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=20000,
            description=f"지출 {i}",
            date=__import__('datetime').date(2026, 3, i + 1),
            category_id=(i % 4) + 1,
        ))
    for i in range(5):
        db_session.add(Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=100000,
            description=f"제외 지출 {i}",
            date=__import__('datetime').date(2026, 3, i + 1),
            category_id=1,
            exclude_from_stats=True,
        ))
    await db_session.commit()

    result = await find_eligible_households(db_session, "2026-03")
    assert test_household.id not in result


@pytest.mark.asyncio
async def test_check_household_eligibility_returns_detail(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """check_household_eligibility는 상세 blocker 정보를 반환한다"""
    # 프로필 없음
    result = await check_household_eligibility(db_session, test_household.id, "2026-03")
    assert result.is_eligible is False
    assert result.blocker == "profile_missing"
```

### Step 2: 테스트 실패 확인

```bash
cd backend && pytest tests/integration/test_report_eligibility.py -v
```
Expected: FAIL (ImportError)

### Step 3: 서비스 구현

```python
# backend/app/services/report_eligibility.py
"""월간 결산 리포트 자격 검증 서비스"""

import logging
from dataclasses import dataclass
from datetime import date
from typing import Literal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.household import Household
from app.models.household_profile import HouseholdProfile
from app.services.report_month_utils import month_boundaries

logger = logging.getLogger(__name__)

# 자격 임계값 상수
MIN_TRANSACTIONS = 15
MIN_CATEGORIES = 3
MIN_SPEND = 200_000


@dataclass
class EligibilityResult:
    has_profile: bool
    transaction_count: int
    category_count: int
    total_spend: float
    is_eligible: bool
    blocker: Literal[
        "profile_missing",
        "transactions_short",
        "categories_short",
        "spend_short",
        None,
    ]

    @property
    def transactions_needed(self) -> int:
        return max(0, MIN_TRANSACTIONS - self.transaction_count)


async def find_eligible_households(
    db: AsyncSession, month: str
) -> list[int]:
    """자격 통과 가구 ID 목록 반환 (단일 SQL)"""
    start, end = month_boundaries(month)

    result = await db.execute(
        select(Household.id)
        .join(HouseholdProfile, HouseholdProfile.household_id == Household.id)
        .outerjoin(
            Expense,
            and_(
                Expense.household_id == Household.id,
                Expense.date >= start,
                Expense.date < end,
                Expense.exclude_from_stats == False,  # noqa: E712
            ),
        )
        .group_by(Household.id)
        .having(
            func.count(Expense.id) >= MIN_TRANSACTIONS,
            func.count(func.distinct(Expense.category_id)) >= MIN_CATEGORIES,
            func.coalesce(func.sum(Expense.amount), 0) >= MIN_SPEND,
        )
    )
    ids = [row[0] for row in result.all()]
    logger.info("[eligibility] 자격 통과 가구 %d개 (월: %s)", len(ids), month)
    return ids


async def check_household_eligibility(
    db: AsyncSession, household_id: int, month: str
) -> EligibilityResult:
    """단일 가구의 자격 상세 정보 반환 (사용자 안내용)"""
    start, end = month_boundaries(month)

    # 프로필 확인
    profile = await db.scalar(
        select(HouseholdProfile).where(
            HouseholdProfile.household_id == household_id
        )
    )
    if not profile:
        return EligibilityResult(
            has_profile=False,
            transaction_count=0,
            category_count=0,
            total_spend=0.0,
            is_eligible=False,
            blocker="profile_missing",
        )

    # 거래 집계
    row = await db.execute(
        select(
            func.count(Expense.id).label("tx_count"),
            func.count(func.distinct(Expense.category_id)).label("cat_count"),
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        ).where(
            Expense.household_id == household_id,
            Expense.date >= start,
            Expense.date < end,
            Expense.exclude_from_stats == False,  # noqa: E712
        )
    )
    stats = row.one()
    tx_count = stats.tx_count
    cat_count = stats.cat_count
    total = float(stats.total)

    blocker = None
    if tx_count < MIN_TRANSACTIONS:
        blocker = "transactions_short"
    elif cat_count < MIN_CATEGORIES:
        blocker = "categories_short"
    elif total < MIN_SPEND:
        blocker = "spend_short"

    return EligibilityResult(
        has_profile=True,
        transaction_count=tx_count,
        category_count=cat_count,
        total_spend=total,
        is_eligible=blocker is None,
        blocker=blocker,
    )
```

### Step 4: 테스트 통과 확인

```bash
cd backend && pytest tests/integration/test_report_eligibility.py -v
```
Expected: 5 passed

### Step 5: 커밋

```bash
git add backend/app/services/report_eligibility.py \
        backend/tests/integration/test_report_eligibility.py
git commit -m "feat: 결산 리포트 자격 검증 서비스 추가"
```

---

## Task 5: report_data_builder 서비스

**Files:**
- Create: `backend/app/services/report_data_builder.py`
- Create: `backend/tests/integration/test_report_data_builder.py`

이 서비스는 기존에 프론트엔드(`InsightsPage.tsx`)가 7~8개 API를 호출해 조립하던 데이터를 백엔드에서 직접 집계한다. **단계 1의 가장 큰 작업량이다.**

`financial_score` 계산 로직은 `frontend/src/utils/financialScore.ts`를 참고하여 Python으로 포팅한다.

### Step 1: 실패 테스트 작성

```python
# backend/tests/integration/test_report_data_builder.py
"""report_data_builder 통합 테스트"""

import pytest
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.income import Income
from app.services.report_data_builder import build_report_data


@pytest.mark.asyncio
async def test_build_report_data_basic(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """기본 집계 — expense_total, income_total, top_expense_categories"""
    # 지출 3건 (카테고리 각 1, 2, 3)
    for cat_id, amount in [(1, 50000), (2, 30000), (3, 20000)]:
        db_session.add(Expense(
            household_id=test_household.id,
            user_id=test_user.id,
            amount=amount,
            description="지출",
            date=date(2026, 3, 1),
            category_id=cat_id,
        ))
    # 수입 1건
    db_session.add(Income(
        household_id=test_household.id,
        user_id=test_user.id,
        amount=500000,
        description="월급",
        date=date(2026, 3, 5),
        category_id=None,
    ))
    await db_session.commit()

    data = await build_report_data(db_session, test_household.id, "2026-03")

    assert data["expense_total"] == 100000.0
    assert data["income_total"] == 500000.0
    assert len(data["top_expense_categories"]) == 3
    assert data["savings_rate"] == pytest.approx(80.0, abs=0.1)


@pytest.mark.asyncio
async def test_build_report_data_excludes_stats_excluded(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """exclude_from_stats=True 거래는 합계에서 제외"""
    db_session.add(Expense(
        household_id=test_household.id,
        user_id=test_user.id,
        amount=100000,
        description="일반 지출",
        date=date(2026, 3, 1),
        category_id=1,
    ))
    db_session.add(Expense(
        household_id=test_household.id,
        user_id=test_user.id,
        amount=1000000,
        description="통계 제외",
        date=date(2026, 3, 2),
        category_id=1,
        exclude_from_stats=True,
    ))
    await db_session.commit()

    data = await build_report_data(db_session, test_household.id, "2026-03")
    assert data["expense_total"] == 100000.0


@pytest.mark.asyncio
async def test_build_report_data_previous_month(
    db_session: AsyncSession,
    test_household,
    test_user,
):
    """전월 비교 데이터가 포함된다"""
    # 2월 지출
    db_session.add(Expense(
        household_id=test_household.id,
        user_id=test_user.id,
        amount=80000,
        description="2월 지출",
        date=date(2026, 2, 10),
        category_id=1,
    ))
    # 3월 지출
    db_session.add(Expense(
        household_id=test_household.id,
        user_id=test_user.id,
        amount=100000,
        description="3월 지출",
        date=date(2026, 3, 10),
        category_id=1,
    ))
    await db_session.commit()

    data = await build_report_data(db_session, test_household.id, "2026-03")
    assert data["previous_month_expense"] == 80000.0
```

### Step 2: 테스트 실패 확인

```bash
cd backend && pytest tests/integration/test_report_data_builder.py -v
```
Expected: FAIL (ImportError)

### Step 3: 서비스 구현

```python
# backend/app/services/report_data_builder.py
"""월간 결산 리포트 데이터 집계 서비스

기존 InsightsPage.tsx가 7~8개 API를 호출해 조립하던 로직을 백엔드로 이관.
ComprehensiveInsightsRequest 스키마와 호환되는 dict를 반환한다.
"""

import logging
from datetime import date

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.income import Income
from app.models.recurring_transaction import RecurringTransaction
from app.services.report_month_utils import month_boundaries, month_str_from_date

logger = logging.getLogger(__name__)


async def build_report_data(
    db: AsyncSession, household_id: int, month: str
) -> dict:
    """ComprehensiveInsightsRequest 호환 dict 생성"""
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

    savings_rate = (
        (income_total - expense_total) / income_total * 100
        if income_total > 0
        else 0.0
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
        # financial_score는 복잡한 계산이므로 별도 함수로 분리
        "financial_score": _calc_financial_score(
            income_total=income_total,
            expense_total=expense_total,
            savings_total=savings_total,
            budget=budget,
            trend=trend,
        ),
    }


async def _sum_expenses(
    db: AsyncSession, household_id: int, start: date, end: date
) -> float:
    result = await db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.household_id == household_id,
            Expense.date >= start,
            Expense.date < end,
            Expense.exclude_from_stats == False,  # noqa: E712
        )
    )
    return float(result)  # type: ignore[arg-type]


async def _sum_income(
    db: AsyncSession, household_id: int, start: date, end: date
) -> float:
    result = await db.scalar(
        select(func.coalesce(func.sum(Income.amount), 0)).where(
            Income.household_id == household_id,
            Income.date >= start,
            Income.date < end,
            Income.exclude_from_stats == False,  # noqa: E712
        )
    )
    return float(result)  # type: ignore[arg-type]


async def _top_expense_categories(
    db: AsyncSession,
    household_id: int,
    start: date,
    end: date,
    expense_total: float,
    limit: int = 5,
) -> list[dict]:
    rows = await db.execute(
        select(
            Category.name,
            func.sum(Expense.amount).label("amount"),
        )
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(
            Expense.household_id == household_id,
            Expense.date >= start,
            Expense.date < end,
            Expense.exclude_from_stats == False,  # noqa: E712
        )
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc())
        .limit(limit)
    )
    total = expense_total or 1.0
    return [
        {
            "name": row.name or "미분류",
            "amount": float(row.amount),
            "percentage": round(float(row.amount) / total * 100, 1),
        }
        for row in rows.all()
    ]


async def _budget_summary(
    db: AsyncSession, household_id: int, start: date, end: date
) -> dict | None:
    budgets = await db.scalars(
        select(Budget).where(Budget.household_id == household_id)
    )
    budget_list = list(budgets)
    if not budget_list:
        return None

    total_budget = sum(float(b.amount) for b in budget_list)

    # 예산 초과 카테고리 이름 조회
    over_result = await db.execute(
        select(Category.name)
        .join(Budget, Budget.category_id == Category.id)
        .join(
            select(
                Expense.category_id,
                func.sum(Expense.amount).label("spent"),
            )
            .where(
                Expense.household_id == household_id,
                Expense.date >= start,
                Expense.date < end,
                Expense.exclude_from_stats == False,  # noqa: E712
            )
            .group_by(Expense.category_id)
            .subquery(),
            Budget.category_id == func.column("category_id"),
            isouter=True,
        )
        .where(
            Budget.household_id == household_id,
            func.column("spent") > Budget.amount,
        )
    )
    over_categories = [row[0] for row in over_result.all()]

    # 총 지출 (예산 관련 카테고리)
    spent_result = await db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.household_id == household_id,
            Expense.date >= start,
            Expense.date < end,
            Expense.exclude_from_stats == False,  # noqa: E712
        )
    )

    return {
        "total_budget": total_budget,
        "total_spent": float(spent_result),  # type: ignore[arg-type]
        "over_categories": over_categories,
    }


async def _expense_income_trend(
    db: AsyncSession, household_id: int, current_month: str, months: int = 3
) -> list[dict]:
    """직전 N개월 income/expense 트렌드"""
    result = []
    year, mon = map(int, current_month.split("-"))
    for i in range(months, 0, -1):
        m = mon - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        m_str = f"{y}-{m:02d}"
        s, e = month_boundaries(m_str)
        exp = await _sum_expenses(db, household_id, s, e)
        inc = await _sum_income(db, household_id, s, e)
        result.append({"month": m_str, "income": inc, "expense": exp})
    return result


async def _savings_total(
    db: AsyncSession, household_id: int, start: date, end: date
) -> float | None:
    """is_savings=True인 수입 카테고리 합계 (저축 카테고리 없으면 None)"""
    result = await db.scalar(
        select(func.coalesce(func.sum(Income.amount), 0))
        .join(Category, Income.category_id == Category.id, isouter=True)
        .where(
            Income.household_id == household_id,
            Income.date >= start,
            Income.date < end,
            Category.type == "savings",
        )
    )
    if result == 0:
        # 저축 카테고리가 아예 없을 수도 있음 — None 반환
        has_savings_cat = await db.scalar(
            select(func.count(Category.id)).where(
                Category.household_id == household_id,
                Category.type == "savings",
            )
        )
        if not has_savings_cat:
            return None
    return float(result)  # type: ignore[arg-type]


async def _recurring_total(
    db: AsyncSession, household_id: int, start: date, end: date
) -> float | None:
    result = await db.scalar(
        select(func.coalesce(func.sum(RecurringTransaction.amount), 0)).where(
            RecurringTransaction.household_id == household_id,
            RecurringTransaction.next_date >= start,
            RecurringTransaction.next_date < end,
        )
    )
    return float(result) if result else None  # type: ignore[arg-type]


def _previous_month(month: str) -> str:
    year, mon = map(int, month.split("-"))
    if mon == 1:
        return f"{year - 1}-12"
    return f"{year}-{mon - 1:02d}"


def _calc_financial_score(
    income_total: float,
    expense_total: float,
    savings_total: float | None,
    budget: dict | None,
    trend: list[dict],
) -> dict:
    """재무 점수 계산 (frontend/src/utils/financialScore.ts 포팅)

    4가지 지표: savings_rate, budget_adherence, fixed_expense_ratio, spending_stability
    """
    scores: list[int] = []

    # 1. 저축률 점수
    savings_score: int | None = None
    if income_total > 0 and savings_total is not None:
        ratio = savings_total / income_total * 100
        if ratio >= 30:
            savings_score = 100
        elif ratio >= 20:
            savings_score = int(80 + (ratio - 20) / 10 * 20)
        elif ratio >= 10:
            savings_score = int(50 + (ratio - 10) / 10 * 30)
        else:
            savings_score = int(ratio / 10 * 50)
        scores.append(savings_score)

    # 2. 예산 준수율 점수
    budget_score: int | None = None
    if budget and budget["total_budget"] > 0:
        adherence = 1 - (budget["total_spent"] / budget["total_budget"])
        budget_score = max(0, min(100, int(adherence * 100 + 50)))
        scores.append(budget_score)

    # 3. 지출 안정성 점수 (직전 3개월 변동계수)
    stability_score: int | None = None
    expenses = [t["expense"] for t in trend if t["expense"] > 0]
    if len(expenses) >= 2:
        mean = sum(expenses) / len(expenses)
        if mean > 0:
            variance = sum((x - mean) ** 2 for x in expenses) / len(expenses)
            cv = (variance ** 0.5) / mean  # 변동계수
            if cv <= 0.1:
                stability_score = 100
            elif cv <= 0.3:
                stability_score = int(100 - (cv - 0.1) / 0.2 * 40)
            else:
                stability_score = max(0, int(60 - (cv - 0.3) / 0.7 * 60))
            scores.append(stability_score)

    overall = int(sum(scores) / len(scores)) if scores else 0

    def grade(s: int) -> str:
        if s >= 90: return "A+"
        if s >= 80: return "A"
        if s >= 70: return "B+"
        if s >= 60: return "B"
        if s >= 50: return "C+"
        if s >= 40: return "C"
        if s >= 30: return "D"
        return "F"

    return {
        "savings_rate": savings_score,
        "budget_adherence": budget_score,
        "fixed_expense_ratio": None,  # 정기거래 비율 — 단계 2에서 보강
        "spending_stability": stability_score,
        "overall": overall,
        "grade": grade(overall),
    }
```

### Step 4: 테스트 통과 확인

```bash
cd backend && pytest tests/integration/test_report_data_builder.py -v
```
Expected: 3 passed

### Step 5: 커밋

```bash
git add backend/app/services/report_data_builder.py \
        backend/tests/integration/test_report_data_builder.py
git commit -m "feat: 결산 리포트 데이터 집계 서비스 추가"
```

---

## Task 6: Pydantic 스키마

**Files:**
- Create: `backend/app/schemas/monthly_report.py`

### Step 1: 스키마 작성

```python
# backend/app/schemas/monthly_report.py
"""월간 결산 리포트 Pydantic 스키마"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.insights import StructuredInsightsResponse


class MonthlyReportResponse(BaseModel):
    """사용자 조회 API 응답"""
    id: int
    month: str
    status: Literal["pending", "processing", "completed", "failed"]
    insights: StructuredInsightsResponse | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class MonthlyReportListItem(BaseModel):
    """리스트/카드 그리드용 (단계 2 대비)"""
    month: str
    status: Literal["pending", "processing", "completed", "failed"]
    headline: str | None  # insights.findings[0].what 미리보기
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class MonthlyReportEligibility(BaseModel):
    """자격 미달 시 사용자 안내 정보"""
    has_profile: bool
    transaction_count: int
    transactions_needed: int
    category_count: int
    total_spend: float
    is_eligible: bool
    blocker: Literal[
        "profile_missing",
        "transactions_short",
        "categories_short",
        "spend_short",
        "first_month",
        None,
    ]


class MonthlyReportOrEligibility(BaseModel):
    """리포트 없을 때 자격 정보를 함께 반환"""
    report: MonthlyReportResponse | None
    eligibility: MonthlyReportEligibility | None
```

### Step 2: 커밋

```bash
git add backend/app/schemas/monthly_report.py
git commit -m "feat: 월간 결산 리포트 Pydantic 스키마 추가"
```

---

## Task 7: report_generator 서비스

**Files:**
- Create: `backend/app/services/report_generator.py`
- Create: `backend/tests/unit/test_report_generator.py`

### Step 1: 실패 테스트 작성

```python
# backend/tests/unit/test_report_generator.py
"""report_generator 단위 테스트"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch
import pytest

from app.services.report_generator import mark_completed, mark_failed, _truncate_error


def test_truncate_error_long_message():
    long_msg = "x" * 3000
    result = _truncate_error(long_msg)
    assert len(result) <= 2000


def test_truncate_error_short_message():
    msg = "short error"
    assert _truncate_error(msg) == msg


@pytest.mark.asyncio
async def test_mark_failed_updates_status(db_session, test_household, test_user):
    from app.models.monthly_report import MonthlyReport
    report = MonthlyReport(
        household_id=test_household.id,
        month="2026-03",
        status="processing",
        report_data={},
        attempt_count=1,
    )
    db_session.add(report)
    await db_session.commit()

    await mark_failed(db_session, report.id, "LLM timeout")
    await db_session.refresh(report)

    assert report.status == "failed"
    assert "LLM timeout" in report.last_error
```

### Step 2: 테스트 실패 확인

```bash
cd backend && pytest tests/unit/test_report_generator.py -v
```
Expected: FAIL

### Step 3: 구현

```python
# backend/app/services/report_generator.py
"""LLM 호출 + MonthlyReport 상태 전이 서비스"""

import asyncio
import logging
from datetime import datetime

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household_profile import HouseholdProfile
from app.models.monthly_report import MonthlyReport
from app.services.llm_service import get_llm_provider
from app.services.prompts import format_insights_data_for_llm

logger = logging.getLogger(__name__)

LLM_TIMEOUT_SECONDS = 30


def _truncate_error(msg: str, max_len: int = 2000) -> str:
    return msg[:max_len] if len(msg) > max_len else msg


async def run_llm_for_report(
    db: AsyncSession, report: MonthlyReport
) -> None:
    """LLM 호출 → 완료/실패 상태 저장"""
    profile = await db.scalar(
        __import__('sqlalchemy', fromlist=['select']).select(HouseholdProfile).where(
            HouseholdProfile.household_id == report.household_id
        )
    )
    formatted = format_insights_data_for_llm(report.report_data, profile)
    llm = get_llm_provider("insights")

    try:
        structured = await asyncio.wait_for(
            llm.generate_comprehensive_insights_v2(formatted),
            timeout=LLM_TIMEOUT_SECONDS,
        )
        await mark_completed(db, report.id, structured.model_dump())
        logger.info(
            "[monthly-reports] llm_success household_id=%d month=%s",
            report.household_id, report.month,
        )
    except Exception as e:
        error_msg = _truncate_error(str(e))
        await mark_failed(db, report.id, error_msg)
        logger.warning(
            "[monthly-reports] llm_failed household_id=%d month=%s error=%s",
            report.household_id, report.month, error_msg,
        )
        raise


async def mark_completed(
    db: AsyncSession, report_id: int, insights: dict
) -> None:
    await db.execute(
        update(MonthlyReport)
        .where(MonthlyReport.id == report_id)
        .values(
            status="completed",
            insights=insights,
            completed_at=datetime.utcnow(),
        )
    )
    await db.commit()


async def mark_failed(
    db: AsyncSession, report_id: int, error: str
) -> None:
    await db.execute(
        update(MonthlyReport)
        .where(MonthlyReport.id == report_id)
        .values(
            status="failed",
            last_error=error,
        )
    )
    await db.commit()
```

**참고**: `select` import를 직접 쓰는 대신 `from sqlalchemy import select` 형태로 수정해야 함 (위 코드는 동작하지만 가독성이 나쁨). 구현 시 수정.

### Step 4: 테스트 통과 확인

```bash
cd backend && pytest tests/unit/test_report_generator.py -v
```
Expected: 3 passed

### Step 5: 커밋

```bash
git add backend/app/services/report_generator.py \
        backend/tests/unit/test_report_generator.py
git commit -m "feat: 결산 리포트 LLM 생성 + 상태 전이 서비스 추가"
```

---

## Task 8: report_scheduler 서비스

**Files:**
- Create: `backend/app/services/report_scheduler.py`
- Create: `backend/tests/integration/test_report_scheduler.py`

### Step 1: 실패 테스트 작성

```python
# backend/tests/integration/test_report_scheduler.py
"""report_scheduler 통합 테스트 (mock LLM)"""

import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.expense import Expense
from app.models.household_profile import HouseholdProfile
from app.models.monthly_report import MonthlyReport
from app.services.report_scheduler import phase1_enqueue_pending, recover_stale_processing
from datetime import datetime, timedelta


@pytest.mark.asyncio
async def test_phase1_creates_pending_rows(
    db_session, test_household, test_user
):
    """자격 통과 가구에 pending row가 생성된다"""
    profile = HouseholdProfile(
        household_id=test_household.id,
        household_type="single", housing_type="monthly_rent",
        income_types=["salary"], age_range="30s",
    )
    db_session.add(profile)
    for i in range(15):
        db_session.add(Expense(
            household_id=test_household.id, user_id=test_user.id,
            amount=20000, description=f"지출 {i}",
            date=__import__('datetime').date(2026, 3, i + 1),
            category_id=(i % 3) + 1,
        ))
    await db_session.commit()

    count = await phase1_enqueue_pending(db_session, "2026-03")
    assert count >= 1

    report = await db_session.scalar(
        select(MonthlyReport).where(
            MonthlyReport.household_id == test_household.id,
            MonthlyReport.month == "2026-03",
        )
    )
    assert report is not None
    assert report.status == "pending"
    assert report.report_data != {}


@pytest.mark.asyncio
async def test_phase1_idempotent(db_session, test_household, test_user):
    """두 번 호출해도 row는 하나만 생성된다"""
    profile = HouseholdProfile(
        household_id=test_household.id,
        household_type="single", housing_type="monthly_rent",
        income_types=["salary"], age_range="30s",
    )
    db_session.add(profile)
    for i in range(15):
        db_session.add(Expense(
            household_id=test_household.id, user_id=test_user.id,
            amount=20000, description=f"지출 {i}",
            date=__import__('datetime').date(2026, 3, i + 1),
            category_id=(i % 3) + 1,
        ))
    await db_session.commit()

    await phase1_enqueue_pending(db_session, "2026-03")
    await phase1_enqueue_pending(db_session, "2026-03")

    rows = await db_session.scalars(
        select(MonthlyReport).where(
            MonthlyReport.household_id == test_household.id,
            MonthlyReport.month == "2026-03",
        )
    )
    assert len(list(rows)) == 1


@pytest.mark.asyncio
async def test_recover_stale_processing(db_session, test_household):
    """processing 좀비 row가 pending으로 복구된다"""
    stale = MonthlyReport(
        household_id=test_household.id,
        month="2026-03",
        status="processing",
        report_data={},
        attempt_count=1,
        started_at=datetime.utcnow() - timedelta(minutes=30),
    )
    db_session.add(stale)
    await db_session.commit()

    await recover_stale_processing(db_session, threshold_minutes=15)
    await db_session.refresh(stale)

    assert stale.status == "pending"
```

### Step 2: 테스트 실패 확인

```bash
cd backend && pytest tests/integration/test_report_scheduler.py -v
```
Expected: FAIL

### Step 3: 구현

```python
# backend/app/services/report_scheduler.py
"""월간 결산 리포트 스케줄러 — Phase 1/2 오케스트레이션"""

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.monthly_report import MonthlyReport
from app.services.report_data_builder import build_report_data
from app.services.report_eligibility import find_eligible_households
from app.services.report_generator import run_llm_for_report

logger = logging.getLogger(__name__)


async def phase1_enqueue_pending(
    db: AsyncSession, month: str
) -> int:
    """자격 통과 가구의 report_data 집계 + pending row 일괄 생성

    Returns:
        생성된(또는 이미 존재하는) row 수
    """
    eligible_ids = await find_eligible_households(db, month)
    logger.info(
        "[monthly-reports] eligible_households count=%d month=%s",
        len(eligible_ids), month,
    )

    created = 0
    for hid in eligible_ids:
        data = await build_report_data(db, hid, month)
        # ON CONFLICT DO NOTHING — 멱등성 보장
        result = await db.execute(
            pg_insert(MonthlyReport)
            .values(
                household_id=hid,
                month=month,
                status="pending",
                report_data=data,
                trigger_source="auto",
            )
            .on_conflict_do_nothing(
                index_elements=["household_id", "month"]
            )
        )
        if result.rowcount:
            created += 1

    await db.commit()
    logger.info("[monthly-reports] phase1_complete queued=%d month=%s", created, month)
    return created


async def recover_stale_processing(
    db: AsyncSession, threshold_minutes: int = 15
) -> None:
    """processing 상태로 N분 이상 된 row를 pending으로 복구"""
    cutoff = datetime.utcnow() - timedelta(minutes=threshold_minutes)
    result = await db.execute(
        update(MonthlyReport)
        .where(
            MonthlyReport.status == "processing",
            MonthlyReport.started_at < cutoff,
        )
        .values(status="pending")
    )
    if result.rowcount:
        logger.warning(
            "[monthly-reports] recovered_stale count=%d", result.rowcount
        )
    await db.commit()


async def _pick_next_pending(
    db: AsyncSession, month: str
) -> MonthlyReport | None:
    """SELECT FOR UPDATE SKIP LOCKED로 원자적 픽업

    NOTE: PostgreSQL 전용. SQLite 테스트 환경에서는 락 없이 동작.
    """
    report = await db.scalar(
        select(MonthlyReport)
        .where(
            MonthlyReport.month == month,
            MonthlyReport.status == "pending",
            MonthlyReport.attempt_count < 3,
        )
        .order_by(MonthlyReport.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if report:
        report.status = "processing"
        report.started_at = datetime.utcnow()
        report.attempt_count += 1
        await db.commit()
    return report


async def _process_one(month: str, sem: asyncio.Semaphore) -> None:
    async with sem:
        async with AsyncSessionLocal() as db:
            report = await _pick_next_pending(db, month)
            if not report:
                return
            try:
                await run_llm_for_report(db, report)
            except Exception:
                pass  # mark_failed는 run_llm_for_report 내부에서 처리


async def phase2_process_pending(month: str) -> None:
    """pending row를 Semaphore(5)로 병렬 LLM 호출"""
    # 먼저 좀비 복구
    async with AsyncSessionLocal() as db:
        await recover_stale_processing(db)

    sem = asyncio.Semaphore(5)
    max_tasks = settings.MONTHLY_REPORT_MAX_PER_RUN

    tasks = [asyncio.create_task(_process_one(month, sem)) for _ in range(max_tasks)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    completed = sum(1 for r in results if r is None)
    failed = sum(1 for r in results if isinstance(r, Exception))
    logger.info(
        "[monthly-reports] phase2_complete completed=%d failed=%d month=%s",
        completed, failed, month,
    )
```

**참고**: SQLite 테스트 환경에서 `with_for_update(skip_locked=True)`는 지원되지 않는다. 통합 테스트에서 phase2는 `mock LLM`으로만 검증하고 실제 SKIP LOCKED 동작은 PostgreSQL에서만 확인한다.

### Step 4: 테스트 통과 확인

```bash
cd backend && pytest tests/integration/test_report_scheduler.py -v
```
Expected: 3 passed

### Step 5: 커밋

```bash
git add backend/app/services/report_scheduler.py \
        backend/tests/integration/test_report_scheduler.py
git commit -m "feat: 결산 리포트 Phase 1/2 스케줄러 서비스 추가"
```

---

## Task 9: 내부 웹훅 API

**Files:**
- Modify: `backend/app/api/webhooks.py`
- Create: `backend/tests/integration/test_api_reports_webhook.py`

### Step 1: 실패 테스트 작성

```python
# backend/tests/integration/test_api_reports_webhook.py
import hashlib
import hmac
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.core.config import settings


def _make_signature(secret: str) -> str:
    return hmac.new(
        secret.encode(), b"monthly-report-trigger", hashlib.sha256
    ).hexdigest()


@pytest.mark.asyncio
async def test_webhook_rejects_missing_signature(authenticated_client: AsyncClient):
    resp = await authenticated_client.post("/api/webhooks/monthly-reports")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_signature(authenticated_client: AsyncClient):
    resp = await authenticated_client.post(
        "/api/webhooks/monthly-reports",
        headers={"x-webhook-signature": "invalid"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_webhook_accepts_valid_signature(authenticated_client: AsyncClient):
    secret = "test-secret"  # pragma: allowlist secret
    with (
        patch.object(settings, "MONTHLY_REPORT_WEBHOOK_SECRET", secret),
        patch.object(settings, "MONTHLY_REPORT_AUTO_ENABLED", True),
        patch("app.api.webhooks.phase1_enqueue_pending", new=AsyncMock(return_value=3)),
        patch("app.api.webhooks.phase2_process_pending"),
    ):
        resp = await authenticated_client.post(
            "/api/webhooks/monthly-reports",
            headers={"x-webhook-signature": _make_signature(secret)},
        )
    assert resp.status_code == 200
    assert resp.json()["queued"] == 3


@pytest.mark.asyncio
async def test_webhook_skips_when_disabled(authenticated_client: AsyncClient):
    secret = "test-secret"  # pragma: allowlist secret
    with (
        patch.object(settings, "MONTHLY_REPORT_WEBHOOK_SECRET", secret),
        patch.object(settings, "MONTHLY_REPORT_AUTO_ENABLED", False),
    ):
        resp = await authenticated_client.post(
            "/api/webhooks/monthly-reports",
            headers={"x-webhook-signature": _make_signature(secret)},
        )
    assert resp.status_code == 200
    assert resp.json()["skipped"] is True
```

### Step 2: 테스트 실패 확인

```bash
cd backend && pytest tests/integration/test_api_reports_webhook.py -v
```
Expected: FAIL

### Step 3: `webhooks.py`에 엔드포인트 추가

기존 `router` 아래에 추가:

```python
# backend/app/api/webhooks.py 하단에 추가
from fastapi import BackgroundTasks
from app.core.config import settings
from app.core.webhook_auth import verify_monthly_report_webhook
from app.core.database import get_db
from app.services.report_month_utils import previous_month_kst
from app.services.report_scheduler import phase1_enqueue_pending, phase2_process_pending


@router.post("/monthly-reports")
async def trigger_monthly_reports(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Supabase pg_cron이 매월 1일 호출하는 월간 결산 리포트 생성 트리거"""
    verify_monthly_report_webhook(request)

    if not settings.MONTHLY_REPORT_AUTO_ENABLED:
        logger.info("[monthly-reports] 자동 실행 비활성화 (MONTHLY_REPORT_AUTO_ENABLED=false)")
        return {"skipped": True, "reason": "auto_disabled"}

    target_month = previous_month_kst()
    queued = await phase1_enqueue_pending(db, target_month)

    background_tasks.add_task(phase2_process_pending, target_month)

    logger.info("[monthly-reports] cron_started month=%s queued=%d", target_month, queued)
    return {"queued": queued, "month": target_month}
```

### Step 4: 테스트 통과 확인

```bash
cd backend && pytest tests/integration/test_api_reports_webhook.py -v
```
Expected: 4 passed

### Step 5: 커밋

```bash
git add backend/app/api/webhooks.py \
        backend/tests/integration/test_api_reports_webhook.py
git commit -m "feat: 월간 결산 리포트 cron webhook 엔드포인트 추가"
```

---

## Task 10: 사용자 조회 API

**Files:**
- Create: `backend/app/api/reports.py`
- Create: `backend/tests/integration/test_api_reports.py`

### Step 1: 실패 테스트 작성

```python
# backend/tests/integration/test_api_reports.py
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.monthly_report import MonthlyReport
from app.schemas.insights import StructuredInsightsResponse


@pytest.mark.asyncio
async def test_get_monthly_report_completed(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_household,
):
    report = MonthlyReport(
        household_id=test_household.id,
        month="2026-03",
        status="completed",
        report_data={"expense_total": 100000},
        insights={
            "findings": [{"what": "식비가 늘었어요", "so_what": "외식 증가", "now_what": "줄이기"}],
            "action_items": [{"title": "식비 절감", "description": "외식 줄이기"}],
            "encouragement": "수고하셨어요",
        },
        insights_version=1,
    )
    db_session.add(report)
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/reports/monthly",
        params={"month": "2026-03"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["report"]["status"] == "completed"
    assert data["report"]["insights"] is not None


@pytest.mark.asyncio
async def test_get_monthly_report_pending_returns_status(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_household,
):
    report = MonthlyReport(
        household_id=test_household.id,
        month="2026-03",
        status="pending",
        report_data={},
    )
    db_session.add(report)
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/reports/monthly",
        params={"month": "2026-03"},
    )
    assert resp.status_code == 200
    assert resp.json()["report"]["status"] == "pending"
    assert resp.json()["report"]["insights"] is None


@pytest.mark.asyncio
async def test_get_monthly_report_not_found_returns_eligibility(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_household,
):
    """리포트 없으면 eligibility 정보 반환"""
    resp = await authenticated_client.get(
        "/api/reports/monthly",
        params={"month": "2026-03"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["report"] is None
    assert data["eligibility"] is not None
    assert "blocker" in data["eligibility"]
```

### Step 2: 테스트 실패 확인

```bash
cd backend && pytest tests/integration/test_api_reports.py -v
```
Expected: FAIL

### Step 3: API 구현

```python
# backend/app/api/reports.py
"""월간 결산 리포트 사용자 조회 API"""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.monthly_report import MonthlyReport
from app.models.user import User
from app.schemas.monthly_report import (
    MonthlyReportEligibility,
    MonthlyReportOrEligibility,
    MonthlyReportResponse,
)
from app.services.report_eligibility import check_household_eligibility
from app.services.report_month_utils import previous_month_kst

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/monthly", response_model=MonthlyReportOrEligibility)
async def get_monthly_report(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """특정 월의 결산 리포트 조회

    리포트가 없으면 자격 정보(eligibility)를 함께 반환한다.
    """
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    report = await db.scalar(
        select(MonthlyReport).where(
            MonthlyReport.household_id == household_id,
            MonthlyReport.month == month,
        )
    )

    if report:
        return MonthlyReportOrEligibility(
            report=MonthlyReportResponse.model_validate(report),
            eligibility=None,
        )

    # 리포트 없음 → 자격 정보 반환
    eligibility = await check_household_eligibility(db, household_id, month)
    return MonthlyReportOrEligibility(
        report=None,
        eligibility=MonthlyReportEligibility(
            has_profile=eligibility.has_profile,
            transaction_count=eligibility.transaction_count,
            transactions_needed=eligibility.transactions_needed,
            category_count=eligibility.category_count,
            total_spend=eligibility.total_spend,
            is_eligible=eligibility.is_eligible,
            blocker=eligibility.blocker,
        ),
    )


@router.get("/latest", response_model=MonthlyReportOrEligibility)
async def get_latest_report(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> object:
    """직전 마감 월의 결산 리포트 조회 (모아보기 상단 카드용)"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    prev_month = previous_month_kst()

    report = await db.scalar(
        select(MonthlyReport).where(
            MonthlyReport.household_id == household_id,
            MonthlyReport.month == prev_month,
            MonthlyReport.status == "completed",
        )
    )

    if report:
        return MonthlyReportOrEligibility(
            report=MonthlyReportResponse.model_validate(report),
            eligibility=None,
        )

    eligibility = await check_household_eligibility(db, household_id, prev_month)
    return MonthlyReportOrEligibility(
        report=None,
        eligibility=MonthlyReportEligibility(
            has_profile=eligibility.has_profile,
            transaction_count=eligibility.transaction_count,
            transactions_needed=eligibility.transactions_needed,
            category_count=eligibility.category_count,
            total_spend=eligibility.total_spend,
            is_eligible=eligibility.is_eligible,
            blocker=eligibility.blocker,
        ),
    )
```

### Step 4: 테스트 통과 확인

```bash
cd backend && pytest tests/integration/test_api_reports.py -v
```
Expected: 3 passed

### Step 5: 커밋

```bash
git add backend/app/api/reports.py \
        backend/tests/integration/test_api_reports.py
git commit -m "feat: 월간 결산 리포트 사용자 조회 API 추가"
```

---

## Task 11: Admin API + main.py 라우터 등록

**Files:**
- Modify: `backend/app/api/admin.py`
- Modify: `backend/app/main.py`

### Step 1: admin.py에 retry/manual-trigger 추가

기존 `admin.py` 하단에 추가:

```python
# backend/app/api/admin.py 하단에 추가

from app.models.monthly_report import MonthlyReport
from app.services.report_scheduler import phase1_enqueue_pending, phase2_process_pending


@router.post("/reports/{report_id}/retry", status_code=200)
async def retry_report(
    report_id: int,
    background_tasks: BackgroundTasks,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """failed/pending 상태 리포트 LLM 재시도"""
    from sqlalchemy import select
    report = await db.scalar(
        select(MonthlyReport).where(MonthlyReport.id == report_id)
    )
    if not report:
        raise HTTPException(status_code=404, detail="리포트를 찾을 수 없습니다")
    if report.status not in ("failed", "pending"):
        raise HTTPException(status_code=400, detail=f"재시도 불가 상태: {report.status}")

    report.status = "pending"
    report.attempt_count = 0
    await db.commit()

    background_tasks.add_task(phase2_process_pending, report.month)
    return {"id": report_id, "status": "retrying"}


@router.post("/reports/manual-trigger", status_code=200)
async def manual_trigger_reports(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    background_tasks: BackgroundTasks,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """특정 월 결산 리포트 수동 생성 (디버깅/초기 배포용)"""
    queued = await phase1_enqueue_pending(db, month)
    background_tasks.add_task(phase2_process_pending, month)
    return {"queued": queued, "month": month}
```

### Step 2: main.py에 reports 라우터 등록

`backend/app/main.py`에서 기존 `app.include_router(insights.router, ...)` 아래에 추가:

```python
from app.api import reports  # 상단 import 블록에 추가

# include_router 블록에 추가
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
```

### Step 3: 전체 테스트 통과 확인

```bash
cd backend && pytest -x -q
```
Expected: 모든 기존 테스트 포함 통과

### Step 4: 커밋

```bash
git add backend/app/api/admin.py backend/app/main.py
git commit -m "feat: 결산 리포트 Admin API + 라우터 등록"
```

---

## Task 12: 프론트엔드 타입 + API 클라이언트 + MSW 핸들러

**Files:**
- Create: `frontend/src/types/report.ts`
- Create: `frontend/src/api/reports.ts`
- Modify: `frontend/src/mocks/handlers.ts`

### Step 1: 타입 정의

```typescript
// frontend/src/types/report.ts
import type { StructuredInsights } from './index'

export type ReportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type ReportBlocker =
  | 'profile_missing'
  | 'transactions_short'
  | 'categories_short'
  | 'spend_short'
  | 'first_month'
  | null

export interface MonthlyReport {
  id: number
  month: string
  status: ReportStatus
  insights: StructuredInsights | null
  completed_at: string | null
}

export interface ReportEligibility {
  has_profile: boolean
  transaction_count: number
  transactions_needed: number
  category_count: number
  total_spend: number
  is_eligible: boolean
  blocker: ReportBlocker
}

export interface MonthlyReportOrEligibility {
  report: MonthlyReport | null
  eligibility: ReportEligibility | null
}
```

### Step 2: API 클라이언트

```typescript
// frontend/src/api/reports.ts
import type { MonthlyReportOrEligibility } from '../types/report'
import api from './client'  // 기존 axios 인스턴스

export const reportsApi = {
  async getMonthly(
    month: string,
    householdId?: number
  ): Promise<MonthlyReportOrEligibility> {
    const params: Record<string, unknown> = { month }
    if (householdId) params.household_id = householdId
    const res = await api.get('/reports/monthly', { params })
    return res.data
  },

  async getLatest(
    householdId?: number
  ): Promise<MonthlyReportOrEligibility> {
    const params: Record<string, unknown> = {}
    if (householdId) params.household_id = householdId
    const res = await api.get('/reports/latest', { params })
    return res.data
  },
}
```

**참고**: 기존 API 클라이언트 인스턴스 파일 경로(`api/client.ts` 또는 `api/index.ts`)를 확인 후 import 경로 수정.

### Step 3: MSW 핸들러 추가

`frontend/src/mocks/handlers.ts`에서 기존 핸들러 배열에 추가:

```typescript
import { http, HttpResponse } from 'msw'

// handlers 배열에 추가
http.get('/api/reports/monthly', () => {
  return HttpResponse.json({
    report: {
      id: 1,
      month: '2026-03',
      status: 'completed',
      insights: {
        findings: [
          { what: '식비가 23% 늘었어요', so_what: '외식이 증가했어요', now_what: '주 2회로 줄여보세요' }
        ],
        action_items: [
          { title: '식비 절감', description: '외식 주 2회 제한' }
        ],
        encouragement: '이번 달도 수고하셨어요',
      },
      completed_at: '2026-04-01T03:30:00Z',
    },
    eligibility: null,
  })
}),

http.get('/api/reports/latest', () => {
  return HttpResponse.json({
    report: {
      id: 1,
      month: '2026-03',
      status: 'completed',
      insights: {
        findings: [
          { what: '식비가 23% 늘었어요', so_what: '외식이 증가했어요', now_what: '주 2회로 줄여보세요' }
        ],
        action_items: [
          { title: '식비 절감', description: '외식 주 2회 제한' }
        ],
        encouragement: '이번 달도 수고하셨어요',
      },
      completed_at: '2026-04-01T03:30:00Z',
    },
    eligibility: null,
  })
}),
```

### Step 4: 빌드 확인

```bash
cd frontend && npm run build
```
Expected: 빌드 오류 없음

### Step 5: 커밋

```bash
git add frontend/src/types/report.ts \
        frontend/src/api/reports.ts \
        frontend/src/mocks/handlers.ts
git commit -m "feat: 결산 리포트 프론트엔드 타입 + API 클라이언트 + MSW 핸들러 추가"
```

---

## Task 13: ReportEmptyState 컴포넌트

**Files:**
- Create: `frontend/src/components/reports/ReportEmptyState.tsx`
- Create: `frontend/src/components/reports/__tests__/ReportEmptyState.test.tsx`

### Step 1: 실패 테스트 작성

```typescript
// frontend/src/components/reports/__tests__/ReportEmptyState.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ReportEmptyState from '../ReportEmptyState'
import type { ReportEligibility } from '../../../types/report'

const baseEligibility: ReportEligibility = {
  has_profile: true,
  transaction_count: 8,
  transactions_needed: 7,
  category_count: 2,
  total_spend: 80000,
  is_eligible: false,
  blocker: 'transactions_short',
}

describe('ReportEmptyState', () => {
  it('거래 부족 시 이번 달 N건 이상 안내가 표시된다', () => {
    render(<ReportEmptyState eligibility={baseEligibility} />)
    expect(screen.getByText(/15건 이상/)).toBeInTheDocument()
  })

  it('프로필 미완성 시 프로필 완성 안내가 표시된다', () => {
    render(
      <ReportEmptyState
        eligibility={{ ...baseEligibility, has_profile: false, blocker: 'profile_missing' }}
      />
    )
    expect(screen.getByText(/프로필/)).toBeInTheDocument()
  })

  it('첫 달 가입 시 다음달 안내가 표시된다', () => {
    render(
      <ReportEmptyState
        eligibility={{ ...baseEligibility, blocker: 'first_month' }}
      />
    )
    expect(screen.getByText(/다음 달/)).toBeInTheDocument()
  })

  it('eligibility null이면 기본 안내 표시', () => {
    render(<ReportEmptyState eligibility={null} />)
    expect(screen.getByText(/결산 리포트/)).toBeInTheDocument()
  })
})
```

### Step 2: 테스트 실패 확인

```bash
cd frontend && npm test -- ReportEmptyState --run
```
Expected: FAIL

### Step 3: 컴포넌트 구현

```tsx
// frontend/src/components/reports/ReportEmptyState.tsx
import type { ReportEligibility } from '../../types/report'
import { useNavigate } from 'react-router-dom'

interface Props {
  eligibility: ReportEligibility | null
}

export default function ReportEmptyState({ eligibility }: Props) {
  const navigate = useNavigate()

  const { title, description, ctaLabel, ctaPath } = resolveContent(eligibility)

  return (
    <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
      <span className="text-4xl">📬</span>
      <div className="space-y-1.5">
        <p className="font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
      {ctaLabel && (
        <button
          onClick={() => navigate(ctaPath!)}
          className="mt-2 text-sm text-grape-600 font-medium underline underline-offset-2"
        >
          {ctaLabel} →
        </button>
      )}
    </div>
  )
}

function resolveContent(eligibility: ReportEligibility | null) {
  if (!eligibility) {
    return {
      title: '결산 리포트를 준비 중이에요',
      description: '매달 1일에 지난 달 결산 리포트가 자동으로 도착해요.',
      ctaLabel: null,
      ctaPath: null,
    }
  }

  switch (eligibility.blocker) {
    case 'profile_missing':
      return {
        title: '가구 프로필을 완성해주세요',
        description: '프로필을 완성하면 개인화된 결산 리포트를 다음 달 1일에 받아보실 수 있어요.',
        ctaLabel: '프로필 완성하기',
        ctaPath: '/settings',
      }
    case 'transactions_short':
      return {
        title: '다음 달부터 결산 리포트를 받아보세요',
        description: `이번 달 거래를 15건 이상 입력하시면 다음 달 1일에 결산 리포트가 도착해요. (현재 ${eligibility.transaction_count}건)`,
        ctaLabel: '거래 입력하기',
        ctaPath: '/home',
      }
    case 'first_month':
      return {
        title: '첫 결산 리포트가 준비 중이에요',
        description: '다음 달 1일에 첫 결산 리포트가 도착해요. 그동안 거래를 입력해주세요.',
        ctaLabel: '거래 입력하기',
        ctaPath: '/home',
      }
    default:
      return {
        title: '이번 달은 결산 리포트가 없어요',
        description: '거래를 꾸준히 입력하시면 다음 달부터 결산 리포트를 받아보실 수 있어요.',
        ctaLabel: null,
        ctaPath: null,
      }
  }
}
```

### Step 4: 테스트 통과 확인

```bash
cd frontend && npm test -- ReportEmptyState --run
```
Expected: 4 passed

### Step 5: 커밋

```bash
git add frontend/src/components/reports/ReportEmptyState.tsx \
        frontend/src/components/reports/__tests__/ReportEmptyState.test.tsx
git commit -m "feat: ReportEmptyState 컴포넌트 추가"
```

---

## Task 14: ReportPendingState + MonthlyReportCard

**Files:**
- Create: `frontend/src/components/reports/ReportPendingState.tsx`
- Create: `frontend/src/components/reports/MonthlyReportCard.tsx`
- Create: 각 `__tests__/*.test.tsx`

### Step 1: ReportPendingState 구현

```tsx
// frontend/src/components/reports/ReportPendingState.tsx
export default function ReportPendingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
      <span className="text-4xl animate-bounce">📬</span>
      <p className="font-semibold text-[var(--text-primary)]">결산 리포트를 준비하고 있어요</p>
      <p className="text-sm text-[var(--text-secondary)]">잠시 후 자동으로 업데이트돼요</p>
    </div>
  )
}
```

### Step 2: ReportPendingState 테스트

```typescript
// frontend/src/components/reports/__tests__/ReportPendingState.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ReportPendingState from '../ReportPendingState'

describe('ReportPendingState', () => {
  it('준비 중 메시지가 표시된다', () => {
    render(<ReportPendingState />)
    expect(screen.getByText(/준비하고 있어요/)).toBeInTheDocument()
  })
})
```

### Step 3: MonthlyReportCard 테스트 작성

```typescript
// frontend/src/components/reports/__tests__/MonthlyReportCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MonthlyReportCard from '../MonthlyReportCard'

// MSW 서버 설정 (server는 setup.ts에서 전역 설정됨)

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

vi.mock('../../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: Function) => {
    const state = { activeHouseholdId: 1 }
    return selector ? selector(state) : state
  },
}))

describe('MonthlyReportCard', () => {
  it('completed 리포트가 있으면 카드 헤드라인이 표시된다', async () => {
    render(<MonthlyReportCard />, { wrapper })
    expect(await screen.findByText(/식비가 23% 늘었어요/)).toBeInTheDocument()
  })
})
```

### Step 4: MonthlyReportCard 구현

```tsx
// frontend/src/components/reports/MonthlyReportCard.tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { reportsApi } from '../../api/reports'
import { useHouseholdStore } from '../../stores/useHouseholdStore'
import ReportEmptyState from './ReportEmptyState'
import ReportPendingState from './ReportPendingState'

export default function MonthlyReportCard() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  const { data, isLoading } = useQuery({
    queryKey: ['report-latest', activeHouseholdId],
    queryFn: () => reportsApi.getLatest(activeHouseholdId ?? undefined),
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const status = query.state.data?.report?.status
      return status === 'pending' || status === 'processing' ? 30_000 : false
    },
  })

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[var(--surface-elevated)] p-4 animate-pulse h-24" />
    )
  }

  if (!data?.report) {
    return <ReportEmptyState eligibility={data?.eligibility ?? null} />
  }

  const { report } = data

  if (report.status !== 'completed') {
    return <ReportPendingState />
  }

  const headline = report.insights?.findings?.[0]?.what ?? ''
  const monthLabel = formatMonthLabel(report.month)

  return (
    <Link
      to={`/insights/reports/${report.month}`}
      className="block rounded-2xl bg-gradient-to-br from-grape-50 to-grape-100 border border-grape-200 p-4 space-y-2 hover:opacity-90 transition-opacity"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-grape-500">📬 {monthLabel} 결산 리포트</span>
        <ChevronRight className="w-4 h-4 text-grape-400" />
      </div>
      <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2">{headline}</p>
      <p className="text-xs text-[var(--text-tertiary)]">
        {report.completed_at ? formatRelative(report.completed_at) + '에 도착' : ''}
      </p>
    </Link>
  )
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  return `${year}년 ${parseInt(m)}월호`
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  return `${diffDays}일 전`
}
```

### Step 5: 테스트 통과 확인

```bash
cd frontend && npm test -- ReportPendingState ReportEmptyState MonthlyReportCard --run
```
Expected: 전체 통과

### Step 6: 커밋

```bash
git add frontend/src/components/reports/
git commit -m "feat: ReportPendingState + MonthlyReportCard 컴포넌트 추가"
```

---

## Task 15: ReportContent + ReportDetailPage

**Files:**
- Create: `frontend/src/components/reports/ReportContent.tsx`
- Create: `frontend/src/pages/ReportDetailPage.tsx`
- Create: `frontend/src/pages/__tests__/ReportDetailPage.test.tsx`

### Step 1: ReportContent 구현

기존 `StructuredInsightsView`를 잡지형 레이아웃으로 재구성. 상세 페이지 전용이므로 타이포그래피를 키운다.

```tsx
// frontend/src/components/reports/ReportContent.tsx
import { Lightbulb, Target } from 'lucide-react'
import type { StructuredInsights } from '../../types'

interface Props {
  insights: StructuredInsights
  month: string
  completedAt: string | null
}

export default function ReportContent({ insights, month, completedAt }: Props) {
  const [year, m] = month.split('-')
  const monthLabel = `${year}년 ${parseInt(m)}월호`
  const dateLabel = completedAt
    ? new Date(completedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : ''

  return (
    <article className="max-w-[640px] mx-auto px-4 pb-16 space-y-12">
      {/* 표지 헤더 */}
      <header className="pt-6 space-y-3">
        <p className="text-xs text-[var(--text-muted)] font-medium tracking-wider uppercase">
          {monthLabel}
        </p>
        {insights.findings[0] && (
          <h1 className="text-3xl font-bold text-[var(--text-primary)] leading-snug">
            {insights.findings[0].what}
          </h1>
        )}
        {dateLabel && (
          <p className="text-sm text-[var(--text-tertiary)]">📬 {dateLabel}에 도착</p>
        )}
        <div className="h-px bg-gradient-to-r from-grape-300 to-transparent" />
      </header>

      {/* 격려 메시지 */}
      {insights.encouragement && (
        <blockquote className="border-l-4 border-grape-400 pl-4">
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed italic">
            {insights.encouragement}
          </p>
        </blockquote>
      )}

      {/* 핵심 발견 */}
      <section className="space-y-8">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
          <Lightbulb className="w-4 h-4 text-grape-500" />
          핵심 발견
        </h2>
        {insights.findings.map((f, i) => (
          <div key={i} className="space-y-3">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] leading-snug">
              {i + 1}. {f.what}
            </h3>
            <p className="text-base text-[var(--text-secondary)] leading-relaxed">
              {f.so_what}
            </p>
            <div className="bg-leaf-50 rounded-xl p-4">
              <p className="text-sm text-leaf-700 font-medium">
                → {f.now_what}
              </p>
            </div>
            {i < insights.findings.length - 1 && (
              <div className="h-px bg-[var(--border-subtle)] mt-4" />
            )}
          </div>
        ))}
      </section>

      {/* 이번 달 액션 */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
          <Target className="w-4 h-4 text-grape-500" />
          이번 달 액션
        </h2>
        <div className="space-y-3">
          {insights.action_items.map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-grape-100 text-grape-600 text-sm font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-0.5">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 참고 사항 */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed border-t border-[var(--border-subtle)] pt-4">
        ⓘ 이 정보는 일반적인 재무 정보이며, 개인 맞춤 투자 자문이 아닙니다. 투자 결정은 전문가와 상담하세요.
      </p>
    </article>
  )
}
```

### Step 2: ReportDetailPage 구현

```tsx
// frontend/src/pages/ReportDetailPage.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { reportsApi } from '../api/reports'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import ReportContent from '../components/reports/ReportContent'
import ReportEmptyState from '../components/reports/ReportEmptyState'
import ReportPendingState from '../components/reports/ReportPendingState'

export default function ReportDetailPage() {
  const { month } = useParams<{ month: string }>()
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  const { data, isLoading } = useQuery({
    queryKey: ['report', activeHouseholdId, month],
    queryFn: () => reportsApi.getMonthly(month!, activeHouseholdId ?? undefined),
    enabled: !!month,
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const status = query.state.data?.report?.status
      return status === 'pending' || status === 'processing' ? 30_000 : false
    },
  })

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* 네비게이션 헤더 */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => navigate('/insights')}
          className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ChevronLeft className="w-4 h-4" />
          모아보기로
        </button>
      </div>

      {/* 콘텐츠 */}
      {isLoading ? (
        <div className="max-w-[640px] mx-auto px-4 pt-8 space-y-4 animate-pulse">
          <div className="h-6 bg-[var(--surface-elevated)] rounded w-24" />
          <div className="h-10 bg-[var(--surface-elevated)] rounded w-3/4" />
          <div className="h-4 bg-[var(--surface-elevated)] rounded w-1/3" />
        </div>
      ) : !data?.report ? (
        <div className="max-w-[640px] mx-auto">
          <ReportEmptyState eligibility={data?.eligibility ?? null} />
        </div>
      ) : data.report.status !== 'completed' ? (
        <div className="max-w-[640px] mx-auto">
          <ReportPendingState />
        </div>
      ) : (
        <ReportContent
          insights={data.report.insights!}
          month={data.report.month}
          completedAt={data.report.completed_at}
        />
      )}
    </div>
  )
}
```

### Step 3: ReportDetailPage 테스트

```typescript
// frontend/src/pages/__tests__/ReportDetailPage.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReportDetailPage from '../ReportDetailPage'

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: Function) => {
    const state = { activeHouseholdId: 1 }
    return selector ? selector(state) : state
  },
}))

const wrapper = ({ month }: { month: string }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[`/insights/reports/${month}`]}>
      <Routes>
        <Route path="/insights/reports/:month" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
)

describe('ReportDetailPage', () => {
  it('completed 리포트의 핵심 발견이 표시된다', async () => {
    const { container } = render(wrapper({ month: '2026-03' }) as any)
    // MSW 핸들러가 completed 리포트 반환
    expect(await screen.findByText(/식비가 23% 늘었어요/)).toBeInTheDocument()
  })

  it('뒤로가기 버튼이 있다', async () => {
    render(wrapper({ month: '2026-03' }) as any)
    expect(await screen.findByText(/모아보기로/)).toBeInTheDocument()
  })
})
```

### Step 4: 테스트 통과 확인

```bash
cd frontend && npm test -- ReportDetailPage --run
```
Expected: 2 passed

### Step 5: 커밋

```bash
git add frontend/src/components/reports/ReportContent.tsx \
        frontend/src/pages/ReportDetailPage.tsx \
        frontend/src/pages/__tests__/ReportDetailPage.test.tsx
git commit -m "feat: ReportContent + ReportDetailPage 추가"
```

---

## Task 16: InsightsPage 수정 + App.tsx 라우트

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`
- Modify: `frontend/src/App.tsx`

### Step 1: InsightsPage에서 AI 섹션 교체

**제거할 코드** (정확한 라인 확인 후):
- Line 156: `const [structuredInsights, setStructuredInsights] = useState<StructuredInsights | null>(null)`
- Line 157: `const [aiLoading, setAiLoading] = useState(false)`
- `generateInsights` 함수 전체
- `insightsApi` import (다른 곳에서 쓰이면 유지)
- Lines 744~780: AI 분석 섹션 전체 (분석하기 버튼, 스피너, StructuredInsightsView)

**추가할 코드**:

```tsx
// InsightsPage.tsx 상단 import에 추가
import MonthlyReportCard from '../components/reports/MonthlyReportCard'

// AI 섹션 자리 (sectionVisibility.ai 블록) 대신:
{sectionVisibility.ai && (
  <section>
    <SectionHeader title="결산 리포트" />
    <MonthlyReportCard />
  </section>
)}
```

**Hero 직후**에 MonthlyReportCard 배치:
```tsx
// HeroSummary 컴포넌트 바로 다음에 추가
<MonthlyReportCard />
```

정확한 삽입 위치는 InsightsPage.tsx를 읽고 HeroSummary 렌더링 이후 지점을 확인.

### Step 2: App.tsx 라우트 추가

```tsx
// frontend/src/App.tsx
// 기존 import 블록에 추가
import ReportDetailPage from './pages/ReportDetailPage'

// '/insights' 라우트 아래에 추가 (같은 레이아웃 안에서)
<Route path="/insights/reports/:month" element={<ReportDetailPage />} />
```

기존 `<Route path="/insights" element={<InsightsPage />} />`는 유지.

### Step 3: 전체 프론트엔드 테스트 + 빌드

```bash
cd frontend && npm run lint && npm run test:run && npm run build
```
Expected: 모두 통과

### Step 4: 커밋

```bash
git add frontend/src/pages/InsightsPage.tsx \
        frontend/src/App.tsx
git commit -m "feat: InsightsPage AI 분석 → MonthlyReportCard 교체 + 라우트 추가"
```

---

## Task 17: Supabase pg_cron 설정 (수동 작업)

이 태스크는 코드가 아닌 Supabase 대시보드에서 수행한다.

### Step 1: Supabase SQL Editor에서 익스텐션 활성화

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Step 2: Vault에 시크릿 저장

```sql
SELECT vault.create_secret(
  'your-actual-webhook-secret-here',
  'monthly_report_webhook_secret'
);
```

Fly.io 환경변수 `MONTHLY_REPORT_WEBHOOK_SECRET`에 동일 값 설정.

### Step 3: cron job 등록 (운영 환경용)

```sql
-- Primary: 매월 1일 18:00 UTC (= KST 03:00)
SELECT cron.schedule(
  'monthly-reports-primary',
  '0 18 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://podo-budget-backend.fly.dev/api/webhooks/monthly-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-signature',
      (SELECT decrypted_secret FROM vault.decrypted_secrets
       WHERE name = 'monthly_report_webhook_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Retry 1: 18:30 UTC
SELECT cron.schedule(
  'monthly-reports-retry-1',
  '30 18 1 * *',
  $$ ... (동일 내용) $$
);

-- Retry 2: 21:00 UTC
SELECT cron.schedule(
  'monthly-reports-retry-2',
  '0 21 1 * *',
  $$ ... (동일 내용) $$
);
```

### Step 4: 첫 배포 후 이전 달 리포트 수동 생성

```bash
# 운영 환경에서 직전 달(예: 2026-03) 일괄 생성
curl -X POST "https://podo-budget-backend.fly.dev/api/admin/reports/manual-trigger?month=2026-03" \
  -H "Authorization: Bearer <admin-token>"
```

---

## 전체 테스트 체크리스트

```bash
# 백엔드 전체
cd backend && pytest -v

# 프론트엔드 전체
cd frontend && npm run lint && npm run test:run && npm run build
```

모든 기존 테스트가 깨지지 않아야 한다.

---

## PR 체크리스트

- [ ] `MONTHLY_REPORT_AUTO_ENABLED=false` (dev), `true` (prod) 확인
- [ ] `MONTHLY_REPORT_WEBHOOK_SECRET` Fly.io 환경변수 설정 완료
- [ ] Supabase Vault 시크릿 저장 완료
- [ ] pg_cron job 3개 등록 완료 (primary + retry 2)
- [ ] admin manual-trigger로 직전 달 리포트 배치 생성 완료
- [ ] `InsightsPage.tsx`에서 AI 분석 섹션 잔여 코드 없음 확인
- [ ] `StructuredInsightsView`가 여전히 import되어 있는지 확인 (미사용이면 제거)
- [ ] PR body에 `close #이슈번호` 포함

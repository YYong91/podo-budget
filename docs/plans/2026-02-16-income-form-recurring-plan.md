# 수입 입력 UI + 정기 거래 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 수입 입력 페이지(자연어 + 폼)와 정기 거래(지출/수입) 관리 기능을 추가한다.

**Architecture:** 기능 1(IncomeForm)은 기존 ExpenseForm.tsx 패턴을 미러링하여 FE만 추가. 기능 2(RecurringTransaction)는 BE 모델/API + FE UI + 대시보드 연동까지 풀스택 구현. 정기 거래는 서버 크론 없이 사용자 접속 시 pending 항목을 조회하는 방식.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, React 19, TypeScript, Tailwind CSS v4, Vitest, pytest

---

## Part 1: 수입 입력 UI (IncomeForm)

### Task 1: IncomeForm 페이지 생성 + 라우트/사이드바 연결

**Files:**
- Create: `frontend/src/pages/IncomeForm.tsx`
- Modify: `frontend/src/App.tsx:25-56` (lazy import + route)
- Modify: `frontend/src/components/Layout.tsx:29` (사이드바 수입 입력 추가)

**Step 1:** `frontend/src/pages/IncomeForm.tsx` 생성

ExpenseForm.tsx를 기반으로 하되 다음을 변경:
- `expenseApi` → `incomeApi` 호출
- amber 테마 → emerald 테마 (`bg-emerald-600`, `shadow-emerald-200`, `ring-emerald-500`, `bg-emerald-50/50`)
- 라벨: "지출 입력" → "수입 입력", "지출" → "수입"
- navigate 대상: `/expenses` → `/income`
- placeholder: "오늘 점심에 김치찌개 8000원 먹었어" → "이번 달 급여 3,500,000원 들어왔어\n부업 수입 200,000원"
- `parsed_expenses` 필터링: `type === 'income'`인 항목만 프리뷰에 표시
- 혼합 결과 처리: expense 타입 항목이 있으면 "지출로 분류된 N건은 별도로 저장해주세요" 안내 메시지
- 카테고리 드롭다운: `categories.filter(c => c.type === 'income' || c.type === 'both')` 적용
- 프리뷰 카드 border: `border-l-amber-400` → `border-l-emerald-400`
- 안내 텍스트: "수입 내용을 자연스럽게 입력하면 AI가 자동으로 분석합니다."

**Step 2:** `frontend/src/App.tsx` 수정

lazy import 추가:
```typescript
const IncomeForm = lazy(() => import('./pages/IncomeForm'))
```

Route 추가 (`/income` route 아래):
```tsx
<Route path="/income/new" element={<IncomeForm />} />
```

주의: `/income/new`는 `/income/:id` 위에 위치해야 한다 (exact match 우선).

**Step 3:** `frontend/src/components/Layout.tsx` 사이드바 수정

navItems 배열에서 `{ path: '/income', label: '수입 목록', icon: Wallet }` 다음에 추가:
```typescript
{ path: '/income/new', label: '수입 입력', icon: PlusCircle },
```

이미 import된 `PlusCircle`을 재사용.

**Step 4:** `frontend/src/pages/IncomeList.tsx` 수정

목록 헤더 옆에 "수입 등록" 버튼 추가 (ExpenseList의 패턴 참조):
```tsx
<Link to="/income/new" className="px-4 py-2 bg-emerald-600 text-white rounded-xl ...">
  수입 등록
</Link>
```

**Step 5:** Category 타입에 `type` 필드 추가 (프론트엔드)

`frontend/src/types/index.ts`의 Category 인터페이스에 `type` 필드 추가:
```typescript
export interface Category {
  id: number
  name: string
  description: string | null
  type: string  // 'expense' | 'income' | 'both'
  created_at: string
}
```

**Step 6:** 테스트 실행

```bash
cd frontend && npm test -- --run
```

**Step 7:** 커밋

```bash
git add frontend/src/pages/IncomeForm.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx frontend/src/pages/IncomeList.tsx frontend/src/types/index.ts
git commit -m "feat: 수입 입력 페이지 (자연어 + 폼) + 라우트/사이드바 연결"
```

---

### Task 2: IncomeForm 테스트 작성

**Files:**
- Create: `frontend/src/pages/__tests__/IncomeForm.test.tsx`
- Modify: `frontend/src/mocks/handlers.ts` (chat API 핸들러에 income 프리뷰 지원)

**Step 1:** MSW handlers에 chat API 프리뷰 핸들러 확인/추가

`frontend/src/mocks/handlers.ts`에 `/api/chat` POST 핸들러가 income 타입 프리뷰를 반환하도록 확인. 없으면 추가:
```typescript
http.post(`${BASE_URL}/chat`, async ({ request }) => {
  const body = await request.json() as { message: string; preview?: boolean }
  if (body.preview) {
    return HttpResponse.json({
      message: '분석 완료',
      parsed_expenses: [
        { amount: 3500000, description: '급여', category: '급여', date: '2026-02-16', memo: '', type: 'income' },
      ],
      parsed_items: null,
      expenses_created: null,
      incomes_created: null,
      insights: null,
    })
  }
  return HttpResponse.json({
    message: '저장 완료',
    expenses_created: [],
    incomes_created: [mockIncomes[0]],
    parsed_items: null,
    parsed_expenses: null,
    insights: null,
  })
}),
```

**Step 2:** `frontend/src/pages/__tests__/IncomeForm.test.tsx` 작성

테스트 항목:
1. 페이지 제목 "수입 입력"이 렌더링된다
2. 자연어/직접 입력 모드 탭이 표시된다
3. 모드 전환이 동작한다
4. 자연어 모드: 입력 후 "분석하기" 버튼 클릭
5. 폼 모드: 필수 필드 검증 (빈 설명, 0 금액)
6. 폼 모드: 정상 제출
7. "수입 목록" 뒤로가기 링크

패턴: 기존 테스트(IncomeList.test.tsx, IncomeDetail.test.tsx)의 `vi.mock('../../hooks/useToast')` + `MemoryRouter` 래핑 패턴 사용.

**Step 3:** 테스트 실행

```bash
cd frontend && npm test -- --run src/pages/__tests__/IncomeForm.test.tsx
```

**Step 4:** 커밋

```bash
git add frontend/src/pages/__tests__/IncomeForm.test.tsx frontend/src/mocks/handlers.ts
git commit -m "test: 수입 입력 페이지 테스트 추가"
```

---

## Part 2: 정기 거래 - 백엔드

### Task 3: RecurringTransaction 모델 + 마이그레이션

**Files:**
- Create: `backend/app/models/recurring_transaction.py`
- Modify: `backend/app/models/__init__.py` (모델 등록)
- Create: Alembic 마이그레이션

**Step 1:** `backend/app/models/recurring_transaction.py` 생성

```python
"""정기 거래 모델

정기적으로 반복되는 지출/수입을 관리합니다.
frequency(빈도)에 따라 next_due_date가 자동 계산되며,
사용자가 앱 접속 시 pending 항목으로 표시됩니다.
"""

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class RecurringTransaction(Base):
    """정기 거래 엔티티

    Attributes:
        type: 거래 유형 ('expense' | 'income')
        frequency: 반복 빈도 ('monthly' | 'weekly' | 'yearly' | 'custom')
        interval: custom 빈도일 때 N일 간격
        day_of_month: 매월/매년 실행일 (1-31)
        day_of_week: 매주 실행 요일 (0=월 ~ 6=일)
        month_of_year: 매년 실행 월 (1-12)
        next_due_date: 다음 실행 예정일
        is_active: 활성 상태 (False면 일시정지/종료)
    """

    __tablename__ = "recurring_transactions"
    __table_args__ = (
        Index("ix_recurring_user_active", "user_id", "is_active"),
        Index("ix_recurring_next_due_active", "next_due_date", "is_active"),
        Index("ix_recurring_household_active", "household_id", "is_active"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True)
    type = Column(String(10), nullable=False)  # expense | income
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    frequency = Column(String(10), nullable=False)  # monthly | weekly | yearly | custom
    interval = Column(Integer, nullable=True)  # custom일 때 N일
    day_of_month = Column(Integer, nullable=True)  # 1-31
    day_of_week = Column(Integer, nullable=True)  # 0-6
    month_of_year = Column(Integer, nullable=True)  # 1-12
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    next_due_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User")
    category = relationship("Category")
    household = relationship("Household")
```

**Step 2:** `backend/app/models/__init__.py`에 추가

```python
from app.models.recurring_transaction import RecurringTransaction
```
`__all__` 리스트에도 `"RecurringTransaction"` 추가.

**Step 3:** Alembic 마이그레이션 생성 및 적용

```bash
cd backend && alembic revision --autogenerate -m "recurring_transactions 테이블 생성"
```

**Step 4:** 테스트 실행 (모델이 임포트 가능한지 확인)

```bash
cd backend && pytest tests/unit/test_models.py -v --no-header -q
```

**Step 5:** 커밋

```bash
git add backend/app/models/recurring_transaction.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat: RecurringTransaction 모델 + 마이그레이션"
```

---

### Task 4: RecurringTransaction 스키마

**Files:**
- Create: `backend/app/schemas/recurring_transaction.py`

**Step 1:** 스키마 생성

```python
"""정기 거래 스키마"""

from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


class RecurringTransactionBase(BaseModel):
    type: str = Field(..., pattern="^(expense|income)$")
    amount: float = Field(..., gt=0, description="금액 (0보다 커야 함)")
    description: str
    category_id: int | None = None
    frequency: str = Field(..., pattern="^(monthly|weekly|yearly|custom)$")
    interval: int | None = Field(None, gt=0, description="custom 빈도일 때 N일 간격")
    day_of_month: int | None = Field(None, ge=1, le=31)
    day_of_week: int | None = Field(None, ge=0, le=6)
    month_of_year: int | None = Field(None, ge=1, le=12)
    start_date: date
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_frequency_fields(self):
        """빈도에 따른 필수 필드 검증"""
        if self.frequency == "monthly" and self.day_of_month is None:
            raise ValueError("monthly 빈도는 day_of_month가 필수입니다")
        if self.frequency == "weekly" and self.day_of_week is None:
            raise ValueError("weekly 빈도는 day_of_week가 필수입니다")
        if self.frequency == "yearly":
            if self.month_of_year is None or self.day_of_month is None:
                raise ValueError("yearly 빈도는 month_of_year와 day_of_month가 필수입니다")
        if self.frequency == "custom" and self.interval is None:
            raise ValueError("custom 빈도는 interval이 필수입니다")
        return self


class RecurringTransactionCreate(RecurringTransactionBase):
    household_id: int | None = None


class RecurringTransactionUpdate(BaseModel):
    amount: float | None = Field(None, gt=0)
    description: str | None = None
    category_id: int | None = None
    is_active: bool | None = None
    end_date: date | None = None


class RecurringTransactionResponse(RecurringTransactionBase):
    id: int
    household_id: int | None = None
    user_id: int
    next_due_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExecuteResponse(BaseModel):
    """정기 거래 실행 결과"""
    message: str
    created_id: int
    type: str
    next_due_date: date
```

**Step 2:** 테스트 실행

```bash
cd backend && python -c "from app.schemas.recurring_transaction import RecurringTransactionCreate; print('OK')"
```

**Step 3:** 커밋

```bash
git add backend/app/schemas/recurring_transaction.py
git commit -m "feat: RecurringTransaction Pydantic 스키마"
```

---

### Task 5: next_due_date 계산 서비스

**Files:**
- Create: `backend/app/services/recurring_service.py`
- Create: `backend/tests/unit/test_recurring_service.py`

**Step 1:** 서비스 로직 작성

```python
"""정기 거래 서비스

next_due_date 계산 및 정기 거래 실행 로직을 담당합니다.
"""

from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import select
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
    """다음 실행 예정일 계산

    Args:
        current_due: 현재 실행 예정일
        frequency: 반복 빈도 (monthly, weekly, yearly, custom)
        interval: custom 빈도의 일 간격
        day_of_month: 매월 실행일
        day_of_week: 매주 실행 요일
        month_of_year: 매년 실행 월

    Returns:
        다음 실행 예정일
    """
    if frequency == "weekly":
        return current_due + timedelta(days=7)
    elif frequency == "monthly":
        # 다음 달로 이동
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
        # start_date 이후 가장 가까운 day_of_week
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
```

**Step 2:** 단위 테스트 `backend/tests/unit/test_recurring_service.py`

calculate_next_due_date와 calculate_initial_due_date에 대한 순수 함수 테스트:
- monthly: 1월 31일 → 2월 28일 (윤년 아닐 때)
- monthly: 12월 → 다음 해 1월
- weekly: 7일 후
- yearly: 다음 해 같은 날
- custom: N일 후
- initial due date 계산 (start_date 이전/이후 케이스)

**Step 3:** 테스트 실행

```bash
cd backend && pytest tests/unit/test_recurring_service.py -v
```

**Step 4:** 커밋

```bash
git add backend/app/services/recurring_service.py backend/tests/unit/test_recurring_service.py
git commit -m "feat: 정기 거래 next_due_date 계산 서비스 + 테스트"
```

---

### Task 6: Recurring Transaction API 라우트

**Files:**
- Create: `backend/app/api/recurring.py`
- Modify: `backend/app/main.py:9,112` (import + router 등록)

**Step 1:** API 라우트 작성

8개 엔드포인트:
- `POST /` - 생성 (201)
- `GET /` - 목록 (type 필터, household 필터)
- `GET /pending` - 처리 대기 (next_due_date ≤ today, is_active=True)
- `GET /{id}` - 상세
- `PUT /{id}` - 수정
- `DELETE /{id}` - 삭제 (204)
- `POST /{id}/execute` - 실행 → Expense/Income 생성 (201)
- `POST /{id}/skip` - 건너뛰기

주의: `/pending` 라우트는 `/{id}` 위에 정의해야 한다 (path parameter 충돌 방지).

생성 시 `calculate_initial_due_date()`로 `next_due_date` 자동 설정.
execute 시 `execute_recurring()` 서비스 호출.
skip 시 `skip_recurring()` 서비스 호출.

**Step 2:** `backend/app/main.py`에 라우터 등록

```python
from app.api import ... recurring ...
app.include_router(recurring.router, prefix="/api/recurring", tags=["recurring"])
```

**Step 3:** 테스트 실행 (서버 기동 확인)

```bash
cd backend && python -c "from app.main import app; print('OK')"
```

**Step 4:** 커밋

```bash
git add backend/app/api/recurring.py backend/app/main.py
git commit -m "feat: 정기 거래 CRUD + execute/skip/pending API"
```

---

### Task 7: Recurring Transaction API 통합 테스트

**Files:**
- Create: `backend/tests/integration/test_api_recurring.py`

**Step 1:** 통합 테스트 작성

테스트 항목 (~20개):
- **CRUD 기본 (6개)**: 생성(monthly), 생성(weekly), 목록 조회, 상세 조회, 수정, 삭제
- **빈도 검증 (4개)**: monthly without day_of_month → 422, weekly without day_of_week → 422, yearly without month_of_year → 422, custom without interval → 422
- **type 필터 (2개)**: expense만 조회, income만 조회
- **pending (2개)**: 오늘 이전 due_date → pending에 포함, 미래 due_date → pending에 미포함
- **execute (3개)**: expense 실행 → Expense 생성 확인, income 실행 → Income 생성 확인, 실행 후 next_due_date 갱신 확인
- **skip (2개)**: skip 후 next_due_date 갱신, end_date 초과 시 is_active=False
- **household (1개)**: household_id로 필터링

패턴: `authenticated_client` fixture 사용, 각 테스트에서 먼저 POST로 정기 거래 생성 후 동작 검증.

**Step 2:** 테스트 실행

```bash
cd backend && pytest tests/integration/test_api_recurring.py -v
```

**Step 3:** 커밋

```bash
git add backend/tests/integration/test_api_recurring.py
git commit -m "test: 정기 거래 API 통합 테스트 (20개)"
```

---

## Part 3: 정기 거래 - 프론트엔드

### Task 8: RecurringTransaction 타입 + API 클라이언트

**Files:**
- Modify: `frontend/src/types/index.ts` (RecurringTransaction 타입 추가)
- Create: `frontend/src/api/recurring.ts`

**Step 1:** TypeScript 타입 추가

`frontend/src/types/index.ts`에 추가:
```typescript
export interface RecurringTransaction {
  id: number
  user_id: number
  household_id: number | null
  type: 'expense' | 'income'
  amount: number
  description: string
  category_id: number | null
  frequency: 'monthly' | 'weekly' | 'yearly' | 'custom'
  interval: number | null
  day_of_month: number | null
  day_of_week: number | null
  month_of_year: number | null
  start_date: string
  end_date: string | null
  next_due_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RecurringTransactionCreate {
  type: 'expense' | 'income'
  amount: number
  description: string
  category_id?: number | null
  frequency: 'monthly' | 'weekly' | 'yearly' | 'custom'
  interval?: number | null
  day_of_month?: number | null
  day_of_week?: number | null
  month_of_year?: number | null
  start_date: string
  end_date?: string | null
  household_id?: number | null
}

export interface ExecuteResponse {
  message: string
  created_id: number
  type: string
  next_due_date: string
}
```

**Step 2:** API 클라이언트 생성

`frontend/src/api/recurring.ts`:
```typescript
import apiClient from './client'
import type { RecurringTransaction, RecurringTransactionCreate, ExecuteResponse } from '../types'

export const recurringApi = {
  getAll: (params?: { type?: string; household_id?: number }) =>
    apiClient.get<RecurringTransaction[]>('/recurring', { params }),

  getPending: (householdId?: number) =>
    apiClient.get<RecurringTransaction[]>('/recurring/pending', {
      params: householdId != null ? { household_id: householdId } : undefined,
    }),

  getById: (id: number) =>
    apiClient.get<RecurringTransaction>(`/recurring/${id}`),

  create: (data: RecurringTransactionCreate) =>
    apiClient.post<RecurringTransaction>('/recurring', data),

  update: (id: number, data: Partial<RecurringTransaction>) =>
    apiClient.put<RecurringTransaction>(`/recurring/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/recurring/${id}`),

  execute: (id: number, amountOverride?: number) =>
    apiClient.post<ExecuteResponse>(`/recurring/${id}/execute`, amountOverride ? { amount_override: amountOverride } : {}),

  skip: (id: number) =>
    apiClient.post<{ next_due_date: string }>(`/recurring/${id}/skip`),
}
```

**Step 3:** 커밋

```bash
git add frontend/src/types/index.ts frontend/src/api/recurring.ts
git commit -m "feat: 정기 거래 TypeScript 타입 + API 클라이언트"
```

---

### Task 9: 정기 거래 관리 페이지

**Files:**
- Create: `frontend/src/pages/RecurringList.tsx`
- Modify: `frontend/src/App.tsx` (lazy import + route)
- Modify: `frontend/src/components/Layout.tsx` (사이드바 메뉴)

**Step 1:** `frontend/src/pages/RecurringList.tsx` 생성

기능:
- 지출/수입 토글 탭 (필터)
- 정기 거래 목록 테이블 (설명, 금액, 빈도, 다음 실행일, 상태)
- "추가" 버튼 → 인라인 폼 또는 모달
- 각 항목: 수정, 삭제, 일시정지/재개 버튼
- pending 항목은 상단에 하이라이트 표시

UI 구성:
- 헤더: "정기 거래" + 추가 버튼
- 탭: 전체 | 지출 | 수입
- 테이블: 설명 | 금액 | 빈도 | 다음 실행일 | 상태 | 작업

빈도 표시 함수:
- monthly → `매월 {day}일`
- weekly → `매주 {요일}`
- yearly → `매년 {month}월 {day}일`
- custom → `{interval}일마다`

색상: 지출 항목은 amber, 수입 항목은 emerald.

**Step 2:** 정기 거래 추가/수정 폼 (RecurringList 내 모달 또는 별도 컴포넌트)

폼 필드:
- 타입 (지출/수입 라디오)
- 금액, 설명
- 카테고리 (타입에 따라 expense/income/both 필터)
- 빈도 (monthly/weekly/yearly/custom 셀렉트)
- 빈도별 추가 필드 (조건부 렌더링)
- 시작일, 종료일(선택)
- 가구 선택 (activeHouseholdId 자동)

**Step 3:** App.tsx에 route 추가

```tsx
const RecurringList = lazy(() => import('./pages/RecurringList'))
// Route:
<Route path="/recurring" element={<RecurringList />} />
```

**Step 4:** Layout.tsx 사이드바에 메뉴 추가

lucide-react에서 `CalendarClock` (또는 `Repeat`) 아이콘 import.
navItems에 추가:
```typescript
{ path: '/recurring', label: '정기 거래', icon: Repeat },
```

위치: "예산 관리" 아래에 배치.

**Step 5:** 테스트 실행 + 커밋

```bash
cd frontend && npm test -- --run && npm run build
git add frontend/src/pages/RecurringList.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: 정기 거래 관리 페이지 + 라우팅 + 사이드바"
```

---

### Task 10: 대시보드 정기 거래 알림 카드

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1:** Dashboard에 pending 정기 거래 카드 추가

`recurringApi.getPending(activeHouseholdId)` 호출하여 대기 중인 정기 거래 목록 가져오기.

새로운 `PendingRecurring` 컴포넌트 (Dashboard.tsx 내부):
- pending 항목이 있을 때만 표시
- 각 항목에 [등록] [건너뛰기] 버튼
- [등록] → `recurringApi.execute(id)` → 성공 시 해당 항목 제거 + toast "넷플릭스 17,000원이 지출로 등록되었습니다"
- [건너뛰기] → `recurringApi.skip(id)` → 성공 시 해당 항목 제거 + toast "다음 실행일: 2026-03-25"
- 카드 색상: amber(지출) / emerald(수입) border-left

위치: StatsCards 아래, 차트/최근 내역 위에 배치.

**Step 2:** fetchData에 pending API 추가 (`.catch(() => [])` 패턴)

**Step 3:** 테스트 실행 + 커밋

```bash
cd frontend && npm test -- --run && npm run build
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: 대시보드에 정기 거래 알림 카드 추가"
```

---

### Task 11: 정기 거래 MSW 모킹 + 테스트

**Files:**
- Modify: `frontend/src/mocks/fixtures.ts` (mockRecurring 데이터)
- Modify: `frontend/src/mocks/handlers.ts` (recurring API 핸들러)
- Create: `frontend/src/pages/__tests__/RecurringList.test.tsx`

**Step 1:** fixtures에 mock 데이터 추가

```typescript
export const mockRecurringTransactions: RecurringTransaction[] = [
  {
    id: 1, user_id: 1, household_id: null,
    type: 'expense', amount: 17000, description: '넷플릭스',
    category_id: null, frequency: 'monthly', interval: null,
    day_of_month: 25, day_of_week: null, month_of_year: null,
    start_date: '2026-01-25', end_date: null,
    next_due_date: '2026-02-25', is_active: true,
    created_at: '2026-01-25T00:00:00Z', updated_at: '2026-01-25T00:00:00Z',
  },
  {
    id: 2, user_id: 1, household_id: null,
    type: 'income', amount: 3500000, description: '급여',
    category_id: null, frequency: 'monthly', interval: null,
    day_of_month: 25, day_of_week: null, month_of_year: null,
    start_date: '2026-01-25', end_date: null,
    next_due_date: '2026-02-25', is_active: true,
    created_at: '2026-01-25T00:00:00Z', updated_at: '2026-01-25T00:00:00Z',
  },
]
```

**Step 2:** handlers에 recurring API 핸들러 추가

GET /recurring, GET /recurring/pending, POST /recurring, POST /recurring/:id/execute, POST /recurring/:id/skip, DELETE /recurring/:id

**Step 3:** RecurringList.test.tsx 작성

테스트 항목:
1. 페이지 제목 "정기 거래" 렌더링
2. 목록 표시 (설명, 금액, 빈도)
3. 지출/수입 탭 필터링
4. 빈 상태 표시
5. 에러 상태 표시

**Step 4:** 테스트 실행 + 커밋

```bash
cd frontend && npm test -- --run
git add frontend/src/mocks/fixtures.ts frontend/src/mocks/handlers.ts frontend/src/pages/__tests__/RecurringList.test.tsx
git commit -m "test: 정기 거래 MSW 모킹 + RecurringList 테스트"
```

---

## Part 4: 검증 및 문서

### Task 12: 전체 테스트 + 빌드 검증

**Files:** 없음 (검증만)

**Step 1:** 백엔드 전체 테스트

```bash
cd backend && pytest -v --no-header -q
```

기대: 전체 통과 (기존 345 + 신규 ~30 = ~375개)

**Step 2:** 프론트엔드 전체 테스트

```bash
cd frontend && npm test -- --run
```

기대: 전체 통과 (기존 389 + 신규 ~15 = ~404개)

**Step 3:** 프론트엔드 빌드

```bash
cd frontend && npm run build
```

기대: 빌드 성공, 타입 에러 없음

**Step 4:** 실패 시 수정 후 커밋

---

### Task 13: 문서 업데이트

**Files:**
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `CLAUDE.md`

**Step 1:** IMPLEMENTATION_STATUS.md 업데이트

- 수입 관리 섹션에 "수입 입력 페이지" 추가
- 정기 거래 섹션 신규 추가 (모델, API, 프론트엔드)
- 테스트 현황 수치 업데이트
- 데이터베이스 섹션에 마이그레이션 #5 추가

**Step 2:** CLAUDE.md 업데이트

- 모델 수 업데이트 (8 → 9)
- Architecture 섹션에 RecurringTransaction 추가
- Current State 섹션 업데이트

**Step 3:** 커밋

```bash
git add docs/IMPLEMENTATION_STATUS.md CLAUDE.md
git commit -m "docs: 수입 입력 + 정기 거래 구현 문서 업데이트"
```

---

## 요약

| Task | 설명 | 예상 파일 수 |
|------|------|------------|
| 1 | IncomeForm 페이지 + 라우트/사이드바 | 5 |
| 2 | IncomeForm 테스트 | 2 |
| 3 | RecurringTransaction 모델 + 마이그레이션 | 3 |
| 4 | RecurringTransaction 스키마 | 1 |
| 5 | next_due_date 서비스 + 테스트 | 2 |
| 6 | Recurring API 라우트 | 2 |
| 7 | Recurring API 통합 테스트 | 1 |
| 8 | FE 타입 + API 클라이언트 | 2 |
| 9 | 정기 거래 관리 페이지 | 3 |
| 10 | 대시보드 알림 카드 | 1 |
| 11 | MSW 모킹 + RecurringList 테스트 | 3 |
| 12 | 전체 테스트 + 빌드 검증 | 0 |
| 13 | 문서 업데이트 | 2 |

**총 13개 Task, ~27개 파일 변경**

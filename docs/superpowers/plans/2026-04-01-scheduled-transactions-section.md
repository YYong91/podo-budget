# 지출/수입 예정 섹션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가계부 홈 화면에 이번 달 정기거래 예정 섹션을 추가하여 고정비를 한눈에 파악하고, 기존 PendingRecurring 카드를 대체한다.

**Architecture:** `useMonthlyTransactions` 훅에서 `GET /recurring` (전체)을 추가 호출하고, FE에서 이번 달 + 활성 + `next_due_date` 범위 필터링. 새 `ScheduledTransactions` 컴포넌트가 접힘/펼침 UI + 도래 항목 액션 버튼을 담당. 기존 `PendingRecurring` 컴포넌트를 대체.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (Grape 디자인 시스템), Vitest + React Testing Library + MSW

**Spec:** `docs/superpowers/specs/2026-04-01-recurring-schedule-section-design.md`

---

## 파일 구조

| 액션 | 파일 | 책임 |
|------|------|------|
| 생성 | `frontend/src/components/ScheduledTransactions.tsx` | 지출/수입 예정 섹션 (접힘/펼침, 목록, 액션 버튼) |
| 생성 | `frontend/src/components/__tests__/ScheduledTransactions.test.tsx` | 섹션 컴포넌트 테스트 |
| 수정 | `frontend/src/hooks/useMonthlyTransactions.ts` | `recurringApi.getAll()` 추가 호출 + 이번 달 필터링 |
| 수정 | `frontend/src/hooks/__tests__/useMonthlyTransactions.test.ts` | 훅 테스트에 정기거래 전체 조회 케이스 추가 |
| 수정 | `frontend/src/components/transaction/MonthlyView.tsx` | PendingRecurring → ScheduledTransactions 교체 |
| 수정 | `frontend/src/components/transaction/__tests__/MonthlyView.test.tsx` | MonthlyView 테스트 업데이트 |
| 수정 | `frontend/src/mocks/handlers.ts` | `GET /recurring` 핸들러에 household_id 필터 + is_active 필터 추가 |
| 수정 | `frontend/src/mocks/fixtures.ts` | 테스트용 정기거래 fixture 보강 (다양한 날짜/타입) |
| 삭제 | `frontend/src/components/PendingRecurring.tsx` | ScheduledTransactions로 대체 |
| 삭제 | `frontend/src/components/__tests__/PendingRecurring.test.tsx` | 대체됨 |

---

### Task 1: 테스트 fixture 및 MSW 핸들러 보강

**Files:**
- Modify: `frontend/src/mocks/fixtures.ts:280-321`
- Modify: `frontend/src/mocks/handlers.ts:283-293`

- [ ] **Step 1: fixtures.ts에 다양한 정기거래 목데이터 추가**

`mockRecurringTransactions`를 확장하여 다양한 시나리오를 커버한다:

```typescript
// frontend/src/mocks/fixtures.ts — mockRecurringTransactions 교체
export const mockRecurringTransactions: RecurringTransaction[] = [
  {
    id: 1, user_id: 1, household_id: 1, type: 'expense',
    amount: 17000, description: '넷플릭스', category_id: null,
    frequency: 'monthly', interval: null, day_of_month: 15,
    day_of_week: null, month_of_year: null,
    start_date: '2026-01-15', end_date: null,
    next_due_date: '2026-02-15', // 이번 달 미처리
    is_active: true,
    created_at: '2026-01-15T00:00:00Z', updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 2, user_id: 1, household_id: 1, type: 'income',
    amount: 3500000, description: '급여', category_id: null,
    frequency: 'monthly', interval: null, day_of_month: 25,
    day_of_week: null, month_of_year: null,
    start_date: '2026-01-25', end_date: null,
    next_due_date: '2026-02-25', // 이번 달 미처리
    is_active: true,
    created_at: '2026-01-25T00:00:00Z', updated_at: '2026-01-25T00:00:00Z',
  },
  {
    id: 3, user_id: 1, household_id: 1, type: 'expense',
    amount: 14900, description: '유튜브 프리미엄', category_id: null,
    frequency: 'monthly', interval: null, day_of_month: 28,
    day_of_week: null, month_of_year: null,
    start_date: '2026-01-28', end_date: null,
    next_due_date: '2026-02-28', // 이번 달 미처리
    is_active: true,
    created_at: '2026-01-28T00:00:00Z', updated_at: '2026-01-28T00:00:00Z',
  },
  {
    id: 4, user_id: 1, household_id: 1, type: 'expense',
    amount: 9900, description: '해지된 구독', category_id: null,
    frequency: 'monthly', interval: null, day_of_month: 10,
    day_of_week: null, month_of_year: null,
    start_date: '2026-01-10', end_date: null,
    next_due_date: '2026-02-10',
    is_active: false, // 비활성
    created_at: '2026-01-10T00:00:00Z', updated_at: '2026-01-10T00:00:00Z',
  },
]
```

- [ ] **Step 2: MSW 핸들러 업데이트 — `GET /recurring`에 household_id 필터 유지, pending 핸들러는 유지**

```typescript
// frontend/src/mocks/handlers.ts — GET /recurring 핸들러
http.get(`${BASE_URL}/recurring`, ({ request }) => {
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  let filtered = mockRecurringTransactions.filter((r) => r.is_active)
  if (type) filtered = filtered.filter((r) => r.type === type)
  return HttpResponse.json(filtered)
}),
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/mocks/fixtures.ts frontend/src/mocks/handlers.ts
git commit -m "test: 정기거래 테스트 fixture 보강 및 MSW 핸들러 업데이트"
```

---

### Task 2: useMonthlyTransactions 훅에 정기거래 전체 조회 추가

**Files:**
- Modify: `frontend/src/hooks/useMonthlyTransactions.ts:53-120`
- Test: `frontend/src/hooks/__tests__/useMonthlyTransactions.test.ts`

- [ ] **Step 1: 테스트 작성 — 훅이 allRecurring 데이터를 반환하는지**

```typescript
// useMonthlyTransactions.test.ts에 추가
it('활성 정기거래 전체를 allRecurring으로 반환한다', async () => {
  const { result } = renderHook(
    () => useMonthlyTransactions({ activeHouseholdId: 1 }),
    { wrapper: createWrapper() },
  )
  await waitFor(() => expect(result.current.loading).toBe(false))
  // mockRecurringTransactions 중 is_active: true인 것만
  expect(result.current.allRecurring.length).toBeGreaterThan(0)
  expect(result.current.allRecurring.every(r => r.is_active)).toBe(true)
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useMonthlyTransactions.test.ts`
Expected: FAIL — `allRecurring` 속성 없음

- [ ] **Step 3: useMonthlyTransactions.ts 수정**

`fetchData`에서 `recurringApi.getAll()` 추가 호출, `pendingRecurring`은 `allRecurring`에서 파생:

```typescript
// 데이터 상태에 추가
const [allRecurring, setAllRecurring] = useState<RecurringTransaction[]>([])

// fetchData 내부 — getPending 대신 getAll 호출
const [expRes, incRes, recurringRes] = await Promise.all([
  expenseApi.getAll(baseParams).catch(() => ({ data: [] as Expense[] })),
  incomeApi.getAll(baseParams).catch(() => ({ data: [] as Income[] })),
  recurringApi.getAll({ household_id: activeHouseholdId }).catch(() => ({ data: [] as RecurringTransaction[] })),
])

setExpenses(expRes.data)
setIncomes(incRes.data)

// 활성만 필터링
const activeRecurring = (recurringRes?.data ?? []).filter(r => r.is_active)
setAllRecurring(activeRecurring)

// pendingRecurring은 allRecurring에서 파생 (오늘 이하 도래)
const today = new Date().toISOString().slice(0, 10)
setPendingRecurring(activeRecurring.filter(r => r.next_due_date <= today))

// 반환 객체에 allRecurring 추가
return {
  // ... 기존 ...
  allRecurring,
  // pendingRecurring, setPendingRecurring 유지 (하위 호환)
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useMonthlyTransactions.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/hooks/useMonthlyTransactions.ts frontend/src/hooks/__tests__/useMonthlyTransactions.test.ts
git commit -m "feat: useMonthlyTransactions에 활성 정기거래 전체 조회 추가"
```

---

### Task 3: ScheduledTransactions 컴포넌트 — 접힘 상태 렌더링

**Files:**
- Create: `frontend/src/components/ScheduledTransactions.tsx`
- Create: `frontend/src/components/__tests__/ScheduledTransactions.test.tsx`

- [ ] **Step 1: 테스트 작성 — 기본 렌더링 (접힌 상태)**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScheduledTransactions from '../ScheduledTransactions'
import type { RecurringTransaction } from '../../types'

const makeItem = (overrides: Partial<RecurringTransaction>): RecurringTransaction => ({
  id: 1, user_id: 1, household_id: 1, type: 'expense',
  amount: 17000, description: '넷플릭스', category_id: null,
  frequency: 'monthly', interval: null, day_of_month: 15,
  day_of_week: null, month_of_year: null,
  start_date: '2026-01-15', end_date: null,
  next_due_date: '2026-04-15', is_active: true,
  created_at: '2026-01-15T00:00:00Z', updated_at: '2026-01-15T00:00:00Z',
  ...overrides,
})

describe('ScheduledTransactions', () => {
  it('빈 배열이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <ScheduledTransactions
        items={[]}
        currentYear={2026}
        currentMonth={3}
        onExecute={vi.fn()}
        onSkip={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('지출만 있으면 "지출 예정" 타이틀을 표시한다', () => {
    render(
      <ScheduledTransactions
        items={[makeItem({ type: 'expense', next_due_date: '2026-04-15' })]}
        currentYear={2026}
        currentMonth={3}
        onExecute={vi.fn()}
        onSkip={vi.fn()}
      />
    )
    expect(screen.getByText('지출 예정')).toBeInTheDocument()
  })

  it('수입만 있으면 "수입 예정" 타이틀을 표시한다', () => {
    render(
      <ScheduledTransactions
        items={[makeItem({ type: 'income', next_due_date: '2026-04-25' })]}
        currentYear={2026}
        currentMonth={3}
        onExecute={vi.fn()}
        onSkip={vi.fn()}
      />
    )
    expect(screen.getByText('수입 예정')).toBeInTheDocument()
  })

  it('지출+수입 있으면 "지출/수입 예정" 타이틀을 표시한다', () => {
    render(
      <ScheduledTransactions
        items={[
          makeItem({ id: 1, type: 'expense', next_due_date: '2026-04-15' }),
          makeItem({ id: 2, type: 'income', next_due_date: '2026-04-25' }),
        ]}
        currentYear={2026}
        currentMonth={3}
        onExecute={vi.fn()}
        onSkip={vi.fn()}
      />
    )
    expect(screen.getByText('지출/수입 예정')).toBeInTheDocument()
  })

  it('접힌 상태에서 건수와 총액을 표시한다', () => {
    render(
      <ScheduledTransactions
        items={[
          makeItem({ id: 1, amount: 17000, next_due_date: '2026-04-15' }),
          makeItem({ id: 2, amount: 14900, next_due_date: '2026-04-28' }),
        ]}
        currentYear={2026}
        currentMonth={3}
        onExecute={vi.fn()}
        onSkip={vi.fn()}
      />
    )
    expect(screen.getByText('2건')).toBeInTheDocument()
    expect(screen.getByText('₩31,900')).toBeInTheDocument()
  })

  it('현재 달이 아닌 정기거래는 필터링한다', () => {
    const { container } = render(
      <ScheduledTransactions
        items={[makeItem({ next_due_date: '2026-05-15' })]}
        currentYear={2026}
        currentMonth={3}
        onExecute={vi.fn()}
        onSkip={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/ScheduledTransactions.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: ScheduledTransactions 컴포넌트 구현 — 접힌 상태**

```typescript
// frontend/src/components/ScheduledTransactions.tsx
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatAmount } from '../utils/format'
import type { RecurringTransaction } from '../types'

interface ScheduledTransactionsProps {
  items: RecurringTransaction[]
  currentYear: number
  currentMonth: number // 0-indexed
  onExecute: (id: number) => void
  onSkip: (id: number) => void
}

const COLLAPSE_STORAGE_KEY = 'podo-scheduled-collapsed'

export default function ScheduledTransactions({
  items, currentYear, currentMonth, onExecute, onSkip,
}: ScheduledTransactionsProps) {
  // 이번 달 범위 필터링
  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
  const nextMonth = currentMonth === 11
    ? `${currentYear + 1}-01-01`
    : `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-01`

  const scheduled = useMemo(
    () => items
      .filter(r => r.next_due_date >= monthStart && r.next_due_date < nextMonth)
      .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)),
    [items, monthStart, nextMonth],
  )

  // 도래 여부 판별
  const today = useMemo(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

  const hasPending = scheduled.some(r => r.next_due_date <= today)

  // 자동 펼침 로직: 도래 미처리 있고 오늘 첫 진입이면 펼침
  const [collapsed, setCollapsed] = useState(() => {
    if (!hasPending) return true
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY)
      if (stored) {
        const { date } = JSON.parse(stored)
        if (date === today) return true // 오늘 이미 접었으면 유지
      }
    } catch { /* 무시 */ }
    return false // 도래 미처리 있고 첫 진입 → 펼침
  })

  const handleCollapse = () => {
    setCollapsed(true)
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify({ date: today }))
  }
  const handleExpand = () => setCollapsed(false)

  if (scheduled.length === 0) return null

  // 타이틀 결정
  const hasExpense = scheduled.some(r => r.type === 'expense')
  const hasIncome = scheduled.some(r => r.type === 'income')
  const title = hasExpense && hasIncome
    ? '지출/수입 예정'
    : hasExpense ? '지출 예정' : '수입 예정'

  // 총액 계산
  const totalExpense = scheduled.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const totalIncome = scheduled.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm overflow-hidden">
      {/* 헤더 (항상 표시) */}
      <button
        onClick={collapsed ? handleExpand : handleCollapse}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
          <span className="text-xs text-[var(--text-tertiary)]">{scheduled.length}건</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {hasExpense && hasIncome
              ? `지출 ${formatAmount(totalExpense)} · 수입 ${formatAmount(totalIncome)}`
              : formatAmount(hasExpense ? totalExpense : totalIncome)
            }
          </span>
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
            : <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
          }
        </div>
      </button>

      {/* 펼친 목록 */}
      {!collapsed && (
        <div className="border-t border-[var(--border-subtle)]">
          <div className="divide-y divide-[var(--border-subtle)]">
            {scheduled.map(r => {
              const isDue = r.next_due_date <= today
              const day = parseInt(r.next_due_date.slice(8, 10), 10)
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-[var(--text-tertiary)] w-6 shrink-0">{day}일</span>
                      <span className="text-sm text-[var(--text-primary)] truncate">{r.description}</span>
                    </div>
                    <span className={`text-sm font-medium shrink-0 ${
                      r.type === 'expense' ? 'text-[var(--text-secondary)]' : 'text-leaf-600'
                    }`}>
                      {r.type === 'income' ? '+' : ''}{formatAmount(r.amount)}
                    </span>
                  </div>
                  {/* 도래 항목 액션 버튼 */}
                  {isDue && (
                    <div className="flex gap-2 mt-2 ml-8">
                      <button
                        onClick={() => onExecute(r.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white ${
                          r.type === 'expense'
                            ? 'bg-grape-600 hover:bg-grape-700'
                            : 'bg-leaf-600 hover:bg-leaf-700'
                        } transition-colors`}
                      >
                        등록
                      </button>
                      <button
                        onClick={() => onSkip(r.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        건너뛰기
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* 남은 금액 요약 */}
          <div className="px-4 py-3 bg-[var(--surface-elevated)] border-t border-[var(--border-subtle)]">
            {totalExpense > 0 && (
              <span className="text-xs text-[var(--text-tertiary)]">
                남은 지출 {formatAmount(totalExpense)}
              </span>
            )}
            {totalExpense > 0 && totalIncome > 0 && (
              <span className="text-xs text-[var(--text-tertiary)]"> · </span>
            )}
            {totalIncome > 0 && (
              <span className="text-xs text-[var(--text-tertiary)]">
                남은 수입 {formatAmount(totalIncome)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/ScheduledTransactions.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/ScheduledTransactions.tsx frontend/src/components/__tests__/ScheduledTransactions.test.tsx
git commit -m "feat: ScheduledTransactions 컴포넌트 — 접힘/펼침 UI + 이번 달 필터링"
```

---

### Task 4: ScheduledTransactions 테스트 — 펼침 + 도래 액션 + 자동 펼침

**Files:**
- Modify: `frontend/src/components/__tests__/ScheduledTransactions.test.tsx`

- [ ] **Step 1: 펼침/도래/자동펼침 테스트 추가**

```typescript
import userEvent from '@testing-library/user-event'

// 기존 describe 안에 추가

it('펼치면 날짜순으로 항목이 표시된다', async () => {
  render(
    <ScheduledTransactions
      items={[
        makeItem({ id: 1, description: '넷플릭스', next_due_date: '2026-04-15' }),
        makeItem({ id: 2, description: '유튜브', next_due_date: '2026-04-28' }),
      ]}
      currentYear={2026}
      currentMonth={3}
      onExecute={vi.fn()}
      onSkip={vi.fn()}
    />
  )
  // 펼치기
  await userEvent.click(screen.getByRole('button', { name: /지출 예정/i }))
  expect(screen.getByText('넷플릭스')).toBeInTheDocument()
  expect(screen.getByText('유튜브')).toBeInTheDocument()
})

it('도래한 항목에 등록/건너뛰기 버튼이 표시된다', async () => {
  // next_due_date를 과거로 설정
  const pastDate = '2026-01-01'
  render(
    <ScheduledTransactions
      items={[makeItem({ next_due_date: pastDate })]}
      currentYear={2026}
      currentMonth={0}
      onExecute={vi.fn()}
      onSkip={vi.fn()}
    />
  )
  // 도래 항목이 있으면 자동 펼침
  expect(screen.getByText('등록')).toBeInTheDocument()
  expect(screen.getByText('건너뛰기')).toBeInTheDocument()
})

it('등록 버튼 클릭 시 onExecute가 호출된다', async () => {
  const onExecute = vi.fn()
  const pastDate = '2026-01-01'
  render(
    <ScheduledTransactions
      items={[makeItem({ id: 5, next_due_date: pastDate })]}
      currentYear={2026}
      currentMonth={0}
      onExecute={onExecute}
      onSkip={vi.fn()}
    />
  )
  await userEvent.click(screen.getByText('등록'))
  expect(onExecute).toHaveBeenCalledWith(5)
})

it('건너뛰기 버튼 클릭 시 onSkip이 호출된다', async () => {
  const onSkip = vi.fn()
  const pastDate = '2026-01-01'
  render(
    <ScheduledTransactions
      items={[makeItem({ id: 5, next_due_date: pastDate })]}
      currentYear={2026}
      currentMonth={0}
      onExecute={vi.fn()}
      onSkip={onSkip}
    />
  )
  await userEvent.click(screen.getByText('건너뛰기'))
  expect(onSkip).toHaveBeenCalledWith(5)
})
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/ScheduledTransactions.test.tsx`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/__tests__/ScheduledTransactions.test.tsx
git commit -m "test: ScheduledTransactions 펼침/도래 액션/자동 펼침 테스트 추가"
```

---

### Task 5: MonthlyView에서 PendingRecurring → ScheduledTransactions 교체

**Files:**
- Modify: `frontend/src/components/transaction/MonthlyView.tsx:11,127-148`
- Modify: `frontend/src/components/transaction/__tests__/MonthlyView.test.tsx`

- [ ] **Step 1: MonthlyView.test.tsx 업데이트 — ScheduledTransactions 렌더링 확인**

기존 PendingRecurring 관련 테스트를 ScheduledTransactions로 교체. 테스트 파일을 읽고 PendingRecurring 참조를 ScheduledTransactions로 변경한다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && npx vitest run src/components/transaction/__tests__/MonthlyView.test.tsx`
Expected: FAIL — PendingRecurring 여전히 렌더링 중

- [ ] **Step 3: MonthlyView.tsx 수정**

import 변경:
```typescript
// 제거
import PendingRecurring from '../PendingRecurring'
// 추가
import ScheduledTransactions from '../ScheduledTransactions'
```

JSX에서 PendingRecurring 블록(126-148줄)을 교체:
```typescript
{/* 지출/수입 예정 섹션 */}
<ScheduledTransactions
  items={monthly.allRecurring}
  currentYear={monthly.currentYear}
  currentMonth={monthly.currentMonth}
  onExecute={async (id) => {
    try {
      await recurringApi.execute(id)
      addToast('success', TOAST.RECURRING_EXECUTED)
      monthly.fetchData()
    } catch {
      addToast('error', TOAST.RECURRING_EXECUTE_FAILED)
    }
  }}
  onSkip={async (id) => {
    try {
      await recurringApi.skip(id)
      addToast('success', TOAST.RECURRING_SKIPPED)
      monthly.fetchData()
    } catch {
      addToast('error', TOAST.RECURRING_SKIP_FAILED)
    }
  }}
/>
```

위치: 미니 캘린더(150줄) 바로 아래, 거래 리스트(161줄) 바로 위로 이동 (달력과 목록 사이).

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && npx vitest run src/components/transaction/__tests__/MonthlyView.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/transaction/MonthlyView.tsx frontend/src/components/transaction/__tests__/MonthlyView.test.tsx
git commit -m "feat: MonthlyView에서 PendingRecurring → ScheduledTransactions 교체"
```

---

### Task 6: PendingRecurring 컴포넌트 삭제 + 전체 테스트 + 린트

**Files:**
- Delete: `frontend/src/components/PendingRecurring.tsx`
- Delete: `frontend/src/components/__tests__/PendingRecurring.test.tsx`

- [ ] **Step 1: PendingRecurring import가 남아있는 곳 확인**

Run: `grep -rn "PendingRecurring" frontend/src/ --include="*.tsx" --include="*.ts"`
MonthlyView.tsx에서 이미 교체했으므로 다른 곳에 없어야 함.

- [ ] **Step 2: PendingRecurring 파일 삭제**

```bash
rm frontend/src/components/PendingRecurring.tsx
rm frontend/src/components/__tests__/PendingRecurring.test.tsx
```

- [ ] **Step 3: 전체 FE 테스트 실행**

Run: `cd frontend && npx vitest run`
Expected: 모든 테스트 PASS

- [ ] **Step 4: 린트 + 빌드 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git rm frontend/src/components/PendingRecurring.tsx frontend/src/components/__tests__/PendingRecurring.test.tsx
git commit -m "refactor: PendingRecurring 컴포넌트 제거 — ScheduledTransactions로 대체"
```

---

### Task 7: 문서 + changelog 업데이트

**Files:**
- Modify: `frontend/src/data/changelogs.ts`
- Modify: `docs/IMPLEMENTATION_STATUS.md` (해당 시)

- [ ] **Step 1: changelogs.ts에 변경사항 추가**

```typescript
// changelogs 배열 맨 앞에 추가 (기존 최신 항목과 같은 배포 주기면 items에 추가)
{
  tag: '신규',
  text: '가계부 홈에 이번 달 정기거래 예정 섹션 추가',
},
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/data/changelogs.ts
git commit -m "docs: changelog에 지출/수입 예정 섹션 추가 반영"
```

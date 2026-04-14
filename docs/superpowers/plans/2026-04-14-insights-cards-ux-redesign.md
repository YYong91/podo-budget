# 모아보기 카드 UX 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모아보기 5개 세부 카드(예산 상황, 정기거래, 카드실적, 수입 구성, 지난달 비교)의 접기/펼치기 패턴을 통일하고, 저축 카드를 수입 구성 카드로 업그레이드한다.

**Architecture:** 공통 `SectionHeader` 컴포넌트를 추출하여 5개 카드에 적용. 모든 카드는 기본 접힘 상태로 오버뷰만 노출하고 chevron 탭 시 세부 내용 펼침. SavingsSection은 stacked bar(CSS flex 비율)로 수입 배분 구조를 시각화.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4 (Grape/Leaf/Warm/Cream 테마), Recharts (MonthlyComparison TrendBarChart), Vitest + React Testing Library

---

## 파일 맵

| 역할 | 파일 |
|---|---|
| **신규** | `frontend/src/components/stats/SectionHeader.tsx` |
| **신규** | `frontend/src/components/stats/__tests__/SectionHeader.test.tsx` |
| **수정** | `frontend/src/components/stats/BudgetVsActual.tsx` |
| **수정** | `frontend/src/components/stats/__tests__/BudgetVsActual.test.tsx` |
| **수정** | `frontend/src/components/stats/RecurringManageSection.tsx` |
| **수정** | `frontend/src/components/stats/__tests__/RecurringManageSection.test.tsx` |
| **수정** | `frontend/src/components/stats/CardUsageSummary.tsx` |
| **수정** | `frontend/src/components/stats/__tests__/CardUsageSummary.test.tsx` |
| **수정** | `frontend/src/components/stats/SavingsSection.tsx` |
| **수정** | `frontend/src/components/stats/__tests__/SavingsSection.test.tsx` |
| **수정** | `frontend/src/components/stats/MonthlyComparison.tsx` |
| **수정** | `frontend/src/components/stats/__tests__/MonthlyComparison.test.tsx` |
| **수정** | `frontend/src/pages/InsightsPage.tsx` |
| **수정** | `frontend/src/data/changelogs.ts` |

---

## Task 1: SectionHeader 공통 컴포넌트

**Files:**
- Create: `frontend/src/components/stats/SectionHeader.tsx`
- Create: `frontend/src/components/stats/__tests__/SectionHeader.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// frontend/src/components/stats/__tests__/SectionHeader.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SectionHeader from '../SectionHeader'

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('SectionHeader', () => {
  // vi.fn()을 공유하면 테스트 간 호출 횟수가 누적되므로 각 테스트마다 독립 생성
  it('타이틀과 이모지를 렌더한다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /예산 상황/ })).toBeInTheDocument()
  })

  it('접힌 상태에서 aria-label="펼치기" 버튼을 표시한다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: '펼치기' })).toBeInTheDocument()
  })

  it('펼친 상태에서 aria-label="접기" 버튼을 표시한다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={true} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: '접기' })).toBeInTheDocument()
  })

  it('헤더 클릭 시 onToggle이 호출된다', async () => {
    const onToggle = vi.fn()
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('collapsible=false이면 토글 버튼이 없다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={vi.fn()} collapsible={false} />)
    expect(screen.queryByRole('button', { name: /펼치기|접기/ })).toBeNull()
  })

  it('collapsible=false이면 헤더 영역 클릭 시 onToggle이 호출되지 않는다', async () => {
    const onToggle = vi.fn()
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={onToggle} collapsible={false} />)
    await userEvent.click(screen.getByRole('heading', { name: /예산 상황/ }))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('manageTo가 있으면 관리 링크를 표시한다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={vi.fn()} manageTo="/budgets" />)
    expect(screen.getByRole('link', { name: '관리' })).toHaveAttribute('href', '/budgets')
  })

  it('관리 링크 클릭 시 onToggle이 호출되지 않는다', async () => {
    const onToggle = vi.fn()
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={onToggle} manageTo="/budgets" />)
    await userEvent.click(screen.getByRole('link', { name: '관리' }))
    expect(onToggle).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/SectionHeader.test.tsx
```

Expected: FAIL — "Cannot find module '../SectionHeader'"

- [ ] **Step 3: SectionHeader 구현**

```tsx
// frontend/src/components/stats/SectionHeader.tsx
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'

type SectionHeaderProps = {
  icon: string
  title: string
  manageTo?: string
  expanded: boolean
  onToggle: () => void
  collapsible?: boolean
  children?: ReactNode
}

export default function SectionHeader({
  icon,
  title,
  manageTo,
  expanded,
  onToggle,
  collapsible = true,
  children,
}: SectionHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        {/* 토글 영역: 타이틀 + chevron */}
        {collapsible ? (
          <button
            type="button"
            className="flex items-center gap-2 flex-1 text-left"
            onClick={onToggle}
            aria-label={expanded ? '접기' : '펼치기'}
          >
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {icon} {title}
            </h2>
          </button>
        ) : (
          <h2 className="text-base font-semibold text-[var(--text-primary)] flex-1">
            {icon} {title}
          </h2>
        )}

        {/* 우측: 관리 링크 + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {manageTo && (
            <Link
              to={manageTo}
              className="text-xs text-grape-600 hover:text-grape-700 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              관리
            </Link>
          )}
          {collapsible && (
            <span
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''} pointer-events-none`}
              aria-hidden
            >
              <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
            </span>
          )}
        </div>
      </div>
      {children}
    </>
  )
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/SectionHeader.test.tsx
```

Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/stats/SectionHeader.tsx \
        frontend/src/components/stats/__tests__/SectionHeader.test.tsx
git commit -m "feat: SectionHeader 공통 컴포넌트 추가 — 모아보기 카드 접기/펼치기 통일"
```

---

## Task 2: BudgetVsActual 개선

**Files:**
- Modify: `frontend/src/components/stats/BudgetVsActual.tsx`
- Modify: `frontend/src/components/stats/__tests__/BudgetVsActual.test.tsx`

**목표**: 기본 5개 표시 + 하단 더보기 → 접힌 오버뷰(총예산/총지출 + 프로그레스바 + 초과 배지) + 펼침(전체 카테고리)

- [ ] **Step 1: 테스트 추가/수정**

기존 테스트 파일(`BudgetVsActual.test.tsx`)에서:
- **삭제**: 50~53번 줄 `it('카테고리 목록을 표시한다', ...)` 전체 제거 — 기본 접힘 상태에서 카테고리가 숨겨지므로 더 이상 유효하지 않음
- **추가**: 아래 테스트들 (삭제 후 추가해야 기존 테스트가 남아있지 않음)

```tsx
// 기존 mockBudgetStats에 초과 카테고리 포함한 목 데이터 추가
const mockWithExceeded: BudgetMonthlyStatsResponse = {
  month: '2026-04',
  total_budget: 500000,
  total_spent: 540000,
  categories: [
    { category_name: '식비', budget_amount: 200000, spent_amount: 220000, remaining_amount: -20000, usage_percentage: 110, is_exceeded: true },
    { category_name: '교통', budget_amount: 100000, spent_amount: 80000, remaining_amount: 20000, usage_percentage: 80, is_exceeded: false },
  ],
}

// 기존 '카테고리 목록을 표시한다' 테스트 — 기본 접힌 상태에서는 카테고리가 보이지 않아야 함
// → 테스트명 변경 + 펼쳐야 표시되도록 수정
it('기본 접힌 상태에서는 카테고리 목록을 표시하지 않는다', () => {
  renderComponent()
  expect(screen.queryByText('식비')).not.toBeInTheDocument()
})

it('펼치기 클릭 시 전체 카테고리 목록을 표시한다', async () => {
  renderComponent()
  await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
  expect(screen.getByText('식비')).toBeInTheDocument()
  expect(screen.getByText('교통')).toBeInTheDocument()
})

it('접힌 상태에서 총예산과 총지출 오버뷰를 표시한다', () => {
  renderComponent()
  // total_budget: 500000, total_spent: 320000
  expect(screen.getByText(/500,000/)).toBeInTheDocument()
  expect(screen.getByText(/320,000/)).toBeInTheDocument()
})

it('초과 카테고리가 있으면 초과 배지를 표시한다', () => {
  renderComponent({ budgetStats: mockWithExceeded })
  expect(screen.getByText(/초과/)).toBeInTheDocument()
})

it('total_budget이 null이면 예산 미설정 안내를 표시한다', () => {
  const statsNoTotal = { ...mockBudgetStats, total_budget: null as unknown as number }
  renderComponent({ budgetStats: statsNoTotal })
  expect(screen.getByText(/예산이 설정되지 않았습니다/)).toBeInTheDocument()
})
```

또한 `import userEvent from '@testing-library/user-event'` 추가.

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/BudgetVsActual.test.tsx
```

Expected: 새로 추가한 테스트들이 FAIL (구현 전이므로)

- [ ] **Step 3: BudgetVsActual 구현**

```tsx
// frontend/src/components/stats/BudgetVsActual.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { BudgetMonthlyStatsResponse } from '../../types'
import { formatAmount } from '../../utils/format'
import SectionHeader from './SectionHeader'

interface BudgetVsActualProps {
  budgetStats: BudgetMonthlyStatsResponse | null
  monthStr?: string
}

export default function BudgetVsActual({ budgetStats, monthStr }: BudgetVsActualProps) {
  const [expanded, setExpanded] = useState(false)

  if (!budgetStats || budgetStats.categories.length === 0) return null

  const { total_budget, total_spent, categories } = budgetStats
  const totalUsage = total_budget && total_budget > 0 ? (total_spent / total_budget) * 100 : null
  const exceededCount = categories.filter(c => c.is_exceeded).length

  return (
    <div
      className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6"
      data-testid="budget-vs-actual"
    >
      <SectionHeader
        icon="💰"
        title="예산 상황"
        manageTo="/budgets"
        expanded={expanded}
        onToggle={() => setExpanded(p => !p)}
      />

      {/* 오버뷰: 총예산/총지출 + 프로그레스바 */}
      <div className="mt-3">
        {total_budget != null && total_budget > 0 ? (
          <>
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)]">
                  {formatAmount(total_spent)}
                  <span className="text-[var(--text-muted)]"> / {formatAmount(total_budget)}</span>
                </span>
                {exceededCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
                    ⚠ {exceededCount}개 초과
                  </span>
                )}
              </div>
              {totalUsage != null && (
                <span className="text-xs text-[var(--text-muted)]">{totalUsage.toFixed(1)}%</span>
              )}
            </div>
            {totalUsage != null && (
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-[var(--border-default)]">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    totalUsage > 100 ? 'bg-red-500' : totalUsage >= 80 ? 'bg-amber-500' : 'bg-grape-500'
                  }`}
                  style={{ width: `${Math.min(totalUsage, 100)}%` }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="py-2">
            <p className="text-sm text-[var(--text-muted)]">예산이 설정되지 않았습니다</p>
            <Link
              to="/budgets"
              className="text-xs text-grape-600 hover:text-grape-700 font-medium mt-1 inline-block"
            >
              설정하기 →
            </Link>
          </div>
        )}
      </div>

      {/* 펼침: 전체 카테고리 목록 */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {categories.map((cat) => (
            <div key={cat.category_name}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <Link
                    to={monthStr ? `/?month=${monthStr}&category=${cat.category_name}` : `/?category=${cat.category_name}`}
                    className="text-sm font-medium text-[var(--text-primary)] hover:text-grape-600 transition-colors"
                  >
                    {cat.category_name}
                  </Link>
                  {cat.is_exceeded && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">초과</span>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-sm font-semibold ${cat.is_exceeded ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                    {formatAmount(cat.spent_amount)}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]"> / {formatAmount(cat.budget_amount)}</span>
                </div>
              </div>
              <div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    cat.is_exceeded ? 'bg-red-500' : cat.usage_percentage >= 80 ? 'bg-amber-500' : 'bg-grape-500'
                  }`}
                  style={{ width: `${Math.min(cat.usage_percentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 text-right">{cat.usage_percentage.toFixed(1)}%</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/BudgetVsActual.test.tsx
```

Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/stats/BudgetVsActual.tsx \
        frontend/src/components/stats/__tests__/BudgetVsActual.test.tsx
git commit -m "feat: BudgetVsActual 접기/펼치기 개선 — SectionHeader 적용, 오버뷰 추가"
```

---

## Task 3: RecurringManageSection 개선

**Files:**
- Modify: `frontend/src/components/stats/RecurringManageSection.tsx`
- Modify: `frontend/src/components/stats/__tests__/RecurringManageSection.test.tsx`

**목표**: 하단 푸터 제거, 접기/펼치기 버튼 → SectionHeader chevron으로 이동

- [ ] **Step 1: 테스트 수정**

`RecurringManageSection.test.tsx` 에서:
- **삭제**: 69~79번 줄 `it('활성 건수와 이번 달 지출 합계를 표시한다', ...)` 전체 제거
- **추가**: 아래 교체 테스트 (삭제 후 추가)

```tsx
// 기존 (69~79번 줄 전체 삭제):
// it('활성 건수와 이번 달 지출 합계를 표시한다', () => { ... })

// 교체:
it('이번 달 고정비 합계를 헤더에 표시한다', () => {
  const executedMap = new Map([[1, 17000], [2, 14900]])
  const items = [
    makeItem({ id: 1, amount: 17000, type: 'expense', next_due_date: '2026-05-15' }),
    makeItem({ id: 2, amount: 14900, type: 'expense', next_due_date: '2026-05-28' }),
  ]
  wrap(<RecurringManageSection items={items} monthStr={MONTH_STR} executedAmountMap={executedMap} />)
  // 하단 푸터 없음, 헤더 서브텍스트에만 고정비 총액 표시
  expect(screen.getByText(/31,900/)).toBeInTheDocument()
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/RecurringManageSection.test.tsx
```

Expected: 교체된 테스트가 FAIL (구현 전), 기존 다른 테스트는 PASS

- [ ] **Step 3: RecurringManageSection 구현**

```tsx
// frontend/src/components/stats/RecurringManageSection.tsx
// 변경점: SectionHeader 적용, 하단 푸터(활성 N건 · 이번 달 지출) 제거
// OverviewChips와 헤더 서브텍스트는 유지

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatAmount } from '../../utils/format'
import type { RecurringTransaction } from '../../types'
import SectionHeader from './SectionHeader'

// ... (isDone, getItemStatus, StatusBadge, OverviewChips 함수는 기존 유지)

export default function RecurringManageSection({ items, monthStr, executedAmountMap }: Props) {
  const [expanded, setExpanded] = useState(false)

  const monthlyExpenseTotal = items
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => {
      const actual = executedAmountMap.get(r.id)
      return sum + (actual ?? r.amount)
    }, 0)

  if (items.length === 0) {
    return (
      <div id="section-recurring" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
        <SectionHeader
          icon="🔄"
          title="정기거래"
          manageTo="/recurring"
          expanded={false}
          onToggle={() => {}}
          collapsible={false}
        />
        <p className="text-sm text-[var(--text-muted)] text-center py-2 mt-3">
          정기거래를 등록하면 고정비 현황을 볼 수 있어요
        </p>
        <div className="text-center mt-2">
          <Link to="/recurring" className="text-xs text-grape-600 hover:text-grape-700 font-medium transition-colors">
            등록하기 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div id="section-recurring" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      <SectionHeader
        icon="🔄"
        title="정기거래"
        manageTo="/recurring"
        expanded={expanded}
        onToggle={() => setExpanded(p => !p)}
      >
        {/* 헤더 서브텍스트 */}
        {monthlyExpenseTotal > 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-tight">
            이번 달 고정비{' '}
            <span className="font-medium text-[var(--text-secondary)]">{formatAmount(monthlyExpenseTotal)}</span>
          </p>
        )}
      </SectionHeader>

      {/* 접힌 상태: 상태 칩 오버뷰 */}
      {!expanded && (
        <div className="mt-2">
          <OverviewChips items={items} monthStr={monthStr} executedAmountMap={executedAmountMap} />
        </div>
      )}

      {/* 펼침: 항목 목록 */}
      {expanded && (
        <div className="mt-3">
          {items.map((item, idx) => {
            // ... 기존 항목 렌더 로직 유지 (isExpense, status, executedAmount, displayAmount, amountChanged, dimmed)
          })}
        </div>
      )}
    </div>
  )
}
```

> 항목 렌더 내부 로직(isExpense, status 판별, amountChanged 등)은 기존 코드 그대로 유지. 달라지는 것은 하단 `<div className="flex items-center justify-between pt-2 mt-2 ...">` 푸터 블록 전체 삭제.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/RecurringManageSection.test.tsx
```

Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/stats/RecurringManageSection.tsx \
        frontend/src/components/stats/__tests__/RecurringManageSection.test.tsx
git commit -m "feat: RecurringManageSection SectionHeader 적용, 중복 푸터 제거"
```

---

## Task 4: CardUsageSummary 개선

**Files:**
- Modify: `frontend/src/components/stats/CardUsageSummary.tsx`
- Modify: `frontend/src/components/stats/__tests__/CardUsageSummary.test.tsx`

**목표**: 접기/펼치기 추가, 접힌 오버뷰(달성/진행 현황) 신규 구현

- [ ] **Step 1: 테스트 추가/수정**

`CardUsageSummary.test.tsx`에서:
- **교체**: `it('각 결제수단의 이름과 사용액을 표시한다', ...)` (59~63번 줄) → 펼쳐야 보이는 버전으로 교체
- **교체**: `it('달성률을 표시한다', ...)` (65~68번 줄) → 펼쳐야 보이는 버전으로 교체
- **추가**: 접힌 오버뷰 관련 신규 테스트

```tsx
// CardUsageSummary.test.tsx 상단에 추가
import userEvent from '@testing-library/user-event'

// 기존 59~68번 줄 교체:
it('펼쳤을 때 각 결제수단의 이름과 사용액을 표시한다', async () => {
  renderComponent()
  await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
  expect(screen.getByText('삼성카드')).toBeInTheDocument()
  expect(screen.getByText('국민카드')).toBeInTheDocument()
})

it('펼쳤을 때 달성률을 표시한다', async () => {
  renderComponent()
  await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
  expect(screen.getByText('73.3%')).toBeInTheDocument()
  expect(screen.getByText('30.0%')).toBeInTheDocument()
})

// 신규 추가:
// 기본 접힌 상태에서는 세부 내용이 숨겨짐
it('기본 접힌 상태에서 카드별 상세 프로그레스를 표시하지 않는다', () => {
  renderComponent()
  expect(screen.queryByText('73.3%')).not.toBeInTheDocument()
})

it('접힌 상태에서 달성/진행 오버뷰를 표시한다', () => {
  renderComponent()
  // mockUsage: 2개 카드, 둘 다 미달성
  expect(screen.getByText(/진행 중 2개/)).toBeInTheDocument()
})

it('달성한 카드가 있으면 달성 건수를 오버뷰에 표시한다', () => {
  const achievedUsage: PaymentMethodUsage[] = [
    { id: 1, name: '삼성카드', type: 'credit_card', monthly_target: 300000,
      spent_amount: 310000, usage_percentage: 103.3, remaining: 0 },
  ]
  renderComponent(achievedUsage)
  expect(screen.getByText(/달성 1개/)).toBeInTheDocument()
})

it('펼치기 클릭 시 카드별 상세 프로그레스가 표시된다', async () => {
  renderComponent()
  await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
  expect(screen.getByText('삼성카드')).toBeInTheDocument()
  expect(screen.getByText('73.3%')).toBeInTheDocument()
})

it('카드 1개일 때 접힌 오버뷰에 해당 카드 이름과 달성률을 표시한다', () => {
  renderComponent([mockUsage[0]])  // 삼성카드만
  expect(screen.getByText(/삼성카드/)).toBeInTheDocument()
  expect(screen.getByText(/73.3%/)).toBeInTheDocument()
})
```

기존 테스트 중 `각 결제수단의 이름과 사용액을 표시한다`, `달성률을 표시한다`는 "펼쳐야 보임"으로 수정.

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/CardUsageSummary.test.tsx
```

Expected: 일부 FAIL

- [ ] **Step 3: CardUsageSummary 구현**

```tsx
// frontend/src/components/stats/CardUsageSummary.tsx
import { useState } from 'react'
import { formatAmount } from '../../utils/format'
import type { PaymentMethodUsage } from '../../types'
import SectionHeader from './SectionHeader'

interface CardUsageSummaryProps {
  usage: PaymentMethodUsage[]
}

function UsageOverview({ targetUsage }: { targetUsage: PaymentMethodUsage[] }) {
  if (targetUsage.length === 1) {
    const item = targetUsage[0]
    const pct = item.usage_percentage ?? 0
    const achieved = pct >= 100
    return (
      <p className="text-sm text-[var(--text-secondary)] mt-2">
        {item.name}{' '}
        <span className={achieved ? 'text-leaf-600 font-medium' : ''}>{pct.toFixed(1)}%</span>
        {achieved
          ? ' · ✅ 달성'
          : item.remaining != null
            ? ` · 잔여 ${formatAmount(item.remaining)}`
            : null}
      </p>
    )
  }

  const achievedCount = targetUsage.filter(u => (u.usage_percentage ?? 0) >= 100).length
  const inProgressCount = targetUsage.length - achievedCount
  return (
    <p className="text-sm text-[var(--text-secondary)] mt-2">
      {achievedCount > 0 && <span className="text-leaf-600">달성 {achievedCount}개</span>}
      {achievedCount > 0 && inProgressCount > 0 && ' · '}
      {inProgressCount > 0 && `진행 중 ${inProgressCount}개`}
    </p>
  )
}

export default function CardUsageSummary({ usage }: CardUsageSummaryProps) {
  const [expanded, setExpanded] = useState(false)
  const targetUsage = usage.filter((u) => u.monthly_target != null)

  if (targetUsage.length === 0) return null

  return (
    <div
      className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6"
      data-testid="card-usage-summary"
    >
      <SectionHeader
        icon="💳"
        title="카드 실적"
        manageTo="/payment-methods"
        expanded={expanded}
        onToggle={() => setExpanded(p => !p)}
      />

      {/* 접힌 오버뷰 */}
      {!expanded && <UsageOverview targetUsage={targetUsage} />}

      {/* 펼침: 카드별 상세 */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {targetUsage.map((item) => {
            const pct = item.usage_percentage ?? 0
            return (
              <div key={item.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${pct >= 100 ? 'text-leaf-600' : 'text-[var(--text-primary)]'}`}>
                      {formatAmount(item.spent_amount)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]"> / {formatAmount(item.monthly_target!)}</span>
                  </div>
                </div>
                <div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      pct >= 100 ? 'bg-leaf-500' : pct >= 80 ? 'bg-grape-500' : 'bg-grape-400'
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-xs text-[var(--text-muted)]">{pct.toFixed(1)}%</span>
                  {item.remaining != null && (
                    <span className={`text-xs ${pct >= 100 ? 'text-leaf-600 font-medium' : 'text-[var(--text-muted)]'}`}>
                      {pct >= 100 ? '✅ 실적 달성' : `잔여 ${formatAmount(item.remaining)}`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/CardUsageSummary.test.tsx
```

Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/stats/CardUsageSummary.tsx \
        frontend/src/components/stats/__tests__/CardUsageSummary.test.tsx
git commit -m "feat: CardUsageSummary 접기/펼치기 + 달성 오버뷰 추가"
```

---

## Task 5: SavingsSection → 수입 구성 업그레이드

**Files:**
- Modify: `frontend/src/components/stats/SavingsSection.tsx`
- Modify: `frontend/src/components/stats/__tests__/SavingsSection.test.tsx`

**목표**: 카드명 "저축" → "수입 구성", stacked bar 추가, recurringTotal/expenseTotal props 추가

- [ ] **Step 1: 테스트 추가/수정**

```tsx
// SavingsSection.test.tsx 추가
import userEvent from '@testing-library/user-event'

// 카드명 변경 확인
it('카드 제목이 "수입 구성"이다', () => {
  renderSection()
  expect(screen.getByRole('heading', { name: /수입 구성/ })).toBeInTheDocument()
})

// stacked bar 렌더 확인 (incomeTotal > 0일 때)
it('수입이 있을 때 stacked bar를 표시한다', () => {
  renderSection({ recurringTotal: 800000, expenseTotal: 1800000 })
  expect(screen.getByTestId('income-flow-bar')).toBeInTheDocument()
})

// incomeTotal === 0 케이스
it('수입이 0이면 stacked bar를 표시하지 않는다', () => {
  renderSection({ incomeTotal: 0, recurringTotal: 0, expenseTotal: 0 })
  expect(screen.queryByTestId('income-flow-bar')).not.toBeInTheDocument()
})

// collapsible 분기 — 카테고리 2개 이상: 펼치기 가능
it('카테고리 2개 이상이면 펼치기 버튼을 표시한다', () => {
  renderSection()  // mockSavingsCategories = 3개
  expect(screen.getByRole('button', { name: '펼치기' })).toBeInTheDocument()
})

// collapsible 분기 — 카테고리 1개 이하: 항상 펼침, 버튼 없음
it('카테고리 1개이면 펼치기 버튼을 표시하지 않는다', () => {
  renderSection({
    savingsCategories: [{ category: '적금', amount: 300000 }],
    savingsTotal: 300000,
  })
  expect(screen.queryByRole('button', { name: /펼치기|접기/ })).not.toBeInTheDocument()
})

// 카테고리 breakdown은 펼쳐야 표시 (2개 이상인 경우)
it('기본 접힌 상태에서는 카테고리 breakdown을 표시하지 않는다', () => {
  renderSection()
  expect(screen.queryByText('적금')).not.toBeInTheDocument()
})

it('펼치기 클릭 시 카테고리 breakdown을 표시한다', async () => {
  renderSection()
  await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
  expect(screen.getByText('적금')).toBeInTheDocument()
  expect(screen.getByText('투자')).toBeInTheDocument()
})

// 기존 '카테고리별 내역을 표시한다' 테스트 → 펼쳐야 보이도록 수정
it('펼쳤을 때 카테고리별 내역을 표시한다', async () => {
  renderSection()
  await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
  expect(screen.getByText('적금')).toBeInTheDocument()
  expect(screen.getByText('투자')).toBeInTheDocument()
  expect(screen.getByText('보험')).toBeInTheDocument()
})
```

**테스트 변경 요약:**
- **삭제**: 37~41번 줄 `it('카테고리별 내역을 표시한다', ...)` 전체 제거 → 위 "펼쳤을 때" 버전으로 교체
- **업데이트**: 55~63번 줄 `it('저축 카테고리가 1개이면 카테고리 목록 없이 총액만 표시한다', ...)` → 새 구현에서 `collapsible=false`이면 breakdown이 항상 표시되므로 테스트 의도를 뒤집어야 함:

```tsx
// 기존 55~63번 줄 전체를 아래로 교체:
it('저축 카테고리가 1개이면 breakdown을 항상 표시한다 (chevron 없음)', () => {
  renderSection({
    savingsCategories: [{ category: '적금', amount: 300000 }],
    savingsTotal: 300000,
  })
  // collapsible=false → 접기/펼치기 버튼 없음
  expect(screen.queryByRole('button', { name: /펼치기|접기/ })).not.toBeInTheDocument()
  // breakdown은 항상 표시
  expect(screen.getByText('적금')).toBeInTheDocument()
})
```

- 기존 `총 저축액을 표시한다` (27번 줄) 유지 — `formatAmount`가 `₩` 접두사 포함 포맷 반환하므로 기존 단언(`'₩530,000'`) 그대로 통과함을 확인

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/SavingsSection.test.tsx
```

Expected: 일부 FAIL

- [ ] **Step 3: SavingsSection 구현**

```tsx
// frontend/src/components/stats/SavingsSection.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatAmount } from '../../utils/format'
import type { CategoryAmount } from '../../types'
import SectionHeader from './SectionHeader'

type SavingsSectionProps = {
  savingsTotal: number | undefined
  incomeTotal: number
  savingsCategories: CategoryAmount[]
  recurringTotal?: number   // optional — 고정비(정기거래 지출 합계), 미전달 시 0
  expenseTotal?: number     // optional — 총지출, 미전달 시 0
}

/** 수입 배분 stacked bar (순수 CSS flex 비율) */
function IncomeFlowBar({
  savingsPct,
  fixedPct,
  variablePct,
  remainingPct,
  incomeTotal,
}: {
  savingsPct: number
  fixedPct: number
  variablePct: number
  remainingPct: number
  incomeTotal: number  // 초과 금액 역산에 필요
}) {
  const isOverspent = remainingPct < 0

  if (isOverspent) {
    // 지출 > 수입: 여유 구간 제거, 나머지 3구간으로 100% 채움
    const total = savingsPct + fixedPct + variablePct || 1
    return (
      <div data-testid="income-flow-bar" className="space-y-1">
        <div className="flex h-2 rounded-full overflow-hidden w-full">
          <div className="bg-leaf-500 transition-all" style={{ width: `${(savingsPct / total) * 100}%` }} />
          <div className="bg-warm-400 transition-all" style={{ width: `${(fixedPct / total) * 100}%` }} />
          <div className="bg-grape-400 transition-all" style={{ width: `${(variablePct / total) * 100}%` }} />
        </div>
        {/* 초과 금액: remainingPct는 비율이므로 incomeTotal로 역산 */}
        <p className="text-xs text-red-600 text-right">
          초과 {formatAmount(Math.abs(Math.round((remainingPct / 100) * incomeTotal)))}
        </p>
      </div>
    )
  }

  return (
    <div data-testid="income-flow-bar" className="flex h-2 rounded-full overflow-hidden w-full">
      <div className="bg-leaf-500 transition-all" style={{ width: `${savingsPct}%` }} />
      <div className="bg-warm-400 transition-all" style={{ width: `${fixedPct}%` }} />
      <div className="bg-grape-400 transition-all" style={{ width: `${variablePct}%` }} />
      <div className="bg-[var(--border-default)] transition-all" style={{ width: `${remainingPct}%` }} />
    </div>
  )
}

/** 범례 점 */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}

export default function SavingsSection({
  savingsTotal,
  incomeTotal,
  savingsCategories,
  recurringTotal = 0,
  expenseTotal = 0,
}: SavingsSectionProps) {
  const hasData = savingsCategories.length > 0 && savingsTotal !== undefined
  const collapsible = savingsCategories.length >= 2
  const [expanded, setExpanded] = useState(false)

  // stacked bar 비율 계산 (incomeTotal > 0 전제)
  const showBar = incomeTotal > 0 && savingsTotal !== undefined
  const savingsPct = showBar ? (savingsTotal / incomeTotal) * 100 : 0
  const fixedPct = showBar ? (recurringTotal / incomeTotal) * 100 : 0
  const rawVariablePct = showBar ? ((expenseTotal - savingsTotal - recurringTotal) / incomeTotal) * 100 : 0
  const variablePct = Math.max(0, rawVariablePct) // 음수 클램프
  const remainingPct = showBar ? ((incomeTotal - expenseTotal) / incomeTotal) * 100 : 0
  const savingsRate = incomeTotal > 0 && savingsTotal !== undefined
    ? (savingsTotal / incomeTotal) * 100
    : undefined

  return (
    <div id="section-savings" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      <SectionHeader
        icon="📊"
        title="수입 구성"
        manageTo="/categories"
        expanded={expanded}
        onToggle={() => setExpanded(p => !p)}
        collapsible={collapsible}
      />

      {hasData ? (
        <div className="mt-3">
          {/* 오버뷰: 저축 총액 + 저축률 */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-bold text-[var(--text-primary)]">
              {formatAmount(savingsTotal!)}
            </span>
            {savingsRate !== undefined && (
              <span className="text-sm text-[var(--text-muted)]">
                수입의 {savingsRate.toFixed(1)}%
              </span>
            )}
          </div>

          {/* stacked bar */}
          {showBar && (
            <>
              <IncomeFlowBar
                savingsPct={savingsPct}
                fixedPct={fixedPct}
                variablePct={variablePct}
                remainingPct={remainingPct}
                incomeTotal={incomeTotal}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                <LegendDot color="bg-leaf-500" label="저축" />
                <LegendDot color="bg-warm-400" label="고정비" />
                <LegendDot color="bg-grape-400" label="변동비" />
                <LegendDot color="bg-[var(--border-default)]" label="여유" />
              </div>
            </>
          )}

          {/* 펼침: 구간별 금액 + 저축 카테고리 breakdown */}
          {(expanded || !collapsible) && (
            <div className="mt-3 space-y-2 pt-3 border-t border-[var(--border-default)]">
              {savingsCategories.map(c => (
                <div key={c.category} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">{c.category}</span>
                  <span className="text-sm tabular-nums text-[var(--text-primary)]">{formatAmount(c.amount)}</span>
                </div>
              ))}
              {showBar && (
                <>
                  <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                    <span>고정비</span>
                    <span className="tabular-nums">{formatAmount(recurringTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                    <span>변동비</span>
                    <span className="tabular-nums">{formatAmount(Math.max(0, expenseTotal - savingsTotal! - recurringTotal))}</span>
                  </div>
                  {remainingPct >= 0 && (
                    <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                      <span>여유</span>
                      <span className="tabular-nums text-leaf-600">{formatAmount(incomeTotal - expenseTotal)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 mt-3">
          <p className="text-sm text-[var(--text-tertiary)]">저축 카테고리를 설정하면 저축 현황을 볼 수 있어요</p>
          <Link to="/categories" className="text-sm font-medium text-grape-600 hover:text-grape-700 mt-1 inline-block">
            카테고리 설정 →
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/SavingsSection.test.tsx
```

Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/stats/SavingsSection.tsx \
        frontend/src/components/stats/__tests__/SavingsSection.test.tsx
git commit -m "feat: SavingsSection → 수입 구성 업그레이드 — stacked bar, 접기/펼치기"
```

---

## Task 6: MonthlyComparison 개선 + TrendBarChart

**Files:**
- Modify: `frontend/src/components/stats/MonthlyComparison.tsx`
- Modify: `frontend/src/components/stats/__tests__/MonthlyComparison.test.tsx`

**목표**: SectionHeader 적용, 스파크라인 제거 → 3개월 트렌드 BarChart, 카테고리 변화에 미니 bar 추가

- [ ] **Step 1: 테스트 수정**

```tsx
// MonthlyComparison.test.tsx 수정

// **삭제**: 74~82번 줄 `it('trend 데이터가 2개 미만이면 스파크라인을 렌더하지 않는다', ...)` 전체 제거
// (구현 후에도 length===0으로 통과하지만 의미 없는 스파크라인 단언은 제거 필수)

// **추가**: 아래 2개 테스트
it('trend 데이터가 2개 이상이면 TrendBarChart를 렌더한다', async () => {
  const user = userEvent.setup()
  render(
    <MonthlyComparison
      expenseComparison={mockComparison}
      incomeComparison={mockIncomeComparison}
    />
  )
  await user.click(screen.getByRole('button', { name: /펼치기/ }))
  expect(screen.getByTestId('trend-bar-chart')).toBeInTheDocument()
})

it('trend 데이터가 2개 미만이면 TrendBarChart를 렌더하지 않는다', async () => {
  const user = userEvent.setup()
  render(
    <MonthlyComparison
      expenseComparison={{ ...mockComparison, trend: [{ label: '4월', total: 1_200_000 }] }}
      incomeComparison={{ ...mockIncomeComparison, trend: [{ label: '4월', total: 3_500_000 }] }}
    />
  )
  await user.click(screen.getByRole('button', { name: /펼치기/ }))
  expect(screen.queryByTestId('trend-bar-chart')).not.toBeInTheDocument()
  expect(screen.getByText(/비교할 이전 데이터가 없습니다/)).toBeInTheDocument()
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/MonthlyComparison.test.tsx
```

Expected: 새로 추가한 TrendBarChart 관련 테스트 2개 FAIL
- `'trend 데이터가 2개 이상이면 TrendBarChart를 렌더한다'` → FAIL (data-testid="trend-bar-chart" 없음)
- `'trend 데이터가 2개 미만이면 TrendBarChart를 렌더하지 않는다'` → FAIL ("비교할 이전 데이터가 없습니다" 텍스트 없음)

기존 `queryAllByTestId('sparkline')` 관련 코드는 구현 후 length===0을 반환하므로 미리 제거해도 무방.

- [ ] **Step 3: MonthlyComparison 구현**

`Sparkline` 컴포넌트와 `ComparisonRow`의 `showTrend` prop 제거. `TrendBarChart` 추가. SectionHeader 적용.

```tsx
// TrendBarChart 내부 컴포넌트 (MonthlyComparison.tsx 내)
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

function TrendBarChart({
  expenseTrend,
  incomeTrend,
}: {
  expenseTrend: PeriodTotal[]
  incomeTrend: PeriodTotal[]
}) {
  if (expenseTrend.length < 2) {
    return (
      <p className="text-sm text-[var(--text-tertiary)] py-4 text-center">
        비교할 이전 데이터가 없습니다
      </p>
    )
  }

  const incomeMap = new Map(incomeTrend.map(d => [d.label, d.total]))
  const chartData = expenseTrend.map(d => ({
    name: d.label,
    수입: incomeMap.get(d.label) ?? 0,
    지출: d.total,
  }))

  return (
    <div data-testid="trend-bar-chart">
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={chartData} barCategoryGap="30%">
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `${Math.round(v / 10000)}만`}
            tick={{ fontSize: 10 }}
            width={32}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${Math.round(value / 10000).toLocaleString()}만원`,
              name,
            ]}
          />
          <Bar dataKey="수입" fill="#4ade80" radius={[2, 2, 0, 0]} />
          <Bar dataKey="지출" fill="#a855f7" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-1">
        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-leaf-400" /> 수입
        </span>
        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-grape-500" /> 지출
        </span>
      </div>
    </div>
  )
}
```

카테고리 변화 TOP3에 미니 bar 추가:

```tsx
// 기존 카테고리 변화 텍스트 렌더 부분 수정
{topCategoryChanges.map(c => {
  const isIncrease = (c.change_percentage ?? 0) > 0
  const maxPct = Math.max(...topCategoryChanges.map(x => Math.abs(x.change_percentage ?? 0)))
  const barWidth = maxPct > 0 ? (Math.abs(c.change_percentage ?? 0) / maxPct) * 100 : 0
  return (
    <div key={c.category} className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <span>{isIncrease ? '🔺' : '🔻'}</span>
          <span className="text-[var(--text-primary)]">{c.category}</span>
        </div>
        <div className="flex items-center gap-2 tabular-nums">
          <span className={isIncrease ? 'text-red-600' : 'text-leaf-600'}>
            {isIncrease ? '+' : ''}{c.change_percentage?.toFixed(0)}%
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            ({formatChange(c.change_amount)})
          </span>
        </div>
      </div>
      {/* 미니 horizontal bar */}
      <div className="h-1 rounded-full bg-[var(--border-default)] overflow-hidden">
        <div
          className={`h-full rounded-full ${isIncrease ? 'bg-red-400' : 'bg-leaf-400'} transition-all`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  )
})}
```

또한 `ComparisonRow`에서 `showTrend` prop과 `Sparkline` 관련 코드 제거. SectionHeader 적용.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/MonthlyComparison.test.tsx
```

Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/stats/MonthlyComparison.tsx \
        frontend/src/components/stats/__tests__/MonthlyComparison.test.tsx
git commit -m "feat: MonthlyComparison SectionHeader 통일, 스파크라인 → TrendBarChart 교체"
```

---

## Task 7: InsightsPage props 전달 업데이트

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`

- [ ] **Step 1: SavingsSection에 recurringTotal, expenseTotal 전달**

`InsightsPage.tsx`에서 SavingsSection 렌더 부분을 찾아 두 props 추가:

```tsx
// 변경 전
<SavingsSection
  savingsTotal={savingsTotal}
  incomeTotal={incomeStats?.total ?? 0}
  savingsCategories={savingsCategories}
/>

// 변경 후
<SavingsSection
  savingsTotal={savingsTotal}
  incomeTotal={incomeStats?.total ?? 0}
  savingsCategories={savingsCategories}
  recurringTotal={recurringTotal}
  expenseTotal={expenseStats?.total ?? 0}
/>
```

`recurringTotal`은 InsightsPage 내 `useMemo`로 이미 계산 중. `expenseStats?.total`도 이미 존재.

- [ ] **Step 2: 전체 테스트 실행**

```bash
cd frontend && npm run test:run
```

Expected: PASS (전체, 기존 테스트 포함)

- [ ] **Step 3: TypeScript 빌드 확인**

```bash
cd frontend && npm run build
```

Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/InsightsPage.tsx
git commit -m "feat: InsightsPage SavingsSection에 수입 배분 props 전달"
```

---

## Task 8: 가이드 / 체인지로그 업데이트

**Files:**
- Modify: `frontend/src/data/changelogs.ts`
- Modify: `frontend/src/pages/GuidePage.tsx` (저축 → 수입 구성 언급 있는 경우)

- [ ] **Step 1: 현재 최신 버전 확인 후 changelogs.ts 맨 앞에 항목 추가**

```bash
# 현재 최신 버전 확인
head -10 frontend/src/data/changelogs.ts
```

확인된 최신 버전에서 patch 숫자를 +1 한 버전을 아래 `version` 필드에 기입.

```typescript
// frontend/src/data/changelogs.ts 배열 맨 앞
{
  version: '0.x.0',  // 위 head 출력의 최신 버전 + 1
  date: '2026-04-14',
  title: '모아보기 카드 UX 개선',
  items: [
    { tag: '개선', text: '예산/정기거래/카드실적/지난달 비교 카드에 접기/펼치기 통일' },
    { tag: '신규', text: '저축 카드 → 수입 구성으로 업그레이드 (수입 배분 구조 시각화)' },
    { tag: '개선', text: '지난달과 비교 그래프를 3개월 트렌드 차트로 교체' },
  ],
},
```

- [ ] **Step 2: GuidePage.tsx 확인 및 수정**

`GuidePage.tsx`에서 "저축" 섹션을 검색하여 "수입 구성"으로 업데이트.

```bash
cd frontend && grep -n "저축" src/pages/GuidePage.tsx
```

해당 줄을 "수입 구성 (이전: 저축)" 또는 새 카드명으로 업데이트.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/data/changelogs.ts frontend/src/pages/GuidePage.tsx
git commit -m "docs: 모아보기 카드 UX 개선 체인지로그 및 가이드 업데이트"
```

---

## Task 9: 전체 검증

- [ ] **Step 1: 전체 테스트 + 빌드**

```bash
cd frontend && npm run lint && npm run test:run && npm run build
```

Expected: lint 경고 없음, 전체 테스트 PASS, 빌드 성공

- [ ] **Step 2: 개발 서버에서 모아보기 직접 확인**

```bash
cd frontend && npm run dev
```

브라우저에서 `http://localhost:5173/insights` 접속 후 확인 항목:
- [ ] 모든 카드 기본 접힘 상태
- [ ] 각 카드 chevron 탭 → 펼침/접힘 동작
- [ ] "관리" 링크 탭 → 해당 페이지 이동 (접기 트리거 안 됨)
- [ ] 예산 상황: 초과 배지 표시 여부
- [ ] 정기거래: 하단 푸터 미표시 확인
- [ ] 카드실적: 오버뷰 텍스트 확인
- [ ] 수입 구성: stacked bar 렌더, 카드명 확인
- [ ] 지난달 비교: TrendBarChart 렌더 확인

- [ ] **Step 3: 최종 커밋 (필요 시)**

```bash
git add -p  # 잔여 변경사항 확인
git commit -m "chore: 모아보기 카드 UX 개선 최종 정리"
```

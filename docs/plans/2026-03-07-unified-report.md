# 종합 리포트 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** InsightsPage의 주간/월간/연간/AI 탭 구조를 단일 종합 리포트로 교체하여 수입·지출·순수익·저축률·예산·자동 하이라이트를 한 화면에 표시한다.

**Architecture:** 기존 InsightsPage를 리뉴얼하여 기간 선택 → 핵심 지표 → 복합 추이 차트 → 예산 현황 → 자동 하이라이트 → AI 심층 분석 순서로 구성한다. 신규 백엔드 API 없음 — 기존 `/expenses/stats`, `/income/stats`, `/expenses/stats/comparison`, `/budgets/monthly-stats` endpoint를 병렬 호출하고 클라이언트에서 순수익·저축률을 계산한다.

**Tech Stack:** React 19, TypeScript, Chart.js (react-chartjs-2), Tailwind CSS v4 (Grape 디자인 시스템), Vitest + RTL

**Design Doc:** `docs/plans/2026-03-07-unified-report-design.md`

---

## Task 1: UnifiedSummaryCards 컴포넌트

**Files:**
- Create: `frontend/src/components/stats/UnifiedSummaryCards.tsx`
- Create: `frontend/src/components/stats/__tests__/UnifiedSummaryCards.test.tsx`

### Step 1: 테스트 작성

`frontend/src/components/stats/__tests__/UnifiedSummaryCards.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import UnifiedSummaryCards from '../UnifiedSummaryCards'

describe('UnifiedSummaryCards', () => {
  it('총 수입을 표시한다', () => {
    render(<UnifiedSummaryCards incomeTotal={3200000} expenseTotal={2400000} />)
    expect(screen.getByText('총 수입')).toBeInTheDocument()
    expect(screen.getByText('₩3,200,000')).toBeInTheDocument()
  })

  it('총 지출을 표시한다', () => {
    render(<UnifiedSummaryCards incomeTotal={3200000} expenseTotal={2400000} />)
    expect(screen.getByText('총 지출')).toBeInTheDocument()
    expect(screen.getByText('₩2,400,000')).toBeInTheDocument()
  })

  it('순수익을 올바르게 계산한다', () => {
    render(<UnifiedSummaryCards incomeTotal={3200000} expenseTotal={2400000} />)
    expect(screen.getByText('순수익')).toBeInTheDocument()
    expect(screen.getByText('₩800,000')).toBeInTheDocument()
  })

  it('저축률을 올바르게 계산한다', () => {
    render(<UnifiedSummaryCards incomeTotal={3200000} expenseTotal={2400000} />)
    expect(screen.getByText('저축률')).toBeInTheDocument()
    expect(screen.getByText('25.0%')).toBeInTheDocument()
  })

  it('적자일 때 순수익 카드에 음수 금액을 표시한다', () => {
    render(<UnifiedSummaryCards incomeTotal={2000000} expenseTotal={2400000} />)
    expect(screen.getByTestId('net-income-value')).toHaveTextContent('-₩400,000')
  })

  it('수입이 0일 때 저축률은 "-"를 표시한다', () => {
    render(<UnifiedSummaryCards incomeTotal={0} expenseTotal={100000} />)
    expect(screen.getByTestId('savings-rate-value')).toHaveTextContent('-')
  })
})
```

### Step 2: 테스트 실행 (실패 확인)

```bash
cd frontend && npm test -- --run src/components/stats/__tests__/UnifiedSummaryCards.test.tsx
```
Expected: FAIL — "Cannot find module"

### Step 3: 컴포넌트 구현

`frontend/src/components/stats/UnifiedSummaryCards.tsx`:

```tsx
interface UnifiedSummaryCardsProps {
  incomeTotal: number
  expenseTotal: number
}

function formatAmount(amount: number): string {
  const abs = Math.abs(amount)
  const formatted = `₩${abs.toLocaleString('ko-KR')}`
  return amount < 0 ? `-${formatted}` : formatted
}

export default function UnifiedSummaryCards({ incomeTotal, expenseTotal }: UnifiedSummaryCardsProps) {
  const net = incomeTotal - expenseTotal
  const savingsRate = incomeTotal > 0 ? (net / incomeTotal) * 100 : null

  const netColor = net >= 0 ? 'text-leaf-700' : 'text-red-600'
  const rateColor = savingsRate === null
    ? 'text-warm-400'
    : savingsRate >= 20 ? 'text-leaf-700'
    : savingsRate >= 10 ? 'text-amber-600'
    : 'text-red-600'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="bg-gradient-to-br from-leaf-50 to-leaf-100 border border-leaf-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-leaf-700/70">총 수입</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-warm-900 mt-1">{formatAmount(incomeTotal)}</p>
      </div>
      <div className="bg-gradient-to-br from-grape-50 to-grape-100 border border-grape-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-grape-700/70">총 지출</p>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-warm-900 mt-1">{formatAmount(expenseTotal)}</p>
      </div>
      <div className="bg-white border border-warm-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-warm-500">순수익</p>
        <p data-testid="net-income-value" className={`text-xl sm:text-2xl font-bold mt-1 ${netColor}`}>{formatAmount(net)}</p>
      </div>
      <div className="bg-white border border-warm-200/60 rounded-2xl shadow-sm p-4 sm:p-5">
        <p className="text-sm text-warm-500">저축률</p>
        <p data-testid="savings-rate-value" className={`text-xl sm:text-2xl font-bold mt-1 ${rateColor}`}>
          {savingsRate !== null ? `${savingsRate.toFixed(1)}%` : '-'}
        </p>
      </div>
    </div>
  )
}
```

### Step 4: 테스트 실행 (통과 확인)

```bash
npm test -- --run src/components/stats/__tests__/UnifiedSummaryCards.test.tsx
```
Expected: 6 tests PASS

### Step 5: 커밋

```bash
git add frontend/src/components/stats/UnifiedSummaryCards.tsx \
        frontend/src/components/stats/__tests__/UnifiedSummaryCards.test.tsx
git commit -m "feat: UnifiedSummaryCards 컴포넌트 추가 (수입/지출/순수익/저축률)"
```

---

## Task 2: CombinedTrendChart 컴포넌트

**Files:**
- Create: `frontend/src/components/stats/CombinedTrendChart.tsx`
- Create: `frontend/src/components/stats/__tests__/CombinedTrendChart.test.tsx`

### Step 1: 테스트 작성

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CombinedTrendChart from '../CombinedTrendChart'

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
}))

const mockTrend = [
  { label: '03/01', amount: 80000 },
  { label: '03/02', amount: 120000 },
]

describe('CombinedTrendChart', () => {
  it('수입과 지출 범례를 표시한다', () => {
    render(<CombinedTrendChart expenseTrend={mockTrend} incomeTrend={mockTrend} />)
    expect(screen.getByText('지출')).toBeInTheDocument()
    expect(screen.getByText('수입')).toBeInTheDocument()
  })

  it('데이터가 없을 때 빈 상태를 표시한다', () => {
    render(<CombinedTrendChart expenseTrend={[]} incomeTrend={[]} />)
    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument()
  })

  it('차트 제목을 표시한다', () => {
    render(<CombinedTrendChart expenseTrend={mockTrend} incomeTrend={mockTrend} />)
    expect(screen.getByText('수입 / 지출 흐름')).toBeInTheDocument()
  })
})
```

### Step 2: 테스트 실행 (실패 확인)

```bash
npm test -- --run src/components/stats/__tests__/CombinedTrendChart.test.tsx
```

### Step 3: 컴포넌트 구현

TrendChart를 참고하되 두 데이터셋을 사용한다. `frontend/src/components/stats/CombinedTrendChart.tsx`:

```tsx
import { useRef, useState } from 'react'
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { TrendPoint } from '../../types'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend)

interface CombinedTrendChartProps {
  expenseTrend: TrendPoint[]
  incomeTrend: TrendPoint[]
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

function formatAxisAmount(v: number): string {
  const n = Number(v)
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(0)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만원`
  if (n >= 1_000) return `${Math.round(n / 1_000)}천원`
  return `${n}원`
}

export default function CombinedTrendChart({ expenseTrend, incomeTrend }: CombinedTrendChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null)
  const [hiddenExpense, setHiddenExpense] = useState(false)
  const [hiddenIncome, setHiddenIncome] = useState(false)

  const labels = expenseTrend.length > 0
    ? expenseTrend.map((d) => d.label)
    : incomeTrend.map((d) => d.label)

  if (labels.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-4 sm:p-5">
        <h3 className="text-base font-semibold text-warm-700 mb-4">수입 / 지출 흐름</h3>
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-sm text-warm-400">데이터가 없습니다</p>
        </div>
      </div>
    )
  }

  const toggleDataset = (index: number, setHidden: (v: boolean) => void, current: boolean) => {
    const chart = chartRef.current
    if (!chart) return
    const next = !current
    chart.setDatasetVisibility(index, !next)
    chart.update()
    setHidden(next)
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: '지출',
        data: expenseTrend.map((d) => d.amount),
        borderColor: '#9333EA',
        backgroundColor: 'rgba(147, 51, 234, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#9333EA',
        tension: 0.3,
        fill: false,
      },
      {
        label: '수입',
        data: incomeTrend.map((d) => d.amount),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#22c55e',
        tension: 0.3,
        fill: false,
      },
    ],
  }

  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-warm-700 mb-3">수입 / 지출 흐름</h3>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => toggleDataset(0, setHiddenExpense, hiddenExpense)}
          className={`flex items-center gap-1.5 text-sm rounded-lg px-2 py-1 transition-all hover:bg-warm-50 ${hiddenExpense ? 'opacity-35' : 'opacity-100'}`}
        >
          <span className="w-8 h-0.5 bg-grape-500 rounded-full inline-block" />
          <span className="text-warm-600">지출</span>
        </button>
        <button
          onClick={() => toggleDataset(1, setHiddenIncome, hiddenIncome)}
          className={`flex items-center gap-1.5 text-sm rounded-lg px-2 py-1 transition-all hover:bg-warm-50 ${hiddenIncome ? 'opacity-35' : 'opacity-100'}`}
        >
          <span className="w-8 h-0.5 bg-leaf-500 rounded-full inline-block" />
          <span className="text-warm-600">수입</span>
        </button>
      </div>
      <div className="h-[230px]">
        <Line
          ref={chartRef}
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatAmount(ctx.parsed.y ?? 0)}` } },
            },
            scales: {
              x: { ticks: { font: { size: 11 } }, grid: { display: false } },
              y: { ticks: { font: { size: 11 }, callback: (v) => formatAxisAmount(Number(v)) } },
            },
          }}
        />
      </div>
    </div>
  )
}
```

### Step 4: 테스트 실행

```bash
npm test -- --run src/components/stats/__tests__/CombinedTrendChart.test.tsx
```
Expected: 3 tests PASS

### Step 5: 커밋

```bash
git add frontend/src/components/stats/CombinedTrendChart.tsx \
        frontend/src/components/stats/__tests__/CombinedTrendChart.test.tsx
git commit -m "feat: CombinedTrendChart 컴포넌트 추가 (수입/지출 복합 차트)"
```

---

## Task 3: generateHighlights 순수 함수 + MonthlyHighlights 컴포넌트

**Files:**
- Create: `frontend/src/components/stats/MonthlyHighlights.tsx`
- Create: `frontend/src/components/stats/__tests__/MonthlyHighlights.test.tsx`

### Step 1: 타입 + 순수 함수 테스트 작성

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MonthlyHighlights, { generateHighlights } from '../MonthlyHighlights'
import type { BudgetMonthlyStatsResponse, ComparisonResponse } from '../../../types'

const baseBudget: BudgetMonthlyStatsResponse = {
  total_budget: 500000,
  total_spent: 400000,
  categories: [
    { category_name: '식비', budget_amount: 300000, spent_amount: 240000, usage_percentage: 80, is_exceeded: false },
  ],
}

const exceededBudget: BudgetMonthlyStatsResponse = {
  ...baseBudget,
  categories: [
    { category_name: '구독', budget_amount: 50000, spent_amount: 55000, usage_percentage: 110, is_exceeded: true },
  ],
}

const comparison: ComparisonResponse = {
  current: { label: '3월', total: 400000 },
  previous: { label: '2월', total: 480000 },
  change: { amount: -80000, percentage: -16.7 },
  trend: [],
  by_category_comparison: [
    { category: '식비', current: 240000, previous: 180000, change_amount: 60000, change_percentage: 33.3 },
  ],
}

describe('generateHighlights', () => {
  it('적자일 때 경고를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 200000, expenseTotal: 250000, budgetStats: null, comparison: null })
    expect(result.some(h => h.type === 'warning' && h.message.includes('초과'))).toBe(true)
  })

  it('예산 초과 카테고리 경고를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 500000, expenseTotal: 400000, budgetStats: exceededBudget, comparison: null })
    expect(result.some(h => h.message.includes('구독'))).toBe(true)
  })

  it('저축률 20% 이상일 때 성취 하이라이트를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 3200000, expenseTotal: 2400000, budgetStats: null, comparison: null })
    expect(result.some(h => h.type === 'positive' && h.message.includes('저축률'))).toBe(true)
  })

  it('전월 대비 지출 감소 시 성취 하이라이트를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 500000, expenseTotal: 400000, budgetStats: null, comparison })
    expect(result.some(h => h.type === 'positive' && h.message.includes('줄였'))).toBe(true)
  })

  it('카테고리 급증 시 일반 하이라이트를 생성한다', () => {
    const result = generateHighlights({ incomeTotal: 500000, expenseTotal: 400000, budgetStats: null, comparison })
    expect(result.some(h => h.message.includes('식비') && h.message.includes('33'))).toBe(true)
  })

  it('최대 4개만 반환한다', () => {
    const result = generateHighlights({ incomeTotal: 200000, expenseTotal: 250000, budgetStats: exceededBudget, comparison })
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('해당 없으면 빈 배열을 반환한다', () => {
    const result = generateHighlights({ incomeTotal: 0, expenseTotal: 0, budgetStats: null, comparison: null })
    expect(result).toHaveLength(0)
  })
})

describe('MonthlyHighlights', () => {
  it('하이라이트가 없으면 섹션을 렌더링하지 않는다', () => {
    const { container } = render(
      <MonthlyHighlights incomeTotal={0} expenseTotal={0} budgetStats={null} comparison={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('하이라이트가 있으면 섹션 제목을 표시한다', () => {
    render(
      <MonthlyHighlights incomeTotal={3200000} expenseTotal={2400000} budgetStats={null} comparison={null} />
    )
    expect(screen.getByText('💡 이번 달 주목할 점')).toBeInTheDocument()
  })
})
```

### Step 2: 테스트 실행 (실패 확인)

```bash
npm test -- --run src/components/stats/__tests__/MonthlyHighlights.test.tsx
```

### Step 3: 구현

`frontend/src/components/stats/MonthlyHighlights.tsx`:

```tsx
import type { BudgetMonthlyStatsResponse, ComparisonResponse } from '../../types'

interface Highlight {
  type: 'warning' | 'positive' | 'info'
  message: string
}

interface HighlightInput {
  incomeTotal: number
  expenseTotal: number
  budgetStats: BudgetMonthlyStatsResponse | null
  comparison: ComparisonResponse | null
}

export function generateHighlights({ incomeTotal, expenseTotal, budgetStats, comparison }: HighlightInput): Highlight[] {
  const highlights: Highlight[] = []
  const net = incomeTotal - expenseTotal

  // 1. 적자 경고 (최우선)
  if (incomeTotal > 0 && net < 0) {
    highlights.push({ type: 'warning', message: '이번 달 지출이 수입을 초과했습니다 ⚠️' })
  }

  // 2. 예산 초과 카테고리
  if (budgetStats) {
    const exceeded = budgetStats.categories.filter(c => c.is_exceeded)
    exceeded.slice(0, 2).forEach(c => {
      const over = c.spent_amount - c.budget_amount
      highlights.push({
        type: 'warning',
        message: `${c.category_name} 예산을 ${over.toLocaleString('ko-KR')}원 초과했습니다`,
      })
    })
  }

  // 3. 저축률 달성
  if (incomeTotal > 0 && net >= 0) {
    const rate = (net / incomeTotal) * 100
    if (rate >= 20) {
      highlights.push({ type: 'positive', message: `이번 달 저축률 ${rate.toFixed(1)}% 달성 🎉` })
    }
  }

  // 4. 전월 대비 총지출 감소
  if (comparison?.change.percentage !== null && comparison?.change.percentage !== undefined) {
    if (comparison.change.percentage <= -10) {
      const pct = Math.abs(comparison.change.percentage).toFixed(1)
      highlights.push({ type: 'positive', message: `지난달보다 지출을 ${pct}% 줄였습니다 👍` })
    }
  }

  // 5. 카테고리 급증 (30% 이상)
  if (comparison) {
    const surged = comparison.by_category_comparison.filter(
      c => c.change_percentage !== null && c.change_percentage > 30
    )
    surged.slice(0, 2).forEach(c => {
      highlights.push({
        type: 'info',
        message: `${c.category}가 지난달보다 ${Math.round(c.change_percentage!)}% 증가했습니다`,
      })
    })
  }

  // 우선순위: warning > positive > info, 최대 4개
  const sorted = [
    ...highlights.filter(h => h.type === 'warning'),
    ...highlights.filter(h => h.type === 'positive'),
    ...highlights.filter(h => h.type === 'info'),
  ]
  return sorted.slice(0, 4)
}

interface MonthlyHighlightsProps {
  incomeTotal: number
  expenseTotal: number
  budgetStats: BudgetMonthlyStatsResponse | null
  comparison: ComparisonResponse | null
}

const iconMap = { warning: '⚠️', positive: '✅', info: '•' } as const
const colorMap = {
  warning: 'text-amber-700',
  positive: 'text-leaf-700',
  info: 'text-warm-700',
} as const

export default function MonthlyHighlights(props: MonthlyHighlightsProps) {
  const highlights = generateHighlights(props)
  if (highlights.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-4 sm:p-6">
      <h2 className="text-base font-semibold text-warm-900 mb-3">💡 이번 달 주목할 점</h2>
      <ul className="space-y-2">
        {highlights.map((h, i) => (
          <li key={i} className={`text-sm flex items-start gap-2 ${colorMap[h.type]}`}>
            <span className="mt-0.5 flex-shrink-0">{iconMap[h.type]}</span>
            <span>{h.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Step 4: 테스트 실행

```bash
npm test -- --run src/components/stats/__tests__/MonthlyHighlights.test.tsx
```
Expected: 9 tests PASS

### Step 5: 커밋

```bash
git add frontend/src/components/stats/MonthlyHighlights.tsx \
        frontend/src/components/stats/__tests__/MonthlyHighlights.test.tsx
git commit -m "feat: MonthlyHighlights 컴포넌트 추가 (룰 기반 자동 하이라이트)"
```

---

## Task 4: BudgetVsActual 데이터 리프트업

월간 하이라이트가 예산 데이터를 필요로 하므로, 데이터 fetch를 InsightsPage로 올리고 BudgetVsActual은 prop을 받는다.

**Files:**
- Modify: `frontend/src/components/stats/BudgetVsActual.tsx` (없으면 InsightsPage.tsx 내부에서 추출)
- Modify: `frontend/src/pages/InsightsPage.tsx`

> BudgetVsActual은 현재 InsightsPage.tsx 내부 함수 컴포넌트임.

### Step 1: BudgetVsActual를 별도 파일로 분리하고 props 방식으로 변경

`frontend/src/components/stats/BudgetVsActual.tsx`:

```tsx
import { Wallet } from 'lucide-react'
import type { BudgetMonthlyStatsResponse } from '../../types'

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

interface BudgetVsActualProps {
  budgetStats: BudgetMonthlyStatsResponse | null
}

export default function BudgetVsActual({ budgetStats }: BudgetVsActualProps) {
  if (!budgetStats || budgetStats.categories.length === 0) return null

  const totalBudget = budgetStats.total_budget
  const totalSpent = budgetStats.total_spent
  const totalUsage = totalBudget && totalBudget > 0 ? (totalSpent / totalBudget) * 100 : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-4 sm:p-6" data-testid="budget-vs-actual">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-grape-600" />
        <h2 className="text-base font-semibold text-warm-900">예산 현황</h2>
      </div>

      {totalBudget != null && (
        <div className="mb-4 p-3 bg-warm-50 rounded-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-warm-600">이번 달 총 예산</span>
            <span className="text-sm font-semibold text-warm-900">{formatAmount(totalBudget)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-warm-600">총 지출</span>
            <span className={`text-sm font-semibold ${totalSpent > totalBudget ? 'text-red-600' : 'text-warm-900'}`}>
              {formatAmount(totalSpent)}
            </span>
          </div>
          {totalUsage != null && (
            <div>
              <div className="w-full bg-warm-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${totalUsage > 100 ? 'bg-red-500' : totalUsage >= 80 ? 'bg-amber-500' : 'bg-grape-500'}`}
                  style={{ width: `${Math.min(totalUsage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-warm-500 mt-1 text-right">{totalUsage.toFixed(1)}% 사용</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {budgetStats.categories.map((cat) => (
          <div key={cat.category_name}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-warm-800">{cat.category_name}</span>
                {cat.is_exceeded && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">초과</span>
                )}
              </div>
              <div className="text-right">
                <span className={`text-sm font-semibold ${cat.is_exceeded ? 'text-red-600' : 'text-warm-900'}`}>
                  {formatAmount(cat.spent_amount)}
                </span>
                <span className="text-xs text-warm-400"> / {formatAmount(cat.budget_amount)}</span>
              </div>
            </div>
            <div className="w-full bg-warm-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${cat.is_exceeded ? 'bg-red-500' : cat.usage_percentage >= 80 ? 'bg-amber-500' : 'bg-grape-500'}`}
                style={{ width: `${Math.min(cat.usage_percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-warm-400 mt-0.5 text-right">{cat.usage_percentage.toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 2: 빌드 확인

```bash
npm run build 2>&1 | grep -E "error|warning" | head -20
```
Expected: 빌드 성공 (InsightsPage에서 기존 BudgetVsActual 참조가 깨지면 다음 Task에서 해결)

### Step 3: 커밋

```bash
git add frontend/src/components/stats/BudgetVsActual.tsx
git commit -m "refactor: BudgetVsActual을 별도 컴포넌트로 분리 + props 방식으로 변경"
```

---

## Task 5: InsightsPage 리뉴얼

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx` (전면 리뉴얼)
- Modify: `frontend/src/pages/__tests__/InsightsPage.test.tsx` (전면 리뉴얼)

### Step 1: InsightsPage 테스트 먼저 재작성

기존 테스트를 새 구조에 맞게 교체한다.

`frontend/src/pages/__tests__/InsightsPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InsightsPage from '../InsightsPage'
import { mockInsights } from '../../mocks/fixtures'
import toast from 'react-hot-toast'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: null }) => unknown) =>
    selector({ activeHouseholdId: null }),
}))

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
}))

function renderInsightsPage() {
  return render(<InsightsPage />)
}

describe('InsightsPage', () => {
  describe('기본 렌더링', () => {
    it('페이지 제목을 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByRole('heading', { name: '리포트' })).toBeInTheDocument()
    })

    it('기간 네비게이터를 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByLabelText('이전 기간')).toBeInTheDocument()
      expect(screen.getByLabelText('다음 기간')).toBeInTheDocument()
    })

    it('주간/월간/연간 기간 선택 버튼을 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByRole('button', { name: '주간' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '월간' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '연간' })).toBeInTheDocument()
    })
  })

  describe('핵심 지표', () => {
    it('로딩 완료 후 총 수입/지출 카드를 표시한다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByText('총 수입')).toBeInTheDocument()
        expect(screen.getByText('총 지출')).toBeInTheDocument()
        expect(screen.getByText('순수익')).toBeInTheDocument()
        expect(screen.getByText('저축률')).toBeInTheDocument()
      })
    })
  })

  describe('기간 전환', () => {
    it('주간 버튼 클릭 시 주차 라벨이 표시된다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByRole('button', { name: '주간' }))
      await waitFor(() => {
        expect(screen.getByText(/주차/)).toBeInTheDocument()
      })
    })

    it('연간 버튼 클릭 시 연도 라벨이 표시된다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByRole('button', { name: '연간' }))
      await waitFor(() => {
        expect(screen.getByText(/^\d{4}년$/)).toBeInTheDocument()
      })
    })
  })

  describe('월간 전용 섹션', () => {
    it('월간 탭에서 예산 현황 섹션이 표시된다', async () => {
      renderInsightsPage()
      await waitFor(() => {
        expect(screen.getByTestId('budget-vs-actual')).toBeInTheDocument()
      })
    })

    it('주간 탭에서 예산 현황 섹션이 숨겨진다', async () => {
      const user = userEvent.setup()
      renderInsightsPage()
      await user.click(screen.getByRole('button', { name: '주간' }))
      await waitFor(() => {
        expect(screen.queryByTestId('budget-vs-actual')).not.toBeInTheDocument()
      })
    })
  })

  describe('AI 심층 분석', () => {
    it('AI 분석 생성 버튼을 표시한다', () => {
      renderInsightsPage()
      expect(screen.getByRole('button', { name: 'AI 심층 분석 생성하기' })).toBeInTheDocument()
    })

    it('생성 버튼 클릭 시 로딩 상태가 된다', async () => {
      server.use(
        http.post('/api/insights/generate', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json(mockInsights)
        })
      )
      const user = userEvent.setup()
      renderInsightsPage()
      user.click(screen.getByRole('button', { name: 'AI 심층 분석 생성하기' }))
      await waitFor(() => {
        expect(screen.getByText(/분석하고 있습니다/)).toBeInTheDocument()
      }, { timeout: 200 })
    })

    it('통계 API 실패 시 에러 토스트를 표시한다', async () => {
      const toastSpy = vi.spyOn(toast, 'error')
      server.use(
        http.get('/api/expenses/stats', () =>
          HttpResponse.json({ detail: 'Server Error' }, { status: 500 })
        )
      )
      renderInsightsPage()
      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith('통계를 불러오는데 실패했습니다')
      })
    })
  })
})
```

### Step 2: 테스트 실행 (실패 확인)

```bash
npm test -- --run src/pages/__tests__/InsightsPage.test.tsx
```
Expected: 여러 테스트 FAIL

### Step 3: InsightsPage 전면 리뉴얼

`frontend/src/pages/InsightsPage.tsx` 전체 교체:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { insightsApi, statsApi } from '../api/insights'
import { incomeApi } from '../api/income'
import { getMonthlyStats } from '../api/budgets'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import PeriodNavigator from '../components/stats/PeriodNavigator'
import UnifiedSummaryCards from '../components/stats/UnifiedSummaryCards'
import CombinedTrendChart from '../components/stats/CombinedTrendChart'
import BudgetVsActual from '../components/stats/BudgetVsActual'
import MonthlyHighlights from '../components/stats/MonthlyHighlights'
import type { BudgetMonthlyStatsResponse, ComparisonResponse, InsightsResponse, StatsResponse } from '../types'

type PeriodType = 'weekly' | 'monthly' | 'yearly'

// ── 날짜 유틸 ──

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDate(dateStr: string, period: PeriodType, direction: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (period === 'weekly') d.setDate(d.getDate() + direction * 7)
  else if (period === 'monthly') d.setMonth(d.getMonth() + direction)
  else d.setFullYear(d.getFullYear() + direction)
  return toDateStr(d)
}

function getNavLabel(dateStr: string, period: PeriodType): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (period === 'weekly') {
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
    const weekNum = Math.ceil((d.getDate() + firstDay.getDay()) / 7)
    return `${d.getMonth() + 1}월 ${weekNum}주차`
  }
  if (period === 'monthly') return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
  return `${d.getFullYear()}년`
}

function getMonthStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ── 마크다운 렌더링 ──

function renderBoldText(text: string): React.ReactNode[] {
  return text.split(/(\*\*.*?\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
      : part
  )
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h4 key={i} className="text-base font-semibold text-warm-900 mt-3 mb-1">{renderBoldText(line.slice(4))}</h4>
    if (line.startsWith('## ')) return <h3 key={i} className="text-lg font-semibold text-warm-900 mt-4 mb-2">{renderBoldText(line.slice(3))}</h3>
    if (line.startsWith('# ')) return <h2 key={i} className="text-xl font-bold text-warm-900 mt-4 mb-2">{renderBoldText(line.slice(2))}</h2>
    if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-warm-700">{renderBoldText(line.slice(2))}</li>
    if (/^\d+\. /.test(line)) return <li key={i} className="ml-4 text-warm-700 list-decimal">{renderBoldText(line.replace(/^\d+\. /, ''))}</li>
    if (line.trim() === '') return <div key={i} className="h-2" />
    return <p key={i} className="text-warm-700 leading-relaxed">{renderBoldText(line)}</p>
  })
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

// ── 메인 페이지 ──

export default function InsightsPage() {
  const [period, setPeriod] = useState<PeriodType>('monthly')
  const [dateStr, setDateStr] = useState(toDateStr(new Date()))
  const [expenseStats, setExpenseStats] = useState<StatsResponse | null>(null)
  const [incomeStats, setIncomeStats] = useState<StatsResponse | null>(null)
  const [budgetStats, setBudgetStats] = useState<BudgetMonthlyStatsResponse | null>(null)
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 통계 병렬 로딩
  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      setLoading(true)
      try {
        const [expRes, incRes] = await Promise.all([
          statsApi.getStats(period, dateStr, activeHouseholdId ?? undefined),
          incomeApi.getStats(period, dateStr, activeHouseholdId ?? undefined),
        ])
        if (cancelled) return
        setExpenseStats(expRes.data)
        setIncomeStats(incRes.data)

        // 월간 전용: 비교 + 예산
        if (period === 'monthly') {
          const monthStr = getMonthStr(dateStr)
          const [compRes, budgetRes] = await Promise.allSettled([
            statsApi.getComparison(period, dateStr, 3, activeHouseholdId ?? undefined),
            getMonthlyStats(monthStr),
          ])
          if (cancelled) return
          setComparison(compRes.status === 'fulfilled' ? compRes.value.data : null)
          setBudgetStats(budgetRes.status === 'fulfilled' ? budgetRes.value.data : null)
        } else {
          setComparison(null)
          setBudgetStats(null)
        }
      } catch {
        if (!cancelled) toast.error('통계를 불러오는데 실패했습니다')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [period, dateStr, activeHouseholdId])

  const handlePrev = useCallback(() => setDateStr(d => shiftDate(d, period, -1)), [period])
  const handleNext = useCallback(() => setDateStr(d => shiftDate(d, period, 1)), [period])

  const handlePeriodChange = (p: PeriodType) => {
    setPeriod(p)
    setDateStr(toDateStr(new Date()))
  }

  // AI 인사이트 생성
  const handleGenerate = async () => {
    if (!selectedMonth) { toast.error('월을 선택해주세요'); return }
    setAiLoading(true)
    try {
      const res = await insightsApi.generate(selectedMonth)
      setInsights(res.data)
      toast.success('인사이트가 생성되었습니다')
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '인사이트 생성에 실패했습니다'
      toast.error(message)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-grape-600" />
        <h1 className="text-xl font-bold text-grape-700">리포트</h1>
      </div>

      {/* 기간 선택 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-warm-100 p-1 rounded-lg">
          {(['weekly', 'monthly', 'yearly'] as PeriodType[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p ? 'bg-white text-grape-700 shadow-sm' : 'text-warm-500 hover:text-warm-700'
              }`}
            >
              {p === 'weekly' ? '주간' : p === 'monthly' ? '월간' : '연간'}
            </button>
          ))}
        </div>
        <PeriodNavigator label={getNavLabel(dateStr, period)} onPrev={handlePrev} onNext={handleNext} />
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-grape-600" />
        </div>
      )}

      {/* 핵심 지표 */}
      {!loading && expenseStats && incomeStats && (
        <UnifiedSummaryCards
          incomeTotal={incomeStats.total}
          expenseTotal={expenseStats.total}
        />
      )}

      {/* 복합 추이 차트 */}
      {!loading && expenseStats && incomeStats && (
        <CombinedTrendChart
          expenseTrend={expenseStats.trend}
          incomeTrend={incomeStats.trend}
        />
      )}

      {/* 월간 전용: 예산 현황 */}
      {!loading && period === 'monthly' && (
        <BudgetVsActual budgetStats={budgetStats} />
      )}

      {/* 월간 전용: 자동 하이라이트 */}
      {!loading && period === 'monthly' && expenseStats && incomeStats && (
        <MonthlyHighlights
          incomeTotal={incomeStats.total}
          expenseTotal={expenseStats.total}
          budgetStats={budgetStats}
          comparison={comparison}
        />
      )}

      {/* AI 심층 분석 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-grape-600" />
          <h2 className="text-base font-semibold text-warm-900">AI 심층 분석</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-4">
          <div className="flex-1 w-full">
            <label htmlFor="month-select" className="block text-sm font-medium text-warm-700 mb-2">분석할 월 선택</label>
            <input
              id="month-select"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 border border-warm-300 rounded-lg focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={aiLoading}
            className="w-full sm:w-auto px-6 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:bg-warm-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {aiLoading ? '분석 중...' : 'AI 심층 분석 생성하기'}
          </button>
        </div>
        <p className="text-sm text-warm-500">Claude API를 통해 해당 월의 지출 패턴을 분석하고 인사이트를 제공합니다. (최대 30초 소요)</p>

        {aiLoading && (
          <div className="mt-6 flex flex-col items-center gap-4 py-8">
            <Loader2 className="animate-spin h-10 w-10 text-grape-600" />
            <p className="text-warm-600">AI가 당신의 지출을 분석하고 있습니다...</p>
          </div>
        )}

        {!aiLoading && insights && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-grape-50 rounded-lg p-4">
                <p className="text-sm text-warm-600 mb-1">총 지출</p>
                <p className="text-2xl font-bold text-grape-700">{formatAmount(insights.total)}</p>
              </div>
              <div className="bg-warm-50 rounded-lg p-4">
                <p className="text-sm text-warm-600 mb-1">카테고리 수</p>
                <p className="text-2xl font-bold text-warm-700">{Object.keys(insights.by_category).length}개</p>
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-warm-700 space-y-2">
              {renderMarkdown(insights.insights)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

### Step 4: 테스트 실행

```bash
npm test -- --run src/pages/__tests__/InsightsPage.test.tsx
```
Expected: 모든 테스트 PASS

### Step 5: 전체 테스트 실행

```bash
npm test -- --run
```
Expected: 전체 PASS

### Step 6: 빌드 확인

```bash
npm run build
```
Expected: 빌드 성공

### Step 7: 커밋

```bash
git add frontend/src/pages/InsightsPage.tsx \
        frontend/src/pages/__tests__/InsightsPage.test.tsx
git commit -m "feat: InsightsPage 종합 리포트로 리뉴얼 (핵심지표/복합차트/하이라이트/AI)"
```

---

## Task 6: active.md 업데이트 + push

### Step 1: active.md에서 session 24 완료 처리

`~/.claude/org/active.md`에서 session 24 status를 completed로 수정, completed_at 기입.

### Step 2: 완료 보고서 작성

`~/.claude/org/reports/2026-03-07-podo-budget-unified-report.md` 작성 후 커밋.

### Step 3: Push

```bash
git push
```

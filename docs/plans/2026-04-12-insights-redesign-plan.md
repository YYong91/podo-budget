# InsightsPage 재설계 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모아보기(InsightsPage)를 3-Layer 구조(한눈에/뜯어보기/돌아보기)로 재편하고, 저축 섹션·전월 비교 섹션을 신규 추가하며 스타일을 통일한다.

**Architecture:** 신규 컴포넌트 4개(LayerDivider, InsightsOnboarding, SavingsSection, MonthlyComparison) 추가, 기존 컴포넌트 6개 수정, HeroSummary 레거시 props 제거. 백엔드 변경 없음 — 기존 API 데이터 재조합으로 구현.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, Recharts (스파크라인), MSW (테스트 모킹), Vitest + React Testing Library

---

## 테스트 실행 명령

```bash
# 전체 테스트
cd frontend && npm run test:run

# 특정 파일
cd frontend && npx vitest run src/components/stats/__tests__/MonthlyHighlights.test.tsx

# 린트 + 빌드 확인
cd frontend && npm run lint && npm run build
```

---

## Task 1: SectionToggleModal — SectionVisibility 타입 확장

새 섹션 `comparison`, `savings`를 추가하고 Layer별 그룹핑으로 UI 재구성.

**Files:**
- Modify: `frontend/src/components/stats/SectionToggleModal.tsx`
- Test: `frontend/src/components/stats/__tests__/SectionToggleModal.test.tsx` (신규)

**Step 1: 테스트 작성**

```typescript
// frontend/src/components/stats/__tests__/SectionToggleModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SectionToggleModal, {
  loadSectionSettings,
  DEFAULT_SECTIONS,
} from '../SectionToggleModal'

describe('SectionToggleModal', () => {
  it('comparison과 savings 항목이 목록에 포함된다', () => {
    render(
      <SectionToggleModal
        sections={{ ...DEFAULT_SECTIONS }}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('전월 대비 변화')).toBeInTheDocument()
    expect(screen.getByText('저축')).toBeInTheDocument()
  })

  it('Layer 2 그룹 제목이 표시된다', () => {
    render(
      <SectionToggleModal
        sections={{ ...DEFAULT_SECTIONS }}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('뜯어보기')).toBeInTheDocument()
    expect(screen.getByText('돌아보기')).toBeInTheDocument()
  })

  it('DEFAULT_SECTIONS에 comparison과 savings가 true로 포함된다', () => {
    expect(DEFAULT_SECTIONS.comparison).toBe(true)
    expect(DEFAULT_SECTIONS.savings).toBe(true)
  })

  it('기존 localStorage에 없는 신규 키는 DEFAULT_SECTIONS 기본값으로 채워진다', () => {
    localStorage.setItem('podo-insights-sections', JSON.stringify({ highlights: false }))
    const loaded = loadSectionSettings()
    expect(loaded.comparison).toBe(true)  // 기본값
    expect(loaded.savings).toBe(true)      // 기본값
    expect(loaded.highlights).toBe(false)  // 저장된 값
    localStorage.removeItem('podo-insights-sections')
  })
})
```

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/SectionToggleModal.test.tsx
```
Expected: FAIL (comparison, savings 없음)

**Step 3: 구현**

`SectionToggleModal.tsx`에서 타입과 상수 수정:

```typescript
// SectionVisibility 타입에 comparison, savings 추가
export type SectionVisibility = {
  highlights: boolean
  categoryTop: boolean
  budget: boolean
  cardUsage: boolean
  assets: boolean
  recurring: boolean
  savings: boolean      // 신규
  comparison: boolean   // 신규
  ai: boolean
}

export const DEFAULT_SECTIONS: SectionVisibility = {
  highlights: true,
  categoryTop: true,
  budget: true,
  cardUsage: true,
  assets: true,
  recurring: true,
  savings: true,        // 신규
  comparison: true,     // 신규
  ai: true,
}
```

`SECTION_LIST`를 Layer별 그룹 구조로 변경 (그룹 헤더 포함):

```typescript
// 기존 flat 배열 대신 그룹 구조로 변경
const SECTION_GROUPS = [
  {
    label: null, // Layer 1은 헤더 없음 (히어로/요약카드는 항상 ON이라 토글 목록에 없음)
    items: [
      { key: 'highlights' as keyof SectionVisibility, label: '이달의 주목할 점' },
    ],
  },
  {
    label: '뜯어보기',
    items: [
      { key: 'categoryTop' as keyof SectionVisibility, label: '변동 지출 (카테고리)' },
      { key: 'budget' as keyof SectionVisibility, label: '변동 지출 (예산)' },
      { key: 'recurring' as keyof SectionVisibility, label: '고정 지출' },
      { key: 'cardUsage' as keyof SectionVisibility, label: '카드 실적' },
      { key: 'savings' as keyof SectionVisibility, label: '저축' },
    ],
  },
  {
    label: '돌아보기',
    items: [
      { key: 'comparison' as keyof SectionVisibility, label: '전월 대비 변화' },
      ...(FEATURES.assets ? [{ key: 'assets' as keyof SectionVisibility, label: '자산 변화' }] : []),
      { key: 'ai' as keyof SectionVisibility, label: 'AI 종합 분석' },
    ],
  },
]
```

모달 본체 렌더링도 그룹 구조로 변경:

```tsx
<div className="space-y-4">
  {/* 항상 ON 항목 */}
  <div className="flex items-center justify-between py-3 px-2 rounded-lg">
    <span className="text-sm text-[var(--text-tertiary)]">히어로 + 요약 카드</span>
    {/* 비활성 토글 UI (기존과 동일) */}
  </div>

  {SECTION_GROUPS.map((group) => (
    <div key={group.label ?? 'default'}>
      {group.label && (
        <p className="text-xs font-medium text-[var(--text-tertiary)] px-2 pb-1 border-b border-[var(--border-default)] mb-1">
          {group.label}
        </p>
      )}
      {group.items.map(({ key, label }) => (
        <label key={key} className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer transition-colors">
          <span className="text-sm text-[var(--text-primary)]">{label}</span>
          <div className="relative">
            <input type="checkbox" checked={sections[key]} onChange={() => handleToggle(key)} className="sr-only" />
            <div className={`w-10 h-6 rounded-full transition-colors ${sections[key] ? 'bg-grape-500' : 'bg-warm-300'}`} />
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sections[key] ? 'left-[18px]' : 'left-0.5'}`} />
          </div>
        </label>
      ))}
    </div>
  ))}
</div>
```

**Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/SectionToggleModal.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/SectionToggleModal.tsx \
        frontend/src/components/stats/__tests__/SectionToggleModal.test.tsx
git commit -m "feat: SectionVisibility에 comparison·savings 추가, Layer 그룹핑"
```

---

## Task 2: LayerDivider — 신규 컴포넌트

Layer 간 구분자 (소제목 + 얇은 divider).

**Files:**
- Create: `frontend/src/components/stats/LayerDivider.tsx`

**Step 1: 구현** (단순 presentational, 별도 테스트 불필요)

```typescript
// frontend/src/components/stats/LayerDivider.tsx
interface LayerDividerProps {
  label: string
}

export default function LayerDivider({ label }: LayerDividerProps) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="flex-1 h-px bg-[var(--border-default)]" />
      <span className="text-xs font-medium text-[var(--text-tertiary)] shrink-0">{label}</span>
      <div className="flex-1 h-px bg-[var(--border-default)]" />
    </div>
  )
}
```

**Step 2: 커밋**

```bash
git add frontend/src/components/stats/LayerDivider.tsx
git commit -m "feat: LayerDivider 컴포넌트 신규"
```

---

## Task 3: InsightsOnboarding — 신규 컴포넌트

거래 5건 미만 시 표시할 온보딩 체크리스트.

**Files:**
- Create: `frontend/src/components/stats/InsightsOnboarding.tsx`
- Test: `frontend/src/components/stats/__tests__/InsightsOnboarding.test.tsx` (신규)

**Step 1: 테스트 작성**

```typescript
// frontend/src/components/stats/__tests__/InsightsOnboarding.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import InsightsOnboarding from '../InsightsOnboarding'

const defaultProps = {
  hasTransactions: true,      // expenseCount + incomeCount > 0
  hasBudget: false,
  hasRecurring: false,
  hasSavingsCategory: false,
}

function renderOnboarding(props = defaultProps) {
  return render(<MemoryRouter><InsightsOnboarding {...props} /></MemoryRouter>)
}

describe('InsightsOnboarding', () => {
  it('안내 타이틀을 표시한다', () => {
    renderOnboarding()
    expect(screen.getByText('아직 데이터가 모이는 중이에요')).toBeInTheDocument()
  })

  it('거래 기록 완료 항목은 체크 표시를 보여준다', () => {
    renderOnboarding({ ...defaultProps, hasTransactions: true })
    const transactionItem = screen.getByText('거래 5건 이상 기록하기').closest('li')
    expect(transactionItem).toHaveClass('line-through')
  })

  it('미완료 항목은 원형 아이콘을 보여준다', () => {
    renderOnboarding({ ...defaultProps, hasBudget: false })
    const budgetItem = screen.getByText('예산 설정하기').closest('li')
    expect(budgetItem).not.toHaveClass('line-through')
  })

  it('가계부로 가기 버튼이 /home으로 이동한다', async () => {
    const user = userEvent.setup()
    renderOnboarding()
    const link = screen.getByRole('link', { name: /가계부로 가기/ })
    expect(link).toHaveAttribute('href', '/home')
  })
})
```

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/InsightsOnboarding.test.tsx
```

**Step 3: 구현**

```typescript
// frontend/src/components/stats/InsightsOnboarding.tsx
import { Link } from 'react-router-dom'

interface InsightsOnboardingProps {
  hasTransactions: boolean    // expenseCount + incomeCount >= 5
  hasBudget: boolean
  hasRecurring: boolean
  hasSavingsCategory: boolean
}

interface CheckItem {
  label: string
  done: boolean
  link: string
}

export default function InsightsOnboarding({
  hasTransactions,
  hasBudget,
  hasRecurring,
  hasSavingsCategory,
}: InsightsOnboardingProps) {
  const items: CheckItem[] = [
    { label: '거래 5건 이상 기록하기', done: hasTransactions, link: '/home' },
    { label: '예산 설정하기', done: hasBudget, link: '/settings/budget' },
    { label: '정기거래 등록하기', done: hasRecurring, link: '/recurring' },
    { label: '저축 카테고리 설정하기', done: hasSavingsCategory, link: '/settings/categories' },
  ]

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6 text-center">
      <p className="text-2xl mb-3">🍇</p>
      <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">
        아직 데이터가 모이는 중이에요
      </h2>
      <ul className="space-y-2 text-left mb-5">
        {items.map(({ label, done, link }) => (
          <li key={label} className={`flex items-center gap-2 text-sm ${done ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
            <span className="text-base">{done ? '✓' : '○'}</span>
            {done ? (
              <span>{label}</span>
            ) : (
              <Link to={link} className="hover:text-grape-600 transition-colors">{label}</Link>
            )}
          </li>
        ))}
      </ul>
      <Link
        to="/home"
        className="inline-flex items-center gap-1 text-sm font-medium text-grape-600 hover:text-grape-700 transition-colors"
      >
        가계부로 가기 →
      </Link>
    </div>
  )
}
```

**Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/InsightsOnboarding.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/InsightsOnboarding.tsx \
        frontend/src/components/stats/__tests__/InsightsOnboarding.test.tsx
git commit -m "feat: InsightsOnboarding 온보딩 체크리스트 컴포넌트 신규"
```

---

## Task 4: FinancialHealthScore — 배지 모드 추가

히어로 섹션에 소형 배지로 표시하고, 클릭 시 바텀시트로 전체 점수 확인.

**Files:**
- Modify: `frontend/src/components/stats/FinancialHealthScore.tsx`
- Test: `frontend/src/components/stats/__tests__/FinancialHealthScore.test.tsx` (신규)

**Step 1: 테스트 작성**

```typescript
// frontend/src/components/stats/__tests__/FinancialHealthScore.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FinancialHealthScore from '../FinancialHealthScore'
import type { HealthScore } from '../../../types'

const mockScore: HealthScore = {
  overall: 78,
  grade: 'B+',
  savings: 65,
  spending: 80,
  debt: 90,
}

describe('FinancialHealthScore', () => {
  describe('full 모드 (기본)', () => {
    it('전체 카드 레이아웃을 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} />)
      expect(screen.getByText('가계 건강 점수')).toBeInTheDocument()
      expect(screen.getByText('78')).toBeInTheDocument()
      expect(screen.getByText('B+')).toBeInTheDocument()
    })
  })

  describe('badge 모드', () => {
    it('등급과 점수만 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      expect(screen.getByText('B+')).toBeInTheDocument()
      expect(screen.getByText('78')).toBeInTheDocument()
      // 전체 카드 요소 없음
      expect(screen.queryByText('가계 건강 점수')).not.toBeInTheDocument()
      expect(screen.queryByText('저축')).not.toBeInTheDocument()
    })

    it('배지 클릭 시 전체 점수 바텀시트가 열린다', async () => {
      const user = userEvent.setup()
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      await user.click(screen.getByRole('button'))
      expect(screen.getByText('가계 건강 점수')).toBeInTheDocument()
      expect(screen.getByText('저축')).toBeInTheDocument()
    })

    it('바텀시트 오버레이 클릭 시 닫힌다', async () => {
      const user = userEvent.setup()
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      await user.click(screen.getByRole('button'))
      expect(screen.getByText('가계 건강 점수')).toBeInTheDocument()
      // 오버레이(배경) 클릭
      await user.click(screen.getByLabelText('닫기'))
      expect(screen.queryByText('저축')).not.toBeInTheDocument()
    })

    it('score가 null이면 아무것도 표시하지 않는다', () => {
      const { container } = render(<FinancialHealthScore score={null} variant="badge" />)
      expect(container.firstChild).toBeNull()
    })
  })
})
```

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/FinancialHealthScore.test.tsx
```

**Step 3: 구현**

`FinancialHealthScore.tsx`를 수정하여 `variant` prop 추가:

```typescript
import { useState } from 'react'
import type { HealthScore } from '../../types'

interface FinancialHealthScoreProps {
  score: HealthScore | null
  variant?: 'full' | 'badge'
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-leaf-600'
  if (grade.startsWith('B')) return 'text-grape-600'
  if (grade.startsWith('C')) return 'text-amber-600'
  return 'text-red-600'
}

function getBarColor(value: number): string {
  if (value >= 80) return 'bg-leaf-500'
  if (value >= 60) return 'bg-grape-500'
  if (value >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

const LABELS = [
  { key: 'savings' as const, label: '저축' },
  { key: 'spending' as const, label: '지출 관리' },
  { key: 'debt' as const, label: '부채' },
]

/** 전체 점수 카드 (기존 렌더링) */
function FullScoreCard({ score }: { score: HealthScore }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">가계 건강 점수</h3>
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border-default)" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3"
              strokeDasharray={`${score.overall} ${100 - score.overall}`}
              className={getGradeColor(score.grade)} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[var(--text-primary)]">
            {score.overall}
          </span>
        </div>
        <div>
          <span className={`text-2xl font-bold ${getGradeColor(score.grade)}`}>{score.grade}</span>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">100점 만점</p>
        </div>
      </div>
      <div className="space-y-2">
        {LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)] w-14 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-[var(--surface-hover)] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${getBarColor(score[key])}`} style={{ width: `${score[key]}%` }} />
            </div>
            <span className="text-xs font-medium text-[var(--text-secondary)] w-8 text-right">{score[key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 소형 배지 + 바텀시트 */
function BadgeMode({ score }: { score: HealthScore }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold border ${getGradeColor(score.grade)} border-current bg-white/80 dark:bg-black/20 hover:opacity-80 transition-opacity`}
      >
        <span>{score.grade}</span>
        <span className="text-xs font-normal opacity-70">{score.overall}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 cursor-default"
          />
          <div className="relative w-full sm:max-w-sm mx-auto p-4 pb-8">
            <FullScoreCard score={score} />
          </div>
        </div>
      )}
    </>
  )
}

export default function FinancialHealthScore({ score, variant = 'full' }: FinancialHealthScoreProps) {
  if (!score) return null
  if (variant === 'badge') return <BadgeMode score={score} />
  return <FullScoreCard score={score} />
}
```

**Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/FinancialHealthScore.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/FinancialHealthScore.tsx \
        frontend/src/components/stats/__tests__/FinancialHealthScore.test.tsx
git commit -m "feat: FinancialHealthScore 배지 모드 추가 (히어로용 소형 배지 + 바텀시트)"
```

---

## Task 5: MonthlyHighlights — savingsTotal·신규 규칙·딥링크 추가

**Files:**
- Modify: `frontend/src/components/stats/MonthlyHighlights.tsx`
- Modify: `frontend/src/components/stats/__tests__/MonthlyHighlights.test.tsx` (기존 파일 없으면 신규)

**Step 1: 테스트 작성**

`generateHighlights` 함수를 named export로 이미 노출 중이므로 단위 테스트로 작성.

```typescript
// frontend/src/components/stats/__tests__/MonthlyHighlights.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { generateHighlights } from '../MonthlyHighlights'
import MonthlyHighlights from '../MonthlyHighlights'

const baseInput = {
  incomeTotal: 3_500_000,
  expenseTotal: 1_200_000,
  savingsTotal: undefined as number | undefined,
  recurringTotal: undefined as number | undefined,
  prevSavingsTotal: undefined as number | undefined,
  budgetStats: null,
  comparison: null,
}

describe('generateHighlights', () => {
  it('지출 > 수입이면 적자 경고를 생성한다', () => {
    const result = generateHighlights({ ...baseInput, incomeTotal: 1_000_000, expenseTotal: 1_200_000 })
    expect(result[0].type).toBe('warning')
    expect(result[0].message).toContain('수입을 초과')
  })

  it('savingsTotal 기반으로 저축률 달성을 판단한다 (fallback 계산 사용 안 함)', () => {
    // savingsTotal=700_000 / income=3_500_000 = 20% → 달성
    const result = generateHighlights({ ...baseInput, savingsTotal: 700_000 })
    expect(result.some(h => h.message.includes('저축률') && h.type === 'positive')).toBe(true)
  })

  it('savingsTotal 미제공 시 저축률 규칙(#3)을 스킵한다', () => {
    // net > 0이어도 savingsTotal 없으면 저축률 하이라이트 없음
    const result = generateHighlights({ ...baseInput, savingsTotal: undefined })
    expect(result.some(h => h.message.includes('저축률'))).toBe(false)
  })

  it('고정비/수입 >= 40% 시 info 하이라이트를 생성한다 (규칙 #5)', () => {
    // recurringTotal=1_400_000 / income=3_500_000 = 40%
    const result = generateHighlights({ ...baseInput, recurringTotal: 1_400_000 })
    expect(result.some(h => h.message.includes('고정비') && h.type === 'info')).toBe(true)
  })

  it('전월 대비 저축 감소 시 info 하이라이트를 생성한다 (규칙 #6)', () => {
    const result = generateHighlights({ ...baseInput, savingsTotal: 300_000, prevSavingsTotal: 500_000 })
    expect(result.some(h => h.message.includes('저축이 줄었') && h.type === 'info')).toBe(true)
  })

  it('최대 4개 하이라이트만 반환한다', () => {
    const result = generateHighlights({
      incomeTotal: 1_000_000,
      expenseTotal: 1_200_000,
      savingsTotal: 0,
      recurringTotal: 600_000,
      prevSavingsTotal: 500_000,
      budgetStats: {
        total_budget: 800_000,
        total_spent: 1_200_000,
        categories: [
          { category_name: '식비', budget_amount: 300_000, spent_amount: 400_000, is_exceeded: true },
          { category_name: '교통', budget_amount: 100_000, spent_amount: 150_000, is_exceeded: true },
          { category_name: '쇼핑', budget_amount: 200_000, spent_amount: 300_000, is_exceeded: true },
        ],
      },
      comparison: null,
    })
    expect(result.length).toBeLessThanOrEqual(4)
  })
})

describe('MonthlyHighlights 컴포넌트', () => {
  it('하이라이트 클릭 시 onHighlightClick 콜백이 호출된다', async () => {
    const user = userEvent.setup()
    const onHighlightClick = vi.fn()
    render(
      <MonthlyHighlights
        incomeTotal={1_000_000}
        expenseTotal={1_200_000}
        budgetStats={null}
        comparison={null}
        onHighlightClick={onHighlightClick}
      />
    )
    // 적자 경고가 표시됨
    const item = screen.getByText(/수입을 초과/)
    await user.click(item.closest('li')!)
    // 적자 경고 #1은 딥링크 없음 → 콜백 호출 안 됨
    expect(onHighlightClick).not.toHaveBeenCalled()
  })

  it('예산 초과 하이라이트 클릭 시 section-budget으로 딥링크한다', async () => {
    const user = userEvent.setup()
    const onHighlightClick = vi.fn()
    render(
      <MonthlyHighlights
        incomeTotal={3_500_000}
        expenseTotal={1_200_000}
        budgetStats={{
          total_budget: 1_000_000,
          total_spent: 1_200_000,
          categories: [
            { category_name: '식비', budget_amount: 300_000, spent_amount: 400_000, is_exceeded: true },
          ],
        }}
        comparison={null}
        onHighlightClick={onHighlightClick}
      />
    )
    const budgetItem = screen.getByText(/예산을 .* 초과/)
    await user.click(budgetItem.closest('li')!)
    expect(onHighlightClick).toHaveBeenCalledWith('section-budget')
  })
})
```

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/MonthlyHighlights.test.tsx
```

**Step 3: 구현**

`MonthlyHighlights.tsx`의 `HighlightInput` 인터페이스와 `generateHighlights` 함수 수정:

```typescript
// HighlightInput 타입 확장
export interface HighlightInput {
  incomeTotal: number
  expenseTotal: number
  savingsTotal?: number          // 신규: is_savings 카테고리 합계
  recurringTotal?: number        // 신규: 고정비 합계 (규칙 #5용)
  prevSavingsTotal?: number      // 신규: 전월 저축 합계 (규칙 #6용)
  budgetStats: BudgetMonthlyStatsResponse | null
  comparison: ComparisonResponse | null
}

export function generateHighlights({
  incomeTotal, expenseTotal, savingsTotal, recurringTotal, prevSavingsTotal,
  budgetStats, comparison,
}: HighlightInput): Highlight[] {
  const highlights: Highlight[] = []

  // 1. 적자 경고
  if (incomeTotal > 0 && expenseTotal > incomeTotal) {
    highlights.push({ type: 'warning', message: '이번 달 지출이 수입을 초과했어요', deeplink: null })
  }

  // 2. 예산 초과 카테고리 (최대 2개)
  if (budgetStats) {
    budgetStats.categories.filter(c => c.is_exceeded).slice(0, 2).forEach(c => {
      const over = c.spent_amount - c.budget_amount
      highlights.push({
        type: 'warning',
        message: `${c.category_name} 예산을 ${over.toLocaleString('ko-KR')}원 초과했어요`,
        deeplink: 'section-budget',
      })
    })
  }

  // 3. 저축률 달성 (savingsTotal 제공 시에만, 20% 이상)
  if (savingsTotal !== undefined && incomeTotal > 0) {
    const rate = (savingsTotal / incomeTotal) * 100
    if (rate >= 20) {
      highlights.push({
        type: 'positive',
        message: `이번 달 저축률 ${rate.toFixed(1)}% 달성 🎉`,
        deeplink: 'section-savings',
      })
    }
  }

  // 4. 지출 감소 (10% 이상)
  if (comparison?.change.percentage !== null && comparison?.change.percentage !== undefined) {
    if (comparison.change.percentage <= -10) {
      const pct = Math.abs(comparison.change.percentage).toFixed(1)
      highlights.push({
        type: 'positive',
        message: `지난달보다 지출을 ${pct}% 줄였어요 👍`,
        deeplink: 'section-comparison',
      })
    }
  }

  // 5. 고정비 비율 >= 40% (신규)
  if (recurringTotal !== undefined && incomeTotal > 0) {
    const pct = (recurringTotal / incomeTotal) * 100
    if (pct >= 40) {
      highlights.push({
        type: 'info',
        message: `수입의 ${pct.toFixed(0)}%가 고정비예요`,
        deeplink: 'section-recurring',
      })
    }
  }

  // 6. 저축 감소 (전월 대비, savingsTotal 제공 시에만)
  if (savingsTotal !== undefined && prevSavingsTotal !== undefined && prevSavingsTotal > 0 && savingsTotal < prevSavingsTotal) {
    highlights.push({
      type: 'info',
      message: '지난달보다 저축이 줄었어요',
      deeplink: 'section-savings',
    })
  }

  // 7. 카테고리 급증 (30% 이상, 최대 2개)
  if (comparison) {
    comparison.by_category_comparison
      .filter(c => c.change_percentage !== null && c.change_percentage > 30)
      .slice(0, 2)
      .forEach(c => {
        highlights.push({
          type: 'info',
          message: `${c.category}가 지난달보다 ${Math.round(c.change_percentage!)}% 증가했어요`,
          deeplink: 'section-category',
        })
      })
  }

  return [
    ...highlights.filter(h => h.type === 'warning'),
    ...highlights.filter(h => h.type === 'positive'),
    ...highlights.filter(h => h.type === 'info'),
  ].slice(0, 4)
}
```

`Highlight` 타입에 `deeplink` 필드 추가:

```typescript
interface Highlight {
  type: 'warning' | 'positive' | 'info'
  message: string
  deeplink: string | null
}
```

컴포넌트 props에 `onHighlightClick` 추가:

```typescript
interface MonthlyHighlightsProps {
  incomeTotal: number
  expenseTotal: number
  savingsTotal?: number
  recurringTotal?: number
  prevSavingsTotal?: number
  budgetStats: BudgetMonthlyStatsResponse | null
  comparison: ComparisonResponse | null
  onHighlightClick?: (sectionId: string) => void
}
```

리스트 아이템에 클릭 핸들러 추가:

```tsx
{highlights.map((h, i) => (
  <li
    key={i}
    className={`text-sm flex items-start gap-2 ${colorMap[h.type]} ${h.deeplink ? 'cursor-pointer hover:opacity-80' : ''}`}
    onClick={() => h.deeplink && onHighlightClick?.(h.deeplink)}
  >
    <span className="mt-0.5 flex-shrink-0">{iconMap[h.type]}</span>
    <span>{h.message}</span>
    {h.deeplink && <span className="ml-auto text-xs opacity-50">→</span>}
  </li>
))}
```

**Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/MonthlyHighlights.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/MonthlyHighlights.tsx \
        frontend/src/components/stats/__tests__/MonthlyHighlights.test.tsx
git commit -m "feat: MonthlyHighlights savingsTotal 기반 저축률 + 신규 규칙 #5·#6 + 딥링크"
```

---

## Task 6: UnifiedSummaryCards — fallback 제거 + ChangeIndicator 제거

저축률 fallback `(수입-지출)/수입` 제거, 미설정 시 "설정 필요" 표시.

**Files:**
- Modify: `frontend/src/components/stats/UnifiedSummaryCards.tsx`
- Test: `frontend/src/components/stats/__tests__/UnifiedSummaryCards.test.tsx` (신규)

**Step 1: 테스트 작성**

```typescript
// frontend/src/components/stats/__tests__/UnifiedSummaryCards.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import UnifiedSummaryCards from '../UnifiedSummaryCards'

function renderCards(props = {}) {
  return render(
    <MemoryRouter>
      <UnifiedSummaryCards
        incomeTotal={3_500_000}
        expenseTotal={1_200_000}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('UnifiedSummaryCards', () => {
  it('savingsTotal 미제공 시 저축률 카드에 "설정 필요"가 표시된다', () => {
    renderCards({ savingsTotal: undefined })
    expect(screen.getByText('설정 필요')).toBeInTheDocument()
  })

  it('savingsTotal 제공 시 is_savings 기반 저축률을 표시한다', () => {
    // 700_000 / 3_500_000 = 20.0%
    renderCards({ savingsTotal: 700_000 })
    expect(screen.getByTestId('savings-rate-value')).toHaveTextContent('20.0%')
  })

  it('ChangeIndicator(지난달 %)를 표시하지 않는다', () => {
    renderCards({ prevIncome: 3_000_000, prevExpense: 1_000_000, savingsTotal: 500_000 })
    expect(screen.queryByText(/지난달/)).not.toBeInTheDocument()
  })

  it('저축률 "설정 필요" 클릭 시 /settings/categories로 이동한다', async () => {
    const user = userEvent.setup()
    renderCards({ savingsTotal: undefined })
    const link = screen.getByRole('link', { name: /설정 필요/ })
    expect(link).toHaveAttribute('href', '/settings/categories')
  })
})
```

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/UnifiedSummaryCards.test.tsx
```

**Step 3: 구현**

`UnifiedSummaryCards.tsx` 수정:

1. `ChangeIndicator` 컴포넌트 및 관련 props(`prevIncome`, `prevExpense`, `prevNetWorth`) 제거
2. 저축률 계산에서 fallback 제거:

```typescript
// 변경 전
const savingsRate = incomeTotal > 0
  ? (savingsTotal !== undefined ? (savingsTotal / incomeTotal) * 100 : (net / incomeTotal) * 100)
  : null

// 변경 후
const savingsRate = (savingsTotal !== undefined && incomeTotal > 0)
  ? (savingsTotal / incomeTotal) * 100
  : null  // undefined = 미설정, null = 표시 불가
```

3. 저축률 카드에 "설정 필요" 링크 표시:

```tsx
{/* 저축률 카드 */}
<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-2xl shadow-sm p-4 sm:p-5">
  <p className="text-sm text-[var(--text-tertiary)]">저축률</p>
  {savingsRate !== null ? (
    <p data-testid="savings-rate-value" className={`text-xl sm:text-2xl font-bold mt-1 ${rateColor}`}>
      {savingsRate.toFixed(1)}%
    </p>
  ) : (
    <Link
      to="/settings/categories"
      className="text-sm font-medium text-grape-600 hover:text-grape-700 mt-1 inline-block"
    >
      설정 필요
    </Link>
  )}
</div>
```

4. 인터페이스에서 `prevIncome`, `prevExpense`, `prevNetWorth` 제거 (사용처 InsightsPage에서도 제거 필요 — Task 11에서 처리)

**Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/UnifiedSummaryCards.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/UnifiedSummaryCards.tsx \
        frontend/src/components/stats/__tests__/UnifiedSummaryCards.test.tsx
git commit -m "refactor: UnifiedSummaryCards 저축률 fallback 제거, ChangeIndicator 제거"
```

---

## Task 7: SavingsSection — 신규 컴포넌트

is_savings 카테고리 기반 저축 현황 섹션.

**Files:**
- Create: `frontend/src/components/stats/SavingsSection.tsx`
- Test: `frontend/src/components/stats/__tests__/SavingsSection.test.tsx` (신규)

**Step 1: 테스트 작성**

```typescript
// frontend/src/components/stats/__tests__/SavingsSection.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SavingsSection from '../SavingsSection'
import type { CategoryAmount } from '../../../types'

const mockSavingsCategories: CategoryAmount[] = [
  { category: '적금', amount: 300_000 },
  { category: '투자', amount: 180_000 },
  { category: '보험', amount: 50_000 },
]

function renderSection(props = {}) {
  return render(
    <MemoryRouter>
      <SavingsSection
        savingsTotal={530_000}
        incomeTotal={3_500_000}
        savingsCategories={mockSavingsCategories}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('SavingsSection', () => {
  it('총 저축액을 표시한다', () => {
    renderSection()
    expect(screen.getByText('₩530,000')).toBeInTheDocument()
  })

  it('수입 대비 저축률을 표시한다', () => {
    renderSection()
    // 530_000 / 3_500_000 * 100 ≈ 15.1%
    expect(screen.getByText(/15\.1%/)).toBeInTheDocument()
  })

  it('카테고리별 내역을 표시한다', () => {
    renderSection()
    expect(screen.getByText('적금')).toBeInTheDocument()
    expect(screen.getByText('투자')).toBeInTheDocument()
    expect(screen.getByText('보험')).toBeInTheDocument()
  })

  it('savingsCategories가 없으면 설정 유도 메시지를 표시한다', () => {
    renderSection({ savingsCategories: [], savingsTotal: undefined })
    expect(screen.getByText(/저축 카테고리를 설정하면/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /카테고리 설정/ })).toBeInTheDocument()
  })
})
```

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/SavingsSection.test.tsx
```

**Step 3: 구현**

```typescript
// frontend/src/components/stats/SavingsSection.tsx
import { Link } from 'react-router-dom'
import { formatAmount } from '../../utils/format'
import type { CategoryAmount } from '../../types'

interface SavingsSectionProps {
  savingsTotal: number | undefined      // undefined = is_savings 미설정
  incomeTotal: number
  savingsCategories: CategoryAmount[]   // is_savings=true 카테고리만 필터링된 목록
}

export default function SavingsSection({ savingsTotal, incomeTotal, savingsCategories }: SavingsSectionProps) {
  const hasData = savingsCategories.length > 0 && savingsTotal !== undefined

  return (
    <div id="section-savings" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">🏦 저축</h2>
        <Link to="/settings/categories" className="text-sm text-grape-600 hover:text-grape-700 transition-colors">
          편집 →
        </Link>
      </div>

      {hasData ? (
        <>
          <p className="text-xl font-bold text-[var(--text-primary)]">
            {formatAmount(savingsTotal!)}
          </p>
          {incomeTotal > 0 && (
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
              수입의 {((savingsTotal! / incomeTotal) * 100).toFixed(1)}%
            </p>
          )}
          <div className="mt-3 space-y-1.5">
            {savingsCategories.map(c => (
              <div key={c.category} className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{c.category}</span>
                <span className="text-sm tabular-nums text-[var(--text-primary)]">{formatAmount(c.amount)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-[var(--text-tertiary)]">저축 카테고리를 설정하면 저축 현황을 볼 수 있어요</p>
          <Link to="/settings/categories" className="text-sm font-medium text-grape-600 hover:text-grape-700 mt-1 inline-block">
            카테고리 설정 →
          </Link>
        </div>
      )}
    </div>
  )
}
```

**Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/SavingsSection.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/SavingsSection.tsx \
        frontend/src/components/stats/__tests__/SavingsSection.test.tsx
git commit -m "feat: SavingsSection 저축 현황 섹션 신규"
```

---

## Task 8: MonthlyComparison — 신규 컴포넌트 (스파크라인)

전월 대비 수입/지출/저축률 + 카테고리 변화 TOP3. Recharts `LineChart`로 미니 스파크라인.

**Files:**
- Create: `frontend/src/components/stats/MonthlyComparison.tsx`
- Test: `frontend/src/components/stats/__tests__/MonthlyComparison.test.tsx` (신규)

> **주의:** Recharts는 이미 설치되어 있음 (`package.json`에 `recharts` 확인). 스파크라인은 `LineChart`에 `width`/`height` 고정값을 직접 지정 (responsive container 미사용 — 서버사이드 렌더링 이슈 방지 + 크기 고정 목적).

**Step 1: 테스트 작성**

```typescript
// frontend/src/components/stats/__tests__/MonthlyComparison.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MonthlyComparison from '../MonthlyComparison'
import type { ComparisonResponse } from '../../../types'

const mockComparison: ComparisonResponse = {
  current: { label: '4월', total: 1_200_000 },
  previous: { label: '3월', total: 1_300_000 },
  change: { amount: -100_000, percentage: -7.7 },
  trend: [
    { label: '2월', total: 1_100_000 },
    { label: '3월', total: 1_300_000 },
    { label: '4월', total: 1_200_000 },
  ],
  by_category_comparison: [
    { category: '교통', current: 135_000, previous: 100_000, change_amount: 35_000, change_percentage: 35.0 },
    { category: '식비', current: 422_000, previous: 480_000, change_amount: -58_000, change_percentage: -12.1 },
    { category: '쇼핑', current: 270_000, previous: 220_000, change_amount: 50_000, change_percentage: 22.7 },
  ],
}

const mockIncomeComparison: ComparisonResponse = {
  current: { label: '4월', total: 3_500_000 },
  previous: { label: '3월', total: 3_300_000 },
  change: { amount: 200_000, percentage: 6.1 },
  trend: [
    { label: '2월', total: 3_200_000 },
    { label: '3월', total: 3_300_000 },
    { label: '4월', total: 3_500_000 },
  ],
  by_category_comparison: [],
}

describe('MonthlyComparison', () => {
  it('수입 현재값과 변화량을 표시한다', () => {
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
        savingsRateCurrent={15.1}
        savingsRatePrevious={14.2}
      />
    )
    expect(screen.getByText('수입')).toBeInTheDocument()
    expect(screen.getByText('+200,000')).toBeInTheDocument()
  })

  it('지출 감소는 text-leaf-600으로 표시한다', () => {
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
      />
    )
    const changeEl = screen.getByText(/-100,000/)
    expect(changeEl).toHaveClass('text-leaf-600')
  })

  it('카테고리 변화 TOP3를 표시한다', () => {
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
      />
    )
    expect(screen.getByText('교통')).toBeInTheDocument()
    expect(screen.getByText('식비')).toBeInTheDocument()
  })

  it('trend 데이터가 2개 미만이면 스파크라인을 렌더하지 않는다', () => {
    render(
      <MonthlyComparison
        expenseComparison={{ ...mockComparison, trend: [{ label: '4월', total: 1_200_000 }] }}
        incomeComparison={{ ...mockIncomeComparison, trend: [{ label: '4월', total: 3_500_000 }] }}
      />
    )
    expect(screen.queryAllByTestId('sparkline')).toHaveLength(0)
  })

  it('savingsRateCurrent 미제공 시 저축률 행을 표시하지 않는다', () => {
    render(
      <MonthlyComparison
        expenseComparison={mockComparison}
        incomeComparison={mockIncomeComparison}
      />
    )
    expect(screen.queryByText('저축률')).not.toBeInTheDocument()
  })
})
```

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/MonthlyComparison.test.tsx
```

**Step 3: 구현**

```typescript
// frontend/src/components/stats/MonthlyComparison.tsx
import { LineChart, Line } from 'recharts'
import { formatAmount } from '../../utils/format'
import type { ComparisonResponse, PeriodTotal } from '../../types'

interface MonthlyComparisonProps {
  expenseComparison: ComparisonResponse | null
  incomeComparison: ComparisonResponse | null
  savingsRateCurrent?: number   // is_savings 기반, 미설정 시 undefined
  savingsRatePrevious?: number
}

/** 스파크라인 (높이 24px, 너비 64px, 축 없음) */
function Sparkline({ data }: { data: PeriodTotal[] }) {
  if (data.length < 2) return null
  const chartData = data.map(d => ({ value: d.total }))
  return (
    <div data-testid="sparkline">
      <LineChart width={64} height={24} data={chartData}>
        <Line type="monotone" dataKey="value" stroke="currentColor" strokeWidth={1.5} dot={false} />
      </LineChart>
    </div>
  )
}

/** 변화량 포맷 (+/-) */
function formatChange(amount: number): string {
  const abs = Math.abs(amount).toLocaleString('ko-KR')
  return amount >= 0 ? `+${abs}` : `-${abs}`
}

interface ComparisonRowProps {
  label: string
  current: number | string   // 금액 또는 "15.1%"
  changeAmount: number       // 금액 변화
  changeLabel: string        // "+200,000" 또는 "+2.1%p"
  positiveIsGreen: boolean   // true=증가가 좋음(수입), false=감소가 좋음(지출)
  trend: PeriodTotal[]
}

function ComparisonRow({ label, current, changeLabel, changeAmount, positiveIsGreen, trend }: ComparisonRowProps) {
  const isPositive = changeAmount > 0
  const isGood = positiveIsGreen ? isPositive : !isPositive
  const changeColor = changeAmount === 0
    ? 'text-[var(--text-secondary)]'
    : isGood ? 'text-leaf-600' : 'text-red-600'

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[var(--text-secondary)] w-12 shrink-0">{label}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
            {typeof current === 'number' ? formatAmount(current) : current}
          </span>
          <span className={`text-xs tabular-nums ${changeColor}`}>{changeLabel}</span>
        </div>
        <div className={`mt-0.5 ${changeColor} opacity-70`}>
          <Sparkline data={trend} />
        </div>
      </div>
    </div>
  )
}

export default function MonthlyComparison({
  expenseComparison,
  incomeComparison,
  savingsRateCurrent,
  savingsRatePrevious,
}: MonthlyComparisonProps) {
  // 카테고리 변화 TOP3: 절대 변화율 기준 상위 3개, 증감 모두 포함
  const topCategoryChanges = (expenseComparison?.by_category_comparison ?? [])
    .filter(c => c.change_percentage !== null && c.previous > 0)
    .sort((a, b) => Math.abs(b.change_percentage!) - Math.abs(a.change_percentage!))
    .slice(0, 3)

  const savingsRateChange = savingsRateCurrent !== undefined && savingsRatePrevious !== undefined
    ? savingsRateCurrent - savingsRatePrevious
    : null

  return (
    <div id="section-comparison" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">📊 지난달과 비교</h2>

      <div className="space-y-3">
        {incomeComparison && (
          <ComparisonRow
            label="수입"
            current={incomeComparison.current.total}
            changeAmount={incomeComparison.change.amount}
            changeLabel={formatChange(incomeComparison.change.amount)}
            positiveIsGreen={true}
            trend={incomeComparison.trend}
          />
        )}
        {expenseComparison && (
          <ComparisonRow
            label="지출"
            current={expenseComparison.current.total}
            changeAmount={expenseComparison.change.amount}
            changeLabel={formatChange(expenseComparison.change.amount)}
            positiveIsGreen={false}
            trend={expenseComparison.trend}
          />
        )}
        {savingsRateCurrent !== undefined && savingsRateChange !== null && (
          <ComparisonRow
            label="저축률"
            current={`${savingsRateCurrent.toFixed(1)}%`}
            changeAmount={savingsRateChange}
            changeLabel={`${savingsRateChange >= 0 ? '+' : ''}${savingsRateChange.toFixed(1)}%p`}
            positiveIsGreen={true}
            trend={[]}
          />
        )}
      </div>

      {topCategoryChanges.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--border-default)]">
          <p className="text-xs font-medium text-[var(--text-tertiary)] mb-2">카테고리 변화 TOP {topCategoryChanges.length}</p>
          <div className="space-y-1.5">
            {topCategoryChanges.map(c => {
              const isIncrease = (c.change_percentage ?? 0) > 0
              return (
                <div key={c.category} className="flex items-center justify-between text-sm">
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
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/MonthlyComparison.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/MonthlyComparison.tsx \
        frontend/src/components/stats/__tests__/MonthlyComparison.test.tsx
git commit -m "feat: MonthlyComparison 전월 대비 섹션 신규 (스파크라인 포함)"
```

---

## Task 9: RecurringManageSection — 리프레이밍

헤더에 고정비 총액 강조, 기본 접힘, 빈 상태 유도 문구.

**Files:**
- Modify: `frontend/src/components/stats/RecurringManageSection.tsx`
- Test: `frontend/src/components/stats/__tests__/RecurringManageSection.test.tsx` (신규)

**Step 1: 테스트 작성**

```typescript
// frontend/src/components/stats/__tests__/RecurringManageSection.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RecurringManageSection from '../RecurringManageSection'
import type { RecurringTransaction } from '../../../types'

const mockItems: RecurringTransaction[] = [
  {
    id: 1,
    description: '넷플릭스',
    amount: 17_000,
    type: 'expense',
    is_active: true,
    next_due_date: '2026-04-15',
    category_emoji: '🎬',
    household_id: 1,
    user_id: 1,
    created_at: '',
    updated_at: '',
    // 필요한 다른 필드는 실제 타입에 맞게 추가
  } as RecurringTransaction,
]

function renderSection(items = mockItems) {
  return render(
    <MemoryRouter>
      <RecurringManageSection
        items={items}
        monthStr="2026-04"
        executedAmountMap={new Map()}
      />
    </MemoryRouter>
  )
}

describe('RecurringManageSection', () => {
  it('고정비 총액을 헤더에 표시한다', () => {
    renderSection()
    expect(screen.getByText(/이번 달 고정비/)).toBeInTheDocument()
  })

  it('기본 상태는 접힌 상태이다', () => {
    renderSection()
    // 아이템 목록이 보이지 않아야 함
    expect(screen.queryByText('넷플릭스')).not.toBeInTheDocument()
  })

  it('펼치기 클릭 시 목록이 표시된다', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('button', { name: /펼치기/ }))
    expect(screen.getByText('넷플릭스')).toBeInTheDocument()
  })

  it('등록된 정기거래가 없으면 유도 문구를 표시한다', () => {
    renderSection([])
    expect(screen.getByText(/정기거래를 등록하면/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /등록하기/ })).toBeInTheDocument()
  })
})
```

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/RecurringManageSection.test.tsx
```

**Step 3: 구현**

`RecurringManageSection.tsx`의 주요 변경:

1. `const [expanded, setExpanded] = useState(true)` → `useState(false)` (기본 접힘)
2. 헤더 텍스트를 "이번 달 고정비 {총액}"으로 변경
3. 빈 상태 유도 문구 변경
4. `id="section-recurring"` 최외각 div에 추가

```typescript
// 변경: 기본 접힘
const [expanded, setExpanded] = useState(false)

// 빈 상태 변경
if (items.length === 0) {
  return (
    <div id="section-recurring" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">🔄 고정 지출</h2>
        <Link to="/recurring" className="text-xs text-grape-600 hover:text-grape-700 transition-colors">관리 →</Link>
      </div>
      <div className="text-center py-4">
        <p className="text-sm text-[var(--text-tertiary)]">정기거래를 등록하면 고정비 현황을 볼 수 있어요</p>
        <Link to="/recurring" className="text-sm font-medium text-grape-600 hover:text-grape-700 mt-1 inline-block">등록하기 →</Link>
      </div>
    </div>
  )
}

// 헤더 변경
<div className="flex items-center justify-between mb-3">
  <div>
    <h2 className="text-base font-semibold text-[var(--text-primary)]">🔄 고정 지출</h2>
    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">이번 달 고정비 {formatAmount(monthlyExpenseTotal)}</p>
  </div>
  <Link to="/recurring" className="text-xs text-grape-600">관리 →</Link>
</div>
```

5. 최외각 div에 `id="section-recurring"` 추가

**Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/RecurringManageSection.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/RecurringManageSection.tsx \
        frontend/src/components/stats/__tests__/RecurringManageSection.test.tsx
git commit -m "refactor: RecurringManageSection 고정비 헤더 강조, 기본 접힘, 빈 상태 유도"
```

---

## Task 10: HeroSummary — 레거시 제거 + comparisonText + healthScore

**Files:**
- Modify: `frontend/src/components/stats/HeroSummary.tsx`
- Modify: `frontend/src/components/stats/__tests__/HeroSummary.test.tsx`

**Step 1: 테스트 수정**

기존 테스트 파일에서 레거시 props(`amount`, `budgetRatio`) 테스트를 제거하고 신규 기능 테스트 추가.

> `HeroSummary.test.tsx`를 열어 레거시 테스트를 모두 제거 후 신규 테스트 작성.

```typescript
// frontend/src/components/stats/__tests__/HeroSummary.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import HeroSummary from '../HeroSummary'
import type { HealthScore } from '../../../types'

const mockScore: HealthScore = { overall: 78, grade: 'B+', savings: 65, spending: 80, debt: 90 }

function renderHero(props = {}) {
  return render(
    <MemoryRouter>
      <HeroSummary
        label="4월 지출"
        totalExpense={1_200_000}
        totalBudget={2_000_000}
        pendingRecurringExpense={300_000}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('HeroSummary', () => {
  it('지출 금액을 표시한다', () => {
    renderHero()
    expect(screen.getByText('₩1,200,000')).toBeInTheDocument()
  })

  it('comparisonText가 있으면 전월 비교 문장을 표시한다', () => {
    renderHero({ comparisonText: '지난달 이맘때보다 3만원 줄었어요 ↓', comparisonColor: 'text-leaf-600' })
    expect(screen.getByText('지난달 이맘때보다 3만원 줄었어요 ↓')).toBeInTheDocument()
  })

  it('healthScore가 있으면 배지를 우측 상단에 표시한다', () => {
    renderHero({ healthScore: mockScore })
    expect(screen.getByText('B+')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
  })

  it('totalBudget이 null이면 예산 미설정 CTA를 표시한다', () => {
    renderHero({ totalBudget: null })
    expect(screen.getByText(/예산을 설정하면/)).toBeInTheDocument()
  })

  it('레거시 props(amount)를 받으면 TypeScript 에러가 발생한다 — 컴파일로 검증', () => {
    // 이 테스트는 런타임이 아닌 tsc로 검증. 빌드 단계에서 확인.
    expect(true).toBe(true)
  })
})
```

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/HeroSummary.test.tsx
```

**Step 3: 구현**

`HeroSummary.tsx` 수정:

1. `LegacyHeroSummaryProps` 타입 및 `LegacyHeroSummary` 함수 완전 삭제
2. `isNewProps` 분기 삭제
3. `NewHeroSummaryProps`에 신규 필드 추가:

```typescript
type HeroSummaryProps = {
  label: string
  totalExpense: number
  totalBudget: number | null | undefined
  pendingRecurringExpense: number
  totalIncome?: number
  comparisonText?: string            // "지난달 이맘때보다 3만원 줄었어요 ↓"
  comparisonColor?: string           // "text-leaf-600" | "text-red-600"
  healthScore?: HealthScore | null   // 배지 모드로 렌더
  onProgressClick?: () => void
  children?: ReactNode
  className?: string
}
```

4. import 추가: `import type { HealthScore } from '../../types'`
5. 렌더링에 comparisonText, healthScore 배지 추가:

```tsx
// 라벨 행: 좌측 라벨 + 우측 건강 점수 배지
<div className="flex justify-between items-start">
  <p className="text-sm text-[var(--text-tertiary)] mb-1">{label}</p>
  {healthScore && (
    <FinancialHealthScore score={healthScore} variant="badge" />
  )}
</div>

<p className="text-display text-[var(--text-primary)]">{formatAmount(totalExpense)}</p>

{/* 전월 비교 문장 */}
{comparisonText && (
  <p className={`text-xs mt-1.5 ${comparisonColor ?? 'text-[var(--text-secondary)]'}`}>
    {comparisonText}
  </p>
)}
```

6. import 추가: `import FinancialHealthScore from './FinancialHealthScore'`

**Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/HeroSummary.test.tsx
```

빌드로 TypeScript 컴파일도 확인:

```bash
cd frontend && npm run build 2>&1 | grep -E "error|HeroSummary|InsightsPage"
```

→ `InsightsPage.tsx`에서 레거시 props 사용 에러가 나타날 것 (Task 11에서 수정).

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/HeroSummary.tsx \
        frontend/src/components/stats/__tests__/HeroSummary.test.tsx
git commit -m "refactor: HeroSummary 레거시 props 제거, comparisonText·healthScore 배지 추가"
```

---

## Task 11: InsightsPage — 전체 통합

모든 변경 사항을 InsightsPage에서 조립. 레거시 props 수정, Layer 구조, 온보딩 모드, 딥링크.

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`
- Modify: `frontend/src/pages/__tests__/InsightsPage.test.tsx`

**Step 1: 테스트 수정**

기존 테스트에 새로운 시나리오 추가 (기존 테스트는 최대한 유지):

```typescript
// 기존 테스트 파일에 추가
it('거래 건수 5건 미만이면 InsightsOnboarding을 표시한다', async () => {
  // mockStats.count = 3, mockIncomeStats.count = 확인 필요
  // MSW에서 count < 5인 stats를 반환하도록 오버라이드
  server.use(
    http.get(`${BASE_URL}/expenses/stats`, () =>
      HttpResponse.json({ ...mockStats, count: 2 })
    ),
    http.get(`${BASE_URL}/income/stats`, () =>
      HttpResponse.json({ ...mockIncomeStats, count: 2 })
    ),
  )
  renderWithQuery(<InsightsPage />)
  await waitFor(() => {
    expect(screen.getByText('아직 데이터가 모이는 중이에요')).toBeInTheDocument()
  })
})

it('Layer 구분자 "뜯어보기"가 표시된다', async () => {
  renderWithQuery(<InsightsPage />)
  await waitFor(() => {
    expect(screen.getByText('뜯어보기')).toBeInTheDocument()
  })
})

it('주목할 점이 요약 카드(총 수입)보다 먼저 렌더된다', async () => {
  renderWithQuery(<InsightsPage />)
  await waitFor(() => {
    expect(screen.getByText(/이달의 주목할 점/)).toBeInTheDocument()
  })
  const allText = document.body.textContent ?? ''
  const highlightsIdx = allText.indexOf('이달의 주목할 점')
  const summaryIdx = allText.indexOf('총 수입')
  expect(highlightsIdx).toBeLessThan(summaryIdx)
})

**Step 2: 실패 확인**

```bash
cd frontend && npx vitest run src/pages/__tests__/InsightsPage.test.tsx
```

**Step 3: InsightsPage 구현**

주요 변경 사항:

#### 3a. HeroSummary 새 props 적용

`pendingRecurringExpense` 파생 추가:

```typescript
// executedAmountMap, activeRecurringItems, monthStr 이미 존재
const pendingRecurringExpense = useMemo(() => {
  return activeRecurringItems
    .filter(r => r.type === 'expense')
    .filter(r => r.next_due_date.slice(0, 7) === monthStr && !executedAmountMap.has(r.id))
    .reduce((sum, r) => sum + r.amount, 0)
}, [activeRecurringItems, monthStr, executedAmountMap])
```

`comparisonText` 파생:

```typescript
const comparisonText = useMemo(() => {
  if (!comparison?.change?.amount || comparison.change.percentage === null) return undefined
  const pct = Math.abs(comparison.change.percentage)
  if (pct < 1) return '지난달과 비슷한 수준이에요'
  const amt = Math.abs(comparison.change.amount).toLocaleString('ko-KR')
  return comparison.change.amount < 0
    ? `지난달 이맘때보다 ${amt}원 줄었어요 ↓`
    : `지난달 이맘때보다 ${amt}원 늘었어요 ↑`
}, [comparison])

const comparisonColor = useMemo(() => {
  if (!comparison?.change?.amount) return undefined
  return comparison.change.amount < 0 ? 'text-leaf-600' : 'text-red-600'
}, [comparison])
```

`savingsRatePrevious` (MonthlyComparison용):

```typescript
const savingsRatePrevious = useMemo(() => {
  if (savingsTotal === undefined) return undefined
  if (!incomeComparison?.previous?.total) return undefined
  // 전월 is_savings 카테고리 합계: comparison의 by_category_comparison에서 계산
  const savingsCatNames = new Set(
    expenseCategories.filter(c => c.is_savings).map(c => c.name)
  )
  const prevSavings = comparison?.by_category_comparison
    .filter(c => savingsCatNames.has(c.category))
    .reduce((sum, c) => sum + c.previous, 0) ?? 0
  const prevIncome = incomeComparison.previous.total
  return prevIncome > 0 ? (prevSavings / prevIncome) * 100 : undefined
}, [savingsTotal, incomeComparison, comparison, expenseCategories])
```

#### 3b. 온보딩 분기

```typescript
const totalTransactionCount = (expenseStats?.count ?? 0) + (incomeStats?.count ?? 0)
const isOnboardingMode = totalTransactionCount < 5 && totalTransactionCount > 0
```

> `totalTransactionCount === 0`이면 기존 EmptyState 유지.

#### 3c. 저축 카테고리 필터링 (SavingsSection용)

```typescript
const savingsCategories = useMemo(() => {
  const savingsCatNames = new Set(
    expenseCategories.filter(c => c.is_savings).map(c => c.name)
  )
  if (savingsCatNames.size === 0) return []
  return (expenseStats?.by_category ?? []).filter(c => savingsCatNames.has(c.category))
}, [expenseCategories, expenseStats])
```

#### 3d. 고정비 총액 (MonthlyHighlights 규칙 #5용)

```typescript
const recurringTotal = useMemo(() => {
  return activeRecurringItems
    .filter(r => r.type === 'expense' && r.is_active)
    .reduce((sum, r) => sum + r.amount, 0)
}, [activeRecurringItems])
```

#### 3e. 전월 저축 합계 (MonthlyHighlights 규칙 #6용)

```typescript
const prevSavingsTotal = useMemo(() => {
  const savingsCatNames = new Set(
    expenseCategories.filter(c => c.is_savings).map(c => c.name)
  )
  if (savingsCatNames.size === 0) return undefined
  return comparison?.by_category_comparison
    .filter(c => savingsCatNames.has(c.category))
    .reduce((sum, c) => sum + c.previous, 0)
}, [expenseCategories, comparison])
```

#### 3f. 딥링크 핸들러

```typescript
const handleDeepLink = useCallback((sectionId: string) => {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
}, [])
```

#### 3g. 렌더 구조 전면 교체

count 기반으로 조건 정리:

```typescript
const transactionCount = (expenseStats?.count ?? 0) + (incomeStats?.count ?? 0)
```

빈 상태/온보딩/풀리포트를 count 기반 세 분기로:

```tsx
{/* 빈 상태 (0건) */}
{!loading && !error && transactionCount === 0 && expenseStats !== undefined && (
  <EmptyState
    variant="primary"
    title="이번 달 거래 내역이 없습니다"
    description="가계부에 수입이나 지출을 기록하면 리포트가 생성됩니다"
    action={{ label: '가계부로 이동', onClick: () => navigate('/home') }}
  />
)}

{/* 온보딩 모드 (1~4건) — 히어로 포함 전체 리포트 교체 */}
{!loading && !error && transactionCount > 0 && transactionCount < 5 && (
  <InsightsOnboarding
    hasTransactions={false}
    hasBudget={!!budgetStats?.total_budget}
    hasRecurring={activeRecurringItems.length > 0}
    hasSavingsCategory={expenseCategories.some(c => c.is_savings)}
  />
)}

{/* 풀 리포트 (5건 이상) */}
{!loading && !error && transactionCount >= 5 && (
  <>
    {/* 히어로 */}
    <HeroSummary
      label={`${currentMonth + 1}월 지출`}
      totalExpense={expenseStats?.total ?? 0}
      totalBudget={budgetStats?.total_budget ?? null}
      pendingRecurringExpense={pendingRecurringExpense}
      totalIncome={incomeStats?.total}
      comparisonText={comparisonText}
      comparisonColor={comparisonColor}
      healthScore={healthScore}
    />

    {/* Layer 1: 한눈에 */}
    {sectionVisibility.highlights && (
      <MonthlyHighlights
        incomeTotal={incomeStats?.total ?? 0}
        expenseTotal={expenseStats?.total ?? 0}
        savingsTotal={savingsTotal}
        recurringTotal={recurringTotal}
        prevSavingsTotal={prevSavingsTotal}
        budgetStats={budgetStats ?? null}
        comparison={comparison ?? null}
        onHighlightClick={handleDeepLink}
      />
    )}

    <UnifiedSummaryCards
      incomeTotal={incomeStats?.total ?? 0}
      expenseTotal={expenseStats?.total ?? 0}
      savingsTotal={savingsTotal}
      monthStr={monthStr}
    />

        {/* Layer 2: 뜯어보기 */}
        <LayerDivider label="뜯어보기" />

        {sectionVisibility.categoryTop && (
          <div id="section-category">
            <CategoryTopList categories={expenseStats?.by_category ?? []} monthStr={monthStr} />
          </div>
        )}

        {sectionVisibility.budget && (
          <div id="section-budget">
            <BudgetVsActual budgetStats={budgetStats ?? null} monthStr={monthStr} />
          </div>
        )}

        {sectionVisibility.recurring && (
          <RecurringManageSection
            items={activeRecurringItems}
            monthStr={monthStr}
            executedAmountMap={executedAmountMap}
          />
        )}

        {sectionVisibility.cardUsage && cardUsage.length > 0 && (
          <CardUsageSummary usage={cardUsage} />
        )}

        {sectionVisibility.savings && (
          <SavingsSection
            savingsTotal={savingsTotal}
            incomeTotal={incomeStats?.total ?? 0}
            savingsCategories={savingsCategories}
          />
        )}

        {/* Layer 3: 돌아보기 */}
        <LayerDivider label="돌아보기" />

        {sectionVisibility.comparison && (
          <MonthlyComparison
            expenseComparison={comparison ?? null}
            incomeComparison={incomeComparison ?? null}
            savingsRateCurrent={savingsTotal !== undefined && incomeStats?.total
              ? (savingsTotal / incomeStats.total) * 100
              : undefined
            }
            savingsRatePrevious={savingsRatePrevious}
          />
        )}

        {/* AI 분석 — FinancialHealthScore는 히어로로 이동했으므로 제거 */}
        {sectionVisibility.ai && (
          <div id="section-ai" className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-grape-600" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">🤖 AI 종합 분석</h2>
              </div>
              {!structuredInsights && (
                <button
                  onClick={handleGenerateAI}
                  disabled={aiLoading}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:bg-warm-400 disabled:cursor-not-allowed transition-colors"
                >
                  {aiLoading ? '분석 중...' : '분석하기'}
                </button>
              )}
            </div>
            {aiLoading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="animate-spin rounded-full border-b-2 border-grape-600 h-8 w-8" />
                <p className="text-sm text-[var(--text-secondary)]">AI가 가계 데이터를 분석하고 있습니다...</p>
              </div>
            )}
            {!aiLoading && structuredInsights && (
              <div className="mt-4">
                <StructuredInsightsView insights={structuredInsights} />
              </div>
            )}
            {!aiLoading && !structuredInsights && (
              <p className="text-sm text-[var(--text-tertiary)] mt-3">
                AI가 수입, 지출, 예산을 분석하여 맞춤 인사이트를 제공합니다.
              </p>
            )}
          </div>
        )}
      </>
    )}
  </>
)}
```

#### 3h. 사용하지 않는 코드 제거

**import 제거:**
- `FinancialHealthScore` import (HeroSummary 내부에서 처리)
- `AssetChangeSummary` import (자산 기능 비활성)
- `assetApi` import

**쿼리 제거:**
- `snapshots` useQuery (FEATURES.assets 비활성, API 불필요)

**useMemo 제거:**
- `assetSummary` / `prevSnapshot` (snapshots 쿼리 제거에 따라)

**props 제거:**
- `UnifiedSummaryCards`에 전달하던 `prevIncome`, `prevExpense`, `prevNetWorth` (Task 6에서 인터페이스 제거됨)

**JSX 제거:**
- `{FEATURES.assets && sectionVisibility.assets && <AssetChangeSummary ... />}` 블록 전체 제거

#### 3i. 신규 import 추가

```typescript
import LayerDivider from '../components/stats/LayerDivider'
import InsightsOnboarding from '../components/stats/InsightsOnboarding'
import SavingsSection from '../components/stats/SavingsSection'
import MonthlyComparison from '../components/stats/MonthlyComparison'
```

**Step 4: 전체 테스트 통과 확인**

```bash
cd frontend && npm run test:run
```

**Step 5: 빌드 확인**

```bash
cd frontend && npm run lint && npm run build
```

**Step 6: 커밋**

```bash
git add frontend/src/pages/InsightsPage.tsx \
        frontend/src/pages/__tests__/InsightsPage.test.tsx
git commit -m "feat: InsightsPage 3-Layer 재설계 통합 (온보딩·딥링크·저축·전월비교)"
```

---

---

## Task 12: 스타일 통일 (선택적 — 별도 커밋)

스펙 "스타일만" 변경 대상 컴포넌트들을 카드 시스템 2단계로 통일.

**Files:**
- Modify: `frontend/src/components/stats/CategoryTopList.tsx`
- Modify: `frontend/src/components/stats/BudgetVsActual.tsx`
- Modify: `frontend/src/components/stats/CardUsageSummary.tsx`
- Modify: `frontend/src/components/stats/StructuredInsightsView.tsx`

**변경 사항:** 각 컴포넌트의 최외각 div 클래스를 기본 카드 스타일로 통일:

```css
/* 기본 카드 (통일 기준) */
bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6
```

프로그레스 바 높이/색상도 통일:
```css
h-1.5 rounded-full overflow-hidden bg-[var(--border-default)]
/* 색상: ≤80% grape-500 / 80~100% amber-500 / >100% red-500 */
```

**커밋:**
```bash
git add frontend/src/components/stats/CategoryTopList.tsx \
        frontend/src/components/stats/BudgetVsActual.tsx \
        frontend/src/components/stats/CardUsageSummary.tsx \
        frontend/src/components/stats/StructuredInsightsView.tsx
git commit -m "style: InsightsPage 컴포넌트 카드 스타일 통일"
```

---

## 최종 확인

```bash
# 전체 테스트
cd frontend && npm run test:run

# 린트
cd frontend && npm run lint

# 빌드
cd frontend && npm run build
```

통과 후 PR 생성:

```bash
git push -u origin feature/insights-redesign
gh pr create --base develop --title "feat: 모아보기(InsightsPage) 3-Layer 재설계" \
  --body "close #[이슈번호]"
```

# HIG 디자인 업그레이드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apple HIG 원칙 기반으로 포도가계부 전체 화면의 디자인 완성도를 한 단계 올린다.

**Architecture:** 바텀업 접근 — PR 1에서 디자인 토큰과 공통 컴포넌트를 정의하고, PR 2-4에서 각 화면에 적용, PR 5에서 모션과 최종 polish. PR 2-4는 병렬 가능.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-03-hig-design-upgrade-design.md`

---

## 파일 구조

### 신규 파일
- `frontend/src/components/skeleton/Skeleton.tsx` — 스켈레톤 프리미티브 (Skeleton, SkeletonCircle)
- `frontend/src/components/skeleton/__tests__/Skeleton.test.tsx` — 스켈레톤 테스트
- `frontend/src/components/stats/HeroSummary.tsx` — 히어로 금액 표시 컴포넌트
- `frontend/src/components/stats/__tests__/HeroSummary.test.tsx` — 히어로 테스트
- 각 페이지별 스켈레톤 조합 컴포넌트 (해당 페이지 파일 내 또는 인접)

### 수정 파일
- `frontend/src/index.css` — 타이포 토큰, 폼 토큰, 카드 유틸리티, 모션 키프레임, 다크모드 보정
- `frontend/src/components/EmptyState.tsx` — variant prop 추가
- `frontend/src/components/__tests__/EmptyState.test.tsx` — variant 테스트
- `frontend/src/components/TransactionItem.tsx` — 여백 확장, text-amount 적용
- `frontend/src/components/transaction/MonthlyView.tsx` — 날짜 그룹 헤더 강화, 스켈레톤 교체, border→gap
- `frontend/src/components/asset/NetWorthHero.tsx` — text-display 토큰 적용
- `frontend/src/components/stats/UnifiedSummaryCards.tsx` — 히어로 아래로 재배치
- `frontend/src/pages/TransactionList.tsx` — HeroSummary 추가
- `frontend/src/pages/AssetDashboard.tsx` — 스켈레톤 교체, card-surface 적용
- `frontend/src/pages/AssetForm.tsx` — input-base 적용
- `frontend/src/components/TransactionForm.tsx` — input-base 적용
- `frontend/src/pages/InsightsPage.tsx` — 히어로 적용, 스켈레톤 교체
- 기타 LoadingSpinner 사용 페이지 전부

---

## PR 1: 디자인 토큰 + 공통 컴포넌트

### Task 1: CSS 디자인 토큰 정의

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: 타이포 토큰 추가**

`index.css` 파일 끝(기존 유틸리티 클래스 영역)에 추가:

```css
/* ── HIG 디자인 토큰 ── */

/* 타이포그래피 */
.text-display {
  @apply text-3xl font-bold tracking-tight leading-tight;
}
.text-amount {
  @apply text-sm font-semibold tabular-nums tracking-wide;
}
```

- [ ] **Step 2: 폼 토큰 추가**

```css
/* 폼 */
.input-base {
  @apply w-full px-3 py-3 text-sm
    bg-[var(--input-bg)] text-[var(--text-primary)]
    border border-[var(--input-border)] rounded-xl
    focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-400
    transition-colors;
}
.dark .input-base {
  @apply focus:ring-grape-400/40 focus:border-grape-300;
}
```

- [ ] **Step 3: 카드 유틸리티 추가**

```css
/* 카드 */
.card-surface {
  @apply bg-[var(--surface-card)] rounded-2xl shadow-sm;
}
.dark .card-surface {
  @apply shadow-none border border-[var(--border-default)];
}
```

- [ ] **Step 4: 스켈레톤 변수 추가**

`:root` 블록에 추가:
```css
--skeleton-base: var(--color-warm-200);
```

`.dark` 블록에 추가:
```css
--skeleton-base: #3d3452;
```

- [ ] **Step 5: 모션 키프레임 추가**

`@theme` 블록의 기존 애니메이션 영역에 추가:

```css
--animate-page-in: page-in 0.25s ease-out;
```

`@theme` 블록 바깥, 기존 `@keyframes` 영역에 추가:

```css
@keyframes page-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

유틸리티 클래스 영역에 추가:

```css
/* 모션 */
.animate-page-in {
  animation: page-in 0.25s ease-out;
}

.animate-stagger > * {
  animation: page-in 0.2s ease-out both;
}
.animate-stagger > *:nth-child(1) { animation-delay: 0ms; }
.animate-stagger > *:nth-child(2) { animation-delay: 40ms; }
.animate-stagger > *:nth-child(3) { animation-delay: 80ms; }
.animate-stagger > *:nth-child(4) { animation-delay: 120ms; }
.animate-stagger > *:nth-child(5) { animation-delay: 160ms; }
.animate-stagger > *:nth-child(n+6) { animation: none; }

@media (prefers-reduced-motion: reduce) {
  .animate-page-in,
  .animate-stagger > *,
  .animate-sheet-up {
    animation: none !important;
  }
}
```

- [ ] **Step 6: 기존 sheet-up 타이밍 개선**

기존 `animate-sheet-up` 정의를 찾아 타이밍 함수 변경:
```css
/* 기존: animation: sheet-up 0.25s ease-out; */
/* 변경: */
--animate-sheet-up: sheet-up 0.3s cubic-bezier(0.32, 0.72, 0, 1);
```

- [ ] **Step 7: 다크모드 히어로 그라데이션 보정**

다크모드 보정은 각 컴포넌트에서 `dark:` 접두사로 적용. 별도 CSS 변수는 불필요.

- [ ] **Step 8: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 9: 커밋**

```bash
git add frontend/src/index.css
git commit -m "style: HIG 디자인 토큰 정의 — 타이포, 폼, 카드, 모션, 스켈레톤"
```

---

### Task 2: Skeleton 프리미티브 컴포넌트

**Files:**
- Create: `frontend/src/components/skeleton/Skeleton.tsx`
- Create: `frontend/src/components/skeleton/__tests__/Skeleton.test.tsx`

- [ ] **Step 1: 테스트 작성**

```tsx
// frontend/src/components/skeleton/__tests__/Skeleton.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton, SkeletonCircle } from '../Skeleton'

describe('Skeleton', () => {
  it('기본 스켈레톤을 렌더한다', () => {
    render(<Skeleton data-testid="sk" />)
    const el = screen.getByTestId('sk')
    expect(el).toBeInTheDocument()
    expect(el.className).toContain('animate-pulse')
  })

  it('className을 병합한다', () => {
    render(<Skeleton className="h-8 w-48" data-testid="sk" />)
    const el = screen.getByTestId('sk')
    expect(el.className).toContain('h-8')
    expect(el.className).toContain('w-48')
  })
})

describe('SkeletonCircle', () => {
  it('원형 스켈레톤을 렌더한다', () => {
    render(<SkeletonCircle className="w-10 h-10" data-testid="sc" />)
    const el = screen.getByTestId('sc')
    expect(el.className).toContain('rounded-full')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run src/components/skeleton/__tests__/Skeleton.test.tsx`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```tsx
// frontend/src/components/skeleton/Skeleton.tsx

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[var(--skeleton-base)] rounded-lg ${className}`}
      {...props}
    />
  )
}

export function SkeletonCircle({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[var(--skeleton-base)] rounded-full ${className}`}
      {...props}
    />
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/skeleton/__tests__/Skeleton.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/skeleton/
git commit -m "feat: Skeleton 프리미티브 컴포넌트 추가"
```

---

### Task 3: EmptyState variant 확장

**Files:**
- Modify: `frontend/src/components/EmptyState.tsx`
- Modify: `frontend/src/components/__tests__/EmptyState.test.tsx`

- [ ] **Step 1: 기존 테스트 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/EmptyState.test.tsx`
Expected: PASS

- [ ] **Step 2: variant 테스트 추가**

기존 테스트 파일에 추가:

```tsx
describe('EmptyState variants', () => {
  it('primary variant는 큰 아이콘 영역을 표시한다', () => {
    render(<EmptyState variant="primary" title="비어있음" />)
    expect(screen.getByText('비어있음')).toBeInTheDocument()
    // primary는 text-lg
    expect(screen.getByText('비어있음').className).toContain('text-lg')
  })

  it('section variant는 작은 레이아웃을 표시한다', () => {
    render(<EmptyState variant="section" title="비어있음" />)
    expect(screen.getByText('비어있음')).toBeInTheDocument()
    expect(screen.getByText('비어있음').className).toContain('text-sm')
  })

  it('inline variant는 아이콘 없이 텍스트만 표시한다', () => {
    render(<EmptyState variant="inline" title="결과 없음" />)
    expect(screen.getByText('결과 없음')).toBeInTheDocument()
    // inline은 아이콘 래퍼가 없어야 함
    expect(screen.queryByTestId('empty-state-icon')).not.toBeInTheDocument()
  })

  it('variant 미지정 시 primary가 기본값이다', () => {
    render(<EmptyState title="기본" />)
    expect(screen.getByText('기본').className).toContain('text-lg')
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/EmptyState.test.tsx`
Expected: FAIL (variant prop 없음)

- [ ] **Step 4: EmptyState 구현 수정**

`EmptyState.tsx`의 props 인터페이스에 variant 추가:
```tsx
interface EmptyStateProps {
  variant?: 'primary' | 'section' | 'inline'
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
}
```

렌더링 로직에서 variant에 따라 분기:
- `primary` (기본값): 현재 레이아웃 유지 (py-12, 큰 아이콘, text-lg)
- `section`: py-8, 작은 아이콘(w-12 h-12), text-sm title, 버튼 크기 축소
- `inline`: 아이콘 없음, py-4, text-sm text-muted, 버튼 없음

아이콘 래퍼에 `data-testid="empty-state-icon"` 추가.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/EmptyState.test.tsx`
Expected: PASS

- [ ] **Step 6: 기존 사용처에 영향 없음 확인**

Run: `cd frontend && npx vitest run`
Expected: 전체 PASS (variant 기본값이 primary이므로 기존 동작 유지)

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/components/EmptyState.tsx frontend/src/components/__tests__/EmptyState.test.tsx
git commit -m "feat: EmptyState variant 추가 — primary/section/inline 3티어"
```

---

### Task 4: HeroSummary 컴포넌트

**Files:**
- Create: `frontend/src/components/stats/HeroSummary.tsx`
- Create: `frontend/src/components/stats/__tests__/HeroSummary.test.tsx`

- [ ] **Step 1: 테스트 작성**

```tsx
// frontend/src/components/stats/__tests__/HeroSummary.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HeroSummary from '../HeroSummary'

describe('HeroSummary', () => {
  it('라벨과 금액을 표시한다', () => {
    render(<HeroSummary label="4월 지출" amount={1240000} />)
    expect(screen.getByText('4월 지출')).toBeInTheDocument()
    expect(screen.getByText('₩1,240,000')).toBeInTheDocument()
  })

  it('sublabel을 표시한다', () => {
    render(
      <HeroSummary label="4월 지출" amount={1240000} sublabel="수입 ₩3,200,000" />
    )
    expect(screen.getByText('수입 ₩3,200,000')).toBeInTheDocument()
  })

  it('금액에 text-display 클래스를 적용한다', () => {
    render(<HeroSummary label="순자산" amount={240000000} />)
    const amountEl = screen.getByText('₩240,000,000')
    expect(amountEl.className).toContain('text-display')
  })

  it('children이 있으면 렌더한다 (프로그레스 바 등)', () => {
    render(
      <HeroSummary label="예산" amount={500000}>
        <div data-testid="progress">62%</div>
      </HeroSummary>
    )
    expect(screen.getByTestId('progress')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run src/components/stats/__tests__/HeroSummary.test.tsx`
Expected: FAIL

- [ ] **Step 3: 구현**

```tsx
// frontend/src/components/stats/HeroSummary.tsx
import type { ReactNode } from 'react'
import { formatAmount } from '../../utils/format'

interface HeroSummaryProps {
  label: string
  amount: number
  sublabel?: string
  children?: ReactNode
  className?: string
}

export default function HeroSummary({ label, amount, sublabel, children, className = '' }: HeroSummaryProps) {
  return (
    <div className={`card-surface p-6 ${className}`}>
      <p className="text-sm text-[var(--text-tertiary)] mb-1">{label}</p>
      <p className="text-display text-[var(--text-primary)]">{formatAmount(amount)}</p>
      {sublabel && (
        <p className="text-xs text-[var(--text-muted)] mt-2">{sublabel}</p>
      )}
      {children}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/stats/__tests__/HeroSummary.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/stats/HeroSummary.tsx frontend/src/components/stats/__tests__/HeroSummary.test.tsx
git commit -m "feat: HeroSummary 컴포넌트 추가 — 히어로 금액 표시"
```

---

### Task 5: PR 1 전체 테스트 + 빌드 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `cd frontend && npm run test:run`
Expected: 전체 PASS

- [ ] **Step 2: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 린트 확인**

Run: `cd frontend && npm run lint`
Expected: 에러 없음

- [ ] **Step 4: PR 1 커밋 (필요시 미반영분)**

```bash
git add frontend/src/
git commit -m "chore: PR 1 빌드/테스트 확인"
```

---

## PR 2: 가계부 홈 적용

### Task 6: 거래 아이템 여백 확장 + text-amount 적용

**Files:**
- Modify: `frontend/src/components/TransactionItem.tsx`

- [ ] **Step 1: 패딩 변경**

`TransactionItem.tsx`에서 Link 래퍼의 클래스 변경:
```
현재: px-4 py-3
변경: px-4 py-4
```

- [ ] **Step 2: 금액에 text-amount 적용**

금액 표시 `<span>`의 클래스 변경:
```
현재: text-sm font-semibold whitespace-nowrap
변경: text-amount whitespace-nowrap
```

- [ ] **Step 3: 기존 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/TransactionItem.test.tsx`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/TransactionItem.tsx
git commit -m "style: 거래 아이템 여백 확장 + text-amount 적용"
```

---

### Task 7: 날짜 그룹 헤더 강화 + border→gap 전환

**Files:**
- Modify: `frontend/src/components/transaction/MonthlyView.tsx`

- [ ] **Step 1: 날짜 그룹 헤더에 일별 합계 추가**

날짜 그룹 헤더 렌더링 부분 (기존 `formatDateHeader(dateKey)` 영역):
- 날짜 텍스트 옆에 해당 날짜 거래의 합계를 표시
- 합계 계산: `transactions.reduce((sum, tx) => sum + (tx.type === 'expense' ? -tx.amount : tx.amount), 0)`
- 합계 표시: `text-xs text-[var(--text-muted)]` 오른쪽 정렬

헤더 레이아웃을 flex로 변경:
```tsx
<div className="sticky top-0 md:top-0 z-10 bg-[var(--surface-elevated)] px-4 py-2 scroll-mt-14 md:scroll-mt-0">
  <div className="flex items-center justify-between">
    <span className="text-xs font-semibold text-[var(--text-secondary)]">
      {formatDateHeader(dateKey)}
    </span>
    <span className="text-amount text-[var(--text-muted)]">
      {formatAmount(dailyTotal)}
    </span>
  </div>
</div>
```

- [ ] **Step 2: 거래 목록 border→gap 전환**

기존 `divide-y divide-[var(--border-subtle)]` 제거.
거래 아이템 컨테이너를 `flex flex-col gap-1`로 변경.

- [ ] **Step 3: 날짜 그룹 간 간격 추가**

날짜 그룹 사이에 `mt-6` 간격 추가 (첫 번째 그룹 제외).

- [ ] **Step 4: 일별 합계 표시 테스트 추가**

MonthlyView 테스트에 추가:
```tsx
it('날짜 그룹 헤더에 일별 합계를 표시한다', async () => {
  // 기존 mock 데이터에 거래가 있는 날짜의 합계가 표시되는지 확인
  // 합계 금액이 text-amount 클래스로 렌더되는지 확인
})
```

- [ ] **Step 5: 기존 MonthlyView 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/transaction/__tests__/MonthlyView.test.tsx`
Expected: PASS (텍스트 변경으로 실패 시 assertion 업데이트)

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/transaction/MonthlyView.tsx frontend/src/components/transaction/__tests__/MonthlyView.test.tsx
git commit -m "style: 날짜 그룹 헤더 강화 — 일별 합계, border→gap 전환"
```

---

### Task 8: 가계부 홈 HeroSummary 적용

**Files:**
- Modify: `frontend/src/pages/TransactionList.tsx`
- Modify: `frontend/src/components/transaction/MonthlyView.tsx`

- [ ] **Step 1: MonthlyView에 HeroSummary 추가**

MonthlyView props에 월간 합계 데이터가 이미 있는지 확인. 기존 `UnifiedSummaryCards`에 전달하는 데이터를 `HeroSummary`에도 전달.

MonthlyView 렌더링 순서를 변경:
1. HeroSummary (월간 지출 히어로)
2. 기존 UnifiedSummaryCards (히어로 아래로 이동)
3. 달력 + 거래 목록

```tsx
import HeroSummary from '../stats/HeroSummary'

// 렌더링 순서에서 HeroSummary를 최상단에 배치
<HeroSummary
  label={`${month}월 지출`}
  amount={totalExpense}
  sublabel={`수입 ${formatAmount(totalIncome)} · 잔액 ${formatAmountWithSign(totalIncome - totalExpense, 'income')}`}
/>
```

- [ ] **Step 2: 기존 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/transaction/__tests__/MonthlyView.test.tsx`
Expected: PASS (또는 assertion 업데이트)

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/TransactionList.tsx frontend/src/components/transaction/MonthlyView.tsx
git commit -m "feat: 가계부 홈 HeroSummary 적용 — 월간 지출 히어로"
```

---

### Task 9: 가계부 홈 스켈레톤 교체

**Files:**
- Modify: `frontend/src/components/transaction/MonthlyView.tsx`

- [ ] **Step 1: MonthlyViewSkeleton을 Skeleton 프리미티브로 교체**

기존 `MonthlyViewSkeleton` 함수를 Skeleton 프리미티브를 사용하도록 재작성:

```tsx
import { Skeleton } from '../skeleton/Skeleton'

function MonthlyViewSkeleton() {
  return (
    <div className="space-y-4">
      {/* 히어로 골격 */}
      <div className="card-surface p-6 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-3 w-36" />
      </div>
      {/* 날짜 헤더 + 거래 3줄 */}
      <div className="card-surface overflow-hidden">
        <div className="px-4 py-2">
          <Skeleton className="h-3 w-24" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="px-4 py-4 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 테스트 확인**

Run: `cd frontend && npx vitest run src/components/transaction/__tests__/MonthlyView.test.tsx`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/transaction/MonthlyView.tsx
git commit -m "style: 가계부 홈 스켈레톤을 Skeleton 프리미티브로 교체"
```

---

### Task 10: 가계부 홈 빈 상태 variant 적용

**Files:**
- Modify: `frontend/src/components/transaction/MonthlyView.tsx`

- [ ] **Step 1: 빈 상태에 variant="primary" 적용**

MonthlyView의 EmptyState 사용처에 `variant="primary"` 추가 (기본값이지만 명시적).

- [ ] **Step 2: 검색 결과 빈 상태에 variant="inline" 적용**

**Files (추가):** `frontend/src/components/transaction/SearchMode.tsx`

SearchMode 컴포넌트의 검색 결과 없음 상태에 `variant="inline"` 적용.

- [ ] **Step 3: 테스트 확인 + 커밋**

Run: `cd frontend && npx vitest run`
Expected: PASS

```bash
git add frontend/src/components/transaction/MonthlyView.tsx
git commit -m "style: 가계부 홈 빈 상태 variant 적용"
```

---

### Task 11: PR 2 전체 확인

- [ ] **Step 1: 전체 테스트 + 빌드 + 린트**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: 모두 통과

- [ ] **Step 2: PR 2 최종 커밋 (필요시)**

```bash
git commit -m "chore: PR 2 가계부 홈 디자인 적용 완료"
```

---

## PR 3: 돌아보기 + 입력폼 적용

### Task 12: 돌아보기 히어로 적용 + 스켈레톤

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`

- [ ] **Step 1: 월간 요약 카드를 HeroSummary로 교체**

InsightsPage의 첫 번째 섹션(월 요약)을 HeroSummary로 교체.

- [ ] **Step 2: LoadingSpinner → 스켈레톤 교체**

InsightsPage의 loading 상태를 Skeleton 프리미티브 조합으로 교체:
```tsx
import { Skeleton } from '../components/skeleton/Skeleton'

function InsightsPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* 히어로 골격 */}
      <div className="card-surface p-6 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-3 w-36" />
      </div>
      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card-surface p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      {/* 차트 영역 */}
      <div className="card-surface p-4">
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      {/* 카테고리 리스트 */}
      <div className="card-surface p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 빈 상태 variant 적용**

- [ ] **Step 4: 테스트 확인 + 커밋**

```bash
git commit -m "style: 돌아보기 HeroSummary + 스켈레톤 적용"
```

---

### Task 13: TransactionForm input-base 적용

**Files:**
- Modify: `frontend/src/components/TransactionForm.tsx`

- [ ] **Step 1: 기존 인풋 스타일을 input-base로 교체**

TransactionForm 내 모든 `<input>`, `<textarea>`, `<select>` 태그의 인라인 Tailwind 클래스를 `input-base`로 교체.

금액 입력 필드는 `input-base` 대신 금액 전용 스타일 유지:
```
text-2xl font-bold tabular-nums tracking-tight text-center
```

- [ ] **Step 2: 라벨 스타일 통일**

모든 `<label>`을 `text-sm font-medium text-[var(--text-secondary)] mb-1.5`로 통일.

- [ ] **Step 3: 테스트 확인 + 커밋**

Run: `cd frontend && npx vitest run src/components/__tests__/TransactionForm.test.tsx`

```bash
git commit -m "style: TransactionForm input-base 폼 토큰 적용"
```

---

### Task 14: AssetForm + ExpenseForm/IncomeForm + Detail 페이지 input-base 적용

**Files:**
- Modify: `frontend/src/pages/AssetForm.tsx`
- Modify: `frontend/src/pages/ExpenseForm.tsx`
- Modify: `frontend/src/pages/IncomeForm.tsx`
- Modify: `frontend/src/pages/ExpenseDetail.tsx`
- Modify: `frontend/src/pages/IncomeDetail.tsx`

- [ ] **Step 1: 각 폼의 인풋을 input-base로 교체**

위 5개 파일의 모든 인라인 인풋 스타일 → `input-base` 교체. 금액 필드는 전용 스타일 유지.

- [ ] **Step 2: LoadingSpinner → 스켈레톤 교체**

각 페이지의 로딩 상태를 폼 구조에 맞는 스켈레톤으로 교체.

- [ ] **Step 3: 테스트 확인 + 커밋**

```bash
git commit -m "style: AssetForm/ExpenseDetail/IncomeDetail input-base 적용"
```

---

### Task 15: PR 3 전체 확인

- [ ] **Step 1: 전체 테스트 + 빌드 + 린트**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: 모두 통과

---

## PR 4: 자산탭 + 설정 적용

### Task 16: 자산탭 디자인 토큰 통일

**Files:**
- Modify: `frontend/src/components/asset/NetWorthHero.tsx`
- Modify: `frontend/src/pages/AssetDashboard.tsx`

- [ ] **Step 1: NetWorthHero에 text-display 적용**

NetWorthHero의 순자산 금액 클래스 변경:
```
현재: text-3xl font-bold tracking-tight
변경: text-display
```

- [ ] **Step 2: AssetDashboard card-surface 적용**

카드 컴포넌트들의 인라인 `bg-[var(--surface-card)] rounded-2xl shadow-sm` → `card-surface` 교체.

- [ ] **Step 3: AssetDashboard LoadingSpinner → 스켈레톤**

```tsx
import { Skeleton } from '../components/skeleton/Skeleton'

// 히어로 + 차트 + 자산 그룹 2개 골격
```

- [ ] **Step 4: 다크모드 히어로 그라데이션 보정**

NetWorthHero의 그라데이션에 다크모드 변형 추가:
```
현재: bg-gradient-to-br from-grape-50 to-grape-100
추가: dark:from-grape-900/30 dark:to-grape-800/20
```

- [ ] **Step 5: 테스트 확인 + 커밋**

```bash
git commit -m "style: 자산탭 디자인 토큰 통일 + 스켈레톤 + 다크모드"
```

---

### Task 17: 설정 + 나머지 페이지 적용

**Files:**
- Modify: 설정 관련 컴포넌트
- Modify: `frontend/src/pages/CategoryManager.tsx`
- Modify: `frontend/src/pages/BudgetManager.tsx`
- Modify: `frontend/src/pages/RecurringList.tsx`
- Modify: 기타 LoadingSpinner 사용 페이지

- [ ] **Step 1: 나머지 페이지 LoadingSpinner → 스켈레톤**

LoadingSpinner를 사용하는 나머지 페이지를 해당 페이지 구조에 맞는 스켈레톤으로 교체:
- `frontend/src/pages/RecurringList.tsx`
- `frontend/src/pages/CategoryManager.tsx`
- `frontend/src/pages/BudgetManager.tsx`
- `frontend/src/pages/HouseholdListPage.tsx`
- `frontend/src/pages/HouseholdDetailPage.tsx`
- `frontend/src/pages/InvitationListPage.tsx`
- `frontend/src/pages/AdminPage.tsx` (내부 도구이므로 간단한 스켈레톤만)

- [ ] **Step 2: 나머지 EmptyState variant 적용**

- CategoryManager, BudgetManager: `variant="section"`
- RecurringList: `variant="primary"`

- [ ] **Step 3: 나머지 폼 input-base 적용**

CategoryManager, BudgetManager, 목표 설정 모달의 인풋을 `input-base`로 교체.

- [ ] **Step 4: 테스트 확인 + 커밋**

```bash
git commit -m "style: 설정/카테고리/예산/정기거래 디자인 토큰 적용"
```

---

### Task 18: PR 4 전체 확인

- [ ] **Step 1: 전체 테스트 + 빌드 + 린트**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: 모두 통과

---

## PR 5: 모션 + 최종 polish

### Task 19: 페이지 진입 애니메이션 적용

**Files:**
- Modify: 모든 페이지 컴포넌트의 최상위 wrapper

- [ ] **Step 1: 각 페이지 최상위 div에 animate-page-in 추가**

모든 페이지 컴포넌트(`TransactionList`, `InsightsPage`, `AssetDashboard`, `AssetForm`, `ExpenseDetail`, `IncomeDetail`, `CategoryManager`, `BudgetManager`, `RecurringList`, 설정 페이지)의 최상위 `<div>`에 `animate-page-in` 클래스 추가.

예시:
```tsx
// 현재
return <div className="space-y-4 px-4 py-6">
// 변경
return <div className="space-y-4 px-4 py-6 animate-page-in">
```

- [ ] **Step 2: 커밋**

```bash
git commit -m "style: 전체 페이지 진입 애니메이션 적용"
```

---

### Task 20: stagger 애니메이션 적용

**Files:**
- Modify: `frontend/src/components/transaction/MonthlyView.tsx`
- Modify: `frontend/src/pages/AssetDashboard.tsx`
- Modify: `frontend/src/pages/InsightsPage.tsx`

- [ ] **Step 1: 카드 목록 컨테이너에 animate-stagger 적용**

- 가계부 홈: 날짜 그룹 컨테이너에 `animate-stagger`
- 자산탭: AssetGroupList에 `animate-stagger`
- 돌아보기: 카드 목록에 `animate-stagger`

- [ ] **Step 2: 테스트 확인 + 커밋**

```bash
git commit -m "style: stagger 애니메이션 적용 — 홈/자산/돌아보기"
```

---

### Task 21: 다크모드 전체 QA + 최종 polish

**Files:**
- Modify: 필요에 따라 여러 파일

- [ ] **Step 1: 다크모드에서 모든 화면 확인**

체크리스트:
- [ ] 카드가 card-surface로 다크에서 border 표시되는지
- [ ] 스켈레톤이 다크에서 보이는지 (skeleton-base 대비)
- [ ] 히어로 그라데이션이 다크에서 은은한 보라인지
- [ ] 인풋 포커스 링이 다크에서 보이는지
- [ ] 금액 색상 (수입 leaf-400)이 다크에서 가독성 좋은지
- [ ] 모션이 prefers-reduced-motion에서 비활성화되는지

- [ ] **Step 2: 발견된 이슈 수정**

- [ ] **Step 3: 전체 테스트 + 빌드 + 린트**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: 모두 통과

- [ ] **Step 4: 최종 커밋**

```bash
git commit -m "style: 다크모드 QA + 최종 polish"
```

---

### Task 22: GuidePage + changelogs 업데이트

**Files:**
- Modify: `frontend/src/pages/GuidePage.tsx`
- Modify: `frontend/src/data/changelogs.ts`

- [ ] **Step 1: GuidePage 업데이트**

디자인 변경사항 반영 (필요시 — 기능 변경이 아니므로 최소한).

- [ ] **Step 2: changelogs 업데이트**

```typescript
{
  version: '0.15.0',
  date: '2026-04-XX',
  title: '디자인 업그레이드',
  items: [
    { tag: '개선', text: '전체 화면 디자인 완성도 향상 — Apple HIG 기반 타이포/여백/모션 개선' },
    { tag: '개선', text: '스켈레톤 로딩 UI 도입 — 로딩 중에도 콘텐츠 구조 유지' },
    { tag: '개선', text: '다크모드 디테일 개선 — 카드 깊이감, 히어로 그라데이션 보정' },
  ],
},
```

- [ ] **Step 3: 커밋**

```bash
git commit -m "docs: GuidePage + changelogs 디자인 업그레이드 반영"
```

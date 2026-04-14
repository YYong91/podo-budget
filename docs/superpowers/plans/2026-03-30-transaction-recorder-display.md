# 거래 목록 기록자 표시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공유 가계부의 거래 목록에서 각 거래를 누가 기록했는지 username을 표시한다.

**Architecture:** `UnifiedTransaction`에 `user_id`를 추가하고, 가구 멤버 목록에서 `user_id → username` 맵을 만들어 `TransactionItem`에 전달한다. 가구원이 1명이면 표시하지 않는다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Zustand, Vitest + React Testing Library + MSW

---

### Task 1: UnifiedTransaction에 user_id 추가

**Files:**
- Modify: `frontend/src/hooks/useTransactionSearch.ts:21-31`
- 참조: `frontend/src/hooks/useMonthlyTransactions.ts` (useTransactionSearch에서 import하므로 자동 반영)

- [ ] **Step 1: UnifiedTransaction 인터페이스에 user_id 추가**

`frontend/src/hooks/useTransactionSearch.ts`의 `UnifiedTransaction` 인터페이스:

```typescript
export interface UnifiedTransaction {
  id: number
  type: 'expense' | 'income'
  date: string
  description: string
  amount: number
  category_id: number | null
  user_id: number | null          // 추가
  exclude_from_stats?: boolean
  raw_input?: string | null
  recurring_transaction_id?: number | null
}
```

Expense 타입에는 `user_id: number | null`, Income 타입에는 `user_id: number`가 이미 정의되어 있으므로, spread 연산자(`...e`, `...i`)로 매핑할 때 자동으로 포함된다. 추가 코드 변경 불필요.

- [ ] **Step 2: 빌드 확인**

Run: `cd frontend && npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/hooks/useTransactionSearch.ts
git commit -m "feat: UnifiedTransaction에 user_id 필드 추가 (#522)"
```

---

### Task 2: TransactionItem에 recordedBy prop 추가 및 표시

**Files:**
- Modify: `frontend/src/components/TransactionItem.tsx`
- Test: `frontend/src/components/__tests__/TransactionItem.test.tsx`

- [ ] **Step 1: 테스트 파일 생성 — recordedBy 표시 테스트**

`frontend/src/components/__tests__/TransactionItem.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import TransactionItem from '../TransactionItem'
import type { Category } from '../../types'

const categoryMap = new Map<number, Category>([
  [1, { id: 1, name: '식비', type: 'expense', is_default: true, household_id: 1, sort_order: 0 }],
])

const defaultProps = {
  id: 1,
  type: 'expense' as const,
  description: '점심 김치찌개',
  amount: 8000,
  categoryId: 1,
  categoryMap,
  onCategoryClick: vi.fn(),
}

function renderItem(props = {}) {
  return render(
    <MemoryRouter>
      <TransactionItem {...defaultProps} {...props} />
    </MemoryRouter>
  )
}

describe('TransactionItem 기록자 표시', () => {
  it('recordedBy가 있으면 username을 표시한다', () => {
    renderItem({ recordedBy: 'seungyong' })
    expect(screen.getByText('seungyong')).toBeInTheDocument()
  })

  it('recordedBy가 없으면 username을 표시하지 않는다', () => {
    renderItem()
    expect(screen.queryByText('seungyong')).not.toBeInTheDocument()
  })

  it('recordedBy가 undefined이면 username을 표시하지 않는다', () => {
    renderItem({ recordedBy: undefined })
    expect(screen.queryByText('seungyong')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/TransactionItem.test.tsx`
Expected: FAIL — `recordedBy` prop이 아직 없으므로 첫 번째 테스트 실패

- [ ] **Step 3: TransactionItem에 recordedBy prop 추가 및 렌더링**

`frontend/src/components/TransactionItem.tsx` 수정:

```typescript
interface TransactionItemProps {
  id: number
  type: 'expense' | 'income'
  description: string
  amount: number
  categoryId: number | null
  /** O(1) 카테고리 조회를 위해 Map으로 전달 (#180) */
  categoryMap: Map<number, Category>
  excludeFromStats?: boolean
  recurringTransactionId?: number | null
  /** 기록자 username — 가구원 2명 이상일 때만 전달 (#522) */
  recordedBy?: string
  /** 안정적 콜백 — TransactionList에서 useMemo로 생성된 핸들러 전달 (#240) */
  onCategoryClick: () => void
}
```

함수 시그니처에 `recordedBy` 추가:

```typescript
function TransactionItem({
  id,
  type,
  description,
  amount,
  categoryId,
  categoryMap,
  excludeFromStats,
  recurringTransactionId,
  recordedBy,
  onCategoryClick,
}: TransactionItemProps) {
```

2번째 줄 뱃지 영역(`<div className="flex items-center gap-1.5">`)의 닫는 `</div>` 앞에 추가:

```tsx
{recordedBy && (
  <span className="text-xs text-[var(--text-tertiary)]">{recordedBy}</span>
)}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/TransactionItem.test.tsx`
Expected: PASS (3개 테스트 모두 통과)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/TransactionItem.tsx frontend/src/components/__tests__/TransactionItem.test.tsx
git commit -m "feat: TransactionItem에 기록자(recordedBy) 표시 추가 (#522)"
```

---

### Task 3: MonthlyView와 SearchMode에서 recordedBy 전달

**Files:**
- Modify: `frontend/src/components/transaction/MonthlyView.tsx`
- Modify: `frontend/src/components/transaction/SearchMode.tsx`
- Modify: `frontend/src/pages/TransactionList.tsx`

- [ ] **Step 1: TransactionList에서 memberMap 생성 및 전달**

`frontend/src/pages/TransactionList.tsx`에서:

1) import 추가:

```typescript
import { useHouseholdStore } from '../stores/useHouseholdStore'
// 이미 import 되어 있음 — activeHouseholdId용
```

2) `currentHousehold`를 스토어에서 가져오기 (기존 `activeHouseholdId` 가져오는 곳 근처):

```typescript
const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
const currentHousehold = useHouseholdStore((s) => s.currentHousehold)
```

3) memberMap 생성 (useMemo):

```typescript
const memberMap = useMemo(() => {
  const members = currentHousehold?.members
  if (!members || members.length <= 1) return null
  const map = new Map<number, string>()
  for (const m of members) {
    map.set(m.user_id, m.username)
  }
  return map
}, [currentHousehold?.members])
```

4) MonthlyView와 SearchMode에 `memberMap` prop 전달:

```tsx
<MonthlyView
  monthly={monthly}
  categoryClickHandlers={categoryClickHandlers}
  memberMap={memberMap}
/>
```

```tsx
<SearchMode
  search={search}
  monthly={monthly}
  categoryClickHandlers={categoryClickHandlers}
  memberMap={memberMap}
/>
```

- [ ] **Step 2: MonthlyView에서 memberMap 받아서 TransactionItem에 recordedBy 전달**

`frontend/src/components/transaction/MonthlyView.tsx`:

1) props 인터페이스에 추가:

```typescript
interface MonthlyViewProps {
  // ... 기존 props
  memberMap: Map<number, string> | null
}
```

2) TransactionItem 렌더링 부분에 `recordedBy` prop 추가:

```tsx
<TransactionItem
  key={`${tx.type}-${tx.id}`}
  id={tx.id}
  type={tx.type}
  description={tx.description}
  amount={tx.amount}
  categoryId={tx.category_id}
  categoryMap={monthly.categoryMap}
  excludeFromStats={tx.exclude_from_stats}
  recurringTransactionId={tx.recurring_transaction_id}
  recordedBy={memberMap && tx.user_id != null ? memberMap.get(tx.user_id) : undefined}
  onCategoryClick={categoryClickHandlers.get(`${tx.type}-${tx.id}`)!}
/>
```

- [ ] **Step 3: SearchMode에서도 동일하게 memberMap → recordedBy 전달**

`frontend/src/components/transaction/SearchMode.tsx`:

1) props 인터페이스에 추가:

```typescript
interface SearchModeProps {
  // ... 기존 props
  memberMap: Map<number, string> | null
}
```

2) TransactionItem 렌더링 부분에 `recordedBy` prop 추가:

```tsx
<TransactionItem
  key={`${tx.type}-${tx.id}`}
  id={tx.id}
  type={tx.type}
  description={tx.description}
  amount={tx.amount}
  categoryId={tx.category_id}
  categoryMap={monthly.categoryMap}
  excludeFromStats={tx.exclude_from_stats}
  recurringTransactionId={tx.recurring_transaction_id}
  recordedBy={memberMap && tx.user_id != null ? memberMap.get(tx.user_id) : undefined}
  onCategoryClick={categoryClickHandlers.get(`${tx.type}-${tx.id}`) ?? (() => {})}
/>
```

- [ ] **Step 4: 빌드 확인**

Run: `cd frontend && npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 5: 전체 테스트 실행**

Run: `cd frontend && npx vitest run`
Expected: 기존 테스트 + 새 테스트 모두 PASS

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/pages/TransactionList.tsx frontend/src/components/transaction/MonthlyView.tsx frontend/src/components/transaction/SearchMode.tsx
git commit -m "feat: 거래 목록에 기록자 username 전달 (#522)"
```

---

### Task 4: TransactionList에서 currentHousehold 로딩 추가

**Files:**
- Modify: `frontend/src/pages/TransactionList.tsx`

> **배경:** `fetchHouseholdDetail`은 HouseholdDetailPage에서만 호출되고 있어, TransactionList 진입 시 `currentHousehold`가 null이다. memberMap을 구성하려면 여기서 직접 로딩해야 한다.

- [ ] **Step 1: TransactionList에 fetchHouseholdDetail useEffect 추가**

`frontend/src/pages/TransactionList.tsx`에서 기존 `activeHouseholdId` 가져오는 곳 아래에 추가:

```typescript
const currentHousehold = useHouseholdStore((s) => s.currentHousehold)
const fetchHouseholdDetail = useHouseholdStore((s) => s.fetchHouseholdDetail)

useEffect(() => {
  if (activeHouseholdId && currentHousehold?.id !== activeHouseholdId) {
    fetchHouseholdDetail(activeHouseholdId)
  }
}, [activeHouseholdId, currentHousehold?.id, fetchHouseholdDetail])
```

`currentHousehold?.id !== activeHouseholdId` 조건으로 가구 전환 시에도 새로 로딩한다.

- [ ] **Step 2: 빌드 확인**

Run: `cd frontend && npx tsc --noEmit`
Expected: 타입 에러 없음

- [ ] **Step 3: 로컬에서 수동 테스트**

Run: `cd frontend && npm run dev`
- 가구원이 2명 이상인 가구에서 거래 목록에 username이 표시되는지 확인
- 가구원이 1명인 가구에서는 표시되지 않는지 확인

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/TransactionList.tsx
git commit -m "feat: TransactionList에서 currentHousehold 로딩 추가 (#522)"
```

---

### Task 5: 린트 + 전체 테스트 + 빌드 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 린트 확인**

Run: `cd frontend && npm run lint`
Expected: 에러 없음

- [ ] **Step 2: 전체 테스트**

Run: `cd frontend && npm run test:run`
Expected: 모든 테스트 PASS

- [ ] **Step 3: 프로덕션 빌드**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 최종 커밋 (필요 시)**

린트/빌드에서 수정 사항이 있었다면 커밋:

```bash
git add -A
git commit -m "chore: 린트/빌드 수정 (#522)"
```

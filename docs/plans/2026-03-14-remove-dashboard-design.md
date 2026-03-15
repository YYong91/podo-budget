# 대시보드 제거 — 가계부를 첫 화면으로 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 대시보드 페이지를 제거하고, 가계부(TransactionList)를 앱의 첫 화면(`/`)으로 설정한다.

**Architecture:** 대시보드의 유일한 고유 기능인 "반복 거래 알림"을 별도 컴포넌트로 추출하여 TransactionList 상단에 배치. 나머지 대시보드 기능(요약 카드, 차트, 최근 거래)은 TransactionList와 리포트에서 이미 커버되므로 삭제. 네비게이션을 5탭 → 4탭으로 축소.

**Tech Stack:** React 19, TypeScript, React Router v7, Tailwind CSS v4, Vitest

---

## 배경

- 대시보드와 리포트 간 중복이 심함 (요약 카드, 차트)
- 포도가계부는 자동 연동 없는 수동 입력 앱 → 거래 내역이 핵심 콘텐츠
- TransactionList에 이미 월 지출/수입 요약이 표시됨
- 리서치 결과: 수동 입력 가계부는 거래 내역을 첫 화면에 두는 패턴이 가장 효과적

---

### Task 1: PendingRecurring 컴포넌트 추출

Dashboard.tsx에서만 사용되는 반복 거래 알림 UI를 독립 컴포넌트로 추출한다.

**Files:**
- Create: `frontend/src/components/PendingRecurring.tsx`
- Test: `frontend/src/components/__tests__/PendingRecurring.test.tsx`

**Step 1: 컴포넌트 파일 생성**

`frontend/src/components/PendingRecurring.tsx`에 Dashboard.tsx의 `PendingRecurring` 함수(386~439행)를 그대로 옮긴다. import도 함께 추가:

```tsx
import type { RecurringTransaction } from '../types'
import { formatAmount } from '../utils/format'

interface PendingRecurringProps {
  items: RecurringTransaction[]
  onExecute: (id: number) => void
  onSkip: (id: number) => void
}

export default function PendingRecurring({ items, onExecute, onSkip }: PendingRecurringProps) {
  if (items.length === 0) return null
  // ... Dashboard.tsx 386~439행의 JSX 그대로
}
```

**Step 2: 테스트 작성**

`frontend/src/components/__tests__/PendingRecurring.test.tsx`:
- 빈 배열이면 아무것도 렌더링하지 않는다
- 반복 거래 항목을 렌더링한다 (description, amount 표시)
- 등록 버튼 클릭 시 onExecute가 호출된다
- 건너뛰기 버튼 클릭 시 onSkip이 호출된다

**Step 3: 테스트 실행**

```bash
cd frontend && npx vitest run src/components/__tests__/PendingRecurring.test.tsx
```

Expected: PASS

**Step 4: 커밋**

```bash
git add frontend/src/components/PendingRecurring.tsx frontend/src/components/__tests__/PendingRecurring.test.tsx
git commit -m "refactor: PendingRecurring 컴포넌트를 Dashboard에서 독립 추출"
```

---

### Task 2: TransactionList에 반복 거래 알림 통합

첫 화면이 될 TransactionList에 반복 거래 알림을 추가한다.

**Files:**
- Modify: `frontend/src/pages/TransactionList.tsx`

**Step 1: import 추가**

```tsx
import { recurringApi } from '../api/recurring'
import PendingRecurring from '../components/PendingRecurring'
import { useToast } from '../hooks/useToast'
import type { RecurringTransaction } from '../types'
```

**Step 2: 상태 + 데이터 로딩 추가**

컴포넌트 내부에:
```tsx
const { addToast } = useToast()
const [pendingRecurring, setPendingRecurring] = useState<RecurringTransaction[]>([])
```

`fetchData` 함수 내에서 기존 expense/income 병렬 로드에 recurring pending도 추가:
```tsx
const [expRes, incRes, pendingRes] = await Promise.all([
  expenseApi.getAll(baseParams).catch(() => ({ data: [] as Expense[] })),
  incomeApi.getAll(baseParams).catch(() => ({ data: [] as Income[] })),
  recurringApi.getPending(activeHouseholdId ?? undefined).catch(() => ({ data: [] as RecurringTransaction[] })),
])
// ...
setPendingRecurring(pendingRes?.data ?? [])
```

**Step 3: JSX에 PendingRecurring 배치**

요약 + 필터 영역과 미니 캘린더 사이에 배치:
```tsx
{/* 요약 + 필터 */}
<div className="flex items-center justify-center gap-6">...</div>

{/* 반복 거래 알림 */}
<PendingRecurring
  items={pendingRecurring}
  onExecute={async (id) => {
    try {
      const res = await recurringApi.execute(id)
      addToast('success', res.data.message)
      setPendingRecurring((prev) => prev.filter((r) => r.id !== id))
      fetchData()
    } catch {
      addToast('error', '반복 거래 등록에 실패했습니다')
    }
  }}
  onSkip={async (id) => {
    try {
      const res = await recurringApi.skip(id)
      addToast('success', `다음 예정일: ${res.data.next_due_date}`)
      setPendingRecurring((prev) => prev.filter((r) => r.id !== id))
    } catch {
      addToast('error', '건너뛰기에 실패했습니다')
    }
  }}
/>

{/* 미니 캘린더 */}
```

**Step 4: 테스트 실행**

```bash
cd frontend && npx vitest run src/pages/__tests__/TransactionList.test.tsx
```

기존 테스트가 깨지지 않는지 확인. recurring API mock이 필요하면 MSW 핸들러에 추가.

**Step 5: 커밋**

```bash
git add frontend/src/pages/TransactionList.tsx
git commit -m "feat: 가계부 목록에 반복 거래 알림 통합"
```

---

### Task 3: 라우팅 변경 — `/`를 TransactionList로

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: 라우트 변경**

```tsx
// 변경 전
const Dashboard = lazy(() => import('./pages/Dashboard'))
// ...
<Route path="/" element={<Dashboard />} />
<Route path="/transactions" element={<TransactionList />} />

// 변경 후 (Dashboard import 제거)
<Route path="/" element={<TransactionList />} />
<Route path="/transactions" element={<Navigate to="/" replace />} />
```

`/transactions?tab=expense` 같은 쿼리 파라미터가 있는 링크도 있으므로, 리다이렉트 시 쿼리를 보존하는 컴포넌트가 필요할 수 있음. 실제로 TransactionList는 `filter` 파라미터를 쓰므로 `/transactions?filter=expense` → `/?filter=expense`로 보존 필요:

```tsx
// 쿼리 보존 리다이렉트 컴포넌트
function TransactionsRedirect() {
  const [searchParams] = useSearchParams()
  const query = searchParams.toString()
  return <Navigate to={query ? `/?${query}` : '/'} replace />
}

// 라우트
<Route path="/transactions" element={<TransactionsRedirect />} />
```

참고: 기존 코드에서 `/transactions?tab=expense`를 쓰는 곳이 있으나, TransactionList는 실제로 `filter` 파라미터를 사용함. 이 불일치가 있다면 함께 정리할 것.

**Step 2: Dashboard lazy import 제거**

```tsx
// 삭제
const Dashboard = lazy(() => import('./pages/Dashboard'))
```

**Step 3: 빌드 확인**

```bash
cd frontend && npm run build
```

Expected: 성공 (Dashboard import가 없어도 빌드됨)

**Step 4: 커밋**

```bash
git add frontend/src/App.tsx
git commit -m "refactor: 첫 화면을 Dashboard에서 TransactionList로 변경"
```

---

### Task 4: 네비게이션 4탭으로 축소

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: navItems에서 대시보드 제거, 가계부 path를 `/`로 변경**

```tsx
// 변경 전
const navItems = [
  { path: '/', label: '대시보드', icon: LayoutDashboard },
  { path: '/transactions', label: '가계부', icon: Receipt },
  { path: '/insights', label: '리포트', icon: TrendingUp },
  { path: '/assets', label: '자산', icon: Landmark },
  { path: '/settings', label: '설정', icon: SettingsIcon },
]

// 변경 후
const navItems = [
  { path: '/', label: '가계부', icon: Receipt },
  { path: '/insights', label: '리포트', icon: TrendingUp },
  { path: '/assets', label: '자산', icon: Landmark },
  { path: '/settings', label: '설정', icon: SettingsIcon },
]
```

**Step 2: 사용하지 않는 import 제거**

`LayoutDashboard`를 lucide-react import에서 제거.

**Step 3: 커밋**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "refactor: 네비게이션에서 대시보드 제거, 4탭 구조로 변경"
```

---

### Task 5: 내부 링크 정리

앱 내에서 `/transactions`를 가리키는 링크들을 `/`로 변경하거나, 리다이렉트에 의존할 수 있는지 확인.

**Files:**
- Modify: 링크가 있는 파일들 (검색으로 확인)

**Step 1: `/transactions` 링크 검색**

```bash
cd frontend && grep -r '"/transactions' src/ --include='*.tsx' --include='*.ts' -l
```

현재 확인된 파일: `Dashboard.tsx` (삭제 예정), `GuidePage.tsx`, `App.tsx` (리다이렉트 처리됨)

**Step 2: GuidePage.tsx의 링크 업데이트**

GuidePage에서 `transactions` 관련 참조가 있다면 `/`로 변경하거나, 설명 텍스트만이면 유지.

**Step 3: 기타 파일의 `/transactions` 링크도 `/`로 변경**

리다이렉트가 있으므로 당장 깨지진 않지만, 불필요한 리다이렉트를 피하기 위해 가능한 직접 `/`를 가리키도록 변경.

**Step 4: 커밋**

```bash
git commit -m "chore: 내부 링크를 /transactions에서 /로 업데이트"
```

---

### Task 6: Dashboard 관련 파일 삭제

**Files:**
- Delete: `frontend/src/pages/Dashboard.tsx`
- Delete: `frontend/src/pages/__tests__/Dashboard.test.tsx`
- Delete: `frontend/src/components/GrapeProgress.tsx`
- Delete: `frontend/src/components/__tests__/GrapeProgress.test.tsx`

**Step 1: GrapeProgress가 Dashboard 외에서 사용되는지 확인**

```bash
cd frontend && grep -r 'GrapeProgress' src/ --include='*.tsx' --include='*.ts'
```

Dashboard.tsx에서만 사용됨을 확인 후 삭제. (최신 Dashboard에서는 이미 import하지 않으므로 바로 삭제 가능)

**Step 2: 파일 삭제**

```bash
rm frontend/src/pages/Dashboard.tsx
rm frontend/src/pages/__tests__/Dashboard.test.tsx
rm frontend/src/components/GrapeProgress.tsx
rm frontend/src/components/__tests__/GrapeProgress.test.tsx
```

**Step 3: 커밋**

```bash
git add -u
git commit -m "chore: Dashboard 및 GrapeProgress 컴포넌트 삭제"
```

---

### Task 7: Layout 테스트 업데이트

**Files:**
- Modify: `frontend/src/components/__tests__/Layout.test.tsx`

**Step 1: 대시보드 관련 테스트 수정**

```tsx
// 변경 전
expect(screen.getAllByRole('link', { name: /대시보드/i }).length).toBe(2)

// 변경 후: 대시보드 테스트 제거, 가계부가 4탭 중 첫 번째인지 확인
// 네비게이션 항목 4개 확인
expect(screen.getAllByRole('link', { name: '가계부' }).length).toBe(2)
expect(screen.getAllByRole('link', { name: /리포트/i }).length).toBe(2)
expect(screen.getAllByRole('link', { name: /^자산$/i }).length).toBe(2)
expect(screen.getAllByRole('link', { name: /설정/i }).length).toBe(2)
```

aria-current 테스트도 업데이트:
```tsx
// 변경 전: '/' 경로에서 대시보드가 active
renderLayout('/')
const dashboardLinks = screen.getAllByRole('link', { name: /대시보드/i })

// 변경 후: '/' 경로에서 가계부가 active
renderLayout('/')
const transactionLinks = screen.getAllByRole('link', { name: '가계부' })
transactionLinks.forEach(link => {
  expect(link).toHaveAttribute('aria-current', 'page')
})
```

**Step 2: 테스트 실행**

```bash
cd frontend && npx vitest run src/components/__tests__/Layout.test.tsx
```

Expected: PASS

**Step 3: 커밋**

```bash
git add frontend/src/components/__tests__/Layout.test.tsx
git commit -m "test: Layout 테스트를 4탭 구조에 맞게 업데이트"
```

---

### Task 8: 전체 테스트 + 빌드 확인

**Step 1: 린트**

```bash
cd frontend && npm run lint
```

**Step 2: 전체 테스트**

```bash
cd frontend && npm run test:run
```

**Step 3: 빌드**

```bash
cd frontend && npm run build
```

**Step 4: 백엔드 테스트 (영향 없음 확인)**

```bash
cd backend && pytest
```

모두 통과하면 완료.

**Step 5: 최종 커밋 (필요 시)**

```bash
git commit -m "chore: 대시보드 제거 후 전체 테스트 통과 확인"
```

---

### Task 9: 문서 업데이트

**Files:**
- Modify: `CLAUDE.md` — Frontend 구조에서 Dashboard 제거, 라우팅 설명 업데이트
- Modify: `frontend/src/pages/GuidePage.tsx` — 대시보드 관련 안내가 있으면 제거/수정
- Modify: `frontend/src/data/changelogs.ts` — 새소식에 "가계부가 첫 화면으로 변경" 추가

**Step 1: CLAUDE.md 업데이트**

Pages 목록에서 Dashboard 제거, TransactionList가 `/`임을 반영.

**Step 2: GuidePage 업데이트**

"대시보드" 관련 안내가 있으면 "가계부"로 변경.

**Step 3: changelogs.ts 업데이트**

```typescript
{
  version: '1.x.0',
  date: '2026-03-14',
  title: '첫 화면 개편',
  items: [
    { tag: '개선', text: '앱을 열면 바로 가계부(거래 내역)가 표시됩니다' },
    { tag: '개선', text: '네비게이션이 4탭으로 간결해졌습니다' },
  ],
},
```

**Step 4: 커밋**

```bash
git commit -m "docs: 대시보드 제거에 따른 문서 및 가이드 업데이트"
```

# #74 + #85 UX 정비 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모든 페이지에서 에러/빈 상태/로딩이 일관되게 동작하도록 정비

**Architecture:** 글로벌 API 에러 toast interceptor 추가 → 빠진 페이지에 ErrorState/EmptyState 적용 → 로딩 스피너 통일 → InsightsPage 스켈레톤 UI

**Tech Stack:** React 19, TypeScript, Axios, react-hot-toast, Tailwind CSS v4

---

### Task 1: 글로벌 API 에러 toast interceptor

**Files:**
- Modify: `frontend/src/api/client.ts:34-48`
- Test: `frontend/src/api/__tests__/client.test.ts` (새 파일)

**Step 1: 테스트 작성**

```typescript
// frontend/src/api/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError } from 'axios'

// toast 모킹
const mockToastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { error: (msg: string) => mockToastError(msg) },
}))

describe('API client error interceptor', () => {
  beforeEach(() => {
    mockToastError.mockClear()
  })

  it('4xx 에러 시 글로벌 toast가 표시된다', async () => {
    // apiClient를 import하면 interceptor가 등록됨
    const { default: apiClient } = await import('../client')

    // 실제 요청 대신 interceptor 로직만 검증
    const error = new AxiosError('Bad Request', '400', undefined, undefined, {
      status: 400,
      data: { detail: '잘못된 요청입니다' },
    } as any)

    try {
      // response interceptor의 reject 핸들러 직접 호출
      await apiClient.interceptors.response.handlers[0].rejected(error)
    } catch {
      // reject은 에러를 다시 던짐
    }

    expect(mockToastError).toHaveBeenCalledWith('잘못된 요청입니다')
  })

  it('401 에러 시 toast가 표시되지 않는다', async () => {
    const { default: apiClient } = await import('../client')

    const error = new AxiosError('Unauthorized', '401', undefined, undefined, {
      status: 401,
      data: { detail: 'Unauthorized' },
    } as any)

    try {
      await apiClient.interceptors.response.handlers[0].rejected(error)
    } catch {
      // expected
    }

    expect(mockToastError).not.toHaveBeenCalled()
  })
})
```

> Note: interceptor 테스트가 까다로우면 로직을 순수 함수로 추출해서 테스트해도 됨.

**Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && npx vitest run src/api/__tests__/client.test.ts`
Expected: FAIL (현재 toast 호출 없음)

**Step 3: 글로벌 에러 toast 구현**

`frontend/src/api/client.ts:34-48`을 다음으로 교체:

```typescript
import toast from 'react-hot-toast'

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.detail || '요청 처리 중 오류가 발생했습니다'

    // 401은 AuthContext에서 처리 (SSO 리디렉션)
    // 나머지 에러는 글로벌 toast로 표시
    if (status !== 401) {
      // 문자열이 아닌 detail (예: 객체)은 기본 메시지 사용
      const toastMsg = typeof message === 'string' ? message : '요청 처리 중 오류가 발생했습니다'
      toast.error(toastMsg)
    }

    // 5xx 서버 에러 또는 네트워크 에러만 Sentry에 보고
    if (!status || status >= 500) {
      captureException(error)
    }

    console.error('API Error:', message)
    return Promise.reject(error)
  }
)
```

**Step 4: 기존 페이지 중복 toast 정리**

글로벌 toast가 있으므로 페이지별 catch에서 `addToast('error', ...)` 중 API 에러 기본 메시지를 그대로 보여주는 곳은 제거 가능. 단, **커스텀 메시지**(예: "설명을 입력해주세요")는 유지.

정리 대상 (catch에서 generic 에러 메시지만 표시하는 곳):
- `InsightsPage.tsx:129` — `toast.error('데이터를 불러오는데 실패했습니다')` → 글로벌이 처리하므로 catch 블록에서 toast 제거, 대신 error 상태 세팅
- `FeedbackPage.tsx:65` — `toast.error('제출에 실패했습니다')` → 유지 (커스텀 메시지)

> **주의**: 모든 catch를 제거하는 게 아님. 페이지 로딩 에러는 error state로 전환, 폼 제출 에러의 커스텀 메시지는 유지.

**Step 5: 테스트 실행 — 통과 확인**

Run: `cd frontend && npx vitest run src/api/__tests__/client.test.ts`
Expected: PASS

**Step 6: 커밋**

```bash
git add frontend/src/api/client.ts frontend/src/api/__tests__/client.test.ts
git commit -m "feat: 글로벌 API 에러 toast interceptor 추가 (#85)"
```

---

### Task 2: InsightsPage 에러/빈 상태 + 스켈레톤

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`

**Step 1: error 상태 추가 + ErrorState/EmptyState import**

InsightsPage에 `error` state 추가하고, 데이터 fetch 실패 시 error 상태 세팅:

```typescript
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'

// 기존 state들 아래에 추가
const [error, setError] = useState(false)

// fetchAll 함수 내에서:
async function fetchAll() {
  setLoading(true)
  setError(false)
  // ... 기존 fetch 로직 ...
  try {
    // 기존 Promise.allSettled 로직
  } catch {
    setError(true)
  } finally {
    setLoading(false)
  }
}
```

**Step 2: 스켈레톤 UI 추가**

loading 상태일 때 스피너 대신 카드 스켈레톤 표시:

```tsx
{loading && (
  <div className="space-y-4">
    {/* 요약 카드 스켈레톤 */}
    <div className="grid grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[var(--surface-card)] rounded-2xl p-4 animate-pulse">
          <div className="h-3 w-16 bg-warm-200 rounded mb-3" />
          <div className="h-6 w-24 bg-warm-200 rounded" />
        </div>
      ))}
    </div>
    {/* 차트 스켈레톤 */}
    <div className="bg-[var(--surface-card)] rounded-2xl p-5 animate-pulse">
      <div className="h-4 w-32 bg-warm-200 rounded mb-4" />
      <div className="h-48 bg-warm-100 rounded-xl" />
    </div>
  </div>
)}
```

**Step 3: 에러/빈 상태 렌더링**

```tsx
{!loading && error && (
  <ErrorState onRetry={fetchAll} />
)}

{!loading && !error && !expenseStats?.total && !incomeStats?.total && (
  <EmptyState
    title="이번 달 거래 내역이 없습니다"
    description="가계부에 수입이나 지출을 기록하면 리포트가 생성됩니다"
  />
)}
```

**Step 4: 빌드 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 에러 없음

**Step 5: 커밋**

```bash
git add frontend/src/pages/InsightsPage.tsx
git commit -m "feat: InsightsPage 에러/빈 상태 + 스켈레톤 UI (#85)"
```

---

### Task 3: ExpenseDetail / IncomeDetail ErrorState 추가

**Files:**
- Modify: `frontend/src/pages/ExpenseDetail.tsx`
- Modify: `frontend/src/pages/IncomeDetail.tsx`

**Step 1: ExpenseDetail에 error 상태 추가**

현재 데이터 로드 실패 시 toast만 표시. error state 추가하고 ErrorState 렌더링:

```typescript
import ErrorState from '../components/ErrorState'

// 기존 state 아래에 추가
const [error, setError] = useState(false)

// fetchExpense catch 블록 수정
} catch {
  setError(true)
  // 글로벌 toast가 자동 표시하므로 수동 toast 제거
}

// 렌더링에 추가 (loading 체크 아래)
if (error) {
  return <ErrorState onRetry={() => { setError(false); /* re-fetch */ }} />
}
```

**Step 2: IncomeDetail에 동일 패턴 적용**

ExpenseDetail과 동일한 패턴으로 error state + ErrorState 추가.

**Step 3: 빌드 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 에러 없음

**Step 4: 커밋**

```bash
git add frontend/src/pages/ExpenseDetail.tsx frontend/src/pages/IncomeDetail.tsx
git commit -m "feat: ExpenseDetail/IncomeDetail 에러 상태 UI 추가 (#85)"
```

---

### Task 4: FeedbackPage ErrorState 추가

**Files:**
- Modify: `frontend/src/pages/FeedbackPage.tsx`

**Step 1: 현재 FeedbackPage 확인**

FeedbackPage는 관리자 전용. 403 에러를 조용히 무시하는 건 의도적이나, 데이터 로드 실패 시 에러 표시 필요.

```typescript
import ErrorState from '../components/ErrorState'

const [error, setError] = useState(false)

// fetch 실패 시
} catch (err) {
  if (err?.response?.status === 403) {
    // 관리자 아닌 사용자 — 기존대로 빈 상태
    return
  }
  setError(true)
}

// 렌더링
if (error) {
  return <ErrorState onRetry={loadFeedbacks} />
}
```

**Step 2: 빌드 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 에러 없음

**Step 3: 커밋**

```bash
git add frontend/src/pages/FeedbackPage.tsx
git commit -m "feat: FeedbackPage 에러 상태 UI 추가 (#85)"
```

---

### Task 5: 로딩 스피너 통일

**Files:**
- Create: `frontend/src/components/LoadingSpinner.tsx`
- Modify: 스피너 사용하는 페이지들

**Step 1: 공통 LoadingSpinner 컴포넌트 생성**

```tsx
// frontend/src/components/LoadingSpinner.tsx
interface LoadingSpinnerProps {
  className?: string
}

export default function LoadingSpinner({ className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center h-64 ${className}`}>
      <div className="animate-spin rounded-full border-b-2 border-grape-600 w-8 h-8" />
    </div>
  )
}
```

**Step 2: 기존 인라인 스피너를 LoadingSpinner로 교체**

각 페이지의 `if (loading)` 블록에서 인라인 스피너를 `<LoadingSpinner />`로 교체:

- `ExpenseDetail.tsx` — `w-8 h-8` 스피너
- `IncomeDetail.tsx` — `w-8 h-8` 스피너
- `RecurringList.tsx` — 확인 후 교체
- `CategoryManager.tsx` — 확인 후 교체
- `BudgetManager.tsx` — `h-8 w-8` 스피너
- `FeedbackPage.tsx` — 확인 후 교체

> InsightsPage는 Task 2에서 스켈레톤으로 교체했으므로 제외.

**Step 3: 빌드 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 에러 없음

**Step 4: 커밋**

```bash
git add frontend/src/components/LoadingSpinner.tsx frontend/src/pages/
git commit -m "refactor: 인라인 스피너를 공통 LoadingSpinner 컴포넌트로 통일 (#74)"
```

---

### Task 6: 전체 테스트 + 문서 업데이트

**Files:**
- Modify: `frontend/src/data/changelogs.ts`

**Step 1: 프론트엔드 전체 체크**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: 모두 PASS

**Step 2: changelog 추가**

`frontend/src/data/changelogs.ts` 맨 앞에 추가:

```typescript
{
  version: '0.x.0',
  date: '2026-03-18',
  title: 'UX 안정성 개선',
  items: [
    { tag: '개선', text: '에러 발생 시 자동으로 안내 메시지가 표시됩니다' },
    { tag: '개선', text: '리포트 페이지 로딩 시 스켈레톤 UI가 표시됩니다' },
    { tag: '개선', text: '모든 페이지에서 에러/빈 상태 안내가 일관되게 동작합니다' },
  ],
},
```

> 버전은 기존 최신 버전 확인 후 맞출 것.

**Step 3: 커밋**

```bash
git add frontend/src/data/changelogs.ts
git commit -m "docs: UX 정비 changelog 추가 (#74, #85)"
```

# Transaction Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ExpenseDetail/IncomeDetail을 TransactionDetail 공통 컴포넌트로 통합하고, 뷰/편집 이중 레이아웃 + 빠른 수정 칩으로 UX를 개선한다.

**Architecture:** type prop(`'expense' | 'income'`)으로 분기하는 TransactionDetail 컴포넌트가 뷰 모드(히어로 금액 + 칩 빠른 수정)와 편집 모드(폼 + sticky CTA)를 모두 담당. 기존 ExpenseDetail/IncomeDetail은 thin wrapper로 간소화.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4 (Grape 디자인 시스템), React Router v7 (`useSearchParams`), Axios, MSW (테스트), Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-10-transaction-detail-redesign.md`

---

## File Structure

| 파일 | 역할 | 변경 유형 |
|------|------|---------|
| `src/components/TransactionDetail.tsx` | 공통 상세/편집 컴포넌트 | 신규 |
| `src/components/__tests__/TransactionDetail.test.tsx` | 주 테스트 | 신규 |
| `src/pages/ExpenseDetail.tsx` | `<TransactionDetail type="expense" />` wrapper | 대폭 간소화 |
| `src/pages/IncomeDetail.tsx` | `<TransactionDetail type="income" />` wrapper | 대폭 간소화 |
| `src/pages/__tests__/ExpenseDetail.test.tsx` | wrapper 스모크 테스트 | 대폭 간소화 |
| `src/pages/__tests__/IncomeDetail.test.tsx` | wrapper 스모크 테스트 | 대폭 간소화 |
| `src/components/QuickInput.tsx` | editPath에 `?edit=true` 추가 | 1줄 수정 |
| `src/components/__tests__/ActionToast.test.tsx` | editPath fixture 업데이트 | 1줄 수정 |
| `src/mocks/handlers.ts` | TransactionDetail용 핸들러 확인/보강 | 필요 시 수정 |

> 모든 경로는 `frontend/` 기준. 실제 파일 경로는 `frontend/src/...`.

---

### Task 1: TransactionDetail — 뷰 모드 기본 렌더링

**Files:**
- Create: `src/components/TransactionDetail.tsx`
- Create: `src/components/__tests__/TransactionDetail.test.tsx`

이 태스크에서는 뷰 모드의 히어로 섹션(금액, 설명, 칩, 날짜)과 보조 정보(메모, 원본입력, 통계제외, 정기거래) 렌더링만 구현한다. 빠른 수정, 편집 모드, 삭제는 이후 태스크.

- [ ] **Step 1: 테스트 파일 생성 — 뷰 모드 렌더링 테스트**

`src/components/__tests__/TransactionDetail.test.tsx` 생성. MSW 핸들러(`GET /api/expenses/:id`, `GET /api/categories`, `GET /api/payment-methods`)가 이미 `handlers.ts`에 존재. 단, categories 핸들러에 `type` query param 필터링이 없으므로 Step 3에서 핸들러 보강 필요.

테스트 공통 mock 설정 (파일 상단):
```typescript
// useHouseholdStore mock — 결제수단 API가 householdId 필요
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: Function) => {
    const state = { activeHouseholdId: 1, households: [{ id: 1 }], isLoading: false }
    return selector ? selector(state) : state
  },
}))
```

테스트 케이스:
```typescript
describe('TransactionDetail — 뷰 모드', () => {
  it('지출 히어로 섹션을 렌더링한다 (금액, 설명, 카테고리 칩, 날짜)', async () => {
    // GET /api/expenses/1 → mockExpenses[0] (₩8,000 김치찌개)
    // 금액 text-4xl, 설명 text-lg, 카테고리 칩 (🍚 식비), 날짜 표시 확인
  })

  it('수입 금액에 + prefix와 leaf-600 색상을 적용한다', async () => {
    // type="income", GET /api/income/1 → mockIncomes[0] (+₩3,500,000)
  })

  it('결제수단 칩에 type 기반 아이콘을 표시한다', async () => {
    // mockExpenses는 payment_method_id=null이므로 server.use()로 override:
    // GET /api/expenses/1 → { ...mockExpenses[0], payment_method_id: 1 }
    // mockPaymentMethods[0] = 삼성카드 (type: credit_card) → 💳 아이콘 확인
  })

  it('페이지 제목을 표시한다 (지출 내역 / 수입 내역)', async () => {
    // h1 텍스트 확인
  })

  it('빈 필드를 숨긴다 (메모 없음, 결제수단 없음)', async () => {
    // memo=null인 expense → 메모 섹션 없음 확인
    // payment_method_id=null → 결제수단 칩 없음 확인
  })

  it('수입 타입은 결제수단 칩을 렌더링하지 않는다', async () => {
    // type="income" → 결제수단 칩 자체가 DOM에 없음 확인
  })

  it('정기거래 연결 시 뱃지를 표시하고 등록 버튼을 숨긴다', async () => {
    // recurring_transaction_id !== null → 🔁 뱃지 있음, + 등록 버튼 없음
  })

  it('정기거래 미연결 시 등록 버튼을 표시한다', async () => {
    // recurring_transaction_id === null → + 정기거래 등록 버튼 있음
  })

  it('exclude_from_stats=true이면 통계 제외 뱃지를 표시한다', async () => {})

  it('raw_input이 있으면 원본 입력을 표시한다', async () => {})
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `cd frontend && npm run test:run -- --reporter=verbose src/components/__tests__/TransactionDetail.test.tsx`
Expected: FAIL (TransactionDetail 모듈 없음)

- [ ] **Step 3: MSW 핸들러 보강 + TransactionDetail 컴포넌트 구현**

**MSW fixtures 보강** (`src/mocks/fixtures.ts`):
- `mockCategories`에 `type: 'income'` 카테고리 추가 (income 테스트에 필요). `mockIncomeCategoriesAll`에 이미 id: 4, 5가 사용되므로 id: 6 사용:
```typescript
{
  id: 6,
  name: '용돈',
  type: 'income',
  description: '기타 수입',
  emoji: '💰',
  sort_order: 6,
  is_savings: false,
  is_system: false,
  exclude_auto_payment: false,
  created_at: '2024-01-01T00:00:00Z',
},
```

**MSW 핸들러 보강** (`src/mocks/handlers.ts`):
- `GET /api/categories` 핸들러에 `type` query param 필터링 추가:
```typescript
http.get(`${BASE_URL}/categories`, ({ request }) => {
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const filtered = type
    ? mockCategories.filter((c) => c.type === type || c.type === 'both')
    : mockCategories
  return HttpResponse.json(filtered)
})
```

**TransactionDetail 컴포넌트** (`src/components/TransactionDetail.tsx`) 생성.

주요 구현 요소:
```typescript
// TYPE_CONFIG
const TYPE_CONFIG = {
  expense: {
    color: 'grape',
    amountPrefix: '',
    amountColor: 'text-[var(--text-primary)]',
    listRoute: '/expenses',
    pageTitle: '지출 내역',
    categoryApiType: 'expense' as const,
    hasPaymentMethod: true,
  },
  income: {
    color: 'leaf',
    amountPrefix: '+',
    amountColor: 'text-leaf-600',
    listRoute: '/income',
    pageTitle: '수입 내역',
    categoryApiType: 'income' as const,
    hasPaymentMethod: false,
  },
} as const

// 상태
type DetailMode = 'view' | 'edit'
type QuickEditField = 'category' | 'payment_method' | null
type PageErrorState = 'none' | 'error' | 'notFound'

// householdId (결제수단 조회에 필요)
const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

// ?edit=true lazy initializer
const [searchParams] = useSearchParams()
const [mode, setMode] = useState<DetailMode>(() =>
  searchParams.get('edit') === 'true' ? 'edit' : 'view'
)

// PaymentMethod.type → 아이콘 매핑
const PM_ICON: Record<string, string> = {
  credit_card: '💳', debit_card: '💳', cash: '💵', transfer: '🏦',
}

// isMountedRef
const isMountedRef = useRef(true)
useEffect(() => () => { isMountedRef.current = false }, [])
```

데이터 fetch:
- `paymentMethodApi.getAll(hhId)` — `hhId = transaction.household_id ?? activeHouseholdId!` (expense만)
- `categoryApi.getAll({ type: cfg.categoryApiType })` — type 필터링 적용

뷰 모드 렌더링:
- 히어로 섹션: 금액(`text-4xl font-bold`), 설명(`text-lg font-medium`)
- 칩 행: 카테고리 칩(emoji + name + ▾), 결제수단 칩(PM_ICON + name + ▾)
- 칩 아래 8px 스페이서 + 날짜(`text-xs text-muted`)
- 보조 정보: 메모, raw_input, exclude_from_stats 뱃지, 정기거래 뱃지/등록 버튼
- 메타 정보: 생성일 · 수정일
- 하단: 수정 버튼(full-width, solid) + 삭제하기(text-sm, text-rose-500, py-4)

로딩/에러:
- `loading` → `<Skeleton>` (기존 패턴)
- `errorState === 'error'` → `<ErrorState onRetry={fetchData} />`
- `errorState === 'notFound'` → "내역을 찾을 수 없습니다" + 목록 링크
- 404 분리: `catch(err)` 에서 `err.response?.status === 404` 분기

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `cd frontend && npm run test:run -- --reporter=verbose src/components/__tests__/TransactionDetail.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/TransactionDetail.tsx frontend/src/components/__tests__/TransactionDetail.test.tsx
git commit -m "feat: TransactionDetail 뷰 모드 기본 렌더링 구현"
```

---

### Task 2: TransactionDetail — 칩 빠른 수정 (카테고리 + 결제수단)

**Files:**
- Modify: `src/components/TransactionDetail.tsx`
- Modify: `src/components/__tests__/TransactionDetail.test.tsx`

- [ ] **Step 1: 빠른 수정 테스트 추가**

```typescript
describe('TransactionDetail — 빠른 수정', () => {
  it('카테고리 칩 클릭 시 드롭다운이 열린다', async () => {
    // 칩 행이 <select>로 교체됨 확인
  })

  it('카테고리 선택 시 API PUT이 호출되고 칩이 복귀한다', async () => {
    // select에서 다른 카테고리 선택 → PUT /api/expenses/1 호출 확인
    // 칩으로 복귀 + 새 카테고리명 표시
  })

  it('카테고리 빠른 수정 저장 중 select가 disabled된다', async () => {})

  it('카테고리 빠른 수정 실패 시 원래 값으로 복귀한다', async () => {
    // server.use(http.put(..., () => HttpResponse.error()))
    // 원래 카테고리 칩으로 복귀 + error toast
  })

  it('빠른 수정 중 다른 칩이 opacity-50으로 비활성화된다', async () => {})

  it('isSaving 중에는 칩 탭이 무시된다', async () => {
    // 느린 PUT 설정 → 카테고리 칩 탭 → 저장 중 결제수단 칩 탭 → 무시됨 확인
  })

  it('빠른 수정 열린 상태에서 수정 버튼 클릭 시 편집 모드로 전환한다', async () => {
    // quickEditField가 닫히고 mode='edit', 미저장 빠른 수정은 PUT 호출 없이 폐기
  })

  it('결제수단 칩 클릭 시 드롭다운이 열린다', async () => {})

  it('결제수단 선택 시 API PUT이 호출된다', async () => {})

  it('403 에러 시 권한 없음 toast를 표시한다', async () => {
    // server.use(http.put(..., () => new HttpResponse(null, { status: 403 })))
    // TOAST.NO_PERMISSION 표시 확인
  })
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `cd frontend && npm run test:run -- --reporter=verbose src/components/__tests__/TransactionDetail.test.tsx`
Expected: FAIL (빠른 수정 관련 요소/동작 없음)

- [ ] **Step 3: 빠른 수정 로직 구현**

`TransactionDetail.tsx`에 추가:

```typescript
// quickEditField 상태
const [quickEditField, setQuickEditField] = useState<QuickEditField>(null)
const [isSaving, setIsSaving] = useState(false)

// 칩 탭 핸들러
const handleChipTap = (field: QuickEditField) => {
  if (quickEditField !== null || isSaving) return  // 동시 탭 방지
  setQuickEditField(field)
}

// 빠른 수정 저장 핸들러
const handleQuickSave = async (field: 'category_id' | 'payment_method_id', value: number | null) => {
  if (!transaction) return
  const originalValue = transaction[field]
  setIsSaving(true)
  try {
    const res = await api.update(transaction.id, { [field]: value })
    if (!isMountedRef.current) return
    setTransaction(res.data)
    setQuickEditField(null)
    // 성공 피드백은 칩 color flash + aria-live announcement (toast 없음)
  } catch {
    if (!isMountedRef.current) return
    // 원래 값 복귀 (낙관적 업데이트 없으므로 transaction 그대로)
    addToast('error', TOAST.SAVE_FAILED)
  } finally {
    if (isMountedRef.current) setIsSaving(false)
  }
}
```

칩 렌더링:
- `quickEditField === null` → 칩 표시 (탭 가능)
- `quickEditField === 'category'` → 카테고리 `<select>` + 결제수단 칩 `opacity-50`
- `quickEditField === 'payment_method'` → 결제수단 `<select>` + 카테고리 칩 `opacity-50`
- select `disabled={isSaving}` 처리
- `onChange` → `handleQuickSave` 호출

aria-live 영역:
```tsx
<div aria-live="polite" className="sr-only">
  {quickEditAnnouncement}
</div>
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `cd frontend && npm run test:run -- --reporter=verbose src/components/__tests__/TransactionDetail.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/TransactionDetail.tsx frontend/src/components/__tests__/TransactionDetail.test.tsx
git commit -m "feat: 카테고리/결제수단 칩 빠른 수정 구현"
```

---

### Task 3: TransactionDetail — 편집 모드

**Files:**
- Modify: `src/components/TransactionDetail.tsx`
- Modify: `src/components/__tests__/TransactionDetail.test.tsx`

- [ ] **Step 1: 편집 모드 테스트 추가**

```typescript
describe('TransactionDetail — 편집 모드', () => {
  it('수정 버튼 클릭 시 편집 모드로 전환한다', async () => {
    // 카드 배경 grape-50, 테두리 grape-300, 폼 필드 렌더링
  })

  it('?edit=true URL로 초기 렌더링부터 편집 모드이다', async () => {
    // MemoryRouter initialEntries={['/expenses/1?edit=true']}
  })

  it('저장 성공 시 뷰 모드로 복귀하고 데이터가 반영된다', async () => {
    // PUT /api/expenses/1 → updated data → 뷰 모드 + 새 값 표시
  })

  it('저장 실패 시 편집 모드를 유지하고 error toast를 표시한다', async () => {
    // server.use(http.put(..., () => HttpResponse.error()))
  })

  it('편집 모드에서 삭제 버튼과 정기거래 섹션이 숨겨진다', async () => {})

  it('편집 모드 재진입 시 editForm이 최신 transaction으로 초기화된다', async () => {
    // 빠른 수정으로 카테고리 변경 후 → 수정 버튼 클릭 → editForm에 새 카테고리 반영
  })
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

- [ ] **Step 3: 편집 모드 구현**

주요 구현:
```typescript
// editForm 상태
const [editForm, setEditForm] = useState({ ... })

// toEditForm 헬퍼 — transaction → editForm 변환
const toEditForm = (t: Expense | Income) => ({
  amount: t.amount,
  description: t.description,
  category_id: t.category_id,
  payment_method_id: 'payment_method_id' in t ? t.payment_method_id : null,
  date: t.date.slice(0, 10),
  memo: t.memo ?? '',
  exclude_from_stats: t.exclude_from_stats ?? false,
})

// enterEditMode — 항상 재초기화
const enterEditMode = () => {
  if (!transaction) return
  setQuickEditField(null)
  setEditForm(toEditForm(transaction))
  setMode('edit')
}

// handleSave
const handleSave = async () => { ... }
// 성공 시: setTransaction(res.data) + setEditForm(toEditForm(res.data)) + setMode('view')
```

편집 모드 레이아웃:
- 카드: `bg-grape-50 border-grape-300` / `bg-leaf-50 border-leaf-300` (transition-colors 200ms)
- 폼 필드: 금액, 설명, 카테고리 `<select>`, 결제수단 `<select>` (expense only), 날짜, 메모, 통계제외 토글
- 카테고리: `categoryApi.getAll({ type })` 사용 (TYPE_CONFIG의 `categoryApiType`)
- 하단 sticky CTA: "목록으로" + "저장" (`position: sticky; bottom: 0`)

- [ ] **Step 4: 테스트 실행하여 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/TransactionDetail.tsx frontend/src/components/__tests__/TransactionDetail.test.tsx
git commit -m "feat: TransactionDetail 편집 모드 구현"
```

---

### Task 4: TransactionDetail — Dirty Form Guard + "목록으로" 네비게이션

**Files:**
- Modify: `src/components/TransactionDetail.tsx`
- Modify: `src/components/__tests__/TransactionDetail.test.tsx`

- [ ] **Step 1: dirty form guard 테스트 추가**

```typescript
describe('TransactionDetail — dirty form guard', () => {
  it('변경 없이 "목록으로" 탭 시 바로 navigate한다', async () => {
    // 수정 모드 진입 → 아무 것도 안 바꿈 → 목록으로 → navigate('/expenses')
  })

  it('변경 후 "목록으로" 탭 시 확인 다이얼로그를 표시한다', async () => {
    // 금액 수정 → 목록으로 → "변경사항이 저장되지 않았습니다" 다이얼로그
  })

  it('다이얼로그에서 "머무르기" 클릭 시 편집 모드를 유지한다', async () => {})

  it('다이얼로그에서 "이동하기" 클릭 시 목록으로 navigate한다', async () => {})
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

- [ ] **Step 3: dirty form guard 구현**

```typescript
const [showDirtyDialog, setShowDirtyDialog] = useState(false)

const isDirty = () =>
  JSON.stringify(editForm) !== JSON.stringify(toEditForm(transaction!))

const handleNavigateAway = () => {
  if (isDirty()) {
    setShowDirtyDialog(true)
  } else {
    navigate(cfg.listRoute)
  }
}
```

다이얼로그 UI:
```tsx
{showDirtyDialog && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
       role="dialog" aria-modal="true" aria-labelledby="dirty-dialog-title">
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-xl max-w-sm w-full p-6">
      <h3 id="dirty-dialog-title" className="text-lg font-semibold ...">저장하지 않고 이동</h3>
      <p className="...">변경사항이 저장되지 않았습니다. 이동하시겠습니까?</p>
      <div className="flex gap-3 justify-end">
        <button onClick={() => setShowDirtyDialog(false)} ...>머무르기</button>
        <button onClick={() => navigate(cfg.listRoute)} ...>이동하기</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/TransactionDetail.tsx frontend/src/components/__tests__/TransactionDetail.test.tsx
git commit -m "feat: 편집 모드 dirty form guard 구현"
```

---

### Task 5: TransactionDetail — 삭제 + 정기거래 등록

**Files:**
- Modify: `src/components/TransactionDetail.tsx`
- Modify: `src/components/__tests__/TransactionDetail.test.tsx`

- [ ] **Step 1: 삭제 + 정기거래 테스트 추가**

```typescript
describe('TransactionDetail — 삭제', () => {
  it('삭제하기 텍스트 버튼이 뷰 모드에 항상 표시된다', async () => {})

  it('삭제하기 클릭 시 확인 모달이 열린다', async () => {})

  it('확인 후 DELETE 호출하고 목록으로 navigate한다', async () => {})

  it('삭제 403 에러 시 권한 없음 toast를 표시한다', async () => {
    // server.use(http.delete(..., () => new HttpResponse(null, { status: 403 })))
    // TOAST.NO_PERMISSION 표시 확인
  })
})

describe('TransactionDetail — 정기거래 등록', () => {
  it('미연결 시 등록 버튼 클릭으로 RegisterRecurringModal이 열린다', async () => {})

  it('모달 성공 후 데이터가 새로고침된다', async () => {})
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

- [ ] **Step 3: 삭제 + 정기거래 구현**

삭제:
```typescript
const handleDelete = async () => {
  if (!transaction) return
  try {
    await api.delete(transaction.id)
    addToast('success', TOAST.DELETED)
    navigate(cfg.listRoute)
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    addToast('error', status === 403 ? TOAST.NO_PERMISSION : TOAST.DELETE_FAILED)
  }
}
```

삭제 버튼 (카드 바깥):
```tsx
<button
  onClick={() => setShowDeleteModal(true)}
  className="text-sm text-rose-500 py-4 w-full text-center"
>
  삭제하기
</button>
```

정기거래: 기존 `RegisterRecurringModal` 재사용. props는 현재 ExpenseDetail과 동일.

- [ ] **Step 4: 테스트 실행하여 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/TransactionDetail.tsx frontend/src/components/__tests__/TransactionDetail.test.tsx
git commit -m "feat: 삭제 + 정기거래 등록 구현"
```

---

### Task 6: TransactionDetail — 에러/로딩 상태 + 접근성 + 애니메이션

**Files:**
- Modify: `src/components/TransactionDetail.tsx`
- Modify: `src/components/__tests__/TransactionDetail.test.tsx`

- [ ] **Step 1: 에러/로딩 + a11y 테스트 추가**

```typescript
describe('TransactionDetail — 에러/로딩', () => {
  it('로딩 중 Skeleton을 렌더링한다', async () => {})

  it('네트워크 에러 시 ErrorState를 렌더링한다', async () => {
    // server.use(http.get(..., () => HttpResponse.error()))
  })

  it('404 시 "찾을 수 없습니다" 메시지를 표시한다', async () => {
    // server.use(http.get(..., () => new HttpResponse(null, { status: 404 })))
  })

  it('403 시 권한 없음 toast를 표시하고 목록으로 이동한다', async () => {
    // server.use(http.get(..., () => new HttpResponse(null, { status: 403 })))
    // TOAST.NO_PERMISSION toast + navigate(cfg.listRoute) 확인
  })
})

describe('TransactionDetail — 접근성', () => {
  it('aria-live 영역이 빠른 수정 결과를 announce한다', async () => {
    // 칩 변경 후 aria-live 영역 텍스트 확인
  })

  it('모드 전환 시 aria-live로 announce한다', async () => {})
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

- [ ] **Step 3: 구현**

에러 상태:
```typescript
const [errorState, setErrorState] = useState<PageErrorState>('none')

// fetchData 에서 분기
catch (err: unknown) {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 403) {
    addToast('error', TOAST.NO_PERMISSION)
    navigate(cfg.listRoute)
  } else if (status === 404) {
    setErrorState('notFound')
  } else {
    setErrorState('error')
  }
}
```

접근성:
```tsx
<div aria-live="polite" className="sr-only" data-testid="live-region">
  {announcement}
</div>
```

애니메이션:
- 페이지 진입: `animate-page-in` (기존 클래스)
- 칩 color flash: `transition-colors duration-400` + state toggle
- 편집 모드 전환: 카드에 `transition-colors duration-200`
- `prefers-reduced-motion`: `motion-safe:` prefix 사용

- [ ] **Step 4: 테스트 실행하여 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/TransactionDetail.tsx frontend/src/components/__tests__/TransactionDetail.test.tsx
git commit -m "feat: 에러/로딩 상태 + 접근성 + 애니메이션 구현"
```

---

### Task 7: Page Wrappers 간소화 + QuickInput ?edit=true

**Files:**
- Modify: `src/pages/ExpenseDetail.tsx`
- Modify: `src/pages/IncomeDetail.tsx`
- Modify: `src/pages/__tests__/ExpenseDetail.test.tsx`
- Modify: `src/pages/__tests__/IncomeDetail.test.tsx`
- Modify: `src/components/QuickInput.tsx`
- Modify: `src/components/__tests__/ActionToast.test.tsx`

- [ ] **Step 1: wrapper 스모크 테스트 작성**

`src/pages/__tests__/ExpenseDetail.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ExpenseDetail from '../ExpenseDetail'

// 기존 mock 설정 유지 (zustand, toast, auth)

it('TransactionDetail을 type="expense"로 렌더링한다', async () => {
  render(
    <MemoryRouter initialEntries={['/expenses/1']}>
      <Routes>
        <Route path="/expenses/:id" element={<ExpenseDetail />} />
      </Routes>
    </MemoryRouter>
  )
  expect(await screen.findByText('지출 내역')).toBeInTheDocument()
})
```

`src/pages/__tests__/IncomeDetail.test.tsx` 동일 패턴 (type="income", "수입 내역").

- [ ] **Step 2: Page wrapper 간소화**

`src/pages/ExpenseDetail.tsx`:
```typescript
import TransactionDetail from '../components/TransactionDetail'

export default function ExpenseDetail() {
  return <TransactionDetail type="expense" />
}
```

`src/pages/IncomeDetail.tsx`:
```typescript
import TransactionDetail from '../components/TransactionDetail'

export default function IncomeDetail() {
  return <TransactionDetail type="income" />
}
```

- [ ] **Step 3: QuickInput editPath 수정**

`src/components/QuickInput.tsx` ~line 122:
```typescript
// Before:
const editPath = totalItems.length > 1
  ? '/home'
  : isExpense ? `/expenses/${firstItem.id}` : `/income/${firstItem.id}`

// After:
const editPath = totalItems.length > 1
  ? '/home'
  : isExpense ? `/expenses/${firstItem.id}?edit=true` : `/income/${firstItem.id}?edit=true`
```

- [ ] **Step 4: ActionToast.test.tsx fixture 수정**

`src/components/__tests__/ActionToast.test.tsx` ~line 21:
```typescript
// Before:
editPath: '/expenses/10',
// After:
editPath: '/expenses/10?edit=true',
```

- [ ] **Step 5: 전체 테스트 실행**

Run: `cd frontend && npm run test:run -- --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/pages/ExpenseDetail.tsx frontend/src/pages/IncomeDetail.tsx \
  frontend/src/pages/__tests__/ExpenseDetail.test.tsx frontend/src/pages/__tests__/IncomeDetail.test.tsx \
  frontend/src/components/QuickInput.tsx frontend/src/components/__tests__/ActionToast.test.tsx
git commit -m "refactor: ExpenseDetail/IncomeDetail wrapper 간소화 + ?edit=true 링크"
```

---

### Task 8: 최종 검증 + 린트 + 빌드

**Files:** 전체

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd frontend && npm run test:run
```
Expected: ALL PASS

- [ ] **Step 2: 린트 확인**

```bash
cd frontend && npm run lint
```
Expected: 에러 없음

- [ ] **Step 3: 프로덕션 빌드 확인**

```bash
cd frontend && npm run build
```
Expected: 빌드 성공

- [ ] **Step 4: 구 코드 정리**

기존 `ExpenseDetail.tsx`와 `IncomeDetail.tsx`에서 삭제된 import/코드가 다른 곳에서 참조되지 않는지 확인. 불필요한 import 정리.

- [ ] **Step 5: 커밋**

```bash
# 정리 대상 파일만 명시적으로 추가
git add frontend/src/components/TransactionDetail.tsx \
  frontend/src/components/__tests__/TransactionDetail.test.tsx \
  frontend/src/pages/ExpenseDetail.tsx frontend/src/pages/IncomeDetail.tsx \
  frontend/src/pages/__tests__/ExpenseDetail.test.tsx frontend/src/pages/__tests__/IncomeDetail.test.tsx
git commit -m "chore: 린트/빌드 정리"
```

---

## Task 순서 의존성

```
Task 1 (뷰 모드) → Task 2 (빠른 수정) → Task 3 (편집 모드) → Task 4 (dirty guard)
                                      ↘ Task 5 (삭제/정기거래)
                                      ↘ Task 6 (에러/a11y)
Task 1~6 완료 → Task 7 (wrapper + QuickInput) → Task 8 (최종 검증)
```

- Task 3은 Task 2 이후 (편집 모드는 칩 quick edit 위에 구축)
- Task 4는 Task 3 이후 (dirty guard는 편집 모드 필요)
- Task 5, 6은 Task 2 이후 어느 순서든 가능하나, 같은 파일을 수정하므로 순차 실행 (병렬 불가)
- Task 7은 Task 1~6 완료 후

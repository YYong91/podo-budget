# 거래 내역 검색 프론트엔드 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** TransactionList에 검색 모드를 추가하여 전체 기간 텍스트 검색 + 필터 + 결과 합계를 제공한다.

**Architecture:** 기존 TransactionList 컴포넌트에 검색 모드 상태를 추가. 검색 모드 진입 시 월 뷰를 숨기고 검색 UI로 전환. URL 파라미터로 검색 상태 영속. 검색 결과는 기존 TransactionItem 재활용.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (Grape design), React Router v7 (useSearchParams)

**Sub-issues:** #319 (검색 모드 기본), #320 (필터 칩), #321 (빈 화면 UX), #322 (무한 스크롤), #323 (카테고리 뱃지)

**Design doc:** `docs/plans/2026-03-23-transaction-search-design.md`

---

### Task 1: 검색 모드 진입 UI — 돋보기 아이콘 + 검색바

**Files:**
- Modify: `frontend/src/pages/TransactionList.tsx`

**Step 1: 검색 상태 + URL 파라미터 추가**

TransactionList 컴포넌트에:
```typescript
// URL에서 search 파라미터 읽기
const searchQuery = searchParams.get('search') || ''
const isSearchMode = searchParams.has('search')
```

검색 모드 진입/해제:
```typescript
const enterSearchMode = useCallback(() => {
  setParams({ search: '' })
}, [setParams])

const exitSearchMode = useCallback(() => {
  setParams({ search: null, type: null, category: null, period: null, member: null })
}, [setParams])

const submitSearch = useCallback((value: string) => {
  setParams({ search: value })
}, [setParams])
```

**Step 2: 돋보기 아이콘 — PeriodNavigator 옆에 배치**

PeriodNavigator 영역에 돋보기 아이콘 추가:
```tsx
<div className="flex items-center gap-2">
  <PeriodNavigator label={monthLabel} onPrev={...} onNext={...} />
  <button onClick={enterSearchMode} className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors" aria-label="검색">
    <Search className="w-5 h-5 text-[var(--text-secondary)]" />
  </button>
</div>
```

Import `Search` from `lucide-react`.

**Step 3: 검색바 UI (검색 모드 시)**

`isSearchMode`일 때 PeriodNavigator 대신 검색바 표시:
```tsx
{isSearchMode ? (
  <div className="flex items-center gap-2">
    <div className="flex-1 relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      <input
        ref={searchInputRef}
        type="text"
        defaultValue={searchQuery}
        placeholder="거래 내역 검색"
        onKeyDown={(e) => {
          if (e.key === 'Enter') submitSearch(e.currentTarget.value)
        }}
        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300"
        autoFocus
      />
    </div>
    <button onClick={exitSearchMode} className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors" aria-label="검색 닫기">
      <X className="w-5 h-5 text-[var(--text-secondary)]" />
    </button>
  </div>
) : (
  <div className="flex items-center gap-2">
    <div className="flex-1">
      <PeriodNavigator ... />
    </div>
    <button onClick={enterSearchMode} ...>
      <Search ... />
    </button>
  </div>
)}
```

Import `X` from `lucide-react`. Add `searchInputRef = useRef<HTMLInputElement>(null)`.

**Step 4: 검색 모드에서 월 뷰 숨기기**

`isSearchMode`일 때:
- 요약(지출/수입 합계) 숨기기
- PendingRecurring 숨기기
- MiniCalendar 숨기기
- 대신 검색 결과 표시

**Step 5: 커밋**

```bash
git commit -m "feat: 검색 모드 진입 UI — 돋보기 + 검색바 (#319)"
```

---

### Task 2: 검색 결과 데이터 로딩 + 표시

**Files:**
- Modify: `frontend/src/pages/TransactionList.tsx`

**Step 1: 검색 데이터 fetch 함수**

```typescript
const [searchResults, setSearchResults] = useState<UnifiedTransaction[]>([])
const [searchSummary, setSearchSummary] = useState<{ total_count: number; total_amount: number } | null>(null)
const [searchLoading, setSearchLoading] = useState(false)

const fetchSearchResults = useCallback(async () => {
  if (!activeHouseholdId || !searchQuery) return
  setSearchLoading(true)
  try {
    const params = { query: searchQuery, limit: 30, household_id: activeHouseholdId }
    const [expRes, incRes, summaryExpRes, summaryIncRes] = await Promise.all([
      expenseApi.getAll(params),
      incomeApi.getAll(params),
      expenseApi.searchSummary(params),
      incomeApi.searchSummary(params),
    ])

    const all: UnifiedTransaction[] = [
      ...expRes.data.map(e => ({ ...e, type: 'expense' as const })),
      ...incRes.data.map(i => ({ ...i, type: 'income' as const })),
    ]
    all.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    setSearchResults(all)
    setSearchSummary({
      total_count: summaryExpRes.data.total_count + summaryIncRes.data.total_count,
      total_amount: summaryExpRes.data.total_amount + summaryIncRes.data.total_amount,
    })
  } catch {
    addToast('error', '검색에 실패했습니다')
  } finally {
    setSearchLoading(false)
  }
}, [searchQuery, activeHouseholdId])

useEffect(() => {
  if (isSearchMode && searchQuery) fetchSearchResults()
}, [isSearchMode, searchQuery, fetchSearchResults])
```

**Step 2: 검색 결과 그룹핑**

```typescript
const searchGrouped = useMemo(() => {
  const grouped = new Map<string, UnifiedTransaction[]>()
  for (const tx of searchResults) {
    const dateKey = tx.date.slice(0, 10)
    const group = grouped.get(dateKey)
    if (group) group.push(tx)
    else grouped.set(dateKey, [tx])
  }
  return grouped
}, [searchResults])
```

**Step 3: 검색 결과 렌더링**

검색 모드일 때의 렌더링 블록:
- 상단 합계: `"검색어" · N건 · 총 xxx원`
- 날짜별 그룹 + TransactionItem (기존 컴포넌트 재활용)
- 빈 결과: "검색 결과가 없습니다" 메시지

**Step 4: 커밋**

```bash
git commit -m "feat: 검색 결과 데이터 로딩 + 표시 (#319)"
```

---

### Task 3: URL 상태 반영 완성 + 검색 해제 동작

**Files:**
- Modify: `frontend/src/pages/TransactionList.tsx`

**Step 1: URL 파라미터 체계 정리**

검색 모드 URL: `?search=병원&type=expense&category=3&period=3m&member=2`
월 뷰 URL: `?month=2026-03&filter=expense` (기존)

검색 해제 시 search 관련 파라미터 모두 제거, 기존 월 뷰로 복귀.

**Step 2: 브라우저 뒤로가기 지원**

검색 모드 → 뒤로가기 → 월 뷰. useSearchParams 기반이므로 자동 동작 확인.

**Step 3: 새로고침 시 검색 상태 복원**

URL에 `?search=병원`이 있으면 자동으로 검색 모드 + 검색 실행. 이미 `isSearchMode`와 `fetchSearchResults`가 URL 기반이므로 동작 확인.

**Step 4: 커밋**

```bash
git commit -m "feat: 검색 URL 상태 반영 + 뒤로가기 지원 (#319)"
```

---

### Task 4: FE 테스트 + lint + build

**Files:**
- Modify: `frontend/src/mocks/handlers.ts` (필요 시)
- Test: `frontend/src/pages/__tests__/TransactionList.test.tsx` (있다면)

**Step 1: 기존 테스트 통과 확인**

```bash
cd frontend && npm run lint && npm run test:run && npm run build
```

깨지는 테스트가 있으면 수정.

**Step 2: 커밋**

```bash
git commit -m "test: TransactionList 검색 모드 테스트 수정 (#319)"
```

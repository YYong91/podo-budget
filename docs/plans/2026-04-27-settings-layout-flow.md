# 더보기 서브페이지 레이아웃/플로우 통일 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 카테고리·예산관리·결제수단·정기거래 4개 페이지의 헤더 구조, 탭 컬러, CRUD 인터랙션 패턴, 삭제 확인 UI를 HIG 기반으로 통일한다.

**Architecture:** 변경을 위험도 순으로 3 PR로 분리한다. PR1(헤더/탭 — 순수 스타일), PR2(삭제 플로우 — 로직 변경), PR3(행 액션 + 목록 구조 — DOM 구조 변경). RecurringList는 이미 기준 패턴에 부합하므로 변경 없음.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4

---

## 배경: 4페이지 현황 vs 통일 목표

| | 카테고리 | 예산관리 | 결제수단 | 정기거래 |
|---|---|---|---|---|
| **헤더 아이콘** | ✅ Tags | ❌ 없음 (에러 상태엔 있음) | ✅ CreditCard | ✅ Repeat |
| **탭 컬러** | 지출=grape, 수입=leaf (동적) | 없음 | 없음 | grape 고정 |
| **행 액션** | 텍스트 버튼 (수정·삭제 항상 노출) | 인라인 인풋 (유지) | 편집모드 토글 (유지) | ⋮ 메뉴 (유지) |
| **삭제 확인** | 전체화면 모달 | N/A | **확인 없음** | 인라인 행 ✅ |
| **목록 구조** | 단일 카드+행 ✅ | 단일 카드+행 ✅ | 개별 카드 분리 | 단일 카드+행 ✅ |

---

## 워크트리 준비

```bash
# 메인 레포에서 실행
git worktree add -b fix/settings-layout-flow \
  /Users/yyong/Developer/podo-budget/.worktrees/settings-layout-flow \
  develop

cd /Users/yyong/Developer/podo-budget/.worktrees/settings-layout-flow
npm install --prefix frontend
```

---

## PR1: 헤더 + 탭 컬러 (순수 스타일, 위험도 낮음)

### Task 1: BudgetManager 헤더에 PiggyBank 아이콘 추가

**Files:**
- Modify: `frontend/src/pages/BudgetManager.tsx:355-359`

에러 상태 헤더(L337-342)에는 이미 PiggyBank가 있고, 정상 상태 헤더(L355-359)에만 없다.

**Step 1: 변경 적용**

```tsx
// Before (L355-359):
<div className="flex items-center gap-3">
  <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
    <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
  </button>
  <h1 className="text-lg font-semibold text-[var(--text-primary)]">예산 관리</h1>
</div>

// After:
<div className="flex items-center gap-3">
  <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
    <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
  </button>
  <PiggyBank className="w-5 h-5 text-grape-500 flex-shrink-0" />
  <h1 className="text-lg font-semibold text-[var(--text-primary)]">예산 관리</h1>
</div>
```

`PiggyBank`는 이미 L17에서 import되어 있음.

**Step 2: lint 확인**

```bash
cd frontend && npm run lint 2>&1 | grep BudgetManager
```

Expected: 에러 없음

**Step 3: 커밋**

```bash
git add frontend/src/pages/BudgetManager.tsx
git commit -m "fix: BudgetManager 정상 상태 헤더에 PiggyBank 아이콘 추가"
```

---

### Task 2: CategoryManager 수입 탭 컬러 grape로 통일

**Files:**
- Modify: `frontend/src/pages/CategoryManager.tsx:292-301`

지출 탭은 `bg-grape-500/20 text-grape-600`, 수입 탭은 `bg-leaf-500/20 text-leaf-600` 으로 달라서 탭을 전환할 때마다 색이 바뀐다. HIG 원칙상 같은 레벨의 탭 컨트롤은 동일한 선택 색상을 써야 한다.

```tsx
// Before (L292-301):
<button
  onClick={() => setActiveTab('income')}
  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
    activeTab === 'income'
      ? 'bg-leaf-500/20 text-leaf-600'
      : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
  }`}
>
  💵 수입 카테고리
</button>

// After:
<button
  onClick={() => setActiveTab('income')}
  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
    activeTab === 'income'
      ? 'bg-grape-500/20 text-grape-600'
      : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
  }`}
>
  💵 수입 카테고리
</button>
```

**Step 1: 변경 후 lint**

```bash
cd frontend && npm run lint 2>&1 | grep CategoryManager
```

**Step 2: 커밋**

```bash
git add frontend/src/pages/CategoryManager.tsx
git commit -m "fix: CategoryManager 수입 탭 컬러 leaf → grape (탭 통일)"
```

---

### Task 3: PR1 빌드 확인 + PR 생성

**Step 1: 전체 빌드**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` 메시지

**Step 2: PR 생성**

```bash
git push -u origin fix/settings-layout-flow
gh pr create \
  --base develop \
  --title "fix: 더보기 서브페이지 헤더/탭 컬러 통일" \
  --body "$(cat <<'EOF'
## Summary
- BudgetManager 정상 상태 헤더에 PiggyBank 아이콘 추가 (에러 상태와 일치)
- CategoryManager 수입 탭 선택 컬러 leaf → grape (4페이지 탭 컬러 통일)

## Test plan
- [ ] BudgetManager 헤더에 아이콘이 표시되는지 확인
- [ ] CategoryManager 지출/수입 탭 전환 시 선택 컬러가 동일한지 확인
- [ ] 다크모드에서 탭 선택 상태 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR2: 삭제 확인 플로우 통일 (로직 변경)

RecurringList의 인라인 행 확인 패턴을 기준으로 통일한다. 모달 제거, `window.confirm()` 없음.

### Task 4: CategoryManager 삭제 모달 → 인라인 행 확인

**Files:**
- Modify: `frontend/src/pages/CategoryManager.tsx:95-96, 190-199, 478-491, 501-530`
- Test: `frontend/src/pages/__tests__/CategoryManager.test.tsx`

**Step 1: handleDelete 에러 분기에 setDeleteTarget(null) 추가**

현재 에러 catch 블록에 `setDeleteTarget(null)` 가 없어서, 삭제 API 실패 시 인라인 확인 행이 계속 노출된다. 에러 시에도 닫혀야 한다:

```tsx
// L190-199 — catch 블록에 setDeleteTarget(null) 추가:
const handleDelete = async (id: number) => {
  try {
    await categoryApi.delete(id)
    addToast('success', TOAST.CATEGORY_DELETED)
    setDeleteTarget(null)
    fetchCategories()
  } catch {
    addToast('error', TOAST.DELETE_FAILED)
    setDeleteTarget(null)  // ← 추가: 에러 시에도 확인 행 닫기
  }
}
```

**Step 2: 삭제 버튼 onClick 업데이트 — editingId도 함께 초기화**

편집 중인 행에서 삭제 버튼을 클릭하면 두 상태가 동시에 활성화되는 충돌이 생긴다. 삭제 트리거 시 `editingId`도 초기화:

```tsx
// L485-490 Before:
<button
  onClick={() => setDeleteTarget(category.id)}
  ...
>

// After:
<button
  onClick={() => { setDeleteTarget(category.id); setEditingId(null) }}
  ...
>
```

**Step 3: 카테고리 행 아래에 인라인 확인 행 추가**

각 카테고리 행이 렌더링되는 부분을 찾아 `deleteTarget === category.id` 일 때 확인 행을 추가한다. L496 (`</div>`) 직전, 즉 각 카테고리 항목의 닫기 직전:

현재 구조 (L420-499 근처):
```tsx
<div key={category.id} className="...border-b border-[var(--border-subtle)] last:border-0">
  {editingId === category.id ? (
    {/* 편집 폼 */}
  ) : (
    <div className="flex items-center gap-3 p-3">
      {/* MoveButtons + 이모지 + 이름 + 액션 버튼 */}
    </div>
  )}
</div>
```

각 카테고리 항목 div의 편집폼/행 렌더링 다음, 해당 div 닫기 전에 추가:

```tsx
{/* 삭제 인라인 확인 */}
{deleteTarget === category.id && (
  <div className="px-3 py-2.5 bg-rose-500/5 flex items-center justify-between border-t border-rose-200/50">
    <p className="text-sm text-[var(--text-secondary)]">
      삭제하면 연결된 거래가 '분류 안 됨'이 돼요
    </p>
    <div className="flex gap-2 flex-shrink-0">
      <button
        onClick={() => setDeleteTarget(null)}
        className="px-3 py-1.5 text-xs rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)]"
      >
        취소
      </button>
      <button
        onClick={() => handleDelete(category.id)}
        className="px-3 py-1.5 text-xs rounded-lg bg-rose-500 text-white font-medium"
      >
        삭제
      </button>
    </div>
  </div>
)}
```

**Step 4: 전체화면 모달 제거**

L501-530 의 모달 블록 전체 삭제:

```tsx
// 아래 블록 전체 제거:
{deleteTarget !== null && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6">
      ...
    </div>
  </div>
)}
```

**Step 5: 테스트 파일 확인**

```bash
grep -n "confirm\|modal\|deleteTarget\|삭제" frontend/src/pages/__tests__/CategoryManager.test.tsx | head -20
```

삭제 관련 테스트가 모달 DOM을 직접 쿼리하는 경우 인라인 행 기준으로 수정 필요. 테스트 파일에서 `getByText('삭제')` 가 여러 번 매칭될 수 있으므로 확인 후 `getAllByText('삭제')[1]` (인라인 확인의 삭제 버튼) 방식으로 업데이트.

**Step 6: 테스트 통과 확인**

```bash
cd frontend && npm run test:run -- CategoryManager 2>&1 | tail -20
```

Expected: PASS

**Step 7: 커밋**

```bash
git add frontend/src/pages/CategoryManager.tsx \
        frontend/src/pages/__tests__/CategoryManager.test.tsx
git commit -m "fix: CategoryManager 삭제 확인 모달 → 인라인 행 (RecurringList 패턴 통일)"
```

---

### Task 5: PaymentMethodManager 삭제 확인 추가

**Files:**
- Modify: `frontend/src/pages/PaymentMethodManager.tsx`
- Test: `frontend/src/pages/__tests__/PaymentMethodManager.test.tsx`

편집 모드에서 Trash2 아이콘 버튼이 바로 `handleDelete(method)`를 호출하고 있어 확인 없이 삭제된다. `deletingId` 상태를 추가해 인라인 확인 행을 표시한다.

**Step 1: `deletingId` 상태 추가**

파일 상단 state 선언부 (약 L55 `[editingMethod, setEditingMethod]` 블록 아래):

```tsx
const [deletingId, setDeletingId] = useState<number | null>(null)
```

**Step 2: 편집 모드 삭제 버튼 변경**

현재 L444-449:
```tsx
<button
  onClick={() => handleDelete(method)}
  aria-label="삭제"
  className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-rose-500"
>
  <Trash2 className="w-4 h-4" />
</button>
```

변경:
```tsx
<button
  onClick={() => setDeletingId(method.id)}
  aria-label="삭제"
  className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-rose-500"
>
  <Trash2 className="w-4 h-4" />
</button>
```

**Step 3: 편집 모드 각 카드에 인라인 확인 행 추가**

편집 모드 카드(L355-456) 구조에서 각 카드 닫기 전에 추가:

```tsx
// 기존 카드 구조:
<div key={method.id} className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-4">
  {editingMethod?.id === method.id ? (
    {/* 편집 폼 */}
  ) : (
    {/* 행 */}
  )}
</div>

// 변경 후 — p-4를 제거하고 안쪽에서 패딩 처리:
<div key={method.id} className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden">
  <div className="p-4">
    {editingMethod?.id === method.id ? (
      {/* 편집 폼 — 내용 동일 */}
    ) : (
      {/* 행 — 내용 동일 */}
    )}
  </div>
  {/* 삭제 인라인 확인 */}
  {deletingId === method.id && (
    <div className="px-4 py-2.5 bg-rose-500/5 flex items-center justify-between border-t border-rose-200/50">
      <p className="text-sm text-[var(--text-secondary)]">'{method.name}'을 삭제할까요?</p>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => setDeletingId(null)}
          className="px-3 py-1.5 text-xs rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)]"
        >
          취소
        </button>
        <button
          onClick={async () => { await handleDelete(method); setDeletingId(null) }}
          className="px-3 py-1.5 text-xs rounded-lg bg-rose-500 text-white font-medium"
        >
          삭제
        </button>
      </div>
    </div>
  )}
</div>
```

**Step 4: `handleDelete` 내부의 toast/fetch 는 그대로 유지**

`handleDelete`는 현재 API 호출 후 toast + fetchData를 하므로 변경 없음.

**Step 5: 테스트 확인**

```bash
cd frontend && npm run test:run -- PaymentMethodManager 2>&1 | tail -20
```

**Step 6: 커밋**

```bash
git add frontend/src/pages/PaymentMethodManager.tsx \
        frontend/src/pages/__tests__/PaymentMethodManager.test.tsx
git commit -m "fix: PaymentMethodManager 삭제 확인 없음 → 인라인 행 추가"
```

---

### Task 6: PR2 전체 테스트 + PR 생성

**Step 1: 전체 lint + 테스트 + 빌드**

```bash
cd frontend && npm run lint && npm run test:run && npm run build 2>&1 | tail -10
```

Expected: 모두 통과

**Step 2: PR 생성**

```bash
gh pr create \
  --base develop \
  --title "fix: 더보기 삭제 플로우 통일 — 모달 제거, 인라인 행 확인" \
  --body "$(cat <<'EOF'
## Summary
- CategoryManager 전체화면 모달 → RecurringList 패턴의 인라인 행 확인으로 교체
- PaymentMethodManager 편집 모드에서 확인 없이 바로 삭제되던 문제 수정 → 인라인 행 확인 추가
- 4개 페이지 삭제 플로우가 인라인 행 패턴으로 통일됨

## Test plan
- [ ] CategoryManager: 삭제 버튼 클릭 → 인라인 확인 행 노출 확인
- [ ] CategoryManager: 확인 행 '취소' → 확인 행 사라짐, 삭제 안 됨
- [ ] CategoryManager: 확인 행 '삭제' → 카테고리 삭제됨
- [ ] PaymentMethodManager: 편집 모드에서 삭제 버튼 → 인라인 확인 행 노출
- [ ] PaymentMethodManager: 확인 행 '취소' → 삭제 안 됨
- [ ] PaymentMethodManager: 확인 행 '삭제' → 결제수단 삭제됨

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR3: 행 액션 아이콘화 + 결제수단 목록 구조 (DOM 구조 변경)

### Task 7: CategoryManager 행 액션 텍스트 버튼 → 아이콘 버튼

**Files:**
- Modify: `frontend/src/pages/CategoryManager.tsx:478-491`
- Import: `Pencil, Trash2` lucide-react에 추가

HIG: 2개 이하의 행 액션은 항상 노출 아이콘 버튼이 텍스트 버튼보다 공간 효율적이고 스캔하기 쉽다. 결제수단의 편집 모드 패턴(Pencil + Trash2 아이콘)과 통일.

**Step 1: import에 Pencil, Trash2 추가**

```tsx
// Before (L9):
import { ArrowLeft, Lock, Plus, Tags } from 'lucide-react'

// After:
import { ArrowLeft, Lock, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
```

**Step 2: 행 액션 버튼 교체 (L478-491)**

```tsx
// Before:
<div className="flex gap-2 flex-shrink-0">
  <button
    onClick={() => startEdit(category)}
    className="px-3 py-1.5 text-sm font-medium text-grape-600 bg-grape-500/10 rounded-lg hover:bg-grape-500/20 transition-colors"
  >
    수정
  </button>
  <button
    onClick={() => setDeleteTarget(category.id)}
    className="px-3 py-1.5 text-sm font-medium text-rose-600 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 transition-colors"
  >
    삭제
  </button>
</div>

// After:
<div className="flex items-center gap-1 flex-shrink-0">
  <button
    onClick={() => startEdit(category)}
    aria-label="수정"
    className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-grape-600"
  >
    <Pencil className="w-4 h-4" />
  </button>
  <button
    onClick={() => setDeleteTarget(category.id)}
    aria-label="삭제"
    className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-rose-500"
  >
    <Trash2 className="w-4 h-4" />
  </button>
</div>
```

PaymentMethodManager의 편집 모드 아이콘 버튼 패턴(L436-449)과 동일한 스타일.

**Step 3: 테스트 — aria-label 쿼리 방식 변경 확인**

```bash
grep -n "수정\|삭제\|edit\|delete" frontend/src/pages/__tests__/CategoryManager.test.tsx | head -20
```

테스트가 `getByText('수정')` / `getByText('삭제')` 로 버튼을 찾는 경우, 텍스트가 사라지므로 `getByRole('button', { name: '수정' })` / `getByRole('button', { name: '삭제' })` 로 변경 필요 (aria-label 추가했으므로 동작함).

**Step 4: 테스트 수정 후 통과 확인**

```bash
cd frontend && npm run test:run -- CategoryManager 2>&1 | tail -20
```

**Step 5: 커밋**

```bash
git add frontend/src/pages/CategoryManager.tsx \
        frontend/src/pages/__tests__/CategoryManager.test.tsx
git commit -m "fix: CategoryManager 행 액션 텍스트 버튼 → 아이콘 버튼 (결제수단 패턴 통일)"
```

---

### Task 8: PaymentMethodManager 일반 모드 목록 단일 카드 + divide-y

**Files:**
- Modify: `frontend/src/pages/PaymentMethodManager.tsx:289-351`
- Test: `frontend/src/pages/__tests__/PaymentMethodManager.test.tsx`

현재 일반 모드에서 결제수단마다 독립 카드(`space-y-3`)를 쓴다. 카테고리·예산관리·정기거래와 달리 시각적 컨테이너가 분산돼 보인다. 단일 카드 + `divide-y` 구조로 변경.

**Step 1: 일반 모드 목록 구조 변경 (L289-351)**

주 결제수단 드롭다운 카드(L267-287)는 독립 카드로 유지, 아래 "내 결제수단" 목록만 변경한다.

```tsx
// Before (L289-351):
<div>
  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">내 결제수단</h2>
  <div className="space-y-3">
    {methods.map((method) => {
      ...
      return (
        <div
          key={method.id}
          data-testid={`payment-method-${method.id}`}
          className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-4"
        >
          {/* 이름/타입/배지 */}
          {/* 실적 프로그레스 바 */}
        </div>
      )
    })}
  </div>
</div>

// After:
<div>
  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">내 결제수단</h2>
  <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden">
    <div className="divide-y divide-[var(--border-subtle)]">
      {methods.map((method) => {
        const usage = usageMap.get(method.id)
        const hasTarget = method.monthly_target && method.monthly_target > 0
        const remaining = hasTarget && usage ? method.monthly_target! - usage.spent_amount : null
        const isAchieved = hasTarget && usage && (usage.usage_percentage ?? 0) >= 100

        return (
          <div
            key={method.id}
            data-testid={`payment-method-${method.id}`}
            className="p-4"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{method.name}</span>
                <span className="text-xs text-[var(--text-muted)]">{TYPE_LABELS[method.type]}</span>
                {method.is_system && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">기본</span>
                )}
              </div>
            </div>

            {/* 실적 프로그레스 바: monthly_target이 있는 경우만 */}
            {hasTarget && usage && (
              <div className="mt-2" data-testid={`usage-bar-${method.id}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                    {formatAmount(usage.spent_amount)} / {formatAmount(method.monthly_target!)}
                  </span>
                  <span className={`text-xs tabular-nums ${isAchieved ? 'text-leaf-600 font-medium' : 'text-[var(--text-muted)]'}`}>
                    {isAchieved ? '실적 달성' : `잔여 ${formatAmount(usage.remaining ?? 0)}`}
                  </span>
                </div>
                <div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      isAchieved
                        ? 'bg-leaf-500'
                        : (usage.usage_percentage ?? 0) >= 80
                          ? 'bg-grape-500'
                          : 'bg-grape-400'
                    }`}
                    style={{ width: `${Math.min(usage.usage_percentage ?? 0, 100)}%` }}
                  />
                </div>
                {!isAchieved && remaining !== null && remaining > 0 && (
                  <p className="text-xs text-grape-600 mt-1 tabular-nums" data-testid={`nudge-${method.id}`}>
                    실적까지 {formatAmount(remaining)} 남음
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  </div>
</div>
```

내용은 동일하고 컨테이너 구조만 변경: 개별 `rounded-2xl` 카드 → 단일 컨테이너 안 `divide-y` 행.

또한 `bg-warm-100`(L310, Task 6 PR2에서 이미 수정)이 이 코드에 포함되어 있으므로 위 코드에서는 `bg-[var(--surface-elevated)]`로 이미 대체됨.

**Step 2: tsc 확인**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep PaymentMethodManager
```

Expected: 에러 없음

**Step 3: 테스트 통과 확인**

`data-testid="payment-method-${method.id}"` 는 유지했으므로 기존 테스트 영향 없어야 함.

```bash
cd frontend && npm run test:run -- PaymentMethodManager 2>&1 | tail -20
```

**Step 4: 커밋**

```bash
git add frontend/src/pages/PaymentMethodManager.tsx
git commit -m "fix: PaymentMethodManager 일반 모드 개별 카드 → 단일 카드+divide-y (목록 구조 통일)"
```

---

### Task 9: PR3 전체 테스트 + PR 생성

**Step 1: 전체 lint + tsc + 테스트 + 빌드**

```bash
cd frontend && npm run lint && npx tsc --noEmit && npm run test:run && npm run build 2>&1 | tail -10
```

Expected: 모두 통과

**Step 2: PR 생성**

```bash
gh pr create \
  --base develop \
  --title "fix: 더보기 행 액션 아이콘화 + 결제수단 목록 구조 통일" \
  --body "$(cat <<'EOF'
## Summary
- CategoryManager 행 액션 '수정'·'삭제' 텍스트 버튼 → Pencil/Trash2 아이콘 버튼 (PaymentMethodManager 편집 모드 패턴과 통일)
- PaymentMethodManager 일반 모드 결제수단 목록을 개별 카드 → 단일 카드+divide-y 구조로 변경 (카테고리·예산·정기거래와 통일)

## Test plan
- [ ] CategoryManager: 행 액션 아이콘 버튼이 표시되는지 확인
- [ ] CategoryManager: 수정 아이콘 → 편집 폼 활성화 확인
- [ ] CategoryManager: 삭제 아이콘 → 인라인 확인 행 노출 확인
- [ ] PaymentMethodManager: 결제수단 목록이 단일 컨테이너로 묶이는지 확인
- [ ] PaymentMethodManager: 실적 프로그레스 바 정상 표시 확인
- [ ] 다크모드에서 결제수단 목록 divide-y 구분선 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 마무리 체크리스트

PR1, PR2, PR3 모두 머지 후:

- [ ] `docs/IMPLEMENTATION_STATUS.md` 업데이트 — 설정 서브페이지 UX 일관성 항목
- [ ] `frontend/src/data/changelogs.ts` — 사용자 대상 변경 없음 (내부 UX 정리), changelog 업데이트 불필요
- [ ] CLAUDE.md 변경 없음

---

## 변경 범위 요약

| 파일 | PR | 변경 내용 |
|---|---|---|
| `BudgetManager.tsx` | PR1 | 헤더 PiggyBank 아이콘 추가 |
| `CategoryManager.tsx` | PR1+PR2+PR3 | 탭 컬러, 삭제 인라인, 행 액션 아이콘 |
| `PaymentMethodManager.tsx` | PR2+PR3 | 삭제 확인, 목록 구조 |
| 테스트 파일 2개 | PR2+PR3 | 쿼리 방식 업데이트 |

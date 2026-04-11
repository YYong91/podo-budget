# 더보기 3라운드 정비 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 더보기에서 진입하는 9개 페이지를 숫자 포맷, UX/용어, 디자인 톤 3라운드로 정비한다

**Architecture:** 각 라운드는 전체 페이지 스캔 후 수정 → 커밋. 라운드간 의존성 없으므로 순서대로 진행. 프론트엔드 전용 작업으로 백엔드 변경 없음.

**Tech Stack:** React + TypeScript, Tailwind CSS v4, Lucide React, Vitest + RTL

---

## 사전 준비: 워크트리 생성

```bash
cd ~/Developer/podo-budget
git worktree add -b feature/settings-polish ../podo-budget-settings-polish develop
cd ../podo-budget-settings-polish/frontend
npm install
```

---

## 대상 파일 (9개)

| 파일 | 경로 |
|------|------|
| CategoryManager | `frontend/src/pages/CategoryManager.tsx` |
| BudgetManager | `frontend/src/pages/BudgetManager.tsx` |
| PaymentMethodManager | `frontend/src/pages/PaymentMethodManager.tsx` |
| RecurringList | `frontend/src/pages/RecurringList.tsx` |
| HouseholdListPage | `frontend/src/pages/HouseholdListPage.tsx` |
| AppearanceSection | `frontend/src/components/settings/AppearanceSection.tsx` |
| MyAccountSection | `frontend/src/components/settings/MyAccountSection.tsx` |
| ChangelogSection | `frontend/src/components/settings/ChangelogSection.tsx` |
| SettingsPage | `frontend/src/pages/SettingsPage.tsx` |

---

## Round 1: 숫자/금액 포맷 통일

### Task 1-1: BudgetManager 금액 표시 정비

**발견된 문제:**
- L402: `${s.amount.toLocaleString('ko-KR')}원` — `formatAmount()` 미사용, `원` suffix 방식
- 금액 표시 span에 `tabular-nums` 클래스 없음

**파일:** `frontend/src/pages/BudgetManager.tsx`

**Step 1: 최근 지출 금액 포맷 수정 (L398-407)**

현재:
```tsx
{item.monthly_spending
  .slice(0, 3)
  .map((s) => `${s.month}월 ${s.amount.toLocaleString('ko-KR')}원`)
  .join(' / ')}
```

수정 후:
```tsx
{item.monthly_spending
  .slice(0, 2)
  .map((s) => `${s.month}월 ${formatAmount(s.amount)}`)
  .join(' · ')}
```

**Step 2: 금액 표시 span에 tabular-nums 추가**

BudgetManager에서 금액 표시하는 곳:
- L297: 배정/총 예산 표시 span → `className="tabular-nums"` 추가
- L300: 남은 예산 span → `className="tabular-nums"` 추가
- L348: 사용/예산 표시 span → `className="tabular-nums"` 추가
- L350: 남은 금액 span → `className="tabular-nums"` 추가

**Step 3: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 오류 없음

**Step 4: Commit**
```bash
git add frontend/src/pages/BudgetManager.tsx
git commit -m "style: BudgetManager 금액 포맷 — formatAmount 통일, tabular-nums 추가"
```

---

### Task 1-2: RecurringList 금액 tabular-nums 추가

**파일:** `frontend/src/pages/RecurringList.tsx`

**발견된 문제:**
- L310 (데스크톱): 금액 td에 `tabular-nums` 없음
- L354 (모바일): 금액 span에 `tabular-nums` 없음
- `formatAmount()` 자체는 이미 사용 중 — 클래스만 추가

**Step 1: 데스크톱 테이블 금액 td (L309)**

```tsx
// 현재
<td className={`px-5 py-3 text-right font-semibold ${r.type === 'expense' ? ... : ...}`}>

// 수정
<td className={`px-5 py-3 text-right font-semibold tabular-nums ${r.type === 'expense' ? ... : ...}`}>
```

**Step 2: 모바일 금액 span (L354)**

```tsx
// 현재
<span className={`font-semibold whitespace-nowrap ml-2 ${...}`}>

// 수정
<span className={`font-semibold whitespace-nowrap ml-2 tabular-nums ${...}`}>
```

**Step 3: Commit**
```bash
git add frontend/src/pages/RecurringList.tsx
git commit -m "style: RecurringList 금액 tabular-nums 추가"
```

---

### Task 1-3: PaymentMethodManager 금액 tabular-nums 추가

**파일:** `frontend/src/pages/PaymentMethodManager.tsx`

**발견된 문제:**
- L311 (실적 표시): `formatAmount()` 사용 중이나 `tabular-nums` 없음
- L314 (잔여 금액): `tabular-nums` 없음
- L332 (넛지 텍스트): `tabular-nums` 없음

**Step 1: 실적 표시 span들에 tabular-nums 추가**

```tsx
// L311
<span className="text-xs text-[var(--text-secondary)] tabular-nums">
  {formatAmount(usage.spent_amount)} / {formatAmount(method.monthly_target!)}
</span>

// L314
<span className={`text-xs tabular-nums ${isAchieved ? 'text-leaf-600 font-medium' : 'text-[var(--text-muted)]'}`}>

// L332
<p className="text-xs text-grape-600 mt-1 tabular-nums" ...>
```

**Step 2: Commit**
```bash
git add frontend/src/pages/PaymentMethodManager.tsx
git commit -m "style: PaymentMethodManager 금액 tabular-nums 추가"
```

---

### Task 1-4: 빌드 + 테스트로 Round 1 검증

```bash
cd frontend
npm run lint && npm run test:run && npm run build
```

Expected: 모든 검사 통과

---

## Round 2: UX + 용어 정비

### Task 2-1: "반복 거래" → "정기거래" 용어 통일

**배경:** #606 커밋에서 `반복 거래 → 정기거래` 통일 결정이 있었으나 RecurringList 페이지 헤더와 에러 상태가 여전히 "반복 거래" 사용.

**파일:** `frontend/src/pages/RecurringList.tsx`, `frontend/src/pages/SettingsPage.tsx`

**Step 1: RecurringList 헤더 수정**

RecurringList에서 "반복 거래" 텍스트 전부 검색:
- L228: 에러 상태 헤더 `<h1>반복 거래</h1>` → `<h1>정기거래</h1>`
- L245: 정상 헤더 `<h1>반복 거래</h1>` → `<h1>정기거래</h1>`

**Step 2: SettingsPage 메뉴 항목 수정**

SettingsPage의 메뉴 항목:
```tsx
// 현재
{ to: '/recurring', label: '반복 거래', icon: Repeat },

// 수정
{ to: '/recurring', label: '정기거래', icon: Repeat },
```

**Step 3: Commit**
```bash
git add frontend/src/pages/RecurringList.tsx frontend/src/pages/SettingsPage.tsx
git commit -m "fix: '반복 거래' → '정기거래' 용어 통일 (#606 후속)"
```

---

### Task 2-2: RecurringList 삭제 confirm → 모달로 교체

**배경:** RecurringList L189에서 `window.confirm()` 사용. CategoryManager는 자체 삭제 확인 모달 보유. 브라우저 기본 다이얼로그는 스타일 통일 불가, 모바일 UX 나쁨.

**파일:** `frontend/src/pages/RecurringList.tsx`

**Step 1: 삭제 대상 state 추가**

```tsx
// 기존 state 아래에 추가
const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
```

**Step 2: handleDelete 수정 — confirm 제거, 모달 기반으로**

```tsx
// 현재
const handleDelete = async (id: number) => {
  if (!confirm('정말 삭제하시겠습니까?')) return
  try {
    await recurringApi.delete(id)
    ...
  }
}

// 수정: 두 함수로 분리
const requestDelete = (id: number) => {
  setDeleteTargetId(id)
}

const handleDelete = async () => {
  if (!deleteTargetId) return
  try {
    await recurringApi.delete(deleteTargetId)
    addToast('success', TOAST.RECURRING_DELETED)
    setDeleteTargetId(null)
    loadData()
  } catch {
    addToast('error', TOAST.DELETE_FAILED)
  }
}
```

**Step 3: 삭제 버튼 onClick 변경**

```tsx
// 데스크톱 삭제 버튼 (L334)
<button onClick={() => requestDelete(r.id)} ...>

// 모바일 삭제 버튼 (L375)
<button onClick={() => requestDelete(r.id)} ...>
```

**Step 4: 삭제 확인 모달 JSX 추가 (RecurringList return 마지막에)**

```tsx
{/* 삭제 확인 모달 */}
{deleteTargetId !== null && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        정기거래 삭제
      </h3>
      <p className="text-[var(--text-secondary)] mb-6">
        정말로 이 정기거래를 삭제하시겠습니까?
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => setDeleteTargetId(null)}
          className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-lg transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleDelete}
          className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
        >
          삭제
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 5: 빌드 확인**
```bash
npm run build
```

**Step 6: Commit**
```bash
git add frontend/src/pages/RecurringList.tsx
git commit -m "fix: RecurringList 삭제 confirm → 모달로 교체"
```

---

### Task 2-3: PaymentMethodManager 뒤로가기 패턴 통일

**배경:** PaymentMethodManager만 `<Link to="/settings">` 사용. 나머지는 `useGoBack()` + `<button>`. `useGoBack()`은 이전 히스토리가 있으면 go(-1), 없으면 fallback URL로 이동해 더 자연스러운 탐색 제공.

**파일:** `frontend/src/pages/PaymentMethodManager.tsx`

**Step 1: import에 useGoBack 추가**

```tsx
// 현재
import { Link } from 'react-router-dom'
import { ArrowLeft, CreditCard, Plus, Trash2, Pencil, ChevronUp, ChevronDown } from 'lucide-react'

// 수정 — Link 제거, useGoBack 추가
import { ArrowLeft, CreditCard, Plus, Trash2, Pencil, ChevronUp, ChevronDown } from 'lucide-react'
import { useGoBack } from '../hooks/useGoBack'
```

**Step 2: useGoBack 훅 초기화 (함수 상단)**

```tsx
const goBack = useGoBack('/settings')
```

**Step 3: 헤더의 Link → button으로 교체 (L212-218)**

```tsx
// 현재
<Link
  to="/settings"
  aria-label="뒤로가기"
  className="p-2 -ml-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
>
  <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
</Link>

// 수정
<button
  onClick={() => goBack()}
  aria-label="뒤로가기"
  className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
>
  <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
</button>
```

**Step 4: Commit**
```bash
git add frontend/src/pages/PaymentMethodManager.tsx
git commit -m "fix: PaymentMethodManager 뒤로가기 useGoBack으로 통일"
```

---

### Task 2-4: HouseholdListPage 추가 버튼 아이콘 통일

**배경:** `+ 가구 만들기` 텍스트 `+`는 문자열. 다른 페이지는 `<Plus />` 아이콘 컴포넌트 사용.

**파일:** `frontend/src/pages/HouseholdListPage.tsx`

**Step 1: Plus import 추가**

```tsx
// 현재
import { ArrowLeft, Users, Calendar } from 'lucide-react'

// 수정
import { ArrowLeft, Users, Calendar, Plus } from 'lucide-react'
```

**Step 2: 헤더 버튼 수정 (L136-140)**

```tsx
// 현재
<button ... className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg ...">
  + 가구 만들기
</button>

// 수정
<button ... className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-xl shadow-sm hover:bg-grape-700 transition-colors">
  <Plus className="w-4 h-4" />
  가구 만들기
</button>
```

**Step 3: Commit**
```bash
git add frontend/src/pages/HouseholdListPage.tsx
git commit -m "fix: HouseholdListPage 추가 버튼 Plus 아이콘으로 통일"
```

---

### Task 2-5: 빌드 + 테스트로 Round 2 검증

```bash
npm run lint && npm run test:run && npm run build
```

Expected: 모든 검사 통과

---

## Round 3: 디자인 톤 통일

### Task 3-1: 헤더 아이콘 패턴 최종 점검

**배경:** #614 커밋으로 개발 브랜치에 이미 헤더 아이콘이 추가됨. 워크트리가 develop 기반이면 이미 적용되어 있을 것. 확인 후 누락된 곳만 추가.

**Step 1: 각 페이지 헤더 아이콘 현황 확인**

```bash
grep -n "PiggyBank\|Tags\|Repeat\|Users" frontend/src/pages/BudgetManager.tsx frontend/src/pages/CategoryManager.tsx frontend/src/pages/RecurringList.tsx frontend/src/pages/HouseholdListPage.tsx
```

Expected (develop 기준):
- BudgetManager: `PiggyBank` import 있음
- CategoryManager: `Tags` import 있음 (또는 없으면 추가)
- RecurringList: `Repeat` import 있음
- HouseholdListPage: `Users` 이미 import됨 (아이콘 표시 확인)

**Step 2: 아이콘이 헤더에 실제 렌더링되는지 확인**

각 페이지 헤더 JSX에서 아이콘 태그 존재 여부 확인. 없으면 추가:

```tsx
// 헤더 표준 패턴 (예: BudgetManager)
<div className="flex items-center gap-3">
  <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
    <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
  </button>
  <PiggyBank className="w-5 h-5 text-grape-500 flex-shrink-0" />
  <h1 className="text-lg font-semibold text-[var(--text-primary)]">예산 관리</h1>
</div>
```

**Step 3: HouseholdListPage 헤더에 Users 아이콘 추가**

현재 HouseholdListPage 헤더에는 `Users` 아이콘이 없음 (본문 멤버수 표시용으로만 사용). 헤더에도 추가:

```tsx
<div className="flex items-center gap-3">
  <button onClick={() => goBack()} ...>
    <ArrowLeft ... />
  </button>
  <Users className="w-5 h-5 text-grape-500 flex-shrink-0" />
  <h1 className="text-lg font-semibold text-[var(--text-primary)]">공유 가계부</h1>
</div>
```

**Step 4: Commit**
```bash
git add frontend/src/pages/BudgetManager.tsx frontend/src/pages/CategoryManager.tsx frontend/src/pages/RecurringList.tsx frontend/src/pages/HouseholdListPage.tsx
git commit -m "style: 설정 서브페이지 헤더 아이콘 최종 점검"
```

---

### Task 3-2: PaymentMethodManager 로딩 스켈레톤 통일

**배경:** PaymentMethodManager만 `animate-pulse` + `bg-warm-200` 인라인 방식. 나머지는 `Skeleton` 컴포넌트 사용.

**파일:** `frontend/src/pages/PaymentMethodManager.tsx`

**Step 1: Skeleton 컴포넌트 import 추가**

```tsx
import { Skeleton } from '../components/skeleton/Skeleton'
```

**Step 2: 로딩 UI 교체 (L236-244)**

```tsx
// 현재
{loading && (
  <div className="space-y-3">
    {[...Array(2)].map((_, i) => (
      <div key={i} className="bg-[var(--surface-card)] rounded-2xl p-4 animate-pulse">
        <div className="h-4 w-24 bg-warm-200 rounded mb-2" />
        <div className="h-3 w-16 bg-warm-200 rounded" />
      </div>
    ))}
  </div>
)}

// 수정
{loading && (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-[var(--surface-card)] rounded-2xl p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    ))}
  </div>
)}
```

**Step 3: Commit**
```bash
git add frontend/src/pages/PaymentMethodManager.tsx
git commit -m "style: PaymentMethodManager 로딩 스켈레톤 Skeleton 컴포넌트로 통일"
```

---

### Task 3-3: PaymentMethodManager 빈 상태 EmptyState 컴포넌트로 통일

**배경:** 빈 상태(L247-252)가 인라인 JSX. 다른 페이지는 `EmptyState` 컴포넌트 사용.

**파일:** `frontend/src/pages/PaymentMethodManager.tsx`

**Step 1: EmptyState import 추가**

```tsx
import EmptyState from '../components/EmptyState'
```

**Step 2: 빈 상태 교체 (L247-252)**

```tsx
// 현재
{!loading && methods.length === 0 && (
  <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-8 text-center">
    <CreditCard className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
    <p className="text-sm font-medium text-[var(--text-secondary)]">결제수단을 추가하면 지출에 태깅할 수 있어요</p>
  </div>
)}

// 수정
{!loading && methods.length === 0 && (
  <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]">
    <EmptyState
      variant="section"
      title="등록된 결제수단이 없습니다"
      description="결제수단을 추가하면 지출 입력 시 태깅할 수 있어요"
      action={{ label: '결제수단 추가', onClick: () => setShowForm(true) }}
    />
  </div>
)}
```

**Step 3: Commit**
```bash
git add frontend/src/pages/PaymentMethodManager.tsx
git commit -m "style: PaymentMethodManager 빈 상태 EmptyState 컴포넌트로 통일"
```

---

### Task 3-4: 카드 컨테이너 스타일 통일

**배경:** 페이지별로 카드 border opacity가 다름.
- BudgetManager: `border-[var(--border-default)]/60` (60% opacity)
- CategoryManager: `border-[var(--border-default)]/60`
- RecurringList: `border-[var(--border-default)]/60`
- PaymentMethodManager: `border-[var(--border-default)]` (100%, opacity 없음)
- HouseholdListPage: `border-[var(--border-default)]` (카드 개별)

PaymentMethodManager의 카드들을 `/60` opacity로 통일.

**파일:** `frontend/src/pages/PaymentMethodManager.tsx`

**Step 1: 카드 border 통일**

PaymentMethodManager 내 `border-[var(--border-default)]`를 `border-[var(--border-default)]/60`으로 변경 (주 결제수단 드롭다운 카드, 결제수단 카드들, 추가 폼 카드).

주의: HouseholdListPage의 개별 카드는 hover 효과가 있어서 `/60`보다 선명한 border가 자연스러울 수 있음 — 유지.

**Step 2: 빌드 확인**
```bash
npm run build
```

**Step 3: Commit**
```bash
git add frontend/src/pages/PaymentMethodManager.tsx
git commit -m "style: PaymentMethodManager 카드 border opacity /60으로 통일"
```

---

### Task 3-5: 최종 빌드 + 테스트

```bash
npm run lint && npm run test:run && npm run build
```

Expected: 모든 검사 통과, 오류 없음

---

## 완료 후: PR 생성

```bash
git push -u origin feature/settings-polish
gh pr create --base develop --title "style: 더보기 페이지 3라운드 정비 — 숫자 포맷, UX/용어, 디자인 톤" --body "$(cat <<'EOF'
## Summary

- **Round 1** 숫자/금액 포맷 통일: BudgetManager 최근 지출 formatAmount 적용, 전 페이지 금액 tabular-nums 추가
- **Round 2** UX/용어 정비: '반복 거래' → '정기거래' 통일, RecurringList 삭제 모달화, PaymentMethodManager 뒤로가기 useGoBack 통일, HouseholdListPage Plus 아이콘 통일
- **Round 3** 디자인 톤 통일: 헤더 아이콘 패턴, 로딩 스켈레톤 Skeleton 컴포넌트, EmptyState 컴포넌트, 카드 border opacity 통일

## Test plan
- [ ] 예산 관리: 최근 지출 금액 ₩0,000 형식 표시
- [ ] 정기거래: 헤더/메뉴 모두 "정기거래" 표시
- [ ] 정기거래: 삭제 시 브라우저 confirm 대신 모달 표시
- [ ] 결제수단: 뒤로가기 버튼 동작 (브라우저 히스토리 기반)
- [ ] 공유 가계부: 헤더 Plus 아이콘 표시
- [ ] 전체: 금액 숫자 자간 tabular-nums 적용 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

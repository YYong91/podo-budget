# 다크모드 2차 개선 — 전체 컴포넌트 시멘틱 변수 통일

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모든 프론트엔드 컴포넌트에서 하드코딩된 라이트모드 색상을 시멘틱 CSS 변수로 통일하여 다크모드를 완전 지원한다.

**Architecture:** `index.css`에 이미 정의된 시멘틱 변수(`--surface-card`, `--text-primary` 등)를 활용. `bg-white`, `text-warm-*`, `border-warm-*` 등 하드코딩 색상을 일괄 치환한다. 추가 CSS 변수가 필요한 경우(폼 인풋 보더, 강조 배경 등) `index.css`에 추가한다.

**Tech Stack:** Tailwind CSS v4, CSS custom properties

---

## 치환 규칙 (모든 태스크에 공통 적용)

| 라이트 하드코딩 | 시멘틱 변수 |
|---|---|
| `bg-white` | `bg-[var(--surface-card)]` |
| `bg-cream-50` | `bg-[var(--surface)]` |
| `bg-warm-50` | `bg-[var(--surface-elevated)]` |
| `bg-warm-100` | `bg-[var(--surface-hover)]` |
| `text-warm-900` | `text-[var(--text-primary)]` |
| `text-warm-800` | `text-[var(--text-primary)]` |
| `text-warm-700` | `text-[var(--text-secondary)]` |
| `text-warm-600` | `text-[var(--text-secondary)]` |
| `text-warm-500` | `text-[var(--text-tertiary)]` |
| `text-warm-400` | `text-[var(--text-muted)]` |
| `border-warm-200` (+ `/60` 등) | `border-[var(--border-default)]` |
| `border-warm-100` | `border-[var(--border-subtle)]` |
| `border-warm-300` | `border-[var(--border-default)]` |

**강조 배경 (grape/leaf/rose 계열):** `bg-grape-50` → `bg-grape-50 dark:bg-grape-900/20`, `bg-leaf-50` → `bg-leaf-50 dark:bg-leaf-900/20`, `bg-rose-50` → `bg-rose-50 dark:bg-rose-900/20`

**강조 텍스트 (grape/leaf/rose 등):** `text-grape-700` → `text-grape-700 dark:text-grape-300`, `text-leaf-600` → `text-leaf-600 dark:text-leaf-400`, `text-rose-600` → `text-rose-600 dark:text-rose-400`

**그라데이션 (AssetDashboard 등):** `from-grape-50 to-grape-100` → `from-grape-50 to-grape-100 dark:from-grape-900/30 dark:to-grape-800/20`

**참고:** `dark:` prefix가 이미 있는 속성은 건드리지 않는다.

---

### Task 1: CSS 변수 보강 — 폼 인풋용 변수 추가

`index.css`에 폼 인풋 전용 시멘틱 변수를 추가한다. 현재 `border-warm-300`이 폼 인풋에 광범위하게 쓰이는데, 기존 `--border-default`(warm-200)보다 약간 진한 보더가 필요하다.

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: 라이트/다크 변수 추가**

`:root`에 추가:
```css
--input-border: var(--color-warm-300);
--input-bg: #ffffff;
```

`.dark`에 추가:
```css
--input-border: #4d4562;
--input-bg: #1e1a2a;
```

**Step 2: 빌드 확인**

```bash
cd frontend && npm run build
```

Expected: 성공

**Step 3: 커밋**

```bash
git add frontend/src/index.css
git commit -m "style: 다크모드 폼 인풋용 시멘틱 변수 추가"
```

---

### Task 2: PeriodNavigator — 월 선택기 가독성

**Files:**
- Modify: `frontend/src/components/stats/PeriodNavigator.tsx`

**Step 1: 시멘틱 변수 적용**

`text-warm-800` → `text-[var(--text-primary)]`

```tsx
<span className="text-lg font-semibold text-[var(--text-primary)] min-w-[160px] text-center">
```

**Step 2: 커밋**

```bash
git add frontend/src/components/stats/PeriodNavigator.tsx
git commit -m "style: 월 네비게이터 다크모드 가독성 개선"
```

---

### Task 3: 리포트 컴포넌트 7개 — 시멘틱 변수 통일

리포트 페이지에서 사용되는 stats 컴포넌트 전체를 한번에 수정한다.

**Files:**
- Modify: `frontend/src/components/stats/CategoryTopList.tsx`
- Modify: `frontend/src/components/stats/AssetChangeSummary.tsx`
- Modify: `frontend/src/components/stats/MonthlyHighlights.tsx`
- Modify: `frontend/src/components/stats/BudgetVsActual.tsx`
- Modify: `frontend/src/components/stats/FinancialHealthScore.tsx`
- Modify: `frontend/src/components/stats/StructuredInsightsView.tsx`
- Modify: `frontend/src/components/stats/UnifiedSummaryCards.tsx`

**Step 1: 각 파일에 치환 규칙 일괄 적용**

핵심 치환:
- `bg-white` → `bg-[var(--surface-card)]`
- `text-warm-*` → 위 테이블에 따라 시멘틱 변수
- `border-warm-*` → `border-[var(--border-default)]` 또는 `border-[var(--border-subtle)]`
- `bg-warm-50` → `bg-[var(--surface-elevated)]`
- `bg-warm-100` → `bg-[var(--surface-hover)]`
- `bg-leaf-50` → `bg-leaf-50 dark:bg-leaf-900/20`
- `text-leaf-700` → `text-leaf-700 dark:text-leaf-400`
- `text-grape-600` → `text-grape-600 dark:text-grape-400` (이미 dark 있으면 스킵)
- `text-amber-600` → `text-amber-600 dark:text-amber-400`

**주의:** `UnifiedSummaryCards.tsx`의 그라데이션 배경(`from-leaf-50 to-leaf-100`, `from-grape-50 to-grape-100`, `from-warm-50 to-warm-100`) 각각에 `dark:from-*/dark:to-*` 추가.

**Step 2: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 3: 테스트 확인**

```bash
cd frontend && npx vitest run src/components/stats/
```

Expected: 전부 PASS (스타일 변경은 기능에 영향 없음)

**Step 4: 커밋**

```bash
git add frontend/src/components/stats/
git commit -m "style: 리포트 컴포넌트 7개 다크모드 시멘틱 변수 통일"
```

---

### Task 4: 모달 3개 — bg-white + 폼 인풋 다크모드

**Files:**
- Modify: `frontend/src/components/RegisterRecurringModal.tsx`
- Modify: `frontend/src/components/CreateHouseholdModal.tsx`
- Modify: `frontend/src/components/InviteMemberModal.tsx`

**Step 1: 각 모달 치환**

핵심:
- `bg-white` → `bg-[var(--surface-card)]`
- `border-warm-300` → `border-[var(--input-border)]`
- `border-warm-100` → `border-[var(--border-subtle)]`
- `text-warm-900` → `text-[var(--text-primary)]`
- `text-warm-700` → `text-[var(--text-secondary)]`
- `text-warm-600` → `text-[var(--text-secondary)]`
- `text-warm-500` → `text-[var(--text-tertiary)]`
- `bg-warm-50` → `bg-[var(--surface-elevated)]`
- `bg-rose-50` → `bg-rose-50 dark:bg-rose-900/20`
- `border-rose-200` → `border-rose-200 dark:border-rose-800/40`
- `text-rose-600` → `text-rose-600 dark:text-rose-400`

**Step 2: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 3: 커밋**

```bash
git add frontend/src/components/RegisterRecurringModal.tsx frontend/src/components/CreateHouseholdModal.tsx frontend/src/components/InviteMemberModal.tsx
git commit -m "style: 모달 3개 다크모드 시멘틱 변수 통일"
```

---

### Task 5: 폼 페이지 3개 — 지출/수입/자산 입력

`border-warm-300`이 가장 많은 파일들. `--input-border` 변수로 통일.

**Files:**
- Modify: `frontend/src/pages/ExpenseForm.tsx`
- Modify: `frontend/src/pages/IncomeForm.tsx`
- Modify: `frontend/src/pages/AssetForm.tsx`

**Step 1: 각 파일 치환**

핵심 (3개 파일 공통):
- `border-warm-300` → `border-[var(--input-border)]`
- `bg-white` → `bg-[var(--surface-card)]` (있는 경우)
- `bg-warm-100` → `bg-[var(--surface-hover)]` (탭 배경 등)
- `text-warm-*` → 시멘틱 변수 치환
- `bg-grape-50` → `bg-grape-50 dark:bg-grape-900/20` (강조 배경)
- `bg-grape-50/50` → `bg-grape-50/50 dark:bg-grape-900/20`
- `bg-leaf-50/50` → `bg-leaf-50/50 dark:bg-leaf-900/20`
- `border-grape-300` → `border-grape-300 dark:border-grape-700`

**Step 2: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 3: 커밋**

```bash
git add frontend/src/pages/ExpenseForm.tsx frontend/src/pages/IncomeForm.tsx frontend/src/pages/AssetForm.tsx
git commit -m "style: 지출/수입/자산 폼 다크모드 시멘틱 변수 통일"
```

---

### Task 6: 상세 페이지 2개 — 지출/수입 상세 + 편집

**Files:**
- Modify: `frontend/src/pages/ExpenseDetail.tsx`
- Modify: `frontend/src/pages/IncomeDetail.tsx`

**Step 1: 각 파일 치환**

- `border-warm-300` → `border-[var(--input-border)]`
- `bg-warm-100` → `bg-[var(--surface-hover)]`
- `bg-white` → `bg-[var(--surface-card)]`
- `text-warm-*` → 시멘틱 변수

**Step 2: 빌드 확인 + 커밋**

```bash
cd frontend && npm run build
git add frontend/src/pages/ExpenseDetail.tsx frontend/src/pages/IncomeDetail.tsx
git commit -m "style: 지출/수입 상세 페이지 다크모드 시멘틱 변수 통일"
```

---

### Task 7: OnboardingPage — 전체 다크모드 적용

**Files:**
- Modify: `frontend/src/pages/OnboardingPage.tsx`

**Step 1: 치환**

- `bg-cream-50` → `bg-[var(--surface)]`
- `bg-white` → `bg-[var(--surface-card)]`
- `text-grape-900` → `text-grape-900 dark:text-grape-200`
- `text-warm-500` → `text-[var(--text-tertiary)]`
- `text-warm-700` → `text-[var(--text-secondary)]`
- `text-warm-400` → `text-[var(--text-muted)]`
- `border-warm-200/60` → `border-[var(--border-default)]`
- `border-warm-200` (input) → `border-[var(--input-border)]`

**Step 2: 빌드 확인 + 커밋**

```bash
cd frontend && npm run build
git add frontend/src/pages/OnboardingPage.tsx
git commit -m "style: 온보딩 페이지 다크모드 적용"
```

---

### Task 8: Layout — 로고 아이콘 + 사이드바 잔여

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: 로고 아이콘 다크모드 처리**

PWA 아이콘 이미지에 다크모드 필터 추가:
```tsx
<img src="/pwa-192x192.png" alt="" className="w-8 h-8 rounded dark:brightness-90" />
```

사이드바의 `bg-grape-50` → `bg-grape-50 dark:bg-grape-900/20`:
- 가구 선택 드롭다운 배경
- 활성 네비게이션 아이템 배경

**Step 2: 빌드 확인 + 커밋**

```bash
cd frontend && npm run build
git add frontend/src/components/Layout.tsx
git commit -m "style: 레이아웃 로고 아이콘 + 사이드바 다크모드 개선"
```

---

### Task 9: AssetDashboard — 순자산 히어로 + 진행바

**Files:**
- Modify: `frontend/src/pages/AssetDashboard.tsx`

**Step 1: 순자산 히어로 그라데이션 다크모드**

양수 순자산:
- `from-grape-50 to-grape-100 border-grape-200/60` → `from-grape-50 to-grape-100 dark:from-grape-900/30 dark:to-grape-800/20 border-grape-200/60 dark:border-grape-700/40`
- `text-grape-700` (순자산 금액) → `text-grape-700 dark:text-grape-300`
- `bg-grape-200/50 text-grape-700` (버튼) → `bg-grape-200/50 dark:bg-grape-800/40 text-grape-700 dark:text-grape-300`

음수 순자산:
- `from-rose-50 to-red-50 border-rose-200/60` → `from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/20 border-rose-200/60 dark:border-rose-700/40`
- `text-rose-700` → `text-rose-700 dark:text-rose-300`
- `bg-rose-200/50 text-rose-700` (버튼) → `bg-rose-200/50 dark:bg-rose-800/40 text-rose-700 dark:text-rose-300`

기타:
- `bg-warm-100` (진행바 배경) → `bg-[var(--surface-hover)]`
- `text-warm-300` (chevron) → `text-[var(--text-muted)]`

**Step 2: 빌드 확인 + 커밋**

```bash
cd frontend && npm run build
git add frontend/src/pages/AssetDashboard.tsx
git commit -m "style: 자산 대시보드 순자산 히어로 + 진행바 다크모드"
```

---

### Task 10: 나머지 페이지 — CategoryManager, RecurringList, 기타

**Files:**
- Modify: `frontend/src/pages/CategoryManager.tsx`
- Modify: `frontend/src/pages/RecurringList.tsx`
- Modify: `frontend/src/pages/HouseholdDetailPage.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/pages/GuidePage.tsx`
- Modify: `frontend/src/pages/FeedbackPage.tsx`
- Modify: `frontend/src/pages/InvitationListPage.tsx`
- Modify: `frontend/src/pages/AcceptInvitationPage.tsx`
- Modify: `frontend/src/pages/PrivacyPolicyPage.tsx`
- Modify: `frontend/src/pages/TermsOfServicePage.tsx`
- Modify: `frontend/src/pages/TransactionList.tsx`

**Step 1: 각 파일에 치환 규칙 일괄 적용**

동일 패턴:
- `bg-white` → `bg-[var(--surface-card)]`
- `border-warm-300` → `border-[var(--input-border)]`
- `bg-warm-100` → `bg-[var(--surface-hover)]`
- `text-warm-*` → 시멘틱 변수
- `border-warm-*` → 시멘틱 변수
- `bg-grape-50` → `bg-grape-50 dark:bg-grape-900/20`

**Step 2: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 3: 커밋**

```bash
git add frontend/src/pages/
git commit -m "style: 나머지 페이지 다크모드 시멘틱 변수 통일"
```

---

### Task 11: 나머지 컴포넌트 — admin, 공통

**Files:**
- Modify: `frontend/src/components/admin/AdminOverview.tsx`
- Modify: `frontend/src/components/admin/AdminUserManager.tsx`
- Modify: `frontend/src/components/admin/AdminFeedbackDashboard.tsx`
- Modify: `frontend/src/components/TransactionItem.tsx`
- Modify: `frontend/src/components/EmptyState.tsx`

**Step 1: 동일 치환 규칙 적용**

**Step 2: 빌드 확인 + 커밋**

```bash
cd frontend && npm run build
git add frontend/src/components/
git commit -m "style: admin 및 공통 컴포넌트 다크모드 시멘틱 변수 통일"
```

---

### Task 12: 전체 검증 — 빌드 + 테스트 + 잔여 하드코딩 스캔

**Step 1: 프론트엔드 빌드**

```bash
cd frontend && npm run build
```

**Step 2: 전체 테스트**

```bash
cd frontend && npm run test:run
```

**Step 3: 잔여 하드코딩 스캔**

```bash
cd frontend && grep -r 'bg-white\|border-warm-300' src/ --include='*.tsx' -l
```

Expected: 0건 또는 의도적 사용만 남음

**Step 4: 최종 커밋 (필요 시)**

```bash
git commit -m "chore: 다크모드 전체 검증 완료"
```

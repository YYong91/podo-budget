# UI 리디자인 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** HomeNRich 전체 프론트엔드를 웜 & 프렌들리 디자인으로 리뉴얼 (Amber 팔레트 + Stone neutral + Lucide 아이콘)

**Architecture:** Tailwind CSS v4 디자인 토큰(index.css)을 Amber 기반으로 교체하고, 모든 컴포넌트/페이지의 className을 새 토큰으로 일괄 변경. 이모지 아이콘을 Lucide React SVG로 교체.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 + Lucide React + Recharts

**설계서:** `docs/plans/2026-02-14-ui-redesign-design.md`

---

### Task 1: lucide-react 설치 + 디자인 토큰 변경

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/index.css`

**Step 1: lucide-react 설치**

Run: `cd frontend && npm install lucide-react`

**Step 2: index.css 디자인 토큰을 Amber로 변경**

```css
@import "tailwindcss";

@theme {
  --color-primary-50: #FFFBEB;
  --color-primary-100: #FEF3C7;
  --color-primary-200: #FDE68A;
  --color-primary-300: #FCD34D;
  --color-primary-400: #FBBF24;
  --color-primary-500: #F59E0B;
  --color-primary-600: #D97706;
  --color-primary-700: #B45309;
  --color-primary-800: #92400E;
  --color-primary-900: #78350F;

  /* 토스트 애니메이션 */
  --animate-slideIn: slideIn 0.3s ease-out;

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
}

body {
  margin: 0;
  min-width: 320px;
  font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont,
    system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo',
    'Noto Sans KR', 'Malgun Gothic', sans-serif;
}
```

**Step 3: 테스트 실행**

Run: `cd frontend && npm test -- --run`
Expected: 157 passed (토큰만 변경, 컴포넌트 미변경이므로 전부 통과)

**Step 4: 커밋**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/index.css
git commit -m "chore: lucide-react 설치 + Amber 디자인 토큰 적용"
```

---

### Task 2: 공통 컴포넌트 리디자인 (EmptyState, ErrorState, Toast, ProtectedRoute)

**Files:**
- Modify: `frontend/src/components/EmptyState.tsx`
- Modify: `frontend/src/components/ErrorState.tsx`
- Modify: `frontend/src/components/Toast.tsx`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/components/__tests__/EmptyState.test.tsx`
- Modify: `frontend/src/components/__tests__/ErrorState.test.tsx`

**Step 1: EmptyState — 이모지 → Lucide 아이콘 + warm 스타일**

icon prop 타입을 `React.ReactNode`로 변경 (string 이모지와 Lucide 컴포넌트 모두 지원).
기본 아이콘을 Lucide `Inbox`로 변경. 아이콘을 원형 amber 배경에 배치.
버튼 스타일을 amber 계열로.

```tsx
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        {icon ?? <Inbox className="w-8 h-8 text-amber-400" />}
      </div>
      <h3 className="text-lg font-semibold text-stone-900 mb-2 text-center">{title}</h3>
      {description && (
        <p className="text-sm text-stone-500 mb-6 text-center max-w-md">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className="px-5 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 active:scale-[0.98] transition-all shadow-sm shadow-amber-200"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-5 py-2.5 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 active:scale-[0.98] transition-all"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: EmptyState 테스트 수정**

기존 이모지 텍스트 검색 → Lucide SVG는 텍스트로 검색 불가. testId나 role 기반으로 변경.
`bg-primary-600` → `bg-amber-600`, `border-gray-300` → `border-stone-300`.

**Step 3: ErrorState — warm 스타일 + Lucide AlertTriangle 아이콘**

이모지 `⚠️` → Lucide `AlertTriangle`.
`bg-primary-600` → `bg-amber-600`.
`text-gray-*` → `text-stone-*`.

**Step 4: Toast — warm 스타일 + Lucide 아이콘**

토스트 아이콘을 Lucide로 교체: success=`Check`, error=`X`, warning=`AlertTriangle`, info=`Info`.
색상은 기존 semantic 색상 유지 (green/red/yellow/blue).

**Step 5: ProtectedRoute — 스피너 + 배경색 변경**

`bg-gray-50` → `bg-stone-50`.
`border-primary-600` → `border-amber-600`.
`text-gray-500` → `text-stone-500`.

**Step 6: 테스트 실행**

Run: `cd frontend && npm test -- --run`
Expected: 157 passed (EmptyState/ErrorState 테스트 className 조정 포함)

**Step 7: 커밋**

```bash
git add frontend/src/components/
git commit -m "refactor: 공통 컴포넌트 웜 디자인 적용 (EmptyState, ErrorState, Toast, ProtectedRoute)"
```

---

### Task 3: Layout 리디자인 (헤더 + 사이드바)

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/components/__tests__/Layout.test.tsx`
- Modify: `frontend/src/App.tsx` (PageLoading 스피너)

**Step 1: Layout.tsx 전면 리디자인**

주요 변경:
- 이모지 navItems → Lucide 아이콘 컴포넌트
- 헤더: `h-14` → `h-16`, amber gradient 하단 라인, `Home` 아이콘 로고
- 사이드바: `w-56` → `w-60`, `bg-stone-50`, amber 활성 메뉴
- `bg-gray-50` → `bg-stone-50` 전면 교체
- 가구 선택 드롭다운 amber 테마
- 햄버거 아이콘 → Lucide `Menu`
- 오버레이 유지

**Step 2: App.tsx PageLoading 스피너 변경**

`border-primary-600` → Lucide `Loader2` + `animate-spin text-amber-600`.

**Step 3: Layout 테스트 수정**

`text-gray-600` → `text-stone-600` 등 className 기반 assertion 수정.

**Step 4: 테스트 실행**

Run: `cd frontend && npm test -- --run`

**Step 5: 커밋**

```bash
git add frontend/src/components/Layout.tsx frontend/src/components/__tests__/Layout.test.tsx frontend/src/App.tsx
git commit -m "refactor: Layout 웜 디자인 적용 (Lucide 아이콘 + amber 사이드바)"
```

---

### Task 4: LoginPage 리디자인

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

**Step 1: LoginPage 전면 리디자인**

주요 변경:
- 배경: `bg-gray-50` → `bg-stone-50`
- 카드: `rounded-xl` → `rounded-2xl`
- 로고: Lucide `Home` 아이콘 + `text-amber-600`
- 서브카피: "부부가 함께 쓰는 AI 가계부"
- 탭 활성: `text-primary-600 border-primary-600` → `text-amber-600 border-amber-600`
- 입력 필드: `border-gray-300 focus:ring-primary-500` → `border-stone-300 focus:ring-amber-500/30 focus:border-amber-500 rounded-xl`
- 버튼: `bg-primary-600` → `bg-amber-600 rounded-xl shadow-sm shadow-amber-200`
- 텍스트: `text-gray-*` → `text-stone-*`
- 체크박스: `text-primary-600 focus:ring-primary-500` → `text-amber-600 focus:ring-amber-500`

**Step 2: 테스트 실행**

Run: `cd frontend && npm test -- --run`

**Step 3: 커밋**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "refactor: LoginPage 웜 디자인 적용"
```

---

### Task 5: Dashboard 리디자인

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Dashboard 전면 리디자인**

주요 변경:
- COLORS 배열 → 새 차트 팔레트 `['#D97706', '#0EA5E9', '#10B981', '#F43F5E', '#8B5CF6', '#EC4899', '#06B6D4', '#78716C']`
- 제목: `text-2xl font-bold text-gray-900` → `text-xl font-semibold text-stone-800`
- 총 지출 카드: `bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl`
- 나머지 카드: `bg-white rounded-2xl border border-stone-200/60 shadow-sm`
- 차트 카드: 동일한 card 스타일
- 카드 제목: `text-lg font-semibold text-gray-900` → `text-base font-semibold text-stone-700`
- 최근 지출 링크: `text-primary-600` → `text-amber-600`
- 라인 차트 stroke: `#4f46e5` → `#D97706`
- 스피너: Lucide `Loader2`
- 모든 `text-gray-*` → `text-stone-*`
- 카드 호버: `hover:shadow-md transition-shadow duration-200`

**Step 2: 테스트 실행**

Run: `cd frontend && npm test -- --run`

**Step 3: 커밋**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "refactor: Dashboard 웜 디자인 적용 (amber 그라데이션 + 새 차트 팔레트)"
```

---

### Task 6: ExpenseList + ExpenseDetail + ExpenseForm 리디자인

**Files:**
- Modify: `frontend/src/pages/ExpenseList.tsx`
- Modify: `frontend/src/pages/ExpenseDetail.tsx`
- Modify: `frontend/src/pages/ExpenseForm.tsx`

**Step 1: ExpenseList 리디자인**

주요 변경:
- 제목/카드/테이블 → stone + amber 토큰
- 테이블 헤더: `bg-gray-50` → `bg-stone-50`
- 정렬 아이콘 활성: `text-primary-600` → `text-amber-600`
- 행 호버: `hover:bg-gray-50` → `hover:bg-amber-50/50`
- 카테고리 뱃지: `bg-primary-50 text-primary-700` → `bg-amber-50 text-amber-700`
- 필터 입력: amber focus
- 페이지네이션: `border-gray-300` → `border-stone-300`
- 모든 `text-gray-*` → `text-stone-*`

**Step 2: ExpenseDetail 리디자인**

- 뒤로가기 `←` → Lucide `ArrowLeft`
- 카드 `rounded-xl` → `rounded-2xl`
- 수정 버튼: `text-primary-700 bg-primary-50` → `text-amber-700 bg-amber-50`
- 삭제 버튼: `text-red-700` → `text-rose-700`
- 입력 필드: amber focus
- 모달: `rounded-xl` → `rounded-2xl`, `bg-red-600` → `bg-rose-600`
- 텍스트: stone 계열

**Step 3: ExpenseForm 리디자인**

- 뒤로가기 → Lucide `ArrowLeft`
- 모드 탭: `bg-primary-600` → `bg-amber-600`
- textarea: `bg-amber-50/50` 배경
- 프리뷰 배너: `bg-blue-50 border-blue-200` → `bg-sky-50 border-sky-200`
- 프리뷰 카드: `border-l-4 border-amber-400` 추가
- CTA: amber 계열
- 입력 필드: amber focus
- 텍스트: stone 계열

**Step 4: 테스트 실행**

Run: `cd frontend && npm test -- --run`

**Step 5: 커밋**

```bash
git add frontend/src/pages/ExpenseList.tsx frontend/src/pages/ExpenseDetail.tsx frontend/src/pages/ExpenseForm.tsx
git commit -m "refactor: 지출 페이지 3종 웜 디자인 적용"
```

---

### Task 7: CategoryManager + BudgetManager + InsightsPage 리디자인

**Files:**
- Modify: `frontend/src/pages/CategoryManager.tsx`
- Modify: `frontend/src/pages/BudgetManager.tsx`
- Modify: `frontend/src/pages/InsightsPage.tsx`

**Step 1: CategoryManager 리디자인**

- 제목/카드/테이블 → stone + amber 토큰
- 추가 버튼: amber
- 편집 행: `bg-primary-50` → `bg-amber-50`
- 수정 버튼: `text-primary-700 bg-primary-50` → `text-amber-700 bg-amber-50`
- 삭제 버튼: `text-red-700 bg-red-50` → `text-rose-700 bg-rose-50`
- 모달: rose 계열
- EmptyState 호출에서 이모지 prop 제거 (기본 Lucide 아이콘 사용) 또는 Lucide 아이콘 전달

**Step 2: BudgetManager 리디자인**

- 동일 패턴 적용
- 알림 카드: 이모지 `🔔` → Lucide `Bell`
- 프로그레스 바 색상: `bg-red-500` → `bg-rose-500`, `bg-green-500` → `bg-emerald-500`
- 경고 이모지 `⚠️` → Lucide `AlertTriangle` 사용 또는 제거
- EmptyState 이모지 제거

**Step 3: InsightsPage 리디자인**

- 이모지 `💡` → Lucide `Sparkles` 또는 `TrendingUp`
- 총 지출 카드: `bg-primary-50` → `bg-amber-50`, `text-primary-700` → `text-amber-700`
- 프로그레스 바: `bg-primary-600` → `bg-amber-600`
- 스피너: Lucide `Loader2`
- EmptyState 이모지 제거
- 텍스트: stone 계열

**Step 4: 테스트 실행**

Run: `cd frontend && npm test -- --run`
Note: InsightsPage 테스트에 `bg-primary-600` assertion이 있을 수 있음 → 수정 필요

**Step 5: 커밋**

```bash
git add frontend/src/pages/CategoryManager.tsx frontend/src/pages/BudgetManager.tsx frontend/src/pages/InsightsPage.tsx
git commit -m "refactor: 카테고리/예산/인사이트 페이지 웜 디자인 적용"
```

---

### Task 8: Household + Invitation 페이지 리디자인

**Files:**
- Modify: `frontend/src/pages/HouseholdListPage.tsx`
- Modify: `frontend/src/pages/HouseholdDetailPage.tsx`
- Modify: `frontend/src/pages/InvitationListPage.tsx`
- Modify: `frontend/src/pages/AcceptInvitationPage.tsx`
- Modify: `frontend/src/components/CreateHouseholdModal.tsx`
- Modify: `frontend/src/components/InviteMemberModal.tsx`

**Step 1: HouseholdListPage 리디자인**

- 카드: `rounded-xl` → `rounded-2xl`, amber hover border
- `hover:border-primary-300` → `hover:border-amber-300`
- 이모지 `👥`, `📅` → Lucide `Users`, `Calendar`
- 추가 버튼: amber
- EmptyState 이모지 제거
- 역할 뱃지: 기존 색상 유지 (purple/blue/gray — 시맨틱)

**Step 2: HouseholdDetailPage 리디자인**

- 뒤로가기 `←` → Lucide `ArrowLeft`
- 탭 활성: `border-primary-600 text-primary-600` → `border-amber-600 text-amber-600`
- 테이블: stone 계열
- 초대 버튼: amber
- 위험 영역: `border-red-200` → `border-rose-200`
- 입력: amber focus
- 텍스트: stone 계열

**Step 3: InvitationListPage 리디자인**

- 뒤로가기 → Lucide `ArrowLeft`
- 카드: `rounded-xl` → `rounded-2xl`
- 수락 버튼: amber
- EmptyState 이모지 제거
- 텍스트: stone 계열

**Step 4: AcceptInvitationPage 리디자인**

- 동일 패턴 (amber CTA, stone neutral)

**Step 5: CreateHouseholdModal + InviteMemberModal 리디자인**

- 모달: `rounded-xl` → `rounded-2xl`
- 제목: `text-gray-900` → `text-stone-900`
- 입력: amber focus
- 버튼: amber
- 에러: `bg-red-50 border-red-200 text-red-600` → `bg-rose-50 border-rose-200 text-rose-600`
- 텍스트: stone 계열

**Step 6: 테스트 실행**

Run: `cd frontend && npm test -- --run`

**Step 7: 커밋**

```bash
git add frontend/src/pages/HouseholdListPage.tsx frontend/src/pages/HouseholdDetailPage.tsx frontend/src/pages/InvitationListPage.tsx frontend/src/pages/AcceptInvitationPage.tsx frontend/src/components/CreateHouseholdModal.tsx frontend/src/components/InviteMemberModal.tsx
git commit -m "refactor: Household/Invitation 페이지 + 모달 웜 디자인 적용"
```

---

### Task 9: SettingsPage + 정적 페이지 리디자인

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/PrivacyPolicyPage.tsx`
- Modify: `frontend/src/pages/TermsOfServicePage.tsx`

**Step 1: SettingsPage 리디자인**

- 카드: `rounded-xl` → `rounded-2xl`
- 경고: `bg-red-50 border-red-200` → `bg-rose-50 border-rose-200`
- 삭제 버튼: `bg-red-600` → `bg-rose-600`
- 모달: `rounded-2xl`, rose 계열
- 텍스트: stone 계열

**Step 2: PrivacyPolicyPage / TermsOfServicePage**

- `text-gray-*` → `text-stone-*`
- 링크: `text-primary-600` → `text-amber-600`

**Step 3: 테스트 실행**

Run: `cd frontend && npm test -- --run`

**Step 4: 커밋**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/pages/PrivacyPolicyPage.tsx frontend/src/pages/TermsOfServicePage.tsx
git commit -m "refactor: 설정/정책 페이지 웜 디자인 적용"
```

---

### Task 10: 최종 검증 + 빌드 확인

**Step 1: 전체 테스트 실행**

Run: `cd frontend && npm test -- --run`
Expected: 157 passed (전부 통과)

**Step 2: TypeScript 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

**Step 3: 개발 서버에서 육안 확인**

Run: `cd frontend && npm run dev`
주요 확인:
- 로그인 페이지 amber 테마
- 대시보드 amber 그라데이션 카드
- 사이드바 Lucide 아이콘
- 지출 입력 프리뷰
- 모달 디자인

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: UI 전체 리디자인 완료 — 웜 & 프렌들리 Amber 테마"
```

---

## 파일 변경 요약

| 카테고리 | 파일 수 | 파일 목록 |
|----------|---------|----------|
| CSS | 1 | index.css |
| 컴포넌트 | 4 | EmptyState, ErrorState, Toast, ProtectedRoute |
| 레이아웃 | 2 | Layout, App |
| 모달 | 2 | CreateHouseholdModal, InviteMemberModal |
| 페이지 | 13 | LoginPage, Dashboard, ExpenseList, ExpenseDetail, ExpenseForm, CategoryManager, BudgetManager, InsightsPage, HouseholdListPage, HouseholdDetailPage, InvitationListPage, AcceptInvitationPage, SettingsPage, PrivacyPolicyPage, TermsOfServicePage |
| 테스트 | 3+ | EmptyState.test, ErrorState.test, Layout.test + 기타 className assertion |
| **합계** | **~25** | |

## 의존성

- Task 1 (토큰 + lucide-react) → 나머지 모든 Task의 선행 조건
- Task 2 (공통 컴포넌트) → Task 3~9에서 사용하므로 먼저 완료
- Task 3 (Layout) → 독립적이지만 가장 눈에 띄므로 일찍 진행
- Task 4~9 → 상호 독립적 (병렬 가능하나 순차 권장)
- Task 10 → 모든 Task 완료 후 최종 검증

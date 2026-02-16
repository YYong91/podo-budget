# 포도가계부(Podo Budget) 리브랜딩 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** HomeNRich를 포도가계부(Podo Budget)로 리브랜딩한다. 포도책방과 동일한 grape 컬러 시스템, cream 배경, 성장 메타포를 적용한다.

**Architecture:** 순수 프론트엔드 변경. 백엔드는 건드리지 않는다. CSS 테마 교체 → Tailwind 클래스 일괄 치환 → 브랜딩 텍스트 교체 → 성장 메타포 UI 추가 순서로 진행한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (@theme), Vitest, Chart.js

---

## Part 1: CSS 테마 + 브랜딩

### Task 1: index.css @theme 교체

**Files:**
- Modify: `frontend/src/index.css`

**Step 1:** `frontend/src/index.css`의 `@theme` 블록을 포도책방 팔레트로 전면 교체

현재 Amber primary 팔레트를 삭제하고 아래로 교체:

```css
@import "tailwindcss";

@theme {
  /* Grape Purple (Primary) */
  --color-grape-50:  #faf5ff;
  --color-grape-100: #f3e8ff;
  --color-grape-200: #e9d5ff;
  --color-grape-300: #d8b4fe;
  --color-grape-400: #c084fc;
  --color-grape-500: #a855f7;
  --color-grape-600: #9333ea;
  --color-grape-700: #7c3aed;
  --color-grape-800: #6b21a8;
  --color-grape-900: #581c87;

  /* Leaf Green (수입/긍정) */
  --color-leaf-50:  #f0fdf4;
  --color-leaf-100: #dcfce7;
  --color-leaf-200: #bbf7d0;
  --color-leaf-300: #86efac;
  --color-leaf-400: #4ade80;
  --color-leaf-500: #22c55e;
  --color-leaf-600: #16a34a;
  --color-leaf-700: #15803d;

  /* Warm Neutrals */
  --color-cream:    #fefce8;
  --color-warm-50:  #fafaf9;
  --color-warm-100: #f5f5f4;
  --color-warm-200: #e7e5e4;
  --color-warm-300: #d6d3d1;
  --color-warm-400: #a8a29e;
  --color-warm-500: #78716c;
  --color-warm-600: #57534e;
  --color-warm-700: #44403c;
  --color-warm-800: #292524;
  --color-warm-900: #1c1917;

  /* 애니메이션 */
  --animate-slideIn: slideIn 0.3s ease-out;
  --animate-grape-pop: grape-pop 0.4s ease-out;
  --animate-bounce-in: bounce-in 0.3s ease-out;

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes grape-pop {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.2); }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes bounce-in {
    0% { transform: translateY(20px); opacity: 0; }
    60% { transform: translateY(-5px); }
    100% { transform: translateY(0); opacity: 1; }
  }
}

body {
  margin: 0;
  min-width: 320px;
  font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont,
    system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo',
    'Noto Sans KR', 'Malgun Gothic', sans-serif;
  background-color: var(--color-cream);
  color: var(--color-warm-900);
}
```

**Step 2:** 테스트 실행

```bash
cd frontend && npm run build
```

기대: 빌드 성공 (아직 클래스 치환 전이므로 amber 등은 Tailwind 기본 팔레트로 동작)

**Step 3:** 커밋

```bash
git add frontend/src/index.css
git commit -m "style: 포도가계부 컬러 테마 적용 (grape/leaf/warm/cream)"
```

---

### Task 2: Tailwind 클래스 일괄 치환 - amber → grape

모든 파일에서 `amber` 를 `grape` 로 일괄 치환한다.

**Files:** (30개 파일)
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/ExpenseList.tsx`
- Modify: `frontend/src/pages/ExpenseDetail.tsx`
- Modify: `frontend/src/pages/ExpenseForm.tsx`
- Modify: `frontend/src/pages/InsightsPage.tsx`
- Modify: `frontend/src/pages/RecurringList.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/ForgotPasswordPage.tsx`
- Modify: `frontend/src/pages/ResetPasswordPage.tsx`
- Modify: `frontend/src/pages/NotFoundPage.tsx`
- Modify: `frontend/src/pages/PrivacyPolicyPage.tsx`
- Modify: `frontend/src/pages/TermsOfServicePage.tsx`
- Modify: `frontend/src/pages/HouseholdDetailPage.tsx`
- Modify: `frontend/src/pages/HouseholdListPage.tsx`
- Modify: `frontend/src/pages/InvitationListPage.tsx`
- Modify: `frontend/src/pages/AcceptInvitationPage.tsx`
- Modify: `frontend/src/pages/BudgetManager.tsx`
- Modify: `frontend/src/pages/CategoryManager.tsx`
- Modify: `frontend/src/components/EmptyState.tsx`
- Modify: `frontend/src/components/ErrorState.tsx`
- Modify: `frontend/src/components/InviteMemberModal.tsx`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/components/CreateHouseholdModal.tsx`
- Modify: `frontend/src/components/stats/StatsSummaryCards.tsx`
- Modify: `frontend/src/components/stats/CategoryBreakdown.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: 테스트 파일들 (amber 텍스트 매칭하는 경우)

**Step 1:** 전체 치환 실행

모든 `.tsx`, `.ts` 파일에서:
- `amber` → `grape` (모든 shade: amber-50, amber-100, ... amber-900)
- `orange` → 삭제 필요한 곳만 수동 확인 (gradient에서 `from-amber-50 to-orange-50` → `from-grape-50 to-grape-100`)

주의: `amber` 텍스트가 아닌 Tailwind 클래스 컨텍스트에서만 치환. 일반 텍스트 "amber"가 있는지 먼저 확인.

Dashboard.tsx의 Chart.js 색상 상수도 변경:
```typescript
// 현재
const COLORS = ['#D97706', '#0EA5E9', '#10B981', '#F43F5E', '#8B5CF6', '#EC4899', '#06B6D4', '#78716C']
// 변경: 첫 번째 색상을 grape-600으로
const COLORS = ['#9333EA', '#0EA5E9', '#10B981', '#F43F5E', '#8B5CF6', '#EC4899', '#06B6D4', '#78716C']
```

Dashboard.tsx의 Line 차트 색상:
```typescript
// 현재
borderColor: '#D97706',
backgroundColor: 'rgba(217, 119, 6, 0.1)',
pointBackgroundColor: '#D97706',
// 변경: grape-600
borderColor: '#9333EA',
backgroundColor: 'rgba(147, 51, 234, 0.1)',
pointBackgroundColor: '#9333EA',
```

**Step 2:** orange 관련 정리

`to-orange-50` 같은 gradient 보조색을 `to-grape-100`으로 변경.

**Step 3:** 누락 확인

```bash
cd frontend && grep -r "amber" src/ --include="*.tsx" --include="*.ts" -l
```

기대: 결과 없음

**Step 4:** 빌드 + 테스트

```bash
cd frontend && npm run build && npm test -- --run
```

**Step 5:** 커밋

```bash
git add -u frontend/src/
git commit -m "style: amber → grape 컬러 전환"
```

---

### Task 3: Tailwind 클래스 일괄 치환 - emerald → leaf

수입/긍정 표시에 사용되는 `emerald` 를 `leaf` 로 치환한다.

**Files:** (9개 파일)
- Modify: `frontend/src/pages/IncomeList.tsx`
- Modify: `frontend/src/pages/IncomeDetail.tsx`
- Modify: `frontend/src/pages/IncomeForm.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/RecurringList.tsx`
- Modify: `frontend/src/pages/InsightsPage.tsx`
- Modify: `frontend/src/pages/BudgetManager.tsx`
- Modify: `frontend/src/components/stats/StatsSummaryCards.tsx`
- Modify: `frontend/src/components/stats/ChangeIndicator.tsx`

**Step 1:** 전체 치환

모든 파일에서 `emerald` → `leaf` (모든 shade).

Dashboard.tsx의 `to-green-50` → `to-leaf-100` (gradient 보조색).

**Step 2:** 누락 확인

```bash
cd frontend && grep -r "emerald" src/ --include="*.tsx" --include="*.ts" -l
```

기대: 결과 없음

**Step 3:** 빌드 + 테스트

```bash
cd frontend && npm run build && npm test -- --run
```

**Step 4:** 커밋

```bash
git add -u frontend/src/
git commit -m "style: emerald → leaf 컬러 전환"
```

---

### Task 4: Tailwind 클래스 일괄 치환 - stone → warm

중립색 `stone` 을 `warm` 으로 치환한다.

**Files:** (36개 파일 - 가장 많은 파일 영향)

**Step 1:** 전체 치환

모든 `.tsx`, `.ts` 파일에서 `stone-` → `warm-` (하이픈 포함하여 정확히 매칭).

주의: `stone` 단독은 건드리지 않음. `keystone` 같은 단어가 있으면 제외.

**Step 2:** 배경색 변경

Layout.tsx에서:
- `bg-stone-50` (페이지 배경) → `bg-cream`
- `bg-stone-50` (사이드바 배경) → `bg-cream`

페이지 레벨의 `bg-white` 는 유지 (카드 배경). `bg-cream` 은 전체 페이지 배경에만 적용.

**Step 3:** 누락 확인

```bash
cd frontend && grep -r "stone-" src/ --include="*.tsx" --include="*.ts" -l
```

기대: 결과 없음

**Step 4:** 빌드 + 테스트

```bash
cd frontend && npm run build && npm test -- --run
```

**Step 5:** 커밋

```bash
git add -u frontend/src/
git commit -m "style: stone → warm 중립색 전환 + cream 배경"
```

---

### Task 5: 브랜딩 텍스트 + PWA 메타 교체

모든 "HomeNRich" 텍스트를 "포도가계부"로 변경한다.

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/ForgotPasswordPage.tsx`
- Modify: `frontend/src/pages/ResetPasswordPage.tsx`
- Modify: `frontend/src/pages/PrivacyPolicyPage.tsx`
- Modify: `frontend/src/pages/TermsOfServicePage.tsx`
- Modify: `frontend/package.json`
- Modify: 테스트 파일 (Layout.test.tsx, LoginPage.test.tsx, ForgotPasswordPage.test.tsx, ResetPasswordPage.test.tsx)

**Step 1:** `frontend/index.html`

```html
<meta name="theme-color" content="#7c3aed" />
<title>포도가계부 - AI 가계부</title>
```

**Step 2:** `frontend/vite.config.ts` PWA manifest

```typescript
manifest: {
  name: '포도가계부 - AI 가계부',
  short_name: '포도가계부',
  description: '포도알처럼 하나씩, 알찬 가계부',
  theme_color: '#7c3aed',
  background_color: '#fefce8',
  // ... 나머지 동일
}
```

**Step 3:** `frontend/src/components/Layout.tsx` 헤더

```tsx
<Link to="/" className="flex items-center gap-2 text-lg font-bold text-grape-700">
  🍇
  포도가계부
</Link>
<span className="text-xs text-warm-400 hidden sm:inline">AI 가계부</span>
```

`Home` 아이콘을 포도 이모지 `🍇`로 교체. lucide-react에서 `Home` import 제거 (사이드바 가구 부분에서도 쓰는지 확인 — 쓰면 유지).

**Step 4:** 로그인/비밀번호 페이지

LoginPage.tsx, ForgotPasswordPage.tsx, ResetPasswordPage.tsx에서:
```tsx
<h1 className="text-2xl font-bold text-grape-700">🍇 포도가계부</h1>
```

**Step 5:** 약관/개인정보 페이지

PrivacyPolicyPage.tsx, TermsOfServicePage.tsx에서:
- `HomeNRich` → `포도가계부`
- `homenrich.example.com` → `podobudget.com`

**Step 6:** `frontend/package.json`

```json
"name": "podo-budget",
```

**Step 7:** 테스트 파일 업데이트

- `Layout.test.tsx`: `'HomeNRich'` → `'포도가계부'`
- `LoginPage.test.tsx`: `'HomeNRich'` → `'포도가계부'`
- `ForgotPasswordPage.test.tsx`: `'HomeNRich'` → `'포도가계부'`
- `ResetPasswordPage.test.tsx`: `'HomeNRich'` → `'포도가계부'`

**Step 8:** 누락 확인

```bash
cd frontend && grep -r "HomeNRich\|homenrich" src/ --include="*.tsx" --include="*.ts" -l
```

기대: 결과 없음 (fly.toml, nginx.conf는 배포 설정이므로 추후)

**Step 9:** 빌드 + 테스트

```bash
cd frontend && npm run build && npm test -- --run
```

**Step 10:** 커밋

```bash
git add frontend/index.html frontend/vite.config.ts frontend/package.json frontend/src/
git commit -m "chore: HomeNRich → 포도가계부 브랜딩 교체"
```

---

## Part 2: 성장 메타포

### Task 6: GrapeProgress 컴포넌트 생성

대시보드에 표시할 포도알 성장 카드를 만든다.

**Files:**
- Create: `frontend/src/components/GrapeProgress.tsx`

**Step 1:** 컴포넌트 생성

```tsx
/**
 * 포도알 성장 카드
 * 이번 달 거래 건수를 포도알로 시각화한다.
 * 10개 = 1 포도송이
 */

import { useMemo } from 'react'

interface GrapeProgressProps {
  /** 이번 달 거래 건수 (지출 + 수입) */
  count: number
}

export default function GrapeProgress({ count }: GrapeProgressProps) {
  const bunches = Math.floor(count / 10)
  const remaining = count % 10

  // 포도알 10개 배열 (채워진 것과 빈 것)
  const grapes = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => i < remaining)
  }, [remaining])

  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-warm-700">이번 달 포도알</h2>
        <span className="text-sm text-warm-500">
          {bunches > 0 && `🍇 ×${bunches} + `}
          {remaining}/10
        </span>
      </div>

      {/* 포도알 시각화 */}
      <div className="flex items-center justify-center gap-1.5 py-3">
        {grapes.map((filled, i) => (
          <div
            key={i}
            className={`w-7 h-7 rounded-full transition-all duration-300 ${
              filled
                ? 'bg-grape-600 shadow-sm shadow-grape-300 animate-grape-pop'
                : 'bg-grape-200'
            }`}
            style={filled ? { animationDelay: `${i * 50}ms` } : undefined}
          />
        ))}
      </div>

      {/* 안내 메시지 */}
      <p className="text-center text-sm text-warm-500 mt-2">
        {remaining === 0 && count === 0
          ? '첫 번째 거래를 기록하고 포도알을 심어보세요!'
          : remaining === 0
            ? `🍇 포도송이 ${bunches}개 완성! 다음 송이를 시작하세요`
            : `포도송이까지 ${10 - remaining}개 남았어요`
        }
      </p>

      {/* 완성된 송이 표시 */}
      {bunches > 0 && (
        <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-warm-100">
          {Array.from({ length: Math.min(bunches, 10) }, (_, i) => (
            <span key={i} className="text-lg">🍇</span>
          ))}
          {bunches > 10 && (
            <span className="text-sm text-warm-500 ml-1">+{bunches - 10}</span>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2:** 빌드 확인

```bash
cd frontend && npm run build
```

**Step 3:** 커밋

```bash
git add frontend/src/components/GrapeProgress.tsx
git commit -m "feat: GrapeProgress 포도알 성장 카드 컴포넌트"
```

---

### Task 7: 대시보드에 성장 카드 통합

Dashboard.tsx에 GrapeProgress를 추가한다.

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1:** import 추가

```tsx
import GrapeProgress from '../components/GrapeProgress'
```

**Step 2:** StatsCards 아래, PendingRecurring 위에 배치

```tsx
{stats && <StatsCards stats={stats} incomeTotal={incomeStats?.total} />}

{/* 포도알 성장 카드 */}
<GrapeProgress count={(stats?.daily_trend?.reduce((sum, d) => {
  // daily_trend의 일수를 거래 건수 근사치로 사용
  // 정확한 count는 stats.count (추후 API에서 제공 시 교체)
  return sum + (d.amount > 0 ? 1 : 0)
}, 0) ?? 0) + (incomeStats?.count ?? 0)} />

{/* 정기 거래 알림 */}
<PendingRecurring ... />
```

참고: 현재 monthly stats API에는 정확한 거래 건수가 없다. `daily_trend`의 날짜 수 + `incomeStats.count`를 근사치로 사용한다. 추후 API에 `expense_count` 필드를 추가하면 교체.

더 정확한 방법: `recentExpenses`와 `recentIncomes`의 총 건수를 API의 전체 count로 쓸 수 있지만, 현재 API가 paginated list만 반환하므로 stats의 count를 사용한다. `mockMonthlyStats`에 count 필드가 없으므로 `daily_trend.length`를 쓴다.

실제로는 ExpenseList API가 전체 count를 반환하지 않으므로, **가장 간단한 접근**: `stats.by_category`의 각 count 합산 (StatsResponse에는 count가 있음) 또는 income stats의 count.

최종 결정: `incomeStats?.count`(수입 건수) + `stats?.by_category?.length`(지출 카테고리 수는 아님)는 정확하지 않다.

**가장 실용적 접근:**
```tsx
// expenses count = daily_trend에서 amount > 0인 날 수 (근사치)
// income count = incomeStats?.count ?? 0
const expenseCount = stats?.daily_trend?.filter(d => d.amount > 0).length ?? 0
const incomeCount = incomeStats?.count ?? 0
```

이 근사치로 시작하고, 추후 BE API에 정확한 월별 거래 건수를 추가하면 교체.

**Step 3:** 빌드 + 테스트

```bash
cd frontend && npm run build && npm test -- --run
```

**Step 4:** 커밋

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: 대시보드에 포도알 성장 카드 추가"
```

---

### Task 8: 사이드바 성장 요약

Layout.tsx 사이드바 하단에 포도알 카운트를 표시한다.

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1:** nav 아래에 성장 요약 추가

```tsx
{/* 사이드바 하단 - 포도알 요약 */}
<div className="mt-auto pt-4 border-t border-warm-200 text-sm text-warm-500">
  <div className="flex items-center gap-2 px-3">
    <span>🍇</span>
    <span>포도알처럼 하나씩</span>
  </div>
</div>
```

이것은 정적 태그라인이다. 실제 거래 건수를 사이드바에서 표시하려면 전역 상태나 API 호출이 필요한데, 사이드바에서 API를 호출하는 것은 과도하다. 태그라인만 표시한다.

**Step 2:** 빌드 + 테스트

```bash
cd frontend && npm run build && npm test -- --run
```

**Step 3:** 커밋

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: 사이드바에 포도가계부 태그라인 추가"
```

---

### Task 9: 거래 등록 토스트 메시지

지출/수입 저장 시 포도알 토스트를 표시한다.

**Files:**
- Modify: `frontend/src/pages/ExpenseForm.tsx`
- Modify: `frontend/src/pages/IncomeForm.tsx`

**Step 1:** ExpenseForm.tsx 저장 성공 토스트 변경

현재 토스트 메시지를 찾아서 포도알 메시지로 변경:
```tsx
addToast('success', '🍇 포도알 +1! 지출이 저장되었습니다')
```

**Step 2:** IncomeForm.tsx 저장 성공 토스트 변경

```tsx
addToast('success', '🍇 포도알 +1! 수입이 저장되었습니다')
```

**Step 3:** 테스트 실행

```bash
cd frontend && npm test -- --run
```

테스트에서 토스트 메시지를 검증하는 부분이 있으면 업데이트.

**Step 4:** 커밋

```bash
git add frontend/src/pages/ExpenseForm.tsx frontend/src/pages/IncomeForm.tsx
git commit -m "feat: 거래 저장 시 포도알 토스트 메시지"
```

---

## Part 3: 테스트 & 문서

### Task 10: GrapeProgress 테스트 작성

**Files:**
- Create: `frontend/src/components/__tests__/GrapeProgress.test.tsx`

**Step 1:** 테스트 작성

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GrapeProgress from '../GrapeProgress'

describe('GrapeProgress', () => {
  it('거래 0건일 때 첫 거래 안내 메시지를 표시한다', () => {
    render(<GrapeProgress count={0} />)
    expect(screen.getByText(/첫 번째 거래를 기록하고/)).toBeInTheDocument()
  })

  it('포도알 진행 상태를 표시한다 (7/10)', () => {
    render(<GrapeProgress count={7} />)
    expect(screen.getByText('7/10')).toBeInTheDocument()
    expect(screen.getByText(/포도송이까지 3개 남았어요/)).toBeInTheDocument()
  })

  it('포도송이 완성 시 축하 메시지를 표시한다', () => {
    render(<GrapeProgress count={10} />)
    expect(screen.getByText(/포도송이 1개 완성/)).toBeInTheDocument()
  })

  it('여러 송이 + 잔여 포도알을 표시한다', () => {
    render(<GrapeProgress count={23} />)
    expect(screen.getByText(/×2/)).toBeInTheDocument()
    expect(screen.getByText('3/10')).toBeInTheDocument()
  })

  it('제목을 표시한다', () => {
    render(<GrapeProgress count={5} />)
    expect(screen.getByText('이번 달 포도알')).toBeInTheDocument()
  })
})
```

**Step 2:** 테스트 실행

```bash
cd frontend && npm test -- --run src/components/__tests__/GrapeProgress.test.tsx
```

**Step 3:** 커밋

```bash
git add frontend/src/components/__tests__/GrapeProgress.test.tsx
git commit -m "test: GrapeProgress 포도알 성장 카드 테스트"
```

---

### Task 11: 전체 검증 + 문서 업데이트

**Files:**
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `CLAUDE.md`

**Step 1:** 전체 테스트

```bash
cd frontend && npm test -- --run
```

기대: 전체 통과

**Step 2:** 빌드 확인

```bash
cd frontend && npm run build
```

기대: 빌드 성공

**Step 3:** 잔여 컬러 확인

```bash
cd frontend && grep -r "amber\|emerald\|stone-\|HomeNRich" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules
```

기대: 결과 없음

**Step 4:** IMPLEMENTATION_STATUS.md 업데이트

- 리브랜딩 섹션 추가 (포도가계부, grape 테마, 성장 메타포)
- 테스트 수치 업데이트

**Step 5:** CLAUDE.md 업데이트

- 프로젝트명: HomeNRich → 포도가계부 (Podo Budget)
- 컬러 시스템: Amber/Stone → Grape/Leaf/Warm/Cream
- 성장 메타포 설명 추가

**Step 6:** 커밋

```bash
git add docs/IMPLEMENTATION_STATUS.md CLAUDE.md
git commit -m "docs: 포도가계부 리브랜딩 문서 업데이트"
```

---

## 요약

| Task | 설명 | 예상 파일 수 |
|------|------|------------|
| 1 | CSS @theme 교체 | 1 |
| 2 | amber → grape 치환 | ~30 |
| 3 | emerald → leaf 치환 | ~9 |
| 4 | stone → warm 치환 | ~36 |
| 5 | 브랜딩 텍스트 + PWA | ~14 |
| 6 | GrapeProgress 컴포넌트 | 1 |
| 7 | 대시보드 성장 카드 통합 | 1 |
| 8 | 사이드바 태그라인 | 1 |
| 9 | 거래 토스트 메시지 | 2 |
| 10 | GrapeProgress 테스트 | 1 |
| 11 | 전체 검증 + 문서 | 2 |

**총 11개 Task, ~40개 파일 변경**

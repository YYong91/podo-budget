# 홈 화면 UI 개선 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 히어로카드 예산 프로그레스 바, 세그먼트 필터 스타일, 미니캘린더 주간 스트립+도트 인디케이터를 구현하여 홈 화면 완성도를 높인다.

**Architecture:** 기존 컴포넌트 3개(HeroSummary, MonthlyView, MiniCalendar)를 수정. 새 컴포넌트 없음, 데이터 흐름 변경 없음. TDD로 각 변경사항을 테스트 먼저 작성.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest, React Testing Library

**스펙 문서:** `docs/superpowers/specs/2026-04-07-home-ui-polish-design.md` (feature/home-ui-polish 브랜치)

---

## Task 1: HeroSummary — budgetRatio prop + 프로그레스 바

**Files:**
- Modify: `frontend/src/components/stats/HeroSummary.tsx`
- Modify: `frontend/src/components/stats/__tests__/HeroSummary.test.tsx`

**Step 1: 실패하는 테스트 작성**

`HeroSummary.test.tsx`에 추가:

```typescript
it('budgetRatio가 주어지면 프로그레스 바를 렌더링한다', () => {
  render(<HeroSummary label="4월 지출" amount={500000} budgetRatio={0.45} />)
  const progressBar = document.querySelector('[role="progressbar"]')
  expect(progressBar).not.toBeNull()
  expect(screen.getByText('45%')).toBeInTheDocument()
})

it('budgetRatio 80% 이상이면 경고 색상을 적용한다', () => {
  render(<HeroSummary label="4월 지출" amount={900000} budgetRatio={0.9} />)
  const fill = document.querySelector('[role="progressbar"] > div > div > div')
  expect(fill?.className).toContain('bg-amber-400')
})

it('budgetRatio 100% 초과이면 위험 색상을 적용한다', () => {
  render(<HeroSummary label="4월 지출" amount={1200000} budgetRatio={1.2} />)
  const fill = document.querySelector('[role="progressbar"] > div > div > div')
  expect(fill?.className).toContain('bg-red-400')
})

it('budgetRatio가 없으면 프로그레스 바를 렌더링하지 않는다', () => {
  render(<HeroSummary label="4월 지출" amount={500000} />)
  const progressBar = document.querySelector('[role="progressbar"]')
  expect(progressBar).toBeNull()
})

it('sublabelLoading=true이면 프로그레스 바 영역을 invisible로 예약한다', () => {
  render(<HeroSummary label="4월 지출" amount={500000} sublabelLoading budgetRatio={0.5} />)
  const progressBar = document.querySelector('[role="progressbar"]')
  expect(progressBar?.className).toContain('invisible')
})
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/HeroSummary.test.tsx
```

**Step 3: HeroSummary.tsx 구현**

기존 `interface` 유지하면서 `budgetRatio` prop 추가:

```typescript
// 기존 interface에 추가
interface HeroSummaryProps {
  label: string
  amount: number
  sublabel?: string
  sublabelLoading?: boolean
  budgetRatio?: number  // 0~1+ (예산 대비 지출 비율)
  children?: ReactNode
  className?: string
}
```

sublabel 아래, children 위에 프로그레스 바 렌더링:

```typescript
{budgetRatio != null && (
  <div
    role="progressbar"
    aria-valuenow={Math.round(budgetRatio * 100)}
    className={`mt-3 ${sublabelLoading ? 'invisible' : ''}`}
  >
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            budgetRatio >= 1 ? 'bg-red-400' : budgetRatio >= 0.8 ? 'bg-amber-400' : 'bg-grape-400'
          }`}
          style={{ width: `${Math.min(Math.round(budgetRatio * 100), 100)}%` }}
        />
      </div>
      <span className="text-xs text-[var(--text-muted)] tabular-nums">
        {Math.round(budgetRatio * 100)}%
      </span>
    </div>
  </div>
)}
```

카드 컨테이너에 그라데이션 배경 추가 (다크모드 포함):
```typescript
// 기존: className={`card-surface p-6 ${className}`}
// 변경:
className={`card-surface p-6 bg-gradient-to-b from-grape-50/60 to-transparent dark:from-grape-900/30 dark:to-transparent ${className}`}
```

**Step 4: 테스트 실행 → 통과 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/HeroSummary.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/HeroSummary.tsx frontend/src/components/stats/__tests__/HeroSummary.test.tsx
git commit -m "feat: 히어로카드 예산 프로그레스 바 + 그라데이션 배경"
```

---

## Task 2: MonthlyView — budgetRatio 전달 + 세그먼트 필터 스타일

**Files:**
- Modify: `frontend/src/components/transaction/MonthlyView.tsx`
- Modify: `frontend/src/components/transaction/__tests__/MonthlyView.test.tsx`

**Step 1: MSW budget handler 확인**

먼저 `frontend/src/mocks/handlers.ts`에서 budget API 핸들러가 `totalBudget` 값을 반환하는지 확인.
없으면 테스트에서 MSW override로 budget 데이터를 설정.

**Step 2: 실패하는 테스트 작성**

`MonthlyView.test.tsx`에 추가:

```typescript
it('예산이 설정되면 프로그레스 바가 표시된다', async () => {
  // 기본 MSW handler는 total_monthly_budget: null → override 필요
  server.use(
    http.get('/api/budgets/total-budget', () =>
      HttpResponse.json({ total_monthly_budget: 500000 })
    ),
  )
  render(<TransactionList />)
  await waitFor(() => {
    expect(document.querySelector('[role="progressbar"]')).not.toBeNull()
  })
})
```

**Step 3: 테스트 실행 → 실패 확인**

```bash
cd frontend && npx vitest run src/components/transaction/__tests__/MonthlyView.test.tsx -t "예산이 설정되면"
```

**Step 4: MonthlyView.tsx 수정**

HeroSummary 호출부 (lines 105-116) 변경:

```typescript
// budgetRatio 계산
const budgetRatio = totalBudget != null && totalBudget > 0
  ? monthly.totalExpense / totalBudget
  : undefined

// sublabel은 예산 없고 수입 있을 때만 (기존 "수입 대비 X%" 유지)
const sublabel = budgetRatio == null && monthly.totalIncome > 0
  ? `수입 대비 ${Math.round((monthly.totalExpense / monthly.totalIncome) * 100)}%`
  : undefined

<HeroSummary
  label={`${monthly.currentMonth + 1}월 지출`}
  amount={monthly.totalExpense}
  sublabel={sublabel}
  sublabelLoading={totalBudget === undefined}
  budgetRatio={budgetRatio}
/>
```

세그먼트 필터 스타일 변경 (lines 187-211):
- 컨테이너: `rounded-lg` → `rounded-xl` (p-1 유지)
- 활성 탭: `bg-grape-100 text-grape-600 font-semibold` (다크: `dark:bg-grape-900/40 dark:text-grape-300`)
- 비활성 탭: 기존 유지
- 높이: `py-1.5` → `py-2`

**Step 5: 테스트 실행 → 통과 확인**

```bash
cd frontend && npx vitest run src/components/transaction/__tests__/MonthlyView.test.tsx
```

**Step 6: 커밋**

```bash
git add frontend/src/components/transaction/MonthlyView.tsx frontend/src/components/transaction/__tests__/MonthlyView.test.tsx
git commit -m "feat: MonthlyView 예산 프로그레스 바 연동 + 세그먼트 필터 스타일"
```

---

## Task 3: MiniCalendar — weekOnly prop + 도트 인디케이터

**Files:**
- Modify: `frontend/src/components/MiniCalendar.tsx`
- Modify: `frontend/src/components/__tests__/MiniCalendar.test.tsx` (기존 파일 존재)

**⚠️ 주의:** 기존 테스트 중 금액 텍스트(`-5만`, `+350만`)를 검증하는 2개 테스트가 있음.
도트로 교체하면 깨지므로 해당 테스트도 함께 수정해야 함.

**Step 1: 기존 테스트 업데이트 + 새 테스트 추가**

`MiniCalendar.test.tsx`에서:
- 기존 `지출이 있는 날짜에 지출 금액을 표시한다` → `지출이 있는 날짜에 grape 도트가 표시된다`로 변경
- 기존 `수입이 있는 날짜에 수입 금액을 표시한다` → `수입이 있는 날짜에 leaf 도트가 표시된다`로 변경
- 새 테스트 추가:

```typescript
it('weekOnly=true이면 1행만 렌더링한다', () => {
  render(<MiniCalendar {...baseProps} weekOnly />)
  const rows = document.querySelectorAll('[data-testid="calendar-week"]')
  expect(rows.length).toBe(1)
})

it('weekOnly=false이면 전체 주를 렌더링한다', () => {
  render(<MiniCalendar {...baseProps} />)
  const rows = document.querySelectorAll('[data-testid="calendar-week"]')
  expect(rows.length).toBeGreaterThan(1)
})

it('지출+수입 둘 다 있는 날에 도트 2개가 표시된다', () => {
  render(<MiniCalendar {...baseProps} />)
  const cell = document.querySelector('[data-date="2026-04-07"]')
  const dots = cell?.querySelectorAll('[data-testid="dot"]')
  expect(dots?.length).toBe(2)
})

it('거래 없는 날에는 도트가 없다', () => {
  render(<MiniCalendar {...baseProps} />)
  const cell = document.querySelector('[data-date="2026-04-06"]')
  const dots = cell?.querySelectorAll('[data-testid="dot"]')
  expect(dots?.length ?? 0).toBe(0)
})
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
cd frontend && npx vitest run src/components/__tests__/MiniCalendar.test.tsx
```

**Step 3: MiniCalendar.tsx 구현**

Props에 `weekOnly?: boolean` 추가:

```typescript
interface MiniCalendarProps {
  // ...기존 props
  weekOnly?: boolean  // true이면 오늘이 속한 주만 렌더링
}
```

주간 스트립 로직:
```typescript
const visibleWeeks = weekOnly
  ? calendarGrid.filter(week => week.some(day => day.dateString === today))
  : calendarGrid
```

도트 인디케이터 (기존 금액 텍스트 교체):
```typescript
{summary && (summary.expense > 0 || summary.income > 0) && (
  <div className="flex items-center justify-center gap-0.5 mt-0.5">
    {summary.expense > 0 && (
      <div data-testid="dot" className="w-1.5 h-1.5 rounded-full bg-grape-400" />
    )}
    {summary.income > 0 && (
      <div data-testid="dot" className="w-1.5 h-1.5 rounded-full bg-leaf-400" />
    )}
  </div>
)}
```

타이포그래피 변경:
- 요일 헤더: `text-xs font-medium` → `text-[10px] font-normal`
- 주말 색상: `text-red-300`, `text-[var(--text-muted)]`
- 날짜 원: `w-6 h-6 text-xs` → `w-7 h-7 text-sm`
- 셀 간격: `px-0.5` → `px-1`
- 셀 높이: `min-h-[48px]` → `min-h-[40px]`

각 week row에 `data-testid="calendar-week"`, 각 day에 `data-date={dateString}` 추가.

`formatCompactAmount` import가 미사용이 되므로 제거 (lint 경고 방지).

**Step 4: 테스트 실행 → 통과 확인**

```bash
cd frontend && npx vitest run src/components/__tests__/MiniCalendar.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/MiniCalendar.tsx frontend/src/components/__tests__/MiniCalendar.test.tsx
git commit -m "feat: 미니캘린더 주간 스트립 + 도트 인디케이터"
```

---

## Task 4: MonthlyView — 캘린더 weekOnly 연동

**Files:**
- Modify: `frontend/src/components/transaction/MonthlyView.tsx`
- Modify: `frontend/src/components/transaction/__tests__/MonthlyView.test.tsx`

**⚠️ 주의:** 기존 테스트에서 `'달력 펼치기'` 텍스트를 검색하는 테스트가 있음.
접힌 상태가 weekOnly 스트립으로 바뀌므로 해당 테스트도 업데이트 필요.

**Step 1: 기존 "달력 펼치기" 테스트 업데이트 + 새 테스트 추가**

기존 `MonthlyView.test.tsx`에서 아래 3개 테스트를 수정:

1. **"접기 버튼 클릭 시 달력이 숨겨지고 달력 펼치기 버튼이 표시된다"**
   - `screen.getByText('달력 펼치기')` → `screen.getByTestId('calendar-expand')` 로 변경

2. **"펼치기 버튼 클릭 시 달력이 다시 표시된다"**
   - `screen.getByText('달력 펼치기')` → `screen.getByTestId('calendar-expand')` 로 변경
   - 클릭 후 `screen.getByTestId('calendar-collapse')` 확인

3. **"localStorage에 접힌 상태가 있으면 접힌 상태로 시작한다"**
   - `screen.getByText('달력 펼치기')` → `screen.getByTestId('calendar-expand')` 로 변경

새 테스트 추가:

```typescript
it('캘린더 접힌 상태에서 주간 스트립이 표시된다', async () => {
  localStorage.setItem('podo-calendar-collapsed', 'true')
  render(<TransactionList />)
  await waitFor(() => {
    const weeks = document.querySelectorAll('[data-testid="calendar-week"]')
    expect(weeks.length).toBe(1)
  })
})
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
cd frontend && npx vitest run src/components/transaction/__tests__/MonthlyView.test.tsx -t "주간 스트립"
```

**Step 3: MonthlyView.tsx 수정**

캘린더 접힌 상태 렌더링 (lines 134-159) 변경:

```typescript
{calendarCollapsed ? (
  <div>
    <MiniCalendar
      year={year}
      month={month}
      daySummaries={monthly.daySummaries}
      onDateClick={handleDateClick}
      today={todayString}
      weekOnly
    />
    <button
      data-testid="calendar-expand"
      onClick={toggleCalendar}
      className="w-full flex justify-center py-1"
    >
      <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
    </button>
  </div>
) : (
  <div>
    <MiniCalendar ... />
    <button data-testid="calendar-collapse" onClick={toggleCalendar} className="...">
      <ChevronUp ... /> 접기
    </button>
  </div>
)}
```

**Step 4: 테스트 실행 → 전체 MonthlyView 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/transaction/__tests__/MonthlyView.test.tsx
```

**Step 5: 커밋**

```bash
git add frontend/src/components/transaction/MonthlyView.tsx frontend/src/components/transaction/__tests__/MonthlyView.test.tsx
git commit -m "feat: 캘린더 접힌 상태 주간 스트립 연동"
```

---

## Task 5: 전체 테스트 + changelogs

**Files:**
- Modify: `frontend/src/data/changelogs.ts`

**Step 1: 전체 테스트 실행**

```bash
cd frontend && npm run lint && npm run test:run && npm run build
```

깨지는 테스트 있으면 수정 후 재실행.

**Step 2: changelogs.ts 업데이트**

배열 맨 앞에 추가. `changelogs.ts`에 이미 `0.16.0`이 있으면 해당 항목의 `items`에 추가, 없으면 새 항목 생성:

```typescript
{
  version: '0.16.0',
  date: '2026-04-05',
  title: '홈 화면 UI 개선',
  items: [
    { tag: '개선', text: '예산 대비 지출 프로그레스 바 추가' },
    { tag: '개선', text: '달력 접힌 상태에서 이번 주 미리보기' },
    { tag: '개선', text: '달력 날짜 도트 인디케이터로 변경' },
  ],
},
```

**Step 3: 커밋**

```bash
git add frontend/src/data/changelogs.ts
git commit -m "docs: 홈 UI 개선 changelog 추가"
```

---

## 변경 파일 요약

| Task | 파일 | 변경 |
|------|------|------|
| 1 | `HeroSummary.tsx` | budgetRatio prop, 프로그레스 바, 그라데이션 (다크모드 포함) |
| 1 | `HeroSummary.test.tsx` | 프로그레스 바 테스트 5개 추가 |
| 2 | `MonthlyView.tsx` | budgetRatio 전달, sublabel 정리, 세그먼트 스타일 |
| 2 | `MonthlyView.test.tsx` | 프로그레스 바 연동 테스트 추가 |
| 3 | `MiniCalendar.tsx` | weekOnly, 도트, 타이포, data-testid |
| 3 | `MiniCalendar.test.tsx` | 기존 금액 테스트 → 도트 테스트로 변경 + 새 테스트 4개 |
| 4 | `MonthlyView.tsx` | weekOnly 연동, 접힌 상태 UI 변경 |
| 4 | `MonthlyView.test.tsx` | 기존 "달력 펼치기" 테스트 업데이트 + 주간 스트립 테스트 |
| 5 | `changelogs.ts` | 사용자 변경 기록 |

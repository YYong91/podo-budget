# 홈 화면 UI 개선 설계

## 목표

히어로카드 · 세그먼트 필터 · 미니캘린더 세 영역의 시각적 디테일과 UX를 개선하여
가계부 첫 화면의 완성도를 높인다.

## 아키텍처

기존 컴포넌트 구조를 유지하면서 각 컴포넌트를 개별 수정한다.
새 컴포넌트 생성 없음, 데이터 흐름 변경 없음.

---

## 1. 히어로카드 (`HeroSummary.tsx`)

### 예산 프로그레스 바

**표시 조건:**
- 예산 설정 O (`totalBudget > 0`) → 프로그레스 바 + 퍼센트 숫자
- 예산 설정 X, 수입 O → 기존 "수입 대비 X%" 텍스트 유지
- 둘 다 없음 → sublabel 없음

**프로그레스 바 스펙:**
- 카드 하단, `mt-3`
- 높이: `h-1.5` (얇게, 심플함 유지)
- 배경 트랙: `bg-[var(--surface-hover)]` `rounded-full`
- 색상: 80% 미만 → `bg-grape-400`, 80~100% → `bg-amber-400`, 100% 초과 → `bg-red-400`
- 너비: `style={{ width: '${Math.min(percentage, 100)}%' }}`
- 퍼센트 텍스트: 바 오른쪽에 `text-xs text-[var(--text-muted)]` (예: `45%`)
- 애니메이션: CSS `transition-all duration-700 ease-out`, 초기 width 0 → useEffect로 목표값 설정

**sublabel 변경:**
- 예산 있는 경우: `sublabel` 제거, 대신 새 `budgetRatio?: number` prop으로 바 렌더링
- 기존 `sublabelLoading` prop 유지 → 로딩 중 바 영역 invisible placeholder

**Props 변경:**
```typescript
interface HeroSummaryProps {
  label: string
  amount: number
  sublabel?: string           // 수입 대비 텍스트용 유지
  sublabelLoading?: boolean   // 기존 유지
  budgetRatio?: number        // 0~1 사이 값 (예산 대비 비율)
  children?: ReactNode
  className?: string
}
```

**MonthlyView 변경:**
- `totalBudget > 0` → `budgetRatio={monthly.totalExpense / totalBudget}` 전달
- `sublabel`에서 "예산 대비 X%" 제거 (수입 대비만 유지)

### 은은한 그라데이션 배경

- `card-surface` 클래스 유지, 추가로 `bg-gradient-to-br from-[var(--surface-card)] to-grape-50/50`
- 다크모드에서 grape-50/50이 자연스럽게 흡수됨

---

## 2. 세그먼트 필터 (`MonthlyView.tsx` 인라인)

**컨테이너:**
- `rounded-lg → rounded-xl`
- `p-1` 유지

**활성 탭:**
- `bg-[var(--surface-card)] shadow-sm` → `bg-grape-100 text-grape-600 font-semibold`
- `rounded-md` 유지

**비활성 탭:**
- `text-muted hover:text-secondary` 유지

**높이:**
- `py-1.5 → py-2`

---

## 3. 미니캘린더 (`MiniCalendar.tsx`)

### 접힌 상태 → 주간 스트립

**기존:** "달력 펼치기" 텍스트 버튼
**변경:** 현재 주 7일 스트립 (같은 MiniCalendar 컴포넌트, `weekOnly` prop 추가)

```typescript
interface MiniCalendarProps {
  // ...기존 props
  weekOnly?: boolean  // true이면 오늘이 속한 주만 렌더링
}
```

- `weekOnly=true`: 오늘이 속한 행(week) 하나만 그리드 렌더링
- 요일 헤더는 동일하게 표시
- 높이: 자동으로 1행만 표시되어 축소됨
- 펼치기 버튼: 스트립 아래 `ChevronDown` 아이콘 (텍스트 없이 아이콘만)

**상태 관리 (MonthlyView):**
- `calendarCollapsed=true` → `<MiniCalendar weekOnly />` + ChevronDown
- `calendarCollapsed=false` → `<MiniCalendar />` + ChevronUp + "접기" 텍스트

### 날짜 셀 → 도트 인디케이터

**기존:** 9px 금액 텍스트 (지출/수입)
**변경:** 도트 인디케이터

- 지출 있음: `w-1.5 h-1.5 rounded-full bg-grape-400`
- 수입 있음: `w-1.5 h-1.5 rounded-full bg-leaf-400`
- 지출+수입 둘 다: 두 점 가로 배치 (gap-0.5)
- 거래 없음: 점 없음 (빈 공간)

### 날짜 숫자 디테일

**요일 헤더:**
- `text-xs font-medium` → `text-[10px] font-normal`
- 주말 색상: `text-red-400 / text-blue-400` → `text-red-300 / text-[var(--text-muted)]` (은은하게)

**날짜 원:**
- `w-6 h-6 text-xs` → `w-7 h-7 text-sm` (숫자에 여유)
- 평일: `text-secondary` → `text-[var(--text-primary)] font-normal`
- 오늘: `font-bold` → `font-semibold`

**셀 간격:**
- `px-0.5` → `px-1`

**셀 높이:**
- 도트로 변경 후 `min-h-[48px]` → `min-h-[40px]`

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `components/stats/HeroSummary.tsx` | budgetRatio prop, 프로그레스 바, 그라데이션 배경 |
| `components/transaction/MonthlyView.tsx` | budgetRatio 전달, 세그먼트 스타일, 캘린더 weekOnly |
| `components/MiniCalendar.tsx` | weekOnly prop, 도트 인디케이터, 타이포 개선 |

---

## 비고

- `changelogs.ts` 업데이트 필요 (사용자 노출 UI 변경)
- 기존 `sublabelLoading` 동작 유지 (PR #580 변경사항)
- 다크모드 grape-50 그라데이션 자동 대응 확인 필요

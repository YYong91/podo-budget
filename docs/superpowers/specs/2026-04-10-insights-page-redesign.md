# 모아보기(InsightsPage) 재설계 스펙

## 경험 정의

### 핵심 약속
> "우리집 살림의 전체 그림을 한눈에, 깊이 있게"

가계부 홈이 "거래 기록"이라면, 모아보기는 **그 기록들이 말해주는 이야기**를 보여주는 페이지.

### 사용자가 답을 얻는 3가지 질문 (우선순위 순)

| 순서 | 질문 | 성격 | Layer |
|------|------|------|-------|
| 1 | 이번 달 돈을 잘 쓰고 있나? | 건강 진단 | Layer 1 |
| 2 | 내 돈이 어디로 갔지? | 흐름 분석 | Layer 2 |
| 3 | 지난달보다 나아졌나? | 추세 확인 | Layer 3 |

### 현재 문제
- 9개 섹션이 독립적으로 데이터를 나열하는 "대시보드" 구조
- 사용자가 스스로 "그래서 나는 잘하고 있는 건가?"를 조합 판단해야 함
- 카드 스타일 3가지 혼재 (그래디언트, border, 배경만)
- 프로그레스 바 높이/색상 기준 불일치
- 건강 점수가 맨 아래에 숨어있어 발견 어려움
- 저축률 계산 불일치 (요약 카드 vs 주목할 점)

---

## 정보 구조

### 전체 레이아웃

```
┌─────────────────────────────────────────────────┐
│  월 네비게이션 (PeriodNavigator) + 설정 버튼      │
├─────────────────────────────────────────────────┤
│                                                 │
│  Layer 1: 한눈에                                │
│  ┌─ 히어로 (진단 + 건강 점수 배지) ──────────┐   │
│  ├─ 이달의 주목할 점 ────────────────────────┤   │
│  └─ 종합 요약 카드 4개 ─────────────────────┘   │
│                                                 │
│          ─ ─ ─ ─  뜯어보기  ─ ─ ─ ─            │
│                                                 │
│  Layer 2: 뜯어보기                              │
│  ┌─ 변동 지출 (카테고리 + 예산) ────────────┐   │
│  ├─ 고정 지출 (정기거래 + 카드 실적) ───────┤   │
│  └─ 저축 ──────────────────────────────────┘   │
│                                                 │
│          ─ ─ ─ ─  돌아보기  ─ ─ ─ ─            │
│                                                 │
│  Layer 3: 돌아보기                              │
│  ┌─ 전월 대비 변화 (신규) ─────────────────┐   │
│  ├─ 자산 변화 (FEATURES.assets=true) ──────┤   │
│  └─ AI 종합 분석 ─────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Layer 간 구분
- Layer 사이에 얇은 divider + 소제목 ("뜯어보기", "돌아보기")
- 섹션 간 `space-y-4`, Layer 간 `space-y-6`

### 첫 사용자 온보딩 모드
거래 데이터가 부족할 때 (기준: 활성 가구의 해당 월 거래 5건 미만, expenseStats.count + incomeStats.count) 리포트 대신 온보딩 체크리스트 표시:

```
┌─────────────────────────────────┐
│  🍇                             │
│  아직 데이터가 모이는 중이에요     │
│                                 │
│  ✓ 거래 5건 이상 기록하기        │
│  ○ 예산 설정하기                │
│  ○ 정기거래 등록하기            │
│  ○ 저축 카테고리 설정하기        │
│                                 │
│  [가계부로 가기 →]              │
└─────────────────────────────────┘
```

---

## Layer 1: 한눈에

### 1-1. 히어로 섹션

**예산 설정 사용자:**
```
┌─────────────────────────────────────┐
│  4월 지출                    [B+]   │
│  1,234,000원                        │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░ 72%          │
│  지난달 이맘때보다 3만원 줄었어요 ↓   │
└─────────────────────────────────────┘
```

**예산 미설정 사용자:**
```
┌─────────────────────────────────────┐
│  4월 지출                    [B+]   │
│  1,234,000원                        │
│  지난달 이맘때보다 3만원 줄었어요 ↓   │
│                                     │
│  💡 예산을 설정하면 더 정확한        │
│     진단을 받을 수 있어요 →          │
└─────────────────────────────────────┘
```

**구성 요소:**
- 월 + "지출" 라벨 (text-sm, text-tertiary)
- 금액 (text-display, 3xl bold)
- 예산 프로그레스 바 (예산 있을 때만, TransactionList의 신규 모드 공유)
- 전월 동일 시점 대비 문장 (항상 표시, comparison API의 end_day 기반)
- 건강 점수 배지 (우측 상단)
  - 텍스트 배지: 등급 + 점수 (예: "B+ 78")
  - 탭하면 세부 점수 바텀시트 (저축/지출관리/부채) — 기존 `FinancialHealthScore` 컴포넌트 재활용, 바텀시트 래퍼는 프로젝트 내 기존 모달 패턴(fixed inset-0 + slide-up) 활용
  - 나중에 포도 성숙도 캐릭터로 교체 가능하게 설계 (배지 영역만 교체)
- 예산 미설정 시 유도 카드 (grape-50 배경, /budgets 링크)

**전월 비교 문장 생성 규칙:**
- 감소: "지난달 이맘때보다 {금액} 줄었어요 ↓" (text-leaf-600)
- 증가: "지난달 이맘때보다 {금액} 늘었어요 ↑" (text-red-600)
- 동일 (변화율 절대값 < 1%): "지난달과 비슷한 수준이에요" (text-secondary)
- 비교 불가 (전월 데이터 없음): 표시 안 함

### 1-2. 이달의 주목할 점

**순서 변경: 요약 카드보다 위로 이동** — 히어로 진단 → 주목할 점(문장) → 요약 카드(숫자) 흐름

**하이라이트 규칙 (우선순위 순, 최대 4개):**

| # | 유형 | 조건 | 메시지 | 타입 |
|---|------|------|--------|------|
| 1 | 적자 경고 | 지출 > 수입 | "이번 달 지출이 수입을 초과했어요" | warning |
| 2 | 예산 초과 | 카테고리별 is_exceeded (최대 2개) | "{카테고리} 예산을 {금액} 초과했어요" | warning |
| 3 | 저축률 달성 | 저축률 >= 20% | "이번 달 저축률 {rate}% 달성" | positive |
| 4 | 지출 감소 | 전월 대비 -10% 이상 | "지난달보다 지출을 {pct}% 줄였어요" | positive |
| 5 | 고정비 비율 (신규) | 고정비/수입 >= 40% | "수입의 {pct}%가 고정비예요" | info |
| 6 | 저축 감소 (신규) | 전월 대비 저축 감소 | "지난달보다 저축이 줄었어요" | info |
| 7 | 카테고리 급증 | 전월 대비 +30% 이상 (최대 2개) | "{카테고리}가 지난달보다 {pct}% 증가했어요" | info |

**저축률 계산 버그 수정:**
- 현재: `(수입 - 지출) / 수입` (단순 잔액 비율)
- 수정: `savingsTotal / incomeTotal` (is_savings=true 카테고리 기반)
- `HighlightInput` 인터페이스에 `savingsTotal?: number` 추가
- `generateHighlights` 함수 시그니처 변경:
  ```typescript
  interface HighlightInput {
    incomeTotal: number
    expenseTotal: number
    savingsTotal?: number          // 신규: is_savings 카테고리 합계
    recurringTotal?: number        // 신규: 고정비 합계 (규칙 #5용)
    prevSavingsTotal?: number      // 신규: 전월 저축 합계 (규칙 #6용)
    budgetStats: BudgetMonthlyStatsResponse | null
    comparison: ComparisonResponse | null
    onHighlightClick?: (target: string) => void  // 신규: 딥링크 콜백
  }
  ```
- is_savings 카테고리 미설정 시 (`savingsTotal === undefined`): 규칙 #3, #6 완전 스킵 (유도 메시지 없음, 저축 섹션에서 처리)

**딥링크 기능 (신규):**
- 각 하이라이트 항목 탭 시 관련 섹션으로 스크롤 점프
- 구현 방식: `id` 기반 (`document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })`)
  - `id="section-category"`, `id="section-budget"`, `id="section-savings"`, `id="section-recurring"`, `id="section-comparison"` 각 섹션 루트에 부여
- 적자 경고 (#1) → 클릭 불가 (딥링크 없음)
- 예산 초과 (#2) → `section-budget`
- 저축률 달성 (#3) → `section-savings`
- 지출 감소 (#4) → `section-comparison`
- 고정비 비율 (#5) → `section-recurring`
- 저축 감소 (#6) → `section-savings`
- 카테고리 급증 (#7) → `section-category`

### 1-3. 종합 요약 카드

**4개 카드, 2x2(모바일) / 1x4(데스크톱):**

| 카드 | 배경 | 클릭 시 |
|------|------|---------|
| 총 수입 | from-leaf-50 to-leaf-100 | — |
| 총 지출 | from-grape-50 to-grape-100 | Layer 2 변동 지출로 스크롤 |
| 남은 돈 | surface-card | — |
| 저축률 | surface-card | Layer 2 저축으로 스크롤 |

**변경 사항:**
- ChangeIndicator 제거 (Layer 3 전월 대비 섹션으로 이동)
- 저축률: is_savings 카테고리 미설정 시 "-" 대신 "설정 필요" 표시 + 탭하면 카테고리 설정으로 이동
- fallback 계산 `(수입-지출)/수입` 제거, is_savings 기반만 사용
- **의도적 UX 변경**: is_savings 미설정 사용자는 기존에 보이던 저축률이 사라짐. 올바른 데이터 기반 수치만 표시하는 정책으로 전환 (잘못된 fallback 제거 목적)
- 순자산 카드: FEATURES.assets=true일 때만 5번째 카드로 표시 (기존 유지)
- 5카드 모바일 레이아웃: 순자산 full-width(col-span-2) + 나머지 2x2 → 3행 구성

---

## Layer 2: 뜯어보기

Layer 소제목: "뜯어보기" (얇은 divider 위에 text-sm text-tertiary)

### 2-1. 변동 지출

**지출 카테고리 (기존 CategoryTopList 재활용)**
- 리스트/차트 탭 전환 유지
- 리스트 뷰: 순위 + 카테고리명 + 금액 + % + 프로그레스 바
- 차트 뷰: 도넛 차트 + 범례
- 클릭: 거래 목록 필터 이동 (기존 유지)

**예산 대비 현황 (기존 BudgetVsActual)**
- 같은 카드 안에 카테고리 아래 배치
- 총 예산 + 프로그레스 바 + 카테고리별 상세
- 예산 미설정: "예산을 설정하면 지출을 더 잘 관리할 수 있어요 →" 유도

### 2-2. 고정 지출

**정기거래 요약 (기존 RecurringManageSection 리프레이밍)**
- 헤더: "이번 달 고정비 {총액}" — 금액 중심 요약 먼저
- 상세: 아코디언 (기본 접힘), 항목별 이모지 + 설명 + 금액 + 상태
- 관리 동작(실행/건너뛰기): 시각적 비중 축소하되 기능 유지
- 정기거래 미등록: "정기거래를 등록하면 고정비 현황을 볼 수 있어요 →" 유도

**카드 실적 (기존 CardUsageSummary)**
- monthly_target 설정된 카드만 표시
- 카드명 + 실적/목표 + 프로그레스 바
- 카드 미설정: 섹션 미표시 (기존 동작 유지)

### 2-3. 저축 (신규 섹션)

**is_savings=true 카테고리 설정 시:**
```
┌─ 🏦 저축 ───────────────────────────┐
│  이번 달 저축 530,000원              │
│  수입의 15.2%                       │
│                                     │
│  적금      300,000                  │
│  투자      180,000                  │
│  보험       50,000                  │
└─────────────────────────────────────┘
```

- 총 저축액 (text-xl font-bold)
- 수입 대비 % (text-sm text-tertiary)
- 카테고리별 내역 리스트

**is_savings 미설정 시:**
```
┌─ 🏦 저축 ───────────────────────────┐
│  저축 카테고리를 설정하면            │
│  저축 현황을 볼 수 있어요            │
│  [카테고리 설정 →]                  │
└─────────────────────────────────────┘
```

**데이터 소스:** InsightsPage의 기존 `savingsTotal` + `expenseStats.by_category` 필터링 (is_savings 카테고리만)

---

## Layer 3: 돌아보기

Layer 소제목: "돌아보기" (얇은 divider 위에 text-sm text-tertiary)

### 3-1. 전월 대비 변화 (신규 섹션)

```
┌─ 📊 지난달과 비교 ──────────────────┐
│                                     │
│  수입   3,500,000  +200,000 (+6%)  │
│         ╌╌╌╌╌╌╌╌  3개월 스파크라인  │
│  지출   1,234,000   -80,000 (-6%)  │
│         ╌╌╌╌╌╌╌╌  3개월 스파크라인  │
│  저축률     15.2%     +2.1%p       │
│         ╌╌╌╌╌╌╌╌  3개월 스파크라인  │
│                                     │
│  카테고리 변화 TOP 3                 │
│  🔺 교통  +35%  (+42,000)          │
│  🔻 식비  -12%  (-58,000)          │
│  🔺 쇼핑  +22%  (+27,000)          │
└─────────────────────────────────────┘
```

**구성:**
- 수입/지출/저축률 행: 현재값 + 변화량 + 변화율 + 3개월 미니 스파크라인
- 스파크라인: 높이 24px, 너비 64px, Recharts LineChart (stroke만, 축 없음). trend 데이터 2개 미만 시 스파크라인 숨김.
- 카테고리 변화 TOP 3: 증감 아이콘 + 카테고리명 + 변화율 + 변화금액
- 증가: text-red-600 (지출 증가는 부정), 감소: text-leaf-600 (지출 감소는 긍정)
- 동일 시점 대비 (comparison API의 end_day 기반)
- 저축률 변화: is_savings 미설정 시 해당 행 숨김

**데이터 소스:** 기존 comparison, incomeComparison 쿼리 + trend 데이터 (현재 미사용 → 활용)

### 3-2. 자산 변화 (기존 AssetChangeSummary)
- FEATURES.assets=true일 때만 표시
- 순자산 + 전월 대비 + 유형별 증감
- 기존 컴포넌트 재활용, 스타일만 통일

### 3-3. AI 종합 분석 (기존 StructuredInsightsView)
- 사용자 트리거 (버튼 클릭) 유지
- 구조화된 결과: 격려 + 핵심 발견 + 액션 아이템
- **프롬프트 고도화는 이번 스코프 제외** — 현재 구조 유지
- 스타일만 통일

---

## 스타일 통일 규칙

### 카드 시스템 (2단계)

**강조 카드 (Layer 1 요약 카드만):**
```css
rounded-2xl shadow-sm p-4 sm:p-5
bg-gradient-to-br from-{color}-50 to-{color}-100
border border-{color}-200/60
```

**기본 카드 (나머지 전부):**
```css
bg-[var(--surface-card)] rounded-2xl shadow-sm
border border-[var(--border-default)]
p-4 sm:p-6
```

### 섹션 헤더 포맷
```
이모지 + text-base font-semibold + (우측) 액션 링크
```
- 이모지: 변동 지출 💸, 고정 지출 🔄, 저축 🏦, 비교 📊, AI 🤖
- 액션 링크: text-sm text-grape-600 ("편집", "전체보기" 등)

### 프로그레스 바 통일
```css
h-1.5 rounded-full overflow-hidden
bg-[var(--border-default)]  /* 트랙 */
```
색상 규칙 (공통):
- ≤80%: `bg-grape-500`
- 80-100%: `bg-amber-500`
- >100%: `bg-red-500`

카드 실적만 역방향:
- <100%: `bg-grape-500`
- ≥100%: `bg-leaf-500` (달성)

### 금액 표시
- 큰 금액: `text-xl sm:text-2xl font-bold tabular-nums`
- 보조 금액: `text-sm tabular-nums`
- 변화량: `text-xs tabular-nums` + 색상 (긍정 leaf-600 / 부정 red-600)

### 긍정/부정 색상
- 긍정 (수입 증가, 지출 감소, 달성): `text-leaf-600`
- 부정 (수입 감소, 지출 증가, 초과): `text-red-600`
- 중립/정보: `text-[var(--text-secondary)]`

### 빈 상태 통일
```html
<div class="text-center py-6">
  <p class="text-sm text-[var(--text-tertiary)]">{유도 문구}</p>
  <Link class="text-sm font-medium text-grape-600 mt-1">{액션} →</Link>
</div>
```

### 간격
- 섹션 간: `space-y-4`
- Layer 간: `space-y-6` + divider
- 카드 내부: `space-y-3`

### 애니메이션
- 페이지 진입: `animate-page-in` + `animate-stagger` (기존 유지)
- 프로그레스 바: `transition-all duration-700 ease-out`
- 스크롤 점프: `scrollIntoView({ behavior: 'smooth' })`

---

## 섹션 토글 (SectionToggleModal)

Layer 구조에 맞게 재구성:

```typescript
type SectionVisibility = {
  // Layer 1
  highlights: boolean      // 이달의 주목할 점

  // Layer 2
  categoryTop: boolean     // 변동 지출 - 카테고리
  budget: boolean          // 변동 지출 - 예산
  recurring: boolean       // 고정 지출 - 정기거래
  cardUsage: boolean       // 고정 지출 - 카드 실적
  savings: boolean         // 저축

  // Layer 3
  comparison: boolean      // 전월 대비 (신규)
  assets: boolean          // 자산 변화 (FEATURES.assets=true)
  ai: boolean              // AI 분석
}
```

- 히어로, 요약 카드: 토글 불가 (항상 표시)
- 모달에서 Layer 별로 그룹핑하여 표시
- 기존 사용자 localStorage는 `{ ...DEFAULT_SECTIONS, ...parsed }` spread로 자동 마이그레이션 (신규 키 comparison, savings는 기본 true)

---

## 컴포넌트 변경 매트릭스

| 컴포넌트 | 변경 유형 | 설명 |
|----------|----------|------|
| InsightsPage.tsx | **대폭 수정** | 렌더 순서 변경, Layer 구분, 온보딩 분기, `id` 기반 딥링크, HeroSummary 호출을 레거시→신규 props로 마이그레이션 (`totalBudget` + `pendingRecurringExpense` 파생 추가) |
| HeroSummary.tsx | **수정** | 건강 점수 배지 추가, 전월 비교 문장, 예산 유도 카드. 레거시 모드(`LegacyHeroSummaryProps`) 삭제 및 신규 모드 단일화 |
| MonthlyHighlights.tsx | **수정** | savingsTotal props 추가, 신규 규칙 2개, 딥링크 콜백 |
| UnifiedSummaryCards.tsx | **수정** | ChangeIndicator 제거, 저축률 fallback 제거, 스크롤 콜백 |
| CategoryTopList.tsx | **스타일만** | 카드 스타일 통일 |
| BudgetVsActual.tsx | **스타일만** | 카드 스타일 통일, 빈 상태 통일 |
| RecurringManageSection.tsx | **수정** | 리프레이밍 (고정비 총액 헤더), 기본 접힘, 빈 상태 유도 |
| CardUsageSummary.tsx | **스타일만** | 프로그레스 바 통일 |
| AssetChangeSummary.tsx | **스타일만** | 카드 스타일 통일 |
| FinancialHealthScore.tsx | **수정** | 소형 배지 모드 추가 (히어로용), 바텀시트 트리거. AI 섹션 카드에서 제거 (히어로로 이동) |
| StructuredInsightsView.tsx | **스타일만** | 카드 스타일 통일 |
| SectionToggleModal.tsx | **수정** | Layer 그룹핑, comparison/savings 항목 추가 |
| **SavingsSection.tsx** | **신규** | 저축 섹션 컴포넌트 |
| **MonthlyComparison.tsx** | **신규** | 전월 대비 섹션 (스파크라인 포함) |
| **InsightsOnboarding.tsx** | **신규** | 첫 사용자 온보딩 체크리스트 |
| **LayerDivider.tsx** | **신규** | Layer 간 구분자 컴포넌트 |

---

## 데이터 의존성

### 기존 API (변경 없음)
- `GET /expenses/stats/monthly` — 월간 지출 통계
- `GET /income/stats/monthly` — 월간 수입 통계
- `GET /expenses/stats/comparison` — 지출 전월 대비 (동일 시점)
- `GET /income/stats/comparison` — 수입 전월 대비 (동일 시점)
- `GET /budgets/monthly-stats` — 예산 대비 현황
- `GET /assets/snapshots` — 자산 스냅샷
- `GET /categories?type=expense` — 카테고리 목록 (is_savings)
- `GET /card-usage/monthly` — 카드 실적
- `GET /recurring-transactions` — 정기거래 목록
- `GET /expenses` + `GET /income` — 당월 거래 목록 (정기거래 매칭용)
- `POST /insights/generate-comprehensive` — AI 분석

### 신규 데이터 필요
- **trend 데이터 활용**: comparison API의 `trend` 필드 — 이미 반환되고 있으나 프론트에서 미사용. 스파크라인에 활용.
- **저축 전월 대비**: is_savings 카테고리 지출의 전월 비교 — 기존 by_category_comparison에서 필터링 가능.
- **온보딩 판단**: 당월 거래 건수 — `expenseStats.count + incomeStats.count`로 판단 가능. `StatsResponse` 타입에 `count` 필드 존재 확인됨.

### 백엔드 변경 불필요
모든 신규 기능이 기존 API 데이터의 재조합으로 구현 가능.

---

## 스코프 제외 (후속 작업)

- AI 분석 프롬프트 고도화
- 건강 점수 포도 성숙도 캐릭터 (디자인 에셋 준비 후)
- 다크 모드 세부 조정 (기존 CSS 변수 기반으로 자동 대응)

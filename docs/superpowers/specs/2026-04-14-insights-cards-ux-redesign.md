# 모아보기 카드 UX 개선 설계

**날짜**: 2026-04-14
**대상 파일**:
- `frontend/src/components/stats/BudgetVsActual.tsx`
- `frontend/src/components/stats/RecurringManageSection.tsx`
- `frontend/src/components/stats/CardUsageSummary.tsx`
- `frontend/src/components/stats/SavingsSection.tsx`
- `frontend/src/components/stats/MonthlyComparison.tsx`
- `frontend/src/pages/InsightsPage.tsx`

---

## 배경 및 목적

모아보기(InsightsPage)의 5개 세부 카드가 각자 다른 접기/펼치기 패턴을 사용하고 있다:
- BudgetVsActual: 하단 "더보기" 버튼, 기본 5개 표시 (접기 개념 모호)
- RecurringManageSection: 하단 푸터에 접기/펼치기 버튼
- CardUsageSummary: 접기 없음, 항상 전체 표시
- SavingsSection: 접기 없음, 정보량이 적고 중복 있음
- MonthlyComparison: 헤더 우측에 텍스트+아이콘 버튼

이 설계는 5개 카드를 **일관된 패턴으로 통일**하고, 저축 카드를 **수입 구성 카드로 업그레이드**하며, MonthlyComparison의 **그래프 시인성을 개선**한다.

---

## 공통 패턴: SectionHeader 컴포넌트

### 설계

모든 카드에 동일한 헤더 구조 적용:

```
┌──────────────────────────────────────────┐
│  [이모지] 타이틀          관리     ▼/▲   │
│  ─────────────────────────────────────   │
│  [오버뷰 콘텐츠 — 항상 표시]             │
│                                          │
│  [펼침 콘텐츠 — expanded=true일 때만]    │
└──────────────────────────────────────────┘
```

### SectionHeader 컴포넌트 Props

```typescript
type SectionHeaderProps = {
  icon: string           // 이모지
  title: string          // 카드 제목
  manageTo?: string      // "관리" 링크 대상 경로 (없으면 링크 숨김)
  expanded: boolean
  onToggle: () => void
  collapsible?: boolean  // false면 chevron 숨김 (기본 true)
  children?: ReactNode   // 헤더 아래 콘텐츠
}
```

### 인터랙션 규칙

- **헤더 행 전체(타이틀 + 빈 공간 + chevron)**: 탭 → 접기/펼치기 (`onToggle`)
- **"관리" 텍스트 링크**: `stopPropagation` → 해당 관리 페이지 이동 (접기/펼치기 트리거 안 됨)
- **chevron 아이콘**: 접힘 `ChevronDown` / 펼침 `ChevronUp`, `transition-transform duration-200`
- **`collapsible={false}`일 때**: chevron 숨김, 헤더 행 `onClick` 없음 (`cursor-default`), `onToggle` 호출 안 됨
- **기본 상태**: 모든 카드 **접힘(closed)**
- **aria-label**: `collapsible={true}`일 때 헤더 버튼에 `aria-label={expanded ? '접기' : '펼치기'}` 부여 (기존 패턴 유지, 테스트 호환)

---

## 카드별 설계

### 1. 예산 상황 (BudgetVsActual)

**현재 문제**
- 기본 5개 카테고리 항상 표시 → 사실상 접기 없음
- 하단 "더보기" 버튼 → 접기 UX와 의미가 다름
- HeroSummary의 총예산 프로그레스바와 다른 맥락 필요

**오버뷰 (접힌 상태)**
```
총예산 100만원  지출 72만원  72%
████████████████████░░░░  [⚠ 2개 초과]
```
- 총예산 / 총지출 한 줄 텍스트
- 단일 프로그레스바 (초과 시 red, 80%+ amber, 정상 grape)
- 초과 카테고리 수 배지 (초과 없으면 숨김)
- **`budgetStats === null`일 때** (예산 자체 미설정, 카테고리 0개): 기존과 동일하게 컴포넌트 전체 `null` 반환 — 이 케이스는 InsightsPage에서 `sectionVisibility.budget` 조건과 함께 처리되므로 카드 자체를 숨기는 것이 적합. 기존 테스트 "budgetStats가 null이면 아무것도 렌더하지 않는다" 유지
- **`budgetStats.total_budget === null`일 때** (예산 통계는 있으나 총 예산 미설정): 오버뷰 영역에 "예산이 설정되지 않았습니다" 텍스트 + "설정하기 →" 링크 표시 (SectionHeader 헤더는 표시됨)

**펼침 콘텐츠**
- 전체 카테고리 목록 (기존 `maxItems=5` 제한 제거, 모두 표시)
- 카테고리별 프로그레스바 + 금액 (기존과 동일)

**변경사항**
- `maxItems` prop 및 관련 로직 제거
- `expanded` state 추가, SectionHeader 적용
- 오버뷰 영역: 현재의 `총예산 박스`를 단순화하여 접힌 상태에 사용

---

### 2. 정기거래 (RecurringManageSection)

**현재 문제**
- 동일 정보가 3곳 분산: 헤더 서브텍스트(고정비 총액) + OverviewChips + 하단 푸터(활성 N건 · 이번 달 지출)
- 접기/펼치기 버튼이 하단 → 카드를 다 읽어야 발견

**오버뷰 (접힌 상태)**
```
[이달 고정비 320,000원]         ← 헤더 서브텍스트 유지
[✓ 완료 3건] [⚠ 미처리 1건] [📅 예정 2건] [수입 150,000원]  ← OverviewChips 유지
```

**펼침 콘텐츠**
- 항목별 상세 목록 (기존과 동일)

**변경사항**
- **하단 푸터 제거**: "활성 N건 · 이번 달 지출 M원" 텍스트를 완전히 제거. "활성 N건" 정보는 OverviewChips에서 건수 합산으로 충분히 파악 가능하므로 별도 표기 불필요
- 접기/펼치기 버튼 → 헤더 chevron으로 이동
- SectionHeader 적용
- 기존 테스트 중 `getAllByText(/금액/)` (헤더+푸터 양쪽 검증) → 푸터 제거로 헤더에만 금액이 표시되므로 `getByText(/금액/)` (단일 위치)로 수정

---

### 3. 카드실적 (CardUsageSummary)

**현재 문제**
- 접기 없음, 항상 전체 표시
- 오버뷰 개념 없음

**오버뷰 (접힌 상태)**

카드 2개 이상:
```
✅ 달성 2개 · 진행 중 1개
```

카드 1개:
```
삼성카드  82%  잔여 18만원
```
(달성 시: `✅ 실적 달성`)

**펼침 콘텐츠**
- 카드별 프로그레스바 전체 목록 (기존과 동일)

**변경사항**
- `useState(false)` expanded 상태 추가
- SectionHeader 적용
- 오버뷰 영역 신규 작성

---

### 4. 수입 구성 (SavingsSection 리네이밍)

**변경 개요**
- 카드명: `🏦 저축` → `📊 수입 구성`
- 컴포넌트명: `SavingsSection` 유지 (내부 리팩토링)
- "관리" 링크 대상: `/categories` 유지

**Props 추가 (InsightsPage에서 주입)**
```typescript
type SavingsSectionProps = {
  savingsTotal: number | undefined
  incomeTotal: number
  savingsCategories: CategoryAmount[]
  recurringTotal?: number   // 추가 (optional, 기본값 0) — 고정비 계산용
  expenseTotal?: number     // 추가 (optional, 기본값 0) — 변동비 계산용
}
```

> 두 props를 optional로 유지하는 이유: 기존 테스트가 이 두 값 없이 렌더하므로 타입 에러 없이 호환됨. 미전달 시 stacked bar의 고정비/변동비 구간은 0으로 계산되어 저축/여유만 표시됨.

**오버뷰 (접힌 상태)**
```
📊 수입 구성                   관리   ▼
32만원  수입의 10.7%

[■ 저축 10.7%][■■■ 고정비 26.7%][■■■■ 변동비 40.0%][░ 여유 22.7%]
```

stacked bar 구성:
| 구간 | 계산식 | 색상 |
|---|---|---|
| 저축 | `savingsTotal / incomeTotal` | `leaf` |
| 고정비 | `recurringTotal / incomeTotal` | `warm` |
| 변동비 | `(expenseTotal - savingsTotal - recurringTotal) / incomeTotal` | `grape` |
| 여유 | `(incomeTotal - expenseTotal) / incomeTotal` | `gray` |

> **변동비 계산 주의**: `recurringTotal`(정기거래 지출 합계)과 `savingsTotal`(is_savings 카테고리 합계)은 집합이 겹칠 수 있다 (예: 적금 자동이체가 정기거래로도 등록된 경우). 이 경우 변동비 음수 결과가 발생하며, 아래 엣지 케이스 3번으로 처리한다.

엣지 케이스:
1. `incomeTotal === 0` → stacked bar 미표시, 저축 총액만 표시
2. `여유` 구간이 음수 (지출 > 수입) → 여유 구간 제거, 전체 bar를 `expenseTotal / (expenseTotal + epsilon)`으로 채우고 끝에 적색 텍스트 "초과 N원" 표시 (마커 아이콘 아님)
3. `변동비`가 음수 (저축+고정비 > 총지출 또는 집합 중복) → 0으로 클램프, 고정비 구간이 상대적으로 과장됨을 감수 (정확도보다 UX 안정성 우선)

**펼침 콘텐츠**
```
저축    320,000원  10.7%
  ├ 적금    200,000원
  └ 투자    120,000원
고정비  800,000원  26.7%
변동비  1,200,000원  40.0%
여유    680,000원  22.7%
```

**접기 조건**
- 저축 카테고리 2개 이상 → `collapsible={true}`, chevron 표시
- 저축 카테고리 1개 이하 → `collapsible={false}`, chevron 숨김

**변경사항**
- InsightsPage에서 `recurringTotal`, `expenseTotal` props 추가 전달
- stacked bar 신규 구현 (Recharts 불필요, 순수 CSS `flex` 비율 바)
- 저축 카테고리 없을 때 empty state 유지 ("카테고리 설정 →")

---

### 5. 지난달과 비교 (MonthlyComparison)

**현재 문제**
- 헤더 우측 텍스트+아이콘 버튼 → 다른 카드와 패턴 불일치
- 스파크라인 64×24px → 너무 작아 의미 전달 어려움
- 카테고리 변화 TOP3가 텍스트만 → 시각적 비교 어려움

**오버뷰 (접힌 상태)**

현재와 동일 — 3행 텍스트 비교:
```
수입  250만원 → 300만원  +50만원
지출  220만원 → 240만원  +20만원
저축률  8.0% → 10.7%  +2.7%p
```

**펼침 콘텐츠**

스파크라인(64px) 제거 → **3개월 트렌드 BarChart** 추가:
```
        2월        3월        4월
수입  [██████]  [██████]  [████████]
지출  [████]    [█████]   [██████]
```
- Recharts `BarChart` (grouped bar)
- 수입: `leaf` 색상 / 지출: `grape` 색상
- 가로 전체 활용, 높이 120px
- x축: 월 레이블, y축: 만원 단위

카테고리 변화 TOP3에 미니 horizontal bar 추가:
```
🔺 외식   +45%  ████████░░  (+8만원)
🔻 교통   -30%  ████░░░░░░  (-3만원)
🔺 쇼핑   +20%  ██████░░░░  (+4만원)
```
- bar 길이 = 변화율 절대값 기준 (최대값이 100%)
- 증가 red, 감소 leaf

**TrendBarChart 데이터 처리**
- trend 데이터 2개 이상: 정상 렌더
- trend 데이터 1개 이하: BarChart 미표시, "비교할 이전 데이터가 없습니다" 텍스트 표시
- 수입/지출 trend 배열 월 불일치: `expenseComparison.trend`의 period 기준으로 정렬, 수입 데이터 없는 월은 `0`으로 채워서 렌더 (데이터 누락이 bar 숨김보다 직관적)

**변경사항**
- 헤더 텍스트 버튼 → SectionHeader chevron으로 교체
- 스파크라인(`Sparkline` 컴포넌트, `ComparisonRow` showTrend prop) 제거
- 3개월 트렌드 BarChart 신규 구현 (`TrendBarChart` 내부 컴포넌트)
- 카테고리 변화 행에 미니 horizontal bar 추가
- 기존 `data-testid="sparkline"` 테스트 → `data-testid="trend-bar-chart"` 테스트로 교체

---

## InsightsPage 변경사항

```typescript
// SavingsSection에 추가 전달할 props
<SavingsSection
  savingsTotal={savingsTotal}
  incomeTotal={incomeStats?.total ?? 0}
  savingsCategories={savingsCategories}
  recurringTotal={recurringTotal}          // 추가
  expenseTotal={expenseStats?.total ?? 0}  // 추가
/>
```

`recurringTotal`과 `expenseTotal` 모두 InsightsPage에서 이미 계산되어 있으므로 추가 API 호출 없음.

---

## 구현 순서

1. `SectionHeader` 공통 컴포넌트 작성
2. `BudgetVsActual` 개선
3. `RecurringManageSection` 개선
4. `CardUsageSummary` 개선
5. `SavingsSection` → 수입 구성 업그레이드
6. `MonthlyComparison` 개선 + TrendBarChart 구현
7. `InsightsPage` props 전달 업데이트

---

## 비기능 요건

- 접힌/펼친 상태 localStorage 저장 없음 — 매 진입 시 접힌 상태로 초기화
- 애니메이션: chevron 회전만 (`transition-transform`). 높이 애니메이션은 미적용 (모바일 성능 고려)
- `id="section-savings"` 유지 — InsightsPage의 `handleDeepLink` 딥링크 호환성

## 테스트 영향 정리

| 컴포넌트 | 기존 테스트 | 처리 방향 |
|---|---|---|
| `BudgetVsActual` | `data-testid="budget-vs-actual"` | 유지 |
| `BudgetVsActual` | "budgetStats가 null이면 null 반환" | 유지 (`budgetStats===null` early return 동작 유지) |
| `CardUsageSummary` | `data-testid="card-usage-summary"` | 유지 |
| `MonthlyComparison` | `queryAllByTestId('sparkline')` | 제거 후 `queryByTestId('trend-bar-chart')` 추가 (trend 2개 이상 시 렌더 검증) + "비교할 이전 데이터가 없습니다" 텍스트 케이스 추가 |
| `MonthlyComparison` | `getByRole('button', { name: /펼치기/ })` | SectionHeader의 aria-label="펼치기/접기" 유지로 호환 |
| `RecurringManageSection` | `getByLabelText('펼치기')` | SectionHeader의 aria-label="펼치기/접기" 유지로 호환 |
| `RecurringManageSection` | `getAllByText(/금액/)` (헤더+푸터 양쪽) | 푸터 제거 후 `getByText(/금액/)` (단일 위치)로 수정 |
| `SavingsSection` | 기존 3개 props로 렌더 | `recurringTotal`, `expenseTotal` optional이므로 타입 에러 없음 |
| `SavingsSection` | 카테고리 1개 케이스 | chevron 미표시(`collapsible=false`) 검증 테스트 추가 |
| `UnifiedSummaryCards` | `data-testid="savings-rate-value"` | 변경 없음 (카드 범위 밖) |

## 가이드/체인지로그 업데이트

구현 완료 후:
- `frontend/src/data/changelogs.ts` — "수입 구성 카드 추가 (저축 → 수입 구성 업그레이드)" 항목 추가
- `frontend/src/pages/GuidePage.tsx` — 저축 섹션 설명을 수입 구성으로 업데이트

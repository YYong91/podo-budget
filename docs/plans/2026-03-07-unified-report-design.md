# 종합 리포트 설계 (InsightsPage 리뉴얼)

**작성일**: 2026-03-07
**상태**: 승인됨
**대상 파일**: `frontend/src/pages/InsightsPage.tsx`, `frontend/src/components/stats/`

---

## 목표

현재 주간/월간/연간/AI 탭 구조를 **단일 종합 리포트**로 교체한다.
사용자가 리포트를 열면 재무 건강 지표, 수입/지출 흐름, 예산 현황, 자동 인사이트를 한 화면에서 파악할 수 있어야 한다.

---

## UI 구조 (스크롤 순서)

```
[기간 선택] 주간 | 월간* | 연간  +  [◀ 2026년 3월 ▶]

[UnifiedSummaryCards]
  총 수입 | 총 지출 | 순수익 | 저축률

[CombinedTrendChart]
  수입선 + 지출선 (같은 차트, 두 선 사이 영역 = 저축)

[BudgetVsActual]          ← 월간 전용
  카테고리별 예산 대비 지출

[MonthlyHighlights]       ← 월간 전용
  룰 기반 자동 하이라이트 최대 4개

[AiAnalysisSection]
  "AI 심층 분석 생성하기" 버튼 + 결과 표시
```

---

## 컴포넌트 설계

### InsightsPage (리뉴얼)

- `activeTab` 상태 제거, `period` (weekly/monthly/yearly) + `dateStr` 만 유지
- 세 endpoint 병렬 호출 후 결과를 각 자식 컴포넌트에 전달
- 월간일 때만 BudgetVsActual, MonthlyHighlights 렌더링

### UnifiedSummaryCards (신규)

Props: `expenseTotal`, `incomeTotal`

계산:
- 순수익 = incomeTotal - expenseTotal
- 저축률 = 순수익 / incomeTotal × 100 (수입이 0이면 표시 안 함)

카드 색상:
- 순수익 양수 → leaf(초록), 음수 → red
- 저축률 ≥ 20% → 🟢, 10~20% → 🟡, < 10% → 🔴

### CombinedTrendChart (기존 TrendChart 확장)

Props: `expenseTrend: TrendPoint[]`, `incomeTrend: TrendPoint[]`

- 두 데이터셋을 Chart.js에 등록
- 지출선: grape(보라), 수입선: leaf(초록)
- 두 선 사이 영역을 연한 초록으로 fill (저축 시각화)
- 기존 TrendChart는 그대로 유지 (다른 곳에서 사용 중)

### MonthlyHighlights (신규)

Props: `expenseStats`, `incomeStats`, `budgetStats`, `comparisonData`

룰 목록 (우선순위 순):

| 우선순위 | 조건 | 메시지 |
|---------|------|--------|
| 1 (경고) | 순수익 < 0 | "이번 달 지출이 수입을 초과했습니다 ⚠️" |
| 2 (경고) | 예산 초과 카테고리 존재 | "{카테고리} 예산을 {N}원 초과했습니다" |
| 3 (일반) | 전월 대비 지출 카테고리 +30% 이상 | "{카테고리}가 지난달보다 {N}% 증가했습니다" |
| 4 (성취) | 저축률 ≥ 20% | "이번 달 저축률 {N}% 달성 🎉" |
| 5 (성취) | 전월 대비 총지출 -10% 이상 | "지난달보다 지출을 {N}원 줄였습니다 👍" |

최대 4개 표시. 해당 없으면 섹션 숨김.

### AiAnalysisSection

기존 AI 탭 기능 그대로 이식. 페이지 맨 아래 배치.

---

## 데이터 흐름

```
InsightsPage
  ↓ Promise.all
  ├── GET /expenses/stats?period=&date=&household_id=
  ├── GET /income/stats?period=&date=&household_id=
  └── GET /expenses/stats/comparison?period=&date=  (월간만)

  클라이언트 계산:
    순수익 = income.total - expense.total
    저축률 = 순수익 / income.total * 100
```

신규 백엔드 API 불필요.

---

## 기간별 표시 범위

| 섹션 | 주간 | 월간 | 연간 |
|------|------|------|------|
| UnifiedSummaryCards | ✅ | ✅ | ✅ |
| CombinedTrendChart | ✅ | ✅ | ✅ |
| BudgetVsActual | ❌ | ✅ | ❌ |
| MonthlyHighlights | ❌ | ✅ | ❌ |
| AiAnalysisSection | ✅ | ✅ | ✅ |

---

## 향후 확장 포인트

- **저축 목표 섹션**: Phase 2 완료 후 BudgetVsActual 아래에 추가
- **자산 총액 카드**: UnifiedSummaryCards에 5번째 카드로 추가 가능
- **하이라이트 룰 확장**: 연속 달성 감지 등 (현재는 단일 월 기준)

---

## 테스트 전략

- `UnifiedSummaryCards`: 순수익/저축률 계산 로직 unit test
- `MonthlyHighlights`: 각 룰 조건별 메시지 생성 unit test
- `InsightsPage`: MSW mock으로 통합 렌더링 테스트 (기존 테스트 리뉴얼)

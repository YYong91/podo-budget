# 카드 UI 디자인 토큰 규칙

## 색상 시스템 (Semantic Colors)

### 상태 색상
| 의미 | 텍스트 | 배경 | 보더 |
|------|--------|------|------|
| 성공/긍정 | `text-leaf-600` | `bg-leaf-500` | `border-leaf-200` |
| 경고/주의 | `text-amber-600` | `bg-amber-50` | `border-amber-200` |
| 오류/초과 | `text-red-600` | `bg-red-400` | — |
| 중립/정보 | `text-[var(--text-secondary)]` | — | — |

### 금액 색상
- 수입 금액: `text-leaf-600`
- 지출 금액: `text-[var(--text-primary)]` (기본, 강조 불필요)
- 초과 금액: `text-red-600`

### 금지 규칙
- `bg-warm-*`, `text-warm-*`, `border-warm-*` **직접 사용 금지**
- 경고 배경이 필요하면: `bg-amber-50 text-amber-700 border-amber-200`

## 타이포그래피

| 용도 | 클래스 |
|------|--------|
| 카드 섹션 헤더 | `text-base font-semibold text-[var(--text-primary)]` |
| 아이템 레이블 | `text-sm text-[var(--text-secondary)]` |
| 아이템 금액 | `text-sm font-medium tabular-nums text-[var(--text-primary)]` |
| 보조 수치/날짜 | `text-xs text-[var(--text-tertiary)]` |

- `tracking-tight` 사용 금지 — `tabular-nums`만 허용

## 간격

| 항목 | 값 |
|------|-----|
| 카드 내부 패딩 | `p-4 sm:p-6` |
| 헤더 → 본문 여백 | `mt-3` |
| 아이템 목록 간격 | `space-y-3` |
| 프로그레스바 높이 | `h-1.5` (HeroSummary만 `h-2` 예외) |

## UX 패턴

### 접기/펼치기
- `SectionHeader` chevron 방식으로 통일
- 하단 "더보기" 버튼 패턴 사용 금지

### 빈 상태
```tsx
<div className="text-center py-4 mt-3">
  <p className="text-sm text-[var(--text-tertiary)]">설명 문구</p>
  <Link to="/path" className="text-sm font-medium text-grape-600 hover:text-grape-700 mt-1 inline-block">
    액션 →
  </Link>
</div>
```

## 이모지 배정 (카드별 고유)

| 이모지 | 카드 |
|--------|------|
| 💡 | MonthlyHighlights — 이번 달 주목할 점 |
| 📋 | CategoryTopList — 지출 카테고리 |
| 💰 | BudgetVsActual — 예산 상황 |
| 🔄 | RecurringManageSection — 정기거래 |
| 💳 | CardUsageSummary — 카드 실적 |
| ⚖️ | SavingsSection — 지출 구성 |
| 📈 | MonthlyComparison — 지난달 비교 |

## 금액 포맷 함수 (utils/format.ts)

- `formatAmount(n)` → `"₩1,234,567"`
- `formatCompact(n)` → `"123만원"`, `"1.2억원"`
- `formatChange(n)` → `"+12만원"`, `"-3만원"` (부호 포함)

컴포넌트 내 로컬 중복 정의 금지.

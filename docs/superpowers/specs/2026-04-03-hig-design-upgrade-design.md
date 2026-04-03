# 포도가계부 HIG 디자인 업그레이드

## 목적

Apple Human Interface Guidelines 원칙(Clarity, Deference, Depth)을 기반으로 포도가계부 전체 화면의 디자인 완성도를 한 단계 올린다. 기능/플로우 변경 없이 디자인 언어를 통일하고 디테일을 챙긴다.

## 스코프

- **대상 화면**: 가계부 홈, 거래 입력/수정 폼, 돌아보기, 자산탭, 설정, 랜딩페이지
- **대상 모드**: 라이트 + 다크 모두
- **제외**: 기능 추가, 사용자 플로우 변경, 라우팅 변경
- **접근법**: 바텀업 — 디자인 토큰/공통 컴포넌트 먼저, 화면은 순차 적용

## HIG 핵심 원칙 적용

| 원칙 | 적용 |
|---|---|
| **Clarity** | 타이포그래피 계층으로 정보 우선순위 명확화. tabular-nums로 금액 정렬 |
| **Deference** | 스켈레톤 UI로 콘텐츠 구조 예측. 불필요한 border 제거, 여백으로 구분 |
| **Depth** | 히어로 카드로 시각적 계층. 모션으로 공간감. 다크모드 elevation 표현 |

---

## 1. 타이포그래피 스케일 & 금액 표시 시스템

### 문제

- 금액 표시가 `text-sm font-semibold`로 거래 설명과 거의 같은 크기
- letter-spacing을 NetWorthHero 하나에서만 사용
- 행간(line-height)이 Tailwind 기본값 그대로

### 디자인: 3단계 타이포 토큰

`index.css`에 유틸리티 클래스로 정의하여 전역 적용:

```css
/* 영웅 숫자 — 순자산, 월 합계 */
.text-display {
  @apply text-3xl font-bold tracking-tight leading-none;
}

/* 금액 — 거래 목록, 카드 내 금액 */
.text-amount {
  @apply text-sm font-semibold tabular-nums tracking-wide;
}
```

**핵심**:
- `tabular-nums` — 숫자 고정폭 정렬 (₩12,000과 ₩1,200이 같은 자릿수만큼 공간 차지)
- `tracking-wide` — 금액 숫자에 자간을 줘서 가독성 향상
- `tracking-tight` — 큰 숫자(히어로)는 조여서 덩어리감
- `leading-none` / `leading-snug` — 행간 조정으로 시각적 밀도 제어

### 적용 위치

| 용도 | 현재 | 변경 |
|---|---|---|
| 히어로 숫자 (순자산, 월 합계) | text-3xl font-bold | `.text-display` |
| 거래 목록 금액 | text-sm font-semibold | `.text-amount` |
| 섹션 제목 | text-lg font-semibold (유지) | 변경 없음 |
| 보조 텍스트 | text-sm text-secondary (유지) | 변경 없음 |

---

## 2. 스켈레톤 UI 시스템

### 문제

- 11개 페이지가 전부 `<LoadingSpinner>` (빙글빙글 원)
- 스켈레톤은 MonthlyView 1곳뿐
- 로딩→콘텐츠 전환 시 레이아웃 점프

### 디자인: 공통 프리미티브 + 페이지별 조합

**신규 파일**: `components/skeleton/Skeleton.tsx`

```tsx
// 기본 블록
<Skeleton className="h-4 w-32" />        // 텍스트 한 줄
<Skeleton className="h-8 w-48" />        // 큰 숫자
<Skeleton className="h-40 rounded-2xl" /> // 카드
<SkeletonCircle className="w-10 h-10" /> // 아바타/아이콘
```

- 내부: `animate-pulse bg-[var(--surface-hover)] rounded-lg`
- 다크모드: `bg-[var(--surface-elevated)]`로 자동 전환

**페이지별 스켈레톤**:

| 페이지 | 스켈레톤 구성 |
|---|---|
| 가계부 홈 | 히어로 골격 + 날짜헤더 + 거래 3줄 |
| 자산 대시보드 | 히어로 숫자 + 차트 영역 + 자산 그룹 2개 |
| 돌아보기 | 요약카드 4개 + 차트 + 카테고리 리스트 |
| 거래 상세 | 금액 + 카테고리 + 메모 영역 |
| 설정 | 섹션 헤더 + 항목 5줄 |

**기존 LoadingSpinner 유지 범위**: 버튼 내 로딩(`저장 중...`), 작은 인라인 로딩에서만 사용. 페이지 레벨 로딩은 전부 스켈레톤으로 교체.

---

## 3. 히어로 카드 & 정보 계층

### 문제

- 자산탭은 `NetWorthHero`로 잘 되어있음
- 가계부 홈에는 히어로가 없음 — 월 합계가 4칸으로 나뉘어 핵심 숫자 불명확
- 돌아보기도 요약 카드들이 동일 크기로 나열

### 디자인: 공통 HeroSection 컴포넌트

**신규 파일**: `components/HeroSection.tsx`

```tsx
<HeroSection
  label="4월 지출"
  amount={1240000}
  sublabel="수입 ₩3,200,000 · 잔액 +₩1,960,000"
/>
```

**레이아웃**:
```
┌─────────────────────────────┐
│  4월 지출                    │  ← text-sm text-tertiary
│  ₩1,240,000                 │  ← .text-display
│                              │
│  수입 ₩3,200,000  잔액 +1.96M│  ← text-xs text-muted
│  예산 대비 62% ████████░░░░  │  ← 프로그레스 바 (선택)
└─────────────────────────────┘
```

**적용**:
- 가계부 홈: 월간 지출 히어로 (기존 UnifiedSummaryCards 4칸 → 히어로 아래로 이동 또는 제거)
- 돌아보기: 첫 번째 카드를 히어로 크기로
- 자산탭: 기존 NetWorthHero에 `.text-display` 토큰만 교체

---

## 4. 거래 리스트 여백 & 그룹핑

### 문제

- 거래 아이템이 `px-4 py-3`으로 빡빡함 (48px)
- 날짜 그룹 헤더가 거래 아이템과 시각적 차이 적음
- 아이템 간 구분이 border 한 줄뿐

### 디자인

**거래 아이템 여백 확장**:
```
현재: px-4 py-3 (48px)
변경: px-4 py-4 (56px) — HIG 권장 44pt 충족 + 여유
```

**날짜 그룹 헤더 강화**:
```
┌─────────────────────────────┐
│  4월 3일 목요일        -₩32,000│  ← sticky, font-medium + 일별 합계 text-muted
│  ┊ 점심 김치찌개      ₩8,000  │
│  ┊ 커피             ₩4,500   │
│  ┊ 마트 장보기       ₩19,500  │
│                              │
│  4월 2일 수요일        -₩15,000│
└─────────────────────────────┘
```

**변경사항**:
- 날짜 헤더에 **일별 합계** 표시 (현재 없음)
- 헤더 배경: `surface-elevated`로 미세 구분
- 헤더와 아이템 사이 간격: `mt-2`
- 날짜 그룹 간 간격: `mt-6`
- **아이템 간 border 제거** — 여백으로 구분 (HIG: 불필요한 선 제거)
- 아이템 간 미세 간격: `gap-1`

---

## 5. 빈 상태 통일

### 문제

- EmptyState 컴포넌트가 13곳에서 사용 중이지만 톤이 제각각
- 어떤 곳은 아이콘+설명+버튼, 어떤 곳은 텍스트만

### 디자인: 3티어 시스템

기존 `EmptyState`에 `variant` prop 추가:

**Tier 1 — `variant="primary"`** (주요 탭: 홈, 자산, 돌아보기):
```
┌─────────────────────────────┐
│         🍇 (포도 아이콘)      │  ← 48x48, grape-100 원형 배경
│    아직 기록이 없어요          │  ← text-lg font-semibold
│    첫 지출을 입력하면          │  ← text-sm text-tertiary
│    여기에 정리돼요             │
│    [ 첫 거래 기록하기 ]        │  ← primary CTA
└─────────────────────────────┘
```

**Tier 2 — `variant="section"`** (카테고리, 예산, 정기거래):
```
(아이콘)
등록된 카테고리가 없습니다     ← text-sm text-secondary
[ 추가하기 ]                  ← small secondary button
```

**Tier 3 — `variant="inline"`** (검색 결과, 필터 결과):
```
검색 결과가 없습니다           ← text-sm text-muted, 중앙 정렬
```

**아이콘**: Lucide 포도(Grape) 아이콘으로 우선 구현. `icon` prop으로 커스텀 이미지 교체 가능하도록 설계. 추후 사용자가 제작한 커스텀 이미지로 교체 예정.

---

## 6. 모션 & 트랜지션

### 문제

- 애니메이션 키프레임 10개 정의되어 있으나 실제 사용 제한적
- 페이지 전환, 리스트 진입, 탭 전환에 모션 없음

### 디자인: CSS 애니메이션만, 라이브러리 도입 없음

**적용할 모션 3가지**:

**1) 페이지 콘텐츠 진입** — fade-in + 미세 slide-up:
```css
@keyframes page-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-page-in {
  animation: page-in 0.25s ease-out;
}
```
- 각 페이지 최상위 wrapper에 적용

**2) 카드/리스트 stagger 진입**:
```css
.animate-stagger > * {
  animation: page-in 0.2s ease-out both;
}
.animate-stagger > *:nth-child(1) { animation-delay: 0ms; }
.animate-stagger > *:nth-child(2) { animation-delay: 40ms; }
.animate-stagger > *:nth-child(3) { animation-delay: 80ms; }
.animate-stagger > *:nth-child(4) { animation-delay: 120ms; }
.animate-stagger > *:nth-child(5) { animation-delay: 160ms; }
```
- 최대 5개까지 stagger, 이후는 즉시 표시
- 홈 거래 목록, 자산 그룹, 돌아보기 카드에 적용

**3) 바텀시트/모달 스프링 개선**:
```css
@keyframes sheet-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
/* iOS 스프링 근사값 */
animation: sheet-up 0.3s cubic-bezier(0.32, 0.72, 0, 1);
```

**명시적으로 안 하는 것**:
- 페이지 간 슬라이드 전환 (framer-motion 필요, 번들 부담)
- 숫자 카운트업 애니메이션 (매번 보면 피로)
- 탭 전환 애니메이션 (즉시 전환이 더 빠릿함)

---

## 7. 폼 UI 통일

### 문제

- 포커스 링 색상이 폼마다 다름 (grape-500, leaf-500 혼재)
- 에러 상태, 라벨 스타일, 인풋 높이가 표준화 안 됨

### 디자인: 폼 토큰

**인풋 기본 스타일** (`index.css`):
```css
.input-base {
  @apply w-full px-3 py-3 text-sm
    bg-[var(--input-bg)] text-[var(--text-primary)]
    border border-[var(--input-border)] rounded-xl
    focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-400
    transition-colors;
}
```
- 높이 통일: `py-3` (44px — HIG 최소 터치 타겟)
- 포커스 링: 항상 grape (수입/지출 구분 없이 통일)
- 라운딩: `rounded-xl` (버튼과 동일)

**라벨**: `text-sm font-medium text-[var(--text-secondary)] mb-1.5`

**에러**: `border-rose-400 focus:ring-rose-500/30` + 하단 `text-xs text-rose-500 mt-1`

**disabled**: `opacity-50 cursor-not-allowed bg-[var(--surface-elevated)]`

**금액 인풋 특별 처리**: `text-2xl font-bold tabular-nums tracking-tight text-center`

---

## 8. 다크모드 디테일

### 문제

- 기본 구조는 잘 되어있으나 그림자/그라데이션의 다크 대응 부족

### 디자인: 보정 포인트 5가지

**1) 카드 elevation — shadow → border**:
```css
.dark {
  /* 다크에서 shadow-sm이 안 보이므로 border로 깊이 표현 */
}
```
- 라이트: `shadow-sm` 유지
- 다크: shadow 제거, `border border-[var(--border-default)]`로 대체

**2) 히어로 그라데이션 다크 버전**:
```
라이트: from-grape-50 to-grape-50/50
다크:   from-grape-900/30 to-grape-800/20
```
- 진한 배경 위 은은한 보라빛 — Grape 브랜드 유지

**3) 스켈레톤 다크 색상**:
```
라이트: bg-[var(--surface-hover)]
다크:   bg-[var(--surface-elevated)]
```
- 명도 차이를 키워서 pulse 맥동이 보이게

**4) 금액 색상 가독성**:
```
라이트 수입: leaf-600
다크 수입:   leaf-400 (어두운 배경에서 더 밝게)
```
- 기존 dark override 확인 후 누락분 보정

**5) 인풋 포커스 링**:
```
라이트: ring-grape-500/30
다크:   ring-grape-400/40 (어두운 배경에서 더 밝게)
```

---

## PR 분할 전략

| PR | 내용 | 의존성 |
|---|---|---|
| **PR 1: 디자인 토큰 + 공통 컴포넌트** | 타이포 유틸리티, Skeleton 프리미티브, EmptyState variant, 폼 토큰, 모션 키프레임, 다크모드 보정 | 없음 |
| **PR 2: 가계부 홈** | HeroSection, 거래 리스트 여백/그룹핑, 스켈레톤 교체, 빈 상태 적용 | PR 1 |
| **PR 3: 돌아보기 + 입력폼** | 돌아보기 히어로, TransactionForm/AssetForm 폼 토큰, 스켈레톤 | PR 1 |
| **PR 4: 자산탭 + 설정** | 자산탭 디자인 언어 통일, 설정 정리, 나머지 스켈레톤/빈 상태 | PR 1 |
| **PR 5: 모션 + 최종 polish** | 페이지 진입 애니메이션, stagger, 바텀시트 스프링, 다크모드 QA | PR 2-4 |

PR 2, 3은 서로 독립 — 병렬 진행 가능.

## 기존 이슈 연계

| 이슈 | 관계 |
|---|---|
| #74 (성능 최적화) | 스켈레톤 UI가 체감 속도 개선에 기여 |
| #116 (React Query) | 스켈레톤과 함께 도입하면 시너지. 이번 스코프에서는 미포함 |
| #482 (자산 재설계) | v2 완료 상태. 디자인 토큰만 통일 |
| #540-545 (자산탭 디테일) | PR 4에서 일부 해소 가능 |

## 기술 제약

- **외부 라이브러리 추가 없음** — framer-motion, @nivo 등 미도입. CSS + Tailwind만 사용
- **Tailwind v4** — `@theme` + CSS custom properties 기반. tailwind.config.js 아님
- **Recharts** — 차트 라이브러리 교체 없음. 기존 스타일링 범위 내 개선
- **Pretendard 폰트** — 유지. 자간/행간 조정으로 활용도 높임
- **빈 상태 아이콘** — Lucide 포도 아이콘으로 우선 구현, 추후 커스텀 이미지로 교체 예정

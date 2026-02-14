# HomeNRich UI 리디자인 설계서

**작성일**: 2026-02-14
**방향**: 웜 & 프렌들리 — 부부/커플이 함께 쓰는 가계부에 맞는 따뜻하고 친근한 디자인
**접근**: 커스텀 디자인 시스템 (Tailwind CSS v4 위에 디자인 토큰 + Lucide React 아이콘)

---

## 1. 컬러 팔레트

### Primary: Amber/Honey

```
primary-50:  #FFFBEB
primary-100: #FEF3C7
primary-200: #FDE68A
primary-300: #FCD34D
primary-400: #FBBF24
primary-500: #F59E0B
primary-600: #D97706  (메인 CTA)
primary-700: #B45309  (hover)
primary-800: #92400E
primary-900: #78350F
```

### Neutral: Stone (Warm Gray)

기존 `gray` → `stone` 계열로 전면 교체.

```
배경:     stone-50  (#FAFAF9)
카드:     white
텍스트:   stone-900 (제목), stone-600 (본문), stone-400 (보조)
테두리:   stone-200
```

### Accent

- Success: Emerald-500 (`#10B981`)
- Danger: Rose-500 (`#F43F5E`)
- Info: Sky-500 (`#0EA5E9`)

### 차트 팔레트

```
['#D97706', '#0EA5E9', '#10B981', '#F43F5E', '#8B5CF6', '#EC4899', '#06B6D4', '#78716C']
```

---

## 2. 레이아웃

### 헤더
- 높이: `h-14` → `h-16`
- 하단 amber gradient 라인 (`from-amber-400 to-transparent`)
- 로고: Lucide `Home` 아이콘 + "HomeNRich" (`text-amber-600 font-bold`)

### 사이드바
- 너비: `w-56` → `w-60`
- 배경: `bg-white` → `bg-stone-50`
- 활성 메뉴: `bg-amber-50 text-amber-800 border-l-3 border-amber-500`
- 비활성: `text-stone-600 hover:bg-stone-100`
- 메뉴 패딩: `py-2` → `py-2.5`

### 카드 계층
- 일반: `bg-white rounded-2xl border border-stone-200/60 shadow-sm`
- 강조: `bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60`
- 액션: `bg-white rounded-2xl border-2 border-dashed border-stone-300`

---

## 3. 타이포그래피

폰트: Pretendard 유지.

| 요소 | 변경 후 |
|------|---------|
| 페이지 제목 | `text-xl font-semibold text-stone-800` |
| 카드 제목 | `text-base font-semibold text-stone-700` |
| 금액 (대) | `text-2xl font-bold tracking-tight` |
| 본문 | `text-sm text-stone-500` |
| 라벨 | `text-xs font-medium text-stone-400 uppercase tracking-wider` |

---

## 4. 컴포넌트

### 버튼

| 타입 | 스타일 |
|------|--------|
| Primary | `bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-5 py-2.5 font-medium shadow-sm shadow-amber-200` |
| Secondary | `bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 rounded-xl` |
| Ghost | `text-stone-600 hover:bg-stone-100 rounded-xl` |
| Danger | `bg-rose-600 hover:bg-rose-700 text-white rounded-xl` |

### Input / Select

`rounded-xl border-stone-300 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500`

### 아이콘 (Lucide React)

| 메뉴 | 아이콘 |
|------|--------|
| 대시보드 | `LayoutDashboard` |
| 지출 목록 | `Receipt` |
| 지출 입력 | `PlusCircle` |
| 카테고리 | `Tags` |
| 예산 관리 | `PiggyBank` |
| 인사이트 | `TrendingUp` |
| 공유 가계부 | `Users` |
| 설정 | `Settings` |
| 받은 초대 | `Mail` |

### 로딩 스피너

Lucide `Loader2` + `animate-spin` (기존 border 스피너 대체)

### Empty State

이모지 → Lucide 아이콘 + 원형 amber 배경:
```html
<div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
  <Icon class="w-8 h-8 text-amber-400" />
</div>
```

---

## 5. 페이지별 변경

### 로그인
- Lucide `Home` 아이콘 + amber-600 로고
- 카드 `rounded-2xl`, 탭 라인 amber
- 서브카피: "부부가 함께 쓰는 AI 가계부"

### 대시보드
- 총 지출 카드: amber 그라데이션 강조 카드
- 차트 팔레트 교체
- 최근 지출 행에 카테고리 색상 dot

### 지출 입력
- textarea `bg-amber-50/50` 배경
- CTA 버튼 amber
- 프리뷰 카드 `border-l-4 border-amber-400`

### 지출 목록
- 테이블 헤더 `bg-stone-50`, 정렬 아이콘 amber
- 행 호버 `hover:bg-amber-50/50`
- 카테고리 뱃지 amber 계열

### 기타 페이지
- 동일한 디자인 토큰 적용 (stone neutral + amber accent)
- 위험 동작(계정 삭제 등)은 rose 계열 유지

---

## 6. 마이크로 인터랙션

- 카드 호버: `hover:shadow-md transition-shadow duration-200`
- 버튼 클릭: `active:scale-[0.98] transition-transform`
- 사이드바 메뉴: `transition-all duration-150`
- 과도한 애니메이션 없이 절제된 피드백만

---

## 7. 변경하지 않는 것

- 라우팅 구조 (React Router v7)
- 상태 관리 (Zustand, AuthContext)
- API 호출 로직
- 컴포넌트 파일 구조 (기존 파일 수정)
- 백엔드 코드

---

## 8. 신규 의존성

- `lucide-react` — SVG 아이콘 라이브러리 (tree-shaking 지원)

---

## 9. 테스트 영향

- Testing Library는 role/text 기반 쿼리 → className 변경에 영향 없음
- `EmptyState` props (icon: string → Lucide component) 변경 시 관련 테스트 조정 필요
- 전체 테스트 통과 확인 후 커밋

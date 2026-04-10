# Transaction Detail Redesign — 스펙 문서

**날짜**: 2026-04-10
**범위**: ExpenseDetail, IncomeDetail → TransactionDetail 통합 + UX 개선
**방향**: A++ (인라인 편집 유지, 뷰/편집 이중 레이아웃, 명확한 모드 전환)

---

## 배경 및 목표

### 문제
현재 `ExpenseDetail` / `IncomeDetail`은:
- 두 파일이 거의 동일한 코드 (복붙 수준)
- 8개 필드가 동등한 시각적 비중으로 나열 → 정보 계층 없음
- 수정/삭제/정기거래 버튼이 상단 우측 → 모바일 엄지 존 위반
- 편집 모드 진입 시 시각적 변화 없음 → "내가 수정 중인가?" 모호
- 빈 값 필드도 `-`로 공간 차지 → 노이즈
- 정기거래 연결 여부가 뷰 모드에서 불명확

### 주요 사용 패턴
**AI 파싱 후 수정이 80% 이상.** 특히 카테고리·결제수단 오분류 수정이 가장 빈번.
"수정하러 가기" 토스트 → 상세 페이지 직접 진입 플로우 존재.

---

## 컴포넌트 구조

`TransactionForm` 패턴과 동일하게 통합:

```
components/TransactionDetail.tsx                  ← 공통 로직 + UI
components/__tests__/TransactionDetail.test.tsx   ← 주 테스트 (신규)
pages/ExpenseDetail.tsx                           ← <TransactionDetail type="expense" /> wrapper
pages/IncomeDetail.tsx                            ← <TransactionDetail type="income" /> wrapper
pages/__tests__/ExpenseDetail.test.tsx            ← wrapper 스모크 테스트로 간소화
pages/__tests__/IncomeDetail.test.tsx             ← wrapper 스모크 테스트로 간소화
```

### type별 설정 (TYPE_CONFIG)
| 항목 | expense | income |
|------|---------|--------|
| 색상 | grape | leaf |
| 금액 prefix | 없음 | `+` |
| 금액 색상 | text-primary | leaf-600 |
| 결제수단 필드 | 있음 | 없음 |
| 카테고리 API 파라미터 | `{ type: 'expense' }` | `{ type: 'income' }` |
| 목록 라우트 | `/expenses` | `/income` |
| 페이지 제목 | `지출 내역` | `수입 내역` |

> `categoryApi.getAll({ type })` 이 서버 사이드 필터링을 지원하므로 클라이언트 필터링 불필요.
> `Category.type === 'both'`인 항목은 서버에서 양쪽 요청에 모두 포함해 반환한다.
> **버그 수정 포함**: 기존 `IncomeDetail`은 `categoryApi.getAll()` (파라미터 없음)을 사용해
> 지출 전용 카테고리까지 노출했음. 이번 리팩토링에서 `{ type: 'income' }` 필터로 동시 수정.

---

## 뷰 모드 (View Mode)

### 레이아웃

```
┌─────────────────────────────────┐
│ ← 뒤로   지출 내역               │  ← 페이지 제목 표시
├─────────────────────────────────┤
│                                 │
│  ₩8,000              (히어로)   │  text-4xl font-bold
│  김치찌개                       │  text-lg font-medium
│                                 │
│  🍚 식비 ▾  💳 카카오페이 ▾     │  ← 칩 (min-h-[44px])
│                                 │  ← 칩과 날짜 사이 8px 스페이서
│  2026.03.15                     │  text-xs text-muted
│                                 │
├─────────────────────────────────┤
│  메모: 회사 근처                 │  ← 값 있을 때만 표시
│  🤖 원본 입력                   │  ← raw_input 있을 때만
│  [통계 제외] 뱃지               │  ← exclude_from_stats=true일 때만
│  🔁 정기거래 연결됨             │  ← recurring_transaction_id 있을 때만
│  [+ 정기거래 등록]              │  ← recurring_transaction_id 없을 때만
├─────────────────────────────────┤
│  생성 2026.03.15 · 수정 ...     │  ← 메타 (text-xs, text-muted)
├─────────────────────────────────┤
│                                 │
│  [          수정          ]     │  ← full-width, solid grape/leaf
│          gap-4 (16px)           │
│           삭제하기               │  ← text-sm, center, text-rose-500, py-4
│                                 │
└─────────────────────────────────┘
```

### 타이포그래피 계층
| 요소 | 크기 | 굵기 | 색상 |
|------|------|------|------|
| 금액 (히어로) | `text-4xl` (36px) | `font-bold` | expense: `text-primary`, income: `leaf-600` |
| 설명 | `text-lg` (18px) | `font-medium` | `text-primary` |
| 칩 텍스트 | `text-sm` (14px) | `font-medium` | `text-secondary` |
| 날짜 | `text-xs` (12px) | `font-normal` | `text-muted` |
| 보조 정보 | `text-sm` (14px) | `font-normal` | `text-secondary` |
| 메타 (생성/수정) | `text-xs` (12px) | `font-normal` | `text-muted` |

### 페이지 제목
- 네비게이션 바에 `← 뒤로` + 제목 (`지출 내역` / `수입 내역`) 표시
- TYPE_CONFIG에서 제목 관리

### 하단 액션 버튼 배치
- **수정 버튼**: full-width, solid 색상 (grape-600 / leaf-600), `rounded-xl`, `py-3`
- **삭제하기**: `text-sm`, `text-rose-500`, center 정렬, `py-4` (터치 타겟 48px 확보)
- 두 버튼 사이 간격: `gap-4` (16px) — "같은 액션 그룹이지만 별개"
- 삭제는 카드 바깥, 수정과 함께 페이지 레벨 액션으로 배치
- 삭제는 filled 버튼이 아닌 텍스트 버튼으로 시각적 무게를 낮춤

### 정기거래 처리
- `recurring_transaction_id` 있음 → "🔁 정기거래 연결됨" 뱃지 표시 (링크 없음, 이번 스코프)
- `recurring_transaction_id` 없음 → "[+ 정기거래 등록]" 텍스트 버튼 → `RegisterRecurringModal` 오픈
- 모달 onSuccess → `fetchData()` 재호출 (기존 동작 유지)
- 편집 모드에서는 정기거래 섹션 숨김

### 카테고리 칩 빠른 수정
- 칩 탭 → **칩 행 전체가 `<select>` 한 줄로 교체** (레이아웃 시프트 방지)
- 칩 최소 터치 타겟: `min-h-[44px]` (HIG 준수)
- **iOS `<select>` 참고**: iOS Safari에서 `<select>`는 하단 피커 휠(UIPickerView)을 트리거함.
  이 동작은 네이티브 iOS 패턴과 일치하므로 커스텀 피커 없이 그대로 활용.
  피커 닫힘 애니메이션과 칩 피드백이 겹치므로 bounce 대신 **color flash** 사용 (아래 애니메이션 섹션 참조).
- 저장 중: `quickEditField` 유지 + select `disabled` 처리 (스피너 없음, 단순하게)
- 선택 변경 즉시 API 저장
- 저장 성공 → 칩으로 복귀 + **칩 color flash** (grape-200/leaf-200 하이라이트 400ms → 원래 색상)
- 저장 실패 → error toast + 원래 값으로 즉시 복귀 (낙관적 업데이트 없음)
- 빠른 수정 중 "수정" 버튼 탭 → `quickEditField = null` 초기화(변경 미저장) 후 편집 모드 진입
- 두 칩 동시 탭 불가: `quickEditField !== null`이면 비활성 칩 `opacity-50` 처리 + 탭 무시

### 결제수단 칩 빠른 수정
- `PaymentMethod.type` 기반 아이콘:
  - `credit_card` / `debit_card` → 💳
  - `cash` → 💵
  - `transfer` → 🏦
- 저장 중: select `disabled` 처리
- 저장 성공 → 칩 color flash (카테고리와 동일)
- 저장 실패 → error toast + 원래 값으로 즉시 복귀
- 결제수단 없을 때 → 칩 미표시 (편집 모드에서만 노출)
- 빠른 수정 중 "수정" 버튼 탭 → 카테고리와 동일 처리
- 비활성 칩: `opacity-50` (카테고리와 동일)

### 빈 값 처리 원칙
- 메모 없음 → 섹션 자체 숨김
- 통계 제외 = false → 숨김
- 결제수단 없음 → 칩 숨김
- 정기거래 미연결 → 등록 버튼 표시 (위 정기거래 처리 참조)

---

## 편집 모드 (Edit Mode)

### 진입 방법
1. 뷰 모드 하단 "수정" 버튼 클릭
2. URL `?edit=true` 파라미터 (토스트 "수정하러 가기"에서 직접 진입)

### 레이아웃

```
┌─────────────────────────────────┐
│ ← 뒤로   지출 내역               │
├─────────────────────────────────┤
│ ┌─ 카드 (색상 틴트) ──────────┐ │
│ │  border: grape-300/leaf-300  │ │  ← 카드 테두리 색상 변경
│ │  bg: grape-50/leaf-50        │ │  ← 카드 내부만 옅은 틴트
│ │                              │ │
│ │  금액    [ ₩ 8,000         ] │ │
│ │  설명    [ 김치찌개         ] │ │
│ │  카테고리 [ 🍚 식비 ▾      ] │ │
│ │  결제수단 [ 💳 카카오페이 ▾] │ │  ← expense only
│ │  날짜    [ 2026.03.15      ] │ │
│ │  메모    [ 회사 근처        ] │ │
│ │                              │ │
│ │  ○ 통계에서 제외             │ │
│ │    저축, 퇴직금 등 비정형     │ │
│ └──────────────────────────────┘ │
│                                   │
│  [    목록으로    ]  [    저장    ] │  ← sticky 하단 CTA
└───────────────────────────────────┘
```

> 편집 모드 시각적 전환:
> - 페이지 배경은 그대로 유지 (`var(--surface)`)
> - **카드 테두리**: `grape-300` (expense) / `leaf-300` (income)
> - **카드 배경**: `grape-50` (expense) / `leaf-50` (income)
> - 카드 내부의 `surface-elevated` 요소와 대비 유지

### 편집 모드 규칙
- 삭제 버튼: 편집 모드에서 숨김 (액션 혼재 방지)
- 정기거래 섹션: 편집 모드에서 숨김
- 저장 → API PUT → 성공 시 `setTransaction(updated.data)` + `setEditForm(updated.data)` 동기화 → 뷰 모드 복귀 + success toast
- "목록으로" → `navigate(listRoute)` (아래 참조)
- 카테고리 목록: `categoryApi.getAll({ type })` 사용 (TYPE_CONFIG 참조)

### editForm 동기화
- 저장 성공 시: `updated.data`로 `transaction` state와 `editForm` 모두 업데이트
- 이후 재편집 진입 시 항상 최신 서버 데이터 기반으로 폼 초기화됨

### "목록으로" 버튼 (구 "취소")
- 라벨을 **"취소"에서 "목록으로"로 변경** — 실제 동작(목록 이동)과 라벨 일치
- `?edit=true` 진입이든 버튼 진입이든 **항상 `navigate(listRoute)`**
- 이유: `navigate(-1)` 사용 시 토스트 진입 케이스에서 히스토리 스택이 불안정
- 기존 테스트에서 "취소 → 뷰 모드 복귀" 검증 → "목록으로 → navigate" 로 변경 필요

### 미저장 변경사항 확인 (Dirty Form Guard)
- "목록으로" 탭 시 `editForm`이 원본 `transaction`과 다르면(dirty) 확인 다이얼로그 표시:
  > "변경사항이 저장되지 않았습니다. 이동하시겠습니까?"
  > [머무르기] [이동하기]
- 변경 없으면 바로 이동
- "이동하기" → `navigate(listRoute)`, "머무르기" → 편집 모드 유지
- dirty 판별: `JSON.stringify(editForm) !== JSON.stringify(toEditForm(transaction))`

---

## 삭제 UX

- 뷰 모드 하단에 텍스트 버튼으로 항상 표시 (가계부 특성상 중복 삭제 빈번)
- 탭 → 확인 모달 (기존 유지)
- 삭제 완료 → `navigate(listRoute)`

---

## 로딩 / 에러 상태

| 상태 | 처리 |
|------|------|
| 초기 로딩 중 | 기존 `<Skeleton>` 컴포넌트 유지 |
| 네트워크 에러 (non-404) | 기존 `<ErrorState onRetry>` 컴포넌트 |
| 404 (거래 없음) | `notFound` 상태로 분리 → "내역을 찾을 수 없습니다" + 목록 링크 |
| 403 (권한 없음) | error toast ("권한이 없습니다") |
| 빠른 수정 저장 실패 | error toast + 원래 값 복귀 |
| 편집 모드 저장 실패 | error toast, 편집 모드 유지 |

> 404와 그 외 에러를 분리하기 위해 에러 상태를 `boolean` 대신 `'none' | 'error' | 'notFound'` union으로 설계.

---

## URL 파라미터

| 파라미터 | 동작 |
|---------|------|
| 없음 | 뷰 모드로 오픈 |
| `?edit=true` | 편집 모드로 바로 오픈 |

### ?edit=true 링크 수정 대상
- `components/QuickInput.tsx` line ~122: `/expenses/${id}` → `/expenses/${id}?edit=true`로 변경
- `components/__tests__/ActionToast.test.tsx`: editPath fixture `/expenses/10` → `/expenses/10?edit=true` 업데이트

---

## 상태 설계

```typescript
type DetailMode = 'view' | 'edit'
type QuickEditField = 'category' | 'payment_method' | null
type ErrorState = 'none' | 'error' | 'notFound'

// 주요 상태 변수
// - mode: 'view' | 'edit'
// - quickEditField: view 모드에서만 유효. null이면 칩 탭 가능
// - isSaving: 빠른 수정 PUT 진행 중 여부
//     → true인 동안: 두 칩 모두 탭 무시, "수정" 버튼도 탭 무시
// - errorState: 'none' | 'error' | 'notFound'
```

### `?edit=true` 초기 모드 파싱
`useSearchParams`로 파싱하되, **lazy initializer** 사용 필수:

```typescript
const [searchParams] = useSearchParams()
const [mode, setMode] = useState<DetailMode>(() =>
  searchParams.get('edit') === 'true' ? 'edit' : 'view'
)
```

`useEffect`로 처리하면 첫 렌더링에 뷰 모드 플래시 발생. lazy initializer로 초기값 결정.

### 편집 모드 진입 시 `editForm` 초기화
**`mode`를 `'edit'`으로 전환할 때마다 항상 현재 `transaction` state로 `editForm` 재초기화.**
빠른 수정(카테고리/결제수단 PUT)이 먼저 실행된 경우 `transaction`이 이미 최신값이므로 안전.

```typescript
const enterEditMode = () => {
  setEditForm(toEditForm(transaction))  // 항상 재초기화
  setMode('edit')
}
```

### 언마운트 경쟁 조건 방지
빠른 수정 핸들러에서 `await` 후 `setState` 호출 시 언마운트 경쟁 가능. `isMountedRef` 패턴 사용:

```typescript
const isMountedRef = useRef(true)
useEffect(() => () => { isMountedRef.current = false }, [])

// 빠른 수정 핸들러 내부
const res = await expenseApi.update(...)
if (!isMountedRef.current) return
setTransaction(res.data)
```

---

## 접근성 (a11y)

- 뒤로가기 링크: `aria-label="목록으로"`
- 페이지 제목: 시각적 표시 + `<h1>` 태그
- 칩 버튼: `role="button"`, `aria-label="카테고리 변경"` / `aria-label="결제수단 변경"`
- 칩 최소 터치 타겟: `min-h-[44px]` (iOS HIG 준수)
- 삭제 모달: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- 삭제 텍스트 버튼: `py-4` (터치 타겟 48px)
- 편집 모드 sticky CTA: `position: sticky; bottom: 0`
- **빠른 수정 피드백 (스크린 리더)**: `aria-live="polite"` 영역 추가.
  저장 성공 시 "카테고리가 식비로 변경되었습니다", 실패 시 에러 메시지 announce.
- **모드 전환 announce**: `aria-live="polite"` status 영역으로 "편집 모드" / "보기 모드" announce.
- **`grape-50` 배경 대비**: 편집 모드 카드 배경 위 인풋 보더/플레이스홀더가 WCAG AA (4.5:1 텍스트, 3:1 UI) 충족하는지 구현 시 검증.

---

## 애니메이션

| 요소 | 효과 | 시점 |
|------|------|------|
| 페이지 진입 | `animate-page-in` | 마운트 시 |
| 빠른 수정 저장 성공 | 칩 color flash (grape-200/leaf-200 → 원래 색, 400ms) | PUT 성공 후 |
| 편집 모드 전환 | 카드 배경/테두리 `transition-colors` (200ms) | 모드 전환 시 |
| sticky CTA 등장 | `translate-y + opacity` transition | 편집 모드 진입 시 |

> **`prefers-reduced-motion` 처리**: 모든 애니메이션은 `@media (prefers-reduced-motion: reduce)` 시 비활성화.
> color flash는 즉시 전환(duration: 0)으로, page-in은 opacity만 유지(transform 제거).

---

## 테스트 MSW 전략

- `handlers.ts`에 기본 핸들러 추가: `GET /expenses/:id`, `GET /income/:id`, `GET /categories?type=expense`, `GET /categories?type=income`, `GET /payment-methods`
- `PUT /expenses/:id`, `PUT /income/:id` 성공 케이스도 기본 핸들러에 추가
- **저장 실패 케이스**는 테스트 내 `server.use()` 인라인 오버라이드 사용:
  ```typescript
  server.use(http.put('/api/expenses/:id', () => HttpResponse.error()))
  ```

---

## 테스트 커버리지 (TransactionDetail.test.tsx)

### 뷰 모드
- 금액(text-4xl)/설명/날짜/카테고리 칩/결제수단 칩 렌더링
- 페이지 제목 표시 (지출 내역 / 수입 내역)
- 빈 필드(메모 없음, 결제수단 없음) 숨김 검증
- 정기거래 연결됨 → 뱃지 표시, 등록 버튼 없음
- 정기거래 미연결 → 등록 버튼 표시, 뱃지 없음
- 삭제하기 텍스트 버튼 존재 (수정 버튼과 분리 확인)

### 빠른 수정 (핵심)
- 카테고리 칩 클릭 → 드롭다운 오픈 (칩 행이 select로 교체)
- 카테고리 선택 → API PUT 호출
- 저장 중 select disabled 처리
- 저장 성공 → 칩으로 복귀 + bounce 애니메이션
- 저장 실패 → 원래 값 복귀 + error toast
- 빠른 수정 열린 상태에서 "수정" 버튼 클릭 → 편집 모드 진입 (빠른 수정 닫힘)
- 결제수단 칩: 위 카테고리와 동일 시나리오

### 편집 모드
- "수정" 버튼 클릭 → 편집 모드 진입 + 카드 배경/테두리 색상 변화
- `?edit=true` URL → 초기 렌더링부터 편집 모드
- 저장 성공 → 뷰 모드 복귀 + updated 데이터 반영
- "목록으로" (clean form) → 바로 `navigate('/expenses')` 호출
- "목록으로" (dirty form) → 확인 다이얼로그 표시 → "이동하기" 클릭 시 navigate
- 저장 실패 → 편집 모드 유지 + error toast

### 에러/로딩
- 로딩 중 Skeleton 렌더링
- API 에러 → ErrorState 렌더링
- 404 → "찾을 수 없습니다" 메시지

---

## 변경 파일 목록

| 파일 | 변경 유형 |
|------|---------|
| `components/TransactionDetail.tsx` | 신규 생성 |
| `components/__tests__/TransactionDetail.test.tsx` | 신규 생성 (주 테스트) |
| `pages/ExpenseDetail.tsx` | wrapper로 간소화 |
| `pages/IncomeDetail.tsx` | wrapper로 간소화 |
| `pages/__tests__/ExpenseDetail.test.tsx` | wrapper 스모크 테스트로 간소화 |
| `pages/__tests__/IncomeDetail.test.tsx` | wrapper 스모크 테스트로 간소화 |
| `components/QuickInput.tsx` | editPath에 `?edit=true` 추가 (~122줄) |
| `components/__tests__/ActionToast.test.tsx` | editPath fixture 업데이트 |
| `mocks/handlers.ts` | TransactionDetail용 MSW 핸들러 추가 |

---

## 스코프 외 (이번에 하지 않는 것)

- 정기거래 연결 뱃지에서 정기거래 상세로의 링크
- 날짜 선택 커스텀 피커
- 상세 → 편집 페이지 분리 (방향 B)

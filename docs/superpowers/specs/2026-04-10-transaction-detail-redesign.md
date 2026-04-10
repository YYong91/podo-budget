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

> `categoryApi.getAll({ type })` 이 서버 사이드 필터링을 지원하므로 클라이언트 필터링 불필요.
> `Category.type === 'both'`인 항목은 서버에서 양쪽 요청에 모두 포함해 반환한다.
> **버그 수정 포함**: 기존 `IncomeDetail`은 `categoryApi.getAll()` (파라미터 없음)을 사용해
> 지출 전용 카테고리까지 노출했음. 이번 리팩토링에서 `{ type: 'income' }` 필터로 동시 수정.

---

## 뷰 모드 (View Mode)

### 레이아웃

```
┌─────────────────────────────────┐
│ ← 뒤로                          │
├─────────────────────────────────┤
│                                 │
│  ₩8,000              (큰 금액)  │
│  김치찌개             (설명)     │
│                                 │
│  🍚 식비 ▾  💳 카카오페이 ▾     │  ← 탭 → 인라인 드롭다운
│  2026.03.15                     │
│                                 │
├─────────────────────────────────┤
│  메모: 회사 근처                 │  ← 값 있을 때만 표시
│  🤖 원본 입력                   │  ← raw_input 있을 때만
│  [통계 제외] 뱃지               │  ← exclude_from_stats=true일 때만
│  🔁 정기거래 연결됨 →           │  ← recurring_transaction_id 있을 때만
│  [+ 정기거래 등록]              │  ← recurring_transaction_id 없을 때만
├─────────────────────────────────┤
│  생성 2026.03.15 · 수정 ...     │  ← 메타 (작고 muted)
├─────────────────────────────────┤
│  [        수정        ]         │  ← primary 버튼
│  [        삭제        ]         │  ← danger 버튼 (항상 노출)
└─────────────────────────────────┘
```

### 정기거래 처리
- `recurring_transaction_id` 있음 → "🔁 정기거래 연결됨" 뱃지 표시 (링크 없음, 이번 스코프)
- `recurring_transaction_id` 없음 → "[+ 정기거래 등록]" 텍스트 버튼 → `RegisterRecurringModal` 오픈
- 모달 onSuccess → `fetchData()` 재호출 (기존 동작 유지)
- 편집 모드에서는 정기거래 섹션 숨김

### 카테고리 칩 빠른 수정
- 칩 탭 → 칩 자리에 `<select>` 드롭다운 인라인 오픈
- 저장 중: `quickEditField` 유지 + select `disabled` 처리 (스피너 없음, 단순하게)
- 선택 변경 즉시 API 저장
- 저장 성공 → 칩으로 복귀 + success toast
- 저장 실패 → error toast + 원래 값으로 즉시 복귀 (낙관적 업데이트 없음)
- 빠른 수정 중 "수정" 버튼 탭 → `quickEditField = null` 초기화(변경 미저장) 후 편집 모드 진입
- 두 칩 동시 탭 불가: `quickEditField !== null`이면 다른 칩 탭 무시

### 결제수단 칩 빠른 수정
- `PaymentMethod.type` 기반 아이콘:
  - `credit_card` / `debit_card` → 💳
  - `cash` → 💵
  - `transfer` → 🏦
- 저장 중: select `disabled` 처리
- 저장 실패 → error toast + 원래 값으로 즉시 복귀
- 결제수단 없을 때 → 칩 미표시 (편집 모드에서만 노출)
- 빠른 수정 중 "수정" 버튼 탭 → 카테고리와 동일 처리

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
│ ← 뒤로                          │
├─────────────────────────────────┤  ← grape-50/leaf-50 배경 토널 (type 색상 기반)
│  금액    [ ₩ 8,000            ] │
│  설명    [ 김치찌개            ] │
│  카테고리 [ 🍚 식비 ▾         ] │
│  결제수단 [ 💳 카카오페이 ▾   ] │  ← expense only
│  날짜    [ 2026.03.15         ] │
│  메모    [ 회사 근처           ] │
│                                 │
│  ○ 통계에서 제외                │
│    저축, 퇴직금 등 비정형 거래   │
├─────────────────────────────────┤
│  [    취소    ]  [    저장    ] │  ← sticky 하단 CTA
└─────────────────────────────────┘
```

> 편집 모드 배경: `surface-elevated` 대신 `grape-50` (expense) / `leaf-50` (income) 사용.
> `surface-elevated`는 이미 내부 요소에서 쓰여 대비가 없음. type 색상 기반 배경이 "수정 중" 인지에 더 효과적.

### 편집 모드 규칙
- 삭제 버튼: 편집 모드에서 숨김 (액션 혼재 방지)
- 정기거래 섹션: 편집 모드에서 숨김
- 저장 → API PUT → 성공 시 `setTransaction(updated.data)` + `setEditForm(updated.data)` 동기화 → 뷰 모드 복귀 + success toast
- 취소 → `navigate(listRoute)` (아래 취소 동작 참조)
- 카테고리 목록: `categoryApi.getAll({ type })` 사용 (TYPE_CONFIG 참조)

### editForm 동기화
- 저장 성공 시: `updated.data`로 `transaction` state와 `editForm` 모두 업데이트
- 이후 재편집 진입 시 항상 최신 서버 데이터 기반으로 폼 초기화됨

### 취소 동작 (일관성 원칙)
- `?edit=true` 진입이든 버튼 진입이든 **항상 `navigate(listRoute)`**
- 이유: `navigate(-1)` 사용 시 토스트 진입 케이스에서 히스토리 스택이 불안정
- 기존 테스트에서 "취소 → 뷰 모드 복귀" 검증 케이스 → "취소 → 목록 navigate" 로 변경 필요

---

## 삭제 UX

- 뷰 모드 하단에 항상 표시 (가계부 특성상 중복 삭제 빈번)
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
- 금액/설명/날짜/카테고리 칩/결제수단 칩 렌더링
- 빈 필드(메모 없음, 결제수단 없음) 숨김 검증
- 정기거래 연결됨 → 뱃지 표시, 등록 버튼 없음
- 정기거래 미연결 → 등록 버튼 표시, 뱃지 없음

### 빠른 수정 (핵심)
- 카테고리 칩 클릭 → 드롭다운 오픈
- 카테고리 선택 → API PUT 호출
- 저장 중 select disabled 처리
- 저장 성공 → 칩으로 복귀
- 저장 실패 → 원래 값 복귀 + error toast
- 빠른 수정 열린 상태에서 "수정" 버튼 클릭 → 편집 모드 진입 (빠른 수정 닫힘)
- 결제수단 칩: 위 카테고리와 동일 시나리오

### 편집 모드
- "수정" 버튼 클릭 → 편집 모드 진입 + 배경 토널 변화
- `?edit=true` URL → 초기 렌더링부터 편집 모드
- 저장 성공 → 뷰 모드 복귀 + updated 데이터 반영
- 취소 → `navigate('/expenses')` 호출 (목록으로)
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

---

## 스코프 외 (이번에 하지 않는 것)

- 정기거래 연결 뱃지에서 정기거래 상세로의 링크
- 날짜 선택 커스텀 피커
- 상세 → 편집 페이지 분리 (방향 B)

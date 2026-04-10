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
components/TransactionDetail.tsx         ← 공통 로직 + UI
components/__tests__/TransactionDetail.test.tsx  ← 통합 테스트
pages/ExpenseDetail.tsx                  ← <TransactionDetail type="expense" /> wrapper
pages/IncomeDetail.tsx                   ← <TransactionDetail type="income" /> wrapper
pages/__tests__/ExpenseDetail.test.tsx   ← wrapper 렌더 스모크 테스트로 간소화
pages/__tests__/IncomeDetail.test.tsx    ← wrapper 렌더 스모크 테스트로 간소화
```

### type별 설정 (TYPE_CONFIG)
| 항목 | expense | income |
|------|---------|--------|
| 색상 | grape | leaf |
| 금액 prefix | 없음 | `+` |
| 금액 색상 | text-primary | leaf-600 |
| 결제수단 필드 | 있음 | 없음 |
| 카테고리 필터 | expense + both | income + both |
| 목록 라우트 | `/expenses` | `/income` |

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
├─────────────────────────────────┤
│  생성 2026.03.15 · 수정 ...     │  ← 메타 (작고 muted)
├─────────────────────────────────┤
│  [        수정        ]         │  ← primary 버튼
│  [        삭제        ]         │  ← danger 버튼 (항상 노출)
└─────────────────────────────────┘
```

### 카테고리 칩 빠른 수정
- 칩 탭 → 칩 자리에 `<select>` 드롭다운 인라인 오픈
- 카테고리 목록은 type에 따라 필터링 (expense: expense+both, income: income+both)
- 선택 즉시 API 저장 (별도 저장 버튼 없음)
- 저장 성공 → 칩으로 복귀 + success toast
- 저장 실패 → error toast + 원래 값으로 즉시 복귀 (낙관적 업데이트 없음)
- 빠른 수정 중 "수정" 버튼 탭 → 빠른 수정 닫고(변경 미저장) 편집 모드 진입

### 결제수단 칩 빠른 수정
- `PaymentMethod.type` 필드(`credit_card | debit_card | cash | transfer`)로 아이콘 구분:
  - `credit_card` / `debit_card` → 💳
  - `cash` → 💵
  - `transfer` → 🏦
- 탭 → 칩 자리에 `<select>` 드롭다운 인라인 오픈
- 선택 즉시 API 저장
- 저장 실패 → error toast + 원래 값으로 즉시 복귀
- 결제수단 없을 때 → 칩 미표시 (편집 모드에서만 노출)
- 빠른 수정 중 "수정" 버튼 탭 → 빠른 수정 닫고 편집 모드 진입

### 빈 값 처리 원칙
- 메모 없음 → 섹션 자체 숨김
- 통계 제외 = false → 숨김
- 결제수단 없음 → 칩 숨김
- 정기거래 미연결 → 섹션 숨김

---

## 편집 모드 (Edit Mode)

### 진입 방법
1. 뷰 모드 하단 "수정" 버튼 클릭
2. URL `?edit=true` 파라미터 (토스트 "수정하러 가기"에서 직접 진입)

### 레이아웃

```
┌─────────────────────────────────┐
│ ← 뒤로                          │
├─────────────────────────────────┤  ← surface-elevated 배경으로 토널 변화
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

### 편집 모드 규칙
- 배경: `var(--surface-elevated)` 토널 변화로 "수정 중" 인지
- 삭제 버튼: 편집 모드에서는 숨김 (액션 혼재 방지)
- 저장 → API PUT → 성공 시 뷰 모드 복귀 + success toast
- 카테고리 필터링: type에 따라 적용 (뷰 모드 빠른 수정과 동일)

### ?edit=true 진입 시 취소 동작
- `navigate(-1)` 대신 `navigate(listRoute)` 사용 (목록으로 이동)
- 이유: 토스트에서 직접 진입했을 때 히스토리 스택이 목록이 아닐 수 있음
- 일반 뷰 모드에서 수정 버튼으로 진입한 경우도 동일하게 목록으로 → 일관성 유지

---

## 삭제 UX

- 뷰 모드 하단에 항상 표시 (가계부 특성상 중복 삭제 빈번)
- 탭 → 확인 모달 (기존 유지)
- 삭제 완료 → 목록으로 navigate

---

## 로딩 / 에러 상태

| 상태 | 처리 |
|------|------|
| 초기 로딩 중 | 기존 `<Skeleton>` 컴포넌트 유지 |
| 네트워크 에러 | 기존 `<ErrorState onRetry>` 컴포넌트 유지 |
| 404 (거래 없음) | "내역을 찾을 수 없습니다" + 목록으로 링크 |
| 403 (권한 없음) | error toast ("권한이 없습니다") |
| 빠른 수정 저장 실패 | error toast + 원래 값 복귀 |
| 편집 모드 저장 실패 | error toast, 편집 모드 유지 |

---

## URL 파라미터

| 파라미터 | 동작 |
|---------|------|
| 없음 | 뷰 모드로 오픈 |
| `?edit=true` | 편집 모드로 바로 오픈 |

### ?edit=true 링크 수정 대상
토스트 "수정하러 가기" editPath는 `QuickInput.tsx`에서 조립됨:
- `QuickInput.tsx`: `/expenses/{id}` → `/expenses/{id}?edit=true` 로 변경
- `ActionToast.test.tsx`: editPath 픽스처 업데이트 필요

---

## 상태 설계

```typescript
type DetailMode = 'view' | 'edit'
type QuickEditField = 'category' | 'payment_method' | null

// view: 뷰 모드
// edit: 전체 편집 모드
// quickEditField: 칩 인라인 편집 중인 필드 (view 모드에서만 유효)
// quickEditField가 열린 상태에서 "수정" 버튼 탭 → quickEditField null로 초기화 후 edit 모드 진입
```

---

## 접근성 (a11y)

- 뒤로가기 링크: `aria-label="목록으로"`
- 삭제 모달: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- 카테고리/결제수단 칩 드롭다운: `aria-label` 포함
- 편집 모드 sticky CTA: `position: sticky; bottom: 0`

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
| `components/QuickInput.tsx` | editPath에 `?edit=true` 추가 |
| `components/__tests__/ActionToast.test.tsx` | editPath 픽스처 업데이트 |

---

## 스코프 외 (이번에 하지 않는 것)

- 날짜 선택 커스텀 피커
- 상세 → 편집 페이지 분리 (방향 B)

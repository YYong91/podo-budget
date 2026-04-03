# 거래 목록 기록자(멤버) 표시

## 개요

공유 가계부에서 각 거래를 누가 기록했는지 거래 목록에 표시한다.

## 관련 이슈

- #522

## 범위

프론트엔드 전용. 백엔드는 이미 `user_id`를 API 응답에 포함하고 있어 변경 불필요.

## 현재 상태 (이미 준비된 것)

- `Expense.user_id` / `Income.user_id` — DB에 기록자 저장됨
- `ExpenseResponse` / `IncomeResponse` — API 응답에 `user_id` 포함
- 프론트엔드 `Expense` / `Income` 타입 — `user_id` 필드 정의됨
- 가구 멤버 조회 가능 (`HouseholdMember → User`)

## 구현

### 데이터 흐름

```
가구 멤버 목록 → Map<user_id, username> 구성
     ↓
TransactionItem에 username prop 전달
     ↓
카테고리 뱃지 옆에 username 텍스트 표시
```

### TransactionItem 변경

- `recordedBy` prop 추가 (string | undefined)
- 카테고리 뱃지, 정기 뱃지, 통계제외 뱃지와 같은 줄에 작은 텍스트로 표시
- 스타일: `text-xs`, 서브 텍스트 컬러 (`text-[var(--text-tertiary)]`)

### 표시 조건

- **가구원이 2명 이상일 때만 표시** — 혼자 쓰는 가계부에서는 불필요
- `recordedBy`가 undefined이면 렌더링하지 않음
- `user_id`가 null인 거래(마이그레이션 이전 데이터)는 기록자를 표시하지 않음

### 표시 예시

```
점심 김치찌개                    -8,000원
🍽️ 식비  정기  seungyong
```

### 데이터 소스

- 가구 멤버 목록은 이미 `useHouseholdStore` 또는 API에서 조회 가능
- `user_id → username` 매핑을 구성하여 TransactionItem에 전달
- MonthlyView와 SearchMode 양쪽에서 동일하게 적용

## 기술 사항

- React 19 + TypeScript
- Tailwind CSS v4 (Grape 디자인 시스템)
- 기존 TransactionItem 컴포넌트 수정 (새 파일 불필요)

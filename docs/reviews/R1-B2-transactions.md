# R1-B2: 거래 핵심 (보안+버그)

리뷰 대상: BE API 4개, 모델 4개, 스키마 4개, 서비스 6개, FE 페이지 6개, 컴포넌트 3개, API 4개

---

## Critical

### [1] chat API에서 사용자 입력이 LLM에 직접 전달 — 프롬프트 인젝션 기본 방어 부재

- **심각도**: Critical
- **카테고리**: 보안/버그
- **위치**: `backend/app/api/chat.py:178`, `backend/app/schemas/chat.py:27`
- **문제**: chat API에서 사용자의 자연어 입력이 LLM 프롬프트에 직접 삽입됨. 기본적인 sanitization 없음
- **영향**: 프롬프트 인젝션으로 LLM 동작 조작 가능, 잘못된 금액/카테고리 분류 유도
- **제안**: 입력 길이 제한 + 시스템/유저 프롬프트 분리 + 출력 검증 강화

### [2] 지출 통계 API에서 household_id 격리 누락 가능성

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/app/api/expenses.py:485-498`
- **문제**: 통계 관련 쿼리에서 household_id 필터가 일관되게 적용되지 않을 수 있음
- **영향**: 타 가구의 통계 데이터 노출 가능성
- **제안**: 모든 통계 쿼리에 household_id 필터 확인

---

## High

### [3] Expense 모델 date 필드 기본값이 서버 시작 시점에 고정

- **심각도**: High
- **카테고리**: 버그
- **위치**: `backend/app/models/expense.py:44`
- **문제**: `default=date.today()` — 서버 시작 시 평가되어 그 날짜로 고정. `default=date.today` (callable)여야 함
- **영향**: 서버 재시작 없이 날짜가 지나면 이전 날짜로 지출이 기록됨
- **제안**: `default=date.today` (괄호 제거)

### [4] 스키마에서 amount 필드가 float 타입

- **심각도**: High
- **카테고리**: 버그
- **위치**: `backend/app/schemas/expense.py:11`, `backend/app/api/chat.py:185`
- **문제**: DB는 Numeric(12,2)이지만 Pydantic 스키마에서 float로 선언. float → Decimal 변환 시 정밀도 손실
- **영향**: 큰 금액에서 소수점 오차 발생 가능 (예: 999999.99가 999999.98로 변환)
- **제안**: 스키마에서 `Decimal` 타입 사용 또는 `condecimal(max_digits=12, decimal_places=2)`

### [5] 레거시 데이터(household_id=None) 수정/삭제 시 항상 404 반환

- **심각도**: High
- **카테고리**: 버그
- **위치**: `backend/app/api/expenses.py:607`, `backend/app/api/income.py:251`, `backend/app/api/dependencies.py:120-130`
- **문제**: `get_household_member(expense.household_id, ...)` 호출 시 household_id가 None이면 쿼리에서 `Household.id == None`이 되어 404 반환
- **영향**: 마이그레이션 이전 생성된 데이터를 수정/삭제 불가
- **제안**: household_id가 None인 레거시 데이터는 본인 확인만으로 수정/삭제 허용

### [6] 히스토리 힌트 description이 LLM 프롬프트에 비검증 삽입 — 프롬프트 인젝션

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/services/prompts.py:197-198`
- **문제**: 과거 거래 description 값을 그대로 프롬프트에 삽입. 개행문자/특수문자로 프롬프트 구조 조작 가능
- **영향**: LLM 행동 조작, 잘못된 카테고리 분류 유도
- **제안**: description에서 개행/특수문자 이스케이프, 길이 제한 적용

### [7] ExpenseForm에서 수입 타입 항목을 지출로 저장

- **심각도**: High
- **카테고리**: 버그
- **위치**: `frontend/src/pages/ExpenseForm.tsx:111-139`
- **문제**: `handleConfirmSave`가 previewItems 전체를 `expenseApi.create()`로 저장. LLM이 type: "income"으로 파싱한 항목도 지출로 기록
- **영향**: "월급 350만원과 점심 8000원" 입력 시 월급도 지출로 기록
- **제안**: item.type에 따라 expenseApi/incomeApi 분기 처리

### [8] TransactionList에서 activeHouseholdId null 상태로 API 호출

- **심각도**: High
- **카테고리**: 버그
- **위치**: `frontend/src/pages/TransactionList.tsx:118-124`
- **문제**: `activeHouseholdId!` (non-null assertion) 사용. 가구 로딩 전에 fetchData 실행 시 null이 API에 전송
- **영향**: 초기 렌더링 시 API 호출 실패 또는 의도하지 않은 데이터 조회
- **제안**: `if (!activeHouseholdId) return` null 가드 추가

---

## 긍정적인 측면

- household_id 기반 격리가 신규 CRUD에 일관 적용
- 권한 체계(owner/admin/member) 명확
- ORM 기반이라 SQL 인젝션 위험 없음
- Rate limiting이 chat 엔드포인트에 적용됨
- LLM 응답 JSON 파싱 실패에 대한 재시도 로직 구비

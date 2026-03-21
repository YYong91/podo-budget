# R3-B2: 거래 핵심 (코드품질+테스트)

리뷰 대상: 백엔드 API/모델/스키마/서비스 레이어 + 프론트엔드 거래 핵심 페이지 및 테스트 파일 전체.

---

## Critical

### [1] GoogleProvider/LocalLLMProvider parse_expense 시그니처가 추상 기반 클래스와 불일치

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `backend/app/services/llm_service.py:481-487,506-512`
- **문제**: LLMProvider 추상 클래스는 category_mappings 파라미터 포함하나 GoogleProvider/LocalLLMProvider는 누락. LSP 위반
- **영향**: category_mappings 키워드 인자 전달 시 TypeError 발생
- **제안**: 두 프로바이더에 category_mappings 파라미터 추가

> ⚠️ R2-B2 [8]에서도 지적됨 — 코드품질 관점 재확인

### [2] ExpenseResponse/IncomeResponse/CategoryResponse 스키마가 Pydantic v1 스타일

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `backend/app/schemas/expense.py:56-57`, `schemas/income.py:55-56`, `schemas/category.py:35-36`
- **문제**: `class Config: from_attributes = True` (v1 스타일). 프로젝트 규칙은 v2 스타일 명시
- **영향**: Pydantic v2 호환성 경고, strict 모드 불일치
- **제안**: `model_config = ConfigDict(from_attributes=True)` 로 변경

---

## High

### [3] ExpenseForm ↔ IncomeForm 핵심 로직 대규모 복제

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `frontend/src/pages/ExpenseForm.tsx`, `pages/IncomeForm.tsx`
- **문제**: handleConfirmSave, handleCreateCategoryForForm, handleCreateCategory, removePreviewItem, handleFormSubmit 등 5개 함수가 거의 동일하게 복제
- **영향**: 버그 수정 시 양쪽 모두 수정 필요, 한쪽 누락 위험
- **제안**: useTransactionForm 훅과 CategoryCreator 컴포넌트로 추출

> ⚠️ R2-B2 [6]에서도 지적됨 — 코드품질 관점 재확인

### [4] TransactionList에서 toast와 useToast 두 가지 알림 시스템 혼용

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `frontend/src/pages/TransactionList.tsx:9,15,211,270,278`
- **문제**: react-hot-toast 직접 import와 프로젝트 useToast 훅을 동시 사용. 라인 211에서 toast.error() 직접 호출
- **영향**: 알림 스타일/동작 불일치
- **제안**: toast.error() → addToast('error', ...) 변경, 직접 import 제거

### [5] 멤버 역할 기반 수정/삭제 권한(403) 테스트 부재

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `backend/app/api/expenses.py:612,650` (대응 테스트 없음)
- **문제**: member 역할로 타인 지출 수정 시 403 반환, admin/owner로 수정 시 200 반환 검증 없음
- **영향**: 역할 권한 회귀 미감지
- **제안**: 같은 가구 내 role별 수정/삭제 테스트 추가

### [6] ExpenseForm에서 income 타입 항목을 지출 API로 저장

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `frontend/src/pages/ExpenseForm.tsx:116-129`
- **문제**: handleConfirmSave가 previewItems 전체를 expenseApi.create로 저장. LLM 혼합 입력 시 type=income 항목도 지출로 저장
- **영향**: "월급 350만원, 점심 8000원" 입력 시 수입이 지출로 잘못 분류
- **제안**: item.type !== 'income' 필터링 추가

> ⚠️ R1-B2 [7]에서도 지적됨 — 테스트 관점 재확인

---

## Medium

### [7] income.py/expenses.py 연간 트렌드 12회 직렬 DB 쿼리 — 코드 중복

- **심각도**: Medium
- **카테고리**: 코드품질
- **위치**: `backend/app/api/income.py:181-189`, `expenses.py:231-239`
- **문제**: 양쪽 파일에 동일한 12회 루프 쿼리 패턴. expenses.py의 /stats/comparison은 단일 쿼리 최적화됨 — 일관성 없음
- **영향**: 코드 중복 + 비일관적 최적화
- **제안**: 공유 유틸로 추출, 단일 쿼리 패턴 통일

### [8] TransactionList 테스트가 실제 렌더링 내용 검증 없이 존재 여부만 확인

- **심각도**: Medium
- **카테고리**: 테스트
- **위치**: `frontend/src/pages/__tests__/TransactionList.test.tsx:44-53`
- **문제**: 빈 상태 텍스트나 link 존재만 확인 — MSW 거래 데이터 렌더링 여부 미검증. 필터 버튼 테스트도 클릭 후 필터 동작 자체 미검증
- **영향**: 거래 목록 렌더링 회귀 미감지
- **제안**: fixtures의 description이 화면에 표시되는지 확인, 필터 후 항목 수 변경 검증

---

## 긍정적인 측면

- LLM 프로바이더 추상화 패턴(Strategy)이 잘 설계됨
- 카테고리 힌트 서비스와 매핑 서비스 분리 적절
- MiniCalendar 테스트가 날짜 선택/주차 표시 등 엣지 케이스를 잘 커버
- API 테스트(test_api_expenses.py)가 400+ 라인으로 주요 CRUD 경로를 커버

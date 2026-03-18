# R2-B2: 거래 핵심 (성능+아키텍처)

리뷰 대상: BE 16개 파일 + FE 10개 파일

---

## Critical

### [1] get_stats 연간 트렌드: 12회 직렬 DB 쿼리

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/api/expenses.py:231-239`, `backend/app/api/income.py:182-189`
- **문제**: yearly 분기에서 for m in range(1, 13) 루프 안에서 매 반복 DB 쿼리. 같은 파일의 get_stats_comparison은 이미 단일 쿼리 최적화 적용됨 — 불일치
- **영향**: 하나의 통계 API 요청이 최대 24회 쿼리 (expenses + income 동시)
- **제안**: extract("month")와 GROUP BY로 단일 쿼리 처리

### [2] get_stats_comparison monthly: N개월 트렌드에 N회 직렬 쿼리

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/api/expenses.py:349-355`
- **문제**: monthly 분기에서 N개월 트렌드를 루프 내 직렬 쿼리로 조회. yearly는 이미 최적화됨
- **영향**: 트렌드 조회에만 최대 12회 추가 쿼리
- **제안**: monthly 분기에서도 단일 GROUP BY 쿼리로 일괄 조회

---

## High

### [3] chat.py에서 items N개 저장 시 카테고리 N회 직렬 조회

- **심각도**: High
- **카테고리**: 성능
- **위치**: `backend/app/api/chat.py:173-218`
- **문제**: 여러 항목 입력 시 루프 내에서 get_or_create_category() 개별 호출
- **영향**: 10건 일괄 입력 시 카테고리 관련 쿼리 10회 추가
- **제안**: 루프 전 카테고리 캐시 dict 준비하여 중복 조회 방지

### [4] LLM parse_expense에 타임아웃 미설정

- **심각도**: High
- **카테고리**: 성능
- **위치**: `backend/app/services/llm_service.py:110-115`, `llm_service.py:339-349`
- **문제**: Anthropic/OpenAI SDK 기본 타임아웃(10분/600초). FE는 30초 타임아웃이지만 BE는 계속 LLM 호출
- **영향**: LLM 응답 지연 시 백엔드 worker가 수 분간 점유
- **제안**: timeout=25.0 설정 (FE 30초보다 짧게)

---

## Medium

### [5] Pydantic v1 스타일 Config 클래스 사용

- **심각도**: Medium
- **카테고리**: 아키텍처
- **위치**: `backend/app/schemas/expense.py:56-57`, `schemas/income.py:55-56`, `schemas/category.py:35-36`
- **문제**: class Config: from_attributes = True (v1 스타일). 프로젝트 규칙은 model_config = ConfigDict() (v2 스타일)
- **영향**: 가이드라인 위반, Pydantic 업그레이드 시 오작동 가능
- **제안**: model_config = ConfigDict(from_attributes=True)로 변경

### [6] ExpenseForm과 IncomeForm 프리뷰 카드 UI 300+ 라인 중복

- **심각도**: Medium
- **카테고리**: 아키텍처
- **위치**: `frontend/src/pages/ExpenseForm.tsx:450-562`, `pages/IncomeForm.tsx:340-476`
- **문제**: 프리뷰 카드가 두 파일에 거의 동일하게 복제. ExpenseForm 내에서도 OCR/natural 모드에 동일 코드 반복
- **영향**: 버그 수정이나 UI 변경 시 3곳 이상 동시 수정 필요
- **제안**: ParsedItemPreviewCard 컴포넌트 추출

### [7] TransactionItem에서 categories 배열 find() O(n) 반복

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `frontend/src/components/TransactionItem.tsx:33`
- **문제**: 거래 300건 × 카테고리 20개 = 6,000번 비교. categories 배열 변경 시 모든 TransactionItem 리렌더
- **영향**: 거래 많을수록 렌더 성능 저하
- **제안**: categories를 Map으로 변환하여 O(1) 조회, categoryName을 직접 전달

### [8] GoogleProvider/LocalLLMProvider의 parse_expense 시그니처 불일치

- **심각도**: Medium
- **카테고리**: 아키텍처
- **위치**: `backend/app/services/llm_service.py:482-487`
- **문제**: 추상 클래스 시그니처에 category_mappings 파라미터가 있으나 구현 클래스에서 누락
- **영향**: LLMProvider 추상화가 인터페이스 보장을 제공하지 못함
- **제안**: 시그니처 통일

### [9] category_mapping_service get_mapped_category 2번 쿼리

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `backend/app/services/category_mapping_service.py:38-52`
- **문제**: CategoryMapping 조회 후 Category 별도 조회. JOIN으로 단일 쿼리 가능
- **제안**: JOIN 쿼리로 통합

### [10] ExpenseDetail/IncomeDetail 진입 시 카테고리 중복 fetch

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `frontend/src/pages/ExpenseDetail.tsx:55-57`, `pages/IncomeDetail.tsx:50-53`
- **문제**: 5개 페이지가 각자 categoryApi.getAll() 호출. 카테고리는 변경이 거의 없는 정적 데이터
- **영향**: 페이지 탐색 시마다 중복 API 호출
- **제안**: Zustand 전역 스토어 또는 React Query staleTime 캐시

### [11] CategoryBottomSheet overflow 복원 시 중첩 모달 간섭

- **심각도**: Medium
- **카테고리**: 아키텍처
- **위치**: `frontend/src/components/CategoryBottomSheet.tsx:41-47`
- **문제**: useEffect cleanup에서 document.body.style.overflow = '' 무조건 초기화
- **영향**: 중첩 모달 닫힐 때 스크롤이 예기치 않게 복원
- **제안**: isOpen false일 때 cleanup 실행 방지

### [12] get_stats by_category에서 NULL 카테고리 COALESCE 미적용

- **심각도**: Medium
- **카테고리**: 아키텍처
- **위치**: `backend/app/api/expenses.py:204-226`
- **문제**: category_id IS NULL인 지출이 DB에서 NULL 그룹으로 처리 후 Python에서 "미분류" 변환
- **제안**: DB 레벨에서 COALESCE(Category.name, '미분류')로 명시적 처리

---

## 긍정적인 측면

- LLM 프로바이더 Strategy 패턴이 깔끔하게 구현
- 카테고리 매핑 학습 시스템이 체계적
- TransactionList의 lazy loading 적용
- 자연어 파싱 프리뷰 → 수정 → 확인 UX 흐름이 명확

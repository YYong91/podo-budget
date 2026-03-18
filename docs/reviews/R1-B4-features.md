# R1-B4: 부가 기능 (보안+버그)

리뷰 대상: 정기거래/예산/인사이트/자산/피드백 (BE API 5개, 모델 6개, 스키마 6개, 서비스 6개, FE 8개)

---

## Critical

### [1] execute_recurring: 중복 실행 방어 없음 (멱등성 부재)

- **심각도**: Critical
- **카테고리**: 버그
- **위치**: `backend/app/services/recurring_service.py:90-141`, `backend/app/api/recurring.py:163-185`
- **문제**: 실행 전에 해당 기간에 이미 지출/수입이 생성되어 있는지 확인하지 않음. 더블 클릭이나 네트워크 재시도로 동일 요청이 두 번 도달하면 두 건 생성
- **영향**: 동일 항목(월세, 보험료 등)이 두 건 등록, 잔액·예산 통계 오염
- **제안**: `(recurring_transaction_id, due_date)` 유니크 제약 추가 또는 실행 전 중복 체크. FE에서 버튼 disabled 처리는 보완책

### [2] `/assets/snapshots` 엔드포인트: household_id 권한 검증 누락

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/app/api/assets.py:68-91`
- **문제**: 다른 모든 자산 엔드포인트는 `get_household_member()` 권한 검증을 하지만, `/assets/snapshots`만 빠져 있음. 타 가구 household_id를 지정하면 스냅샷 존재 여부 추론 가능
- **영향**: 다른 가구의 순자산 스냅샷 데이터에 비인가 접근
- **제안**: `get_household_member(household_id, current_user, db)` 호출 추가

---

## High

### [3] generate-comprehensive 인사이트: 입력 검증 없는 LLM 호출

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/api/insights.py:125-148`
- **문제**: 프론트엔드가 계산해서 보낸 재무 데이터를 DB 검증 없이 LLM에 전달. `ComprehensiveInsightsRequest`에 범위 검증 없음
- **영향**: 조작된 데이터로 rate limit 소모, LLM 프롬프트 인젝션 시도 가능
- **제안**: 스키마에 `Field(ge=0)` 등 기본 범위 검증 추가

### [4] asset_service.get_assets: household_id=None 시 잘못된 데이터 조회

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/services/asset_service.py:35-42`
- **문제**: household_id가 None이면 `created_by == user.id` 조건으로 폴백. 다중 가구 환경에서 특정 가구 데이터가 누락될 수 있음
- **영향**: 다중 가구 사용자의 잘못된 가구 데이터 기반 저축액 계산
- **제안**: household_id=None 폴백 로직 제거, 호출 경로에서 household_id 필수 보장

### [5] AssetCreate LLM 파싱 결과를 검증 없이 저장 + 텍스트 길이 무제한

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/services/asset_parse_service.py:35-54`, `backend/app/api/assets.py:110-117`
- **문제**: LLM 응답의 ticker 등 필드에 길이 제한 없음. `AssetParseRequest.text`에도 길이 제한 없어 LLM 비용 과다 소모 가능
- **영향**: LLM 프롬프트 인젝션 및 API 비용 과다
- **제안**: `text: str = Field(..., max_length=1000)`, `/assets/parse`에 rate limiting 적용

### [6] Budget 스키마 datetime/date 타입 혼용

- **심각도**: High
- **카테고리**: 버그
- **위치**: `backend/app/schemas/budget.py:29`, `backend/app/api/budget.py:164`
- **문제**: `BudgetCreate.start_date/end_date`가 datetime 타입인데 Expense.date(Date 컬럼)와 비교. timezone-aware vs naive 혼용
- **영향**: 특정 환경에서 예산 알림 오류, 쿼리 성능 저하 (인덱스 미활용)
- **제안**: start_date/end_date를 date 타입으로 통일

### [7] 인메모리 캐시 — negative cache 없음, 외부 API 장애 시 연쇄 호출

- **심각도**: Medium
- **카테고리**: 버그
- **위치**: `backend/app/services/price_service.py:19-20`, `backend/app/services/exchange_rate.py:15-16`
- **문제**: 외부 API 실패 시 캐시에 None 저장 안 됨 → 실패할 때마다 외부 API 재호출
- **영향**: 외부 API 장애 시 모든 자산 조회가 느려지고 rate limit 도달
- **제안**: 실패 시 짧은 TTL(30초~1분)로 None을 캐시하는 negative cache 패턴 추가

### [8] assets PUT/DELETE: 탈퇴한 멤버가 이전 가구 자산 수정/삭제 가능

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/api/assets.py:225-260`
- **문제**: `created_by == current_user.id`만 확인. 가구 멤버 탈퇴 후에도 created_by로 이전 가구 자산 수정/삭제 가능
- **영향**: 탈퇴한 멤버의 잠재적 권한 유지
- **제안**: created_by 체크에 추가로 `get_household_member()` 검증 함께 수행

---

## 긍정적인 측면

- 정기거래의 execute/skip 분리 설계가 명확
- 자산 API의 대부분 엔드포인트에서 household_id 권한 검증 일관 적용
- 외부 API(한투, 네이버, Yahoo) 호출 시 TTL 기반 캐시 사용
- 환율 서비스에 fallback 로직 존재

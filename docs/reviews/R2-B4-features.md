# R2-B4: 부가 기능 (성능+아키텍처)

리뷰 대상: BE 12개 파일 + FE 10개 파일

---

## Critical

### [1] get_assets_with_prices: N+1 외부 API 호출 — 자산 수만큼 시세 API 직렬 호출

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/services/asset_service.py:76-102`
- **문제**: 각 자산에 대해 get_asset_current_value를 루프에서 순차 await. 미국 주식 있으면 get_usd_krw_rate()도 개별 호출. 5초 캐시 있으나 캐시 미스 시 전체 자산 블로킹
- **영향**: GET /assets, /assets/summary, /assets/goal, InsightsPage 등 다수 경로에서 호출. 자산 5개면 외부 API 최대 5번 순차
- **제안**: asyncio.gather로 병렬화, 환율은 루프 외부에서 1회 선조회

### [2] AssetDashboard: getAll + getSummary가 서버에서 시세 API를 두 번 호출

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `frontend/src/pages/AssetDashboard.tsx:101-107`
- **문제**: GET /assets와 GET /assets/summary가 각각 get_assets_with_prices를 독립 호출. 병렬 요청 시 캐시 미스 경쟁 발생
- **영향**: 자산 페이지 진입 시 외부 API 호출이 2배
- **제안**: BE에 GET /assets?include_summary=true 단일 엔드포인트 제공

---

## High

### [3] price_service.py: 프로세스 재시작 시 캐시 소실 + 멀티 워커 캐시 불공유

- **심각도**: High
- **카테고리**: 성능/아키텍처
- **위치**: `backend/app/services/price_service.py:19`
- **문제**: 인메모리 dict 캐시. 배포 시 초기화, 워커 2개 이상이면 독립 캐시
- **영향**: 배포 직후 모든 자산 시세 API 일제 호출
- **제안**: singleflight 패턴(asyncio.Lock 활용) 또는 Redis 캐시

### [4] get_asset_summary가 get_assets_with_prices를 내부 호출 — 책임 분리 위반

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `backend/app/services/asset_service.py:105-138`
- **문제**: 요약만 필요한 경우에도 항상 실시간 시세 조회. create_snapshot도 동일 체인
- **영향**: 불필요한 외부 API 호출
- **제안**: with_prices=False 파라미터 추가로 시세 조회 선택적 처리

### [5] budget.py: timezone-naive datetime.now() 사용

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `backend/app/api/budget.py:161-164`
- **문제**: Budget.start_date와 datetime.now()(로컬 시간) 비교. 서버 timezone에 따라 결과 다름
- **영향**: KST 서버에서 UTC 기준 아직 시작 전인 예산이 활성으로 오판될 수 있음
- **제안**: datetime.now(timezone.utc) 사용 또는 DB 컬럼 timezone-aware 통일

---

## Medium

### [6] InsightsPage assetApi.getSummary가 외부 API 종속

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `frontend/src/pages/InsightsPage.tsx:89-96`
- **문제**: 리포트 페이지에서 getSummary 호출 → 서버에서 시세 API 실시간 호출 → 외부 API 응답 시간에 P99 종속
- **영향**: 투자 자산 보유자의 리포트 초기 로딩 지연
- **제안**: 최신 스냅샷의 net_worth를 summary 대용으로 사용

### [7] asset_goal_service get_monthly_savings에서 exclude_from_stats 필터 누락

- **심각도**: Medium
- **카테고리**: 아키텍처
- **위치**: `backend/app/services/asset_goal_service.py:142-178`
- **문제**: 다른 집계 엔드포인트는 exclude_from_stats == False 필터 적용하는데 여기만 누락
- **영향**: 이체성 거래가 저축액 계산에 포함 → 순저축액 오류
- **제안**: Expense.exclude_from_stats == False 필터 추가

### [8] AssetForm 자연어 프리뷰 저장 시 직렬 API 호출

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `frontend/src/pages/AssetForm.tsx:230-242`
- **문제**: for...of 루프에서 assetApi.create를 순차 await. 3개 자산이면 3번 직렬 호출
- **영향**: 저장 시간이 자산 수에 비례
- **제안**: Promise.all로 병렬 호출 또는 BE bulk create 엔드포인트

### [9] BudgetManager loadData useEffect 의존성 누락

- **심각도**: Medium
- **카테고리**: 아키텍처
- **위치**: `frontend/src/pages/BudgetManager.tsx:75-77`
- **문제**: useEffect([], []) 빈 의존성. activeHouseholdId 변경 시 예산 데이터 미갱신
- **영향**: 가구 전환 시 이전 가구 예산이 그대로 표시
- **제안**: useCallback + activeHouseholdId 의존성 추가

---

## 긍정적인 측면

- Promise.allSettled 사용으로 InsightsPage 개별 API 실패 시 나머지 정상 표시
- 자산 시세 캐시(5분 TTL) 존재
- 정기거래 서비스 레이어 분리가 잘 되어 있음
- RecurringList의 UX(pending 알림 카드)가 사용자 친화적

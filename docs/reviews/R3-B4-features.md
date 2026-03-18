# R3-B4: 부가 기능 (코드품질+테스트)

리뷰 대상: 정기거래/예산/인사이트/자산/피드백 레이어 (백엔드 API/서비스/모델/스키마 + 프론트엔드 페이지/테스트)

---

## Critical

### [1] 스냅샷 조회 시 가구 멤버십 권한 검증 누락

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `backend/app/api/assets.py:68-91`
- **문제**: GET /api/assets/snapshots에서 get_household_member() 호출 없음. 다른 자산 엔드포인트(/summary, /, /goal)는 모두 권한 검증 수행
- **영향**: household_id를 알면 다른 가구의 스냅샷 데이터 열람 가능
- **제안**: `await get_household_member(household_id, current_user, db)` 추가

> ⚠️ R1-B4 [2]에서도 지적됨 — 코드품질 관점 재확인

### [2] get_monthly_savings에서 지출 합산 시 exclude_from_stats 미필터링

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `backend/app/services/asset_goal_service.py:154-166`
- **문제**: Expense 집계에 `exclude_from_stats == False` 조건 누락. insights.py/budget.py의 동일 집계에는 필터 적용됨
- **영향**: 이체성 거래(통계 제외 플래그)가 순저축액 계산에 포함 — 과소 계산
- **제안**: `Expense.exclude_from_stats == False` 필터 추가

> ⚠️ R2-B4 [7]에서도 지적됨 — 코드품질 관점 재확인

---

## High

### [3] price_service.py와 exchange_rate.py — USD/KRW 환율 조회 이중화

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/services/price_service.py:199-215`, `services/exchange_rate.py`
- **문제**: 두 모듈이 각각 독립적인 환율 API + 캐시 보유. price_service는 open.er-api.com(5분 TTL), exchange_rate는 api.frankfurter.dev(30분 TTL)
- **영향**: 동시에 다른 환율 적용 가능, 코드 중복
- **제안**: 하나의 환율 서비스로 통합

### [4] get_asset_current_value에서 수익률 계산 로직 3회 중복

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/services/price_service.py:221-262`
- **문제**: stock_kr, stock_us, crypto 각 브랜치에 profit_loss/profit_loss_pct 계산이 동일하게 3번 반복
- **영향**: 수익률 계산 공식 변경 시 3곳 수정 필요
- **제안**: `_calc_profit()` 내부 헬퍼 함수 추출

### [5] 피드백 API 통합 테스트 파일 누락

- **심각도**: High
- **카테고리**: 테스트
- **위치**: (파일 미존재)
- **문제**: POST /api/feedback, GET /api/feedback(관리자), PATCH /api/feedback/{id}(상태변경), GET /api/feedback/mine 통합 테스트 없음
- **영향**: ADMIN_USER_ID 비교 기반 권한 로직이 보안 경계임에도 미검증
- **제안**: `tests/integration/test_api_feedback.py` 생성

### [6] 자산 시세 서비스 단위 테스트 전무

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `backend/app/services/price_service.py`, `exchange_rate.py` (대응 테스트 없음)
- **문제**: stock_kr/stock_us/crypto 시세 연동, get_asset_current_value 수익률 계산, _get_kis_token 캐싱 등 핵심 로직 미테스트
- **영향**: 시세 계산 버그 미감지
- **제안**: `tests/unit/test_price_service.py` 생성, 외부 HTTP 모킹

### [7] update_asset/delete_asset 핸들러 내 인라인 임포트

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/api/assets.py:233-235,252-254`
- **문제**: 함수 내부에서 `from sqlalchemy import select`, `from app.models.asset import Asset` 임포트. 파일 내 다른 핸들러는 모듈 상단 import
- **영향**: IDE 정적 분석 방해, 코드 스타일 비일관
- **제안**: 모듈 상단으로 이동

### [8] BudgetResponse 스키마에 Pydantic v1 스타일 Config

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/schemas/budget.py:60-61`
- **문제**: `class Config: from_attributes = True` 사용
- **영향**: v2 스타일 규칙 위반
- **제안**: `model_config = ConfigDict(from_attributes=True)` 변경

### [9] AssetGoal 모델 household_id NOT NULL인데 서비스에서 None 허용

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/services/asset_goal_service.py:19,33,54,126`
- **문제**: 모델은 nullable=False인데 서비스 함수가 `household_id: int | None` 타입으로 None 분기 코드 포함
- **영향**: 죽은 코드 브랜치, 혼란 유발
- **제안**: `household_id: int` (non-optional)으로 변경, `is_(None)` 브랜치 제거

---

## 긍정적인 측면

- Promise.allSettled 사용으로 InsightsPage 개별 API 실패 시 나머지 정상 표시
- 자산 시세 캐시(5분 TTL) 존재
- 정기거래 서비스 레이어 분리가 잘 되어 있음
- RecurringList의 UX(pending 알림 카드)가 사용자 친화적

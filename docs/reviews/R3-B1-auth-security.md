# R3-B1: 인증/보안 레이어 (코드품질+테스트)

리뷰 대상: `backend/app/core/auth.py`, `core/rate_limit.py`, `core/exceptions.py`, `api/auth.py`, `api/dependencies.py`, `main.py`, `frontend/src/contexts/AuthContext.tsx`, `components/ProtectedRoute.tsx`, `api/client.ts`, `api/auth.ts` 및 대응 테스트 파일 전체.

---

## Critical

### [1] getCookieToken 함수가 두 파일에 완전히 중복됨

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `frontend/src/api/client.ts:13-19`, `frontend/src/contexts/AuthContext.tsx:56-66`
- **문제**: getCookieToken() 함수가 client.ts와 AuthContext.tsx에 동일한 로직으로 중복 구현. 쿠키 이름(podo_access_token), 정규식, localStorage 폴백까지 일치
- **영향**: 쿠키 이름이나 파싱 로직 변경 시 두 곳 동기화 필요, 누락 시 인터셉터 간 토큰 불일치 버그
- **제안**: `utils/auth.ts`에 getCookieToken() 추출 후 두 파일에서 import

> ⚠️ R2-B1 [4]에서도 지적됨 — 코드품질 관점 재확인

### [2] rate_limit.py에 ALGORITHM 상수가 settings.JWT_ALGORITHM과 별도 하드코딩

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `backend/app/core/rate_limit.py:18`
- **문제**: rate_limit.py에 `ALGORITHM = "HS256"` 모듈 레벨 상수 선언. auth.py는 settings.JWT_ALGORITHM 사용하나 rate_limit.py는 로컬 상수 사용
- **영향**: JWT 알고리즘 설정 변경 시 rate_limit.py 토큰 디코딩 실패
- **제안**: 로컬 상수 제거, `settings.JWT_ALGORITHM` 직접 사용

> ⚠️ R2-B1 [2]에서도 지적됨 — 코드품질 관점 재확인

---

## High

### [3] 비활성 계정(is_active=False) 403 경로 테스트 없음

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `backend/app/core/auth.py:79-80,92-93` (대응 테스트 누락)
- **문제**: user.is_active == False일 때 HTTP 403 반환 분기가 테스트 커버리지 외
- **영향**: 비활성화 계정 차단 로직 회귀 시 CI 미감지
- **제안**: is_active=False 사용자로 /api/auth/me 호출하여 403 확인 테스트 추가

### [4] get_user_identifier 함수 테스트 완전 부재

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `backend/app/core/rate_limit.py:21-66` (대응 테스트 없음)
- **문제**: rate limiting 핵심 key function에 단위 테스트 없음. JWT → user:{sub}, 무효 JWT → IP 폴백, request.client=None → "unknown" 등 여러 분기
- **영향**: X-Forwarded-For 파싱 버그, None 처리 오류 미감지
- **제안**: `tests/unit/test_rate_limit.py` 생성, Request 모킹하여 각 분기 테스트

### [5] 텔레그램/카카오 연동 4개 엔드포인트 테스트 없음

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `backend/app/api/auth.py:49-119` (대응 테스트 없음)
- **문제**: POST /telegram-link-code, DELETE /telegram/link, POST /kakao-link-code, DELETE /kakao/link 통합 테스트 없음
- **영향**: 연동 코드 발급/해제 회귀 버그 CI 누락
- **제안**: 각 엔드포인트 성공/미인증 케이스를 test_api_auth.py에 추가

### [6] ProtectedRoute 초기화 중/실패 UI 및 온보딩 리다이렉트 테스트 없음

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `frontend/src/components/__tests__/ProtectedRoute.test.tsx`
- **문제**: hasInitialized=false 로딩 스피너, initError 재시도 UI, households.length===0 온보딩 navigate, sessionStorage intended_path 저장 미테스트
- **영향**: 온보딩 리다이렉트/초기화 실패 UI 회귀 보호 없음
- **제안**: mockHouseholdState 변경하여 각 분기별 테스트 추가

### [7] UserResponse 스키마가 Pydantic v1 스타일 Config 사용

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/schemas/auth.py:27-28`
- **문제**: `class Config: from_attributes = True` (v1 스타일). 프로젝트 규칙은 `model_config = ConfigDict(from_attributes=True)` (v2)
- **영향**: Pydantic v2 호환성 경고, strict 모드 불일치
- **제안**: v2 스타일로 변경

### [8] main.py 루트 엔드포인트 응답에 타 프로젝트명 잔재

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/main.py:190`
- **문제**: GET / 응답이 "Welcome to HomeNRich API" — 현 서비스명은 포도가계부(Podo Budget)
- **영향**: API 문서/헬스체크에서 혼동
- **제안**: "Welcome to Podo Budget API" 또는 settings.APP_NAME 사용

### [9] auth.test.ts 에러 케이스 미테스트

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `frontend/src/api/__tests__/auth.test.ts`
- **문제**: 기본 happy path만 검증. 401 응답, 네트워크 에러 케이스 없음
- **영향**: authApi 에러 처리 동작 미검증
- **제안**: 401, 네트워크 에러 케이스 추가

---

## Medium

### [10] 텔레그램/카카오 링크 코드 생성 로직 중복

- **심각도**: Medium
- **카테고리**: 코드품질
- **위치**: `backend/app/api/auth.py:61,98`
- **문제**: 두 함수가 동일한 6자 대문자+숫자 코드 생성, 15분 만료 로직 복제
- **영향**: 코드 길이/문자셋 변경 시 두 곳 수정 필요
- **제안**: `_generate_link_code()` 헬퍼 함수 추출

### [11] dependencies.py에서 settings를 함수 내부에서 지연 import

- **심각도**: Medium
- **카테고리**: 코드품질
- **위치**: `backend/app/api/dependencies.py:187`
- **문제**: require_admin() 내부에서 from app.core.config import settings 로컬 import. 순환 임포트 문제 없음에도 불필요
- **영향**: 코드 가독성 저하
- **제안**: 파일 상단으로 이동

### [12] require_admin/require_household_admin/require_household_owner 테스트 없음

- **심각도**: Medium
- **카테고리**: 테스트
- **위치**: `backend/app/api/dependencies.py:149-216`
- **문제**: 권한 검증 함수 3개 테스트 부재
- **영향**: 권한 체계 변경 시 회귀 미감지
- **제안**: 권한 거부(403) 케이스 추가

---

## 긍정적인 측면

- 인증 플로우가 SSO(podo-auth) 단일 경로로 잘 통합됨
- JWT 검증 로직에 iss(발급자) 확인이 포함됨
- ProtectedRoute에 초기화/에러/온보딩 분기가 구현되어 있음 (테스트만 부족)
- conftest.py의 test_user/test_household fixture가 일관된 패턴 유지

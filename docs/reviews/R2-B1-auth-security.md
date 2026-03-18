# R2-B1: 인증/보안 레이어 (성능+아키텍처)

리뷰 대상: BE 6개 파일 + FE 4개 파일

---

## Critical

### [1] JWT 검증 + DB 조회가 매 요청마다 실행됨 — 캐시 없음

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/core/auth.py:54-106`
- **문제**: `get_current_user` 디펜던시는 매 요청마다 JWT 검증(CPU) + `SELECT ... WHERE auth_user_id = ?` DB 조회를 수행. 캐시 계층 전혀 없음
- **영향**: 인증이 필요한 모든 API 엔드포인트에서 최소 1번의 추가 DB round-trip. 유저 증가 시 연결 풀 압박
- **제안**: `auth_user_id`를 키로 하는 짧은 TTL 인메모리 캐시(cachetools.TTLCache, TTL 60초) 도입

### [2] rate_limit.py에 JWT 알고리즘 상수 중복 정의

- **심각도**: Critical
- **카테고리**: 아키텍처
- **위치**: `backend/app/core/rate_limit.py:18`
- **문제**: `ALGORITHM = "HS256"`이 하드코딩. `config.py`의 `settings.JWT_ALGORITHM`을 사용하지 않음
- **영향**: 알고리즘 변경 시 rate limiter가 구 알고리즘으로 토큰 검증 시도 → JWTError → 모든 인증 요청이 IP 기반 rate limit으로 폴백
- **제안**: `settings.JWT_ALGORITHM` 직접 참조

---

## High

### [3] slowapi 메모리 기반 — 멀티 인스턴스 시 rate limit 무력화

- **심각도**: High
- **카테고리**: 성능/아키텍처
- **위치**: `backend/app/core/rate_limit.py:69-71`
- **문제**: slowapi 기본 MemoryStorage. 인스턴스 2개 이상 시 각각 독립 카운터 → 실제 제한치의 N배 허용
- **영향**: LLM API 비용 보호 rate limit 실효성 하락
- **제안**: 단기적으로 fly.toml에서 단일 인스턴스 명시, 중장기적으로 Redis 스토리지

### [4] getCookieToken 함수가 client.ts와 AuthContext.tsx에 중복 구현

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `frontend/src/api/client.ts:13-19`, `frontend/src/contexts/AuthContext.tsx:56-66`
- **문제**: 쿠키 파싱 정규식과 localStorage 폴백 로직이 두 파일에 완전 동일하게 구현
- **영향**: 쿠키 키 이름 또는 파싱 로직 변경 시 한쪽 누락으로 인증 불일치 버그 가능
- **제안**: `frontend/src/utils/token.ts`로 추출

---

## Medium

### [5] get_household_member가 Household 조회와 Member 조회를 순차 쿼리 2번으로 처리

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `backend/app/api/dependencies.py:119-145`
- **문제**: Household 존재 확인 + 멤버 자격 확인이 별도 쿼리 2번. 모든 가구 데이터 엔드포인트에서 호출
- **영향**: 요청당 2~3번의 인증 관련 DB 쿼리 발생
- **제안**: JOIN 쿼리 1번으로 통합

### [6] AuthContext의 value 객체가 매 렌더마다 새 참조 생성

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `frontend/src/contexts/AuthContext.tsx:234-238`
- **문제**: value 객체 리터럴이 매 렌더마다 새 참조. logout/refreshUser가 useCallback 미적용
- **영향**: useAuth() 구독 모든 컴포넌트가 AuthProvider 렌더링 시 불필요 리렌더링
- **제안**: logout을 useCallback, value 전체를 useMemo로 감싸기

---

## 긍정적인 측면

- JWT 검증 로직 자체는 안전하게 구현
- Shadow User 패턴이 깔끔하게 분리
- rate limiter가 인증/비인증 사용자 구분하여 차별화된 제한 적용
- ProtectedRoute의 인증 리디렉션 로직이 명확

# R1-B1: 인증/보안 레이어 (보안+버그)

리뷰 대상: 10개 파일 (백엔드 6개, 프론트엔드 4개)

---

## Critical

### [1] Telegram Webhook 시크릿 미설정 시 인증 없이 임의 LLM 실행 가능

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/app/api/telegram.py:192-195`, `backend/app/main.py:71-74`
- **문제**: `TELEGRAM_WEBHOOK_SECRET`이 설정되어 있을 때만 서명 검증을 수행. 빈 문자열이면 검증 로직 전체를 건너뜀. `main.py`의 lifespan에서도 경고만 출력할 뿐 시작을 막지 않음.
- **영향**: 공격자가 `/api/telegram/webhook`에 임의 JSON을 POST하면 LLM 파싱 비용 발생, `link_telegram_account_by_code`를 호출해 임의 코드로 계정 연동 시도 가능
- **제안**: `TELEGRAM_BOT_TOKEN`이 설정된 경우 `TELEGRAM_WEBHOOK_SECRET`도 필수로 강제하거나, 미설정 시 RuntimeError로 시작 차단

### [2] Sentry Webhook 시크릿 미설정 시 인증 없이 텔레그램 메시지 발송 가능

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/app/api/webhooks.py:69-72`
- **문제**: `SENTRY_WEBHOOK_SECRET`이 빈 문자열이면 서명 검증 블록 자체가 실행되지 않음. Telegram webhook과 동일한 패턴의 취약점
- **영향**: 누구나 `/api/webhooks/sentry`에 임의 JSON을 POST해서 운영자 텔레그램 채널로 스팸 메시지 발송 가능
- **제안**: `SENTRY_ALERT_CHAT_ID`가 설정된 경우 `SENTRY_WEBHOOK_SECRET`도 필수로 만들어야 함

### [3] X-Forwarded-For 헤더 스푸핑으로 rate limit 우회 가능

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/app/core/rate_limit.py:63-64`
- **문제**: 인증되지 않은 요청의 경우 `X-Forwarded-For` 헤더를 그대로 신뢰
- **영향**: 공격자가 매 요청마다 다른 IP를 설정하면 rate limit 완전 우회 가능 (단, LLM 엔드포인트는 `get_current_user`가 보호하므로 실제 LLM 호출까지는 도달하지 않음)
- **제안**: Fly.io 환경이라면 `Fly-Client-IP` 헤더를 사용하거나, 신뢰할 프록시 IP 범위를 명시

---

## High

### [4] Shadow User 생성 시 email 기반 매칭이 계정 탈취 벡터가 될 수 있음

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/core/auth.py:83-94`
- **문제**: `auth_user_id`로 조회 실패 시 `email`로 기존 유저를 찾아 `auth_user_id`를 자동 연결. podo-auth의 이메일 검증 강도에 전적으로 의존
- **영향**: podo-auth에서 이메일 인증 없이 계정 생성이 가능하다면, 타인의 가계부 데이터 전체 탈취 가능
- **제안**: 시간 제한 또는 플래그로 통제, email 매칭 시 최소한 감사 로그 기록

### [5] 토큰 만료 후 최대 5분간 인증 상태 유지

- **심각도**: High
- **카테고리**: 버그
- **위치**: `frontend/src/contexts/AuthContext.tsx:177-189`
- **문제**: 토큰 만료 체크가 5분 인터벌로만 실행. 앱이 열려 있는 상태에서 토큰 만료 시 다음 인터벌까지 최대 5분간 `isAuthenticated = true` 유지
- **영향**: 보안 위협보다는 UX 불일치 — 진행 중인 작업(예: 지출 저장)이 401로 실패
- **제안**: 토큰 `exp` 클레임 기반 proactive refresh 또는 인터벌을 1분으로 축소

### [6] CORS 기본값에 개발 환경 도메인이 포함됨

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/core/config.py:59`
- **문제**: `CORS_ORIGINS` 기본값에 `http://localhost:5173` 포함. 환경변수 미설정 시 프로덕션에서도 로컬호스트 오리진 허용
- **영향**: 로컬에서 실행 중인 임의 웹 페이지가 프로덕션 API에 인증된 요청 가능
- **제안**: 기본값을 프로덕션 도메인만으로 설정, 개발 환경은 `.env`에서 명시적 설정

### [7] Telegram callback_query에서 계정 연동 후 소유권 검증 불일치

- **심각도**: High
- **카테고리**: 버그
- **위치**: `backend/app/api/telegram.py:479-489`
- **문제**: 봇으로 입력한 지출의 `user_id`는 봇 유저 ID인데, 계정 연동 후 `get_or_create_bot_user`는 SSO 유저를 반환하여 소유권 검증 실패
- **영향**: 계정 연동 후 텔레그램으로 입력한 기존 지출을 수정/삭제 불가
- **제안**: 연동 시 기존 봇 유저 데이터를 SSO 유저로 마이그레이션, 또는 소유권 검증 시 연동된 봇 유저도 허용

### [8] ValueError 핸들러가 내부 오류 메시지를 클라이언트에 노출

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/core/exceptions.py:13-17`
- **문제**: `ValueError` 발생 시 `str(exc)` 전체를 클라이언트에 그대로 반환. 서버 내부 구조(쿼리, 파일 경로, 모델 구조) 노출 가능
- **제안**: Sentry에 기록하고 사용자에게는 일반적인 메시지 반환. 커스텀 예외로 구분

---

## 긍정적인 측면

- JWT 알고리즘 `HS256` 명시적 고정, `iss` 클레임 검증으로 다른 서비스 토큰 차단
- CORS는 와일드카드가 아닌 명시적 도메인 리스트 사용
- `allow_credentials=True`와 와일드카드 오리진의 위험한 조합 없음
- `get_household_member()` 의존성 체인이 모든 데이터 엔드포인트에서 일관 적용
- 401 응답 시 쿠키 도메인을 보존하여 SSO 세션 보호 로직 올바름

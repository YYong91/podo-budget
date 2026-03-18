# R1-B6: 봇/외부 연동 (보안+버그)

리뷰 대상: BE 9개 파일 + FE 5개 파일

---

## Critical

### [1] 텔레그램/카카오 Webhook 출처 검증이 선택적 — 미설정 시 인증 없음

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/app/api/telegram.py:192-195`, `backend/app/api/kakao.py:131-134`
- **문제**: `TELEGRAM_WEBHOOK_SECRET`과 `KAKAO_BOT_API_KEY`가 빈 문자열이면 검증 완전 스킵. 기본값이 둘 다 `""`
- **영향**: 누구나 webhook으로 LLM 무제한 호출(비용), 임의 지출 생성, 쓰레기 봇 유저 생성
- **제안**: 운영 환경에서 봇 토큰 설정 시 시크릿도 필수 강제 (startup validation)
- **참고**: R1-B1 [1]과 중복 — 동일 근본 원인

### [2] 카카오 인증 헤더 비교 — timing attack + 실제 헤더 형식 불일치 가능

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/app/api/kakao.py:131-134`
- **문제**: `!=` 비교로 timing attack 노출. 카카오 오픈빌더가 `Bearer TOKEN` 형식으로 보내면 검증이 항상 실패하여 시크릿을 빈 문자열로 유지하게 됨
- **영향**: 정상 카카오 요청이 403으로 거절되거나, 무인증 상태가 지속
- **제안**: `hmac.compare_digest` 사용, 카카오 오픈빌더 실제 헤더 형식 확인 후 파싱 로직 매칭

### [3] get_account_by_id — household_id가 있으면 소유자/멤버 검증 없이 반환 (IDOR)

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/app/services/account_service.py:38-48`
- **문제**: `account.household_id`가 있으면 `created_by` 검사를 건너뛰고 바로 반환. household 멤버십 검증 없음
- **영향**: 인증된 임의 사용자가 account_id 순차 대입으로 타 가구 계좌 정보(이름, 기관, 메모) 열람 가능
- **제안**: `GET /{account_id}` 엔드포인트에서 `get_household_member()` 검증 추가

---

## High

### [4] Sentry Webhook 서명 검증도 선택적

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/api/webhooks.py:69-72`
- **문제**: `SENTRY_WEBHOOK_SECRET` 미설정 시 서명 검증 스킵. payload의 title/culprit/url이 그대로 텔레그램 메시지로 전송
- **영향**: 임의 JSON으로 관리자 텔레그램에 스팸/피싱 메시지 주입
- **제안**: 운영 환경에서 시크릿 필수 강제
- **참고**: R1-B1 [2]와 중복

### [5] _verify_sentry_signature — sha256= prefix 미파싱으로 검증 항상 실패

- **심각도**: High
- **카테고리**: 버그
- **위치**: `backend/app/api/webhooks.py:20`
- **문제**: Sentry는 `sha256=<hex>` 형식으로 서명을 보내는데, 코드는 prefix 없이 raw hexdigest와 비교 → 항상 불일치
- **영향**: `SENTRY_WEBHOOK_SECRET` 설정 시 모든 합법적 Sentry webhook이 401로 거절, 알림 미전달
- **제안**: `signature.startswith("sha256=")` 파싱 추가

### [6] 텔레그램 set_category — 콜백 데이터에서 임의 카테고리 이름으로 생성 가능

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/api/telegram.py:621`
- **문제**: `set_category` 액션에서 category_info가 숫자가 아닌 경우 `get_or_create_category`가 콜백 데이터의 문자열로 카테고리 생성
- **영향**: 콜백 조작으로 임의 카테고리 생성 (자신의 user_id 스코프이므로 타인 데이터 오염은 없음)
- **제안**: 카테고리 생성을 숫자 ID 기반으로만 허용

### [7] AccountManager — activeHouseholdId! non-null assertion

- **심각도**: High
- **카테고리**: 버그
- **위치**: `frontend/src/pages/AccountManager.tsx:28`
- **문제**: `activeHouseholdId!`로 non-null assertion. 초기 렌더링 시 null이면 잘못된 API 요청
- **영향**: 가구 로딩 중 페이지 진입 시 API 오류
- **제안**: `if (!activeHouseholdId) return` null guard 추가

---

## Medium

### [8] 카카오 연동 UI — 복사 명령어 형식 불일치

- **심각도**: Medium
- **카테고리**: 버그
- **위치**: `frontend/src/pages/SettingsPage.tsx:290, 506`
- **문제**: 클립보드 복사 텍스트가 `/link 코드`인데, 카카오 봇 도움말은 `연동 코드` 형식 안내
- **영향**: 사용자 혼란 (기능 자체는 둘 다 동작)
- **제안**: UI 안내 텍스트를 `연동 코드` 형식으로 통일

---

## 긍정적인 측면

- 텔레그램 연동 코드에 6자리 영숫자 사용 + 10분 만료
- 봇 유저와 SSO 유저 분리(Shadow User 패턴) 명확
- callback_query 소유권 검증이 존재
- 봇 메시지 포맷이 한국어로 사용자 친화적

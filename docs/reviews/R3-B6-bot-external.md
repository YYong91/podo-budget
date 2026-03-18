# R3-B6: 봇/외부 연동 (코드품질+테스트)

리뷰 대상: `backend/app/api/telegram.py`, `kakao.py`, `webhooks.py`, `accounts.py`, `models/account.py`, `schemas/account.py`, `services/bot_messages.py`, `services/bot_user_service.py`, `services/account_service.py`, `frontend/src/pages/SettingsPage.tsx`, `AccountManager.tsx` 및 관련 테스트 파일.

---

## Critical

(이전 라운드에서 발견된 사항 제외 후 Critical 없음)

---

## High

### [1] telegram.py와 kakao.py — _get_accessible_categories 함수 완전 중복

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/api/telegram.py:92-112`, `api/kakao.py:351-371`
- **문제**: 동일한 카테고리 조회 함수가 양쪽에 완전 복제. handle_report_command, handle_budget_command의 DB 쿼리 로직도 거의 동일
- **영향**: 로직 변경 시 한쪽만 수정될 위험
- **제안**: `services/bot_query_service.py`로 공유 쿼리 로직 추출

### [2] bot_user_service.py — link_telegram/kakao_account_by_code 로직 완전 중복

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/services/bot_user_service.py:93-235,238-285`
- **문제**: 만료 체크 → 코드 조회 → 중복 체크 → 이관 → 커밋 구조가 두 함수에 완전 동일. 플랫폼 차이(telegram_chat_id vs kakao_user_id)만 다름
- **영향**: 코드 중복, 한쪽만 수정 위험
- **제안**: 플랫폼을 파라미터로 받는 제네릭 함수로 통합

### [3] accounts.py update/delete에서 select/Account 함수 내부 import

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/api/accounts.py:61-63,79-81`
- **문제**: update_account/delete_account에서 sqlalchemy.select, app.models.account.Account를 함수 내부 import. 동일 파일 내 create/get은 모듈 상단 import
- **영향**: 코드 스타일 비일관, IDE 정적 분석 방해
- **제안**: 모듈 상단으로 이동

> ⚠️ R2-B6 [5]에서도 지적됨 — 코드품질 관점 재확인

### [4] SettingsPage 카카오 코드 복사 시 명령어 형식 불일치

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `frontend/src/pages/SettingsPage.tsx:289-292`
- **문제**: 복사 내용이 `/link {code}` 형식. 하지만 bot_messages.py의 format_kakao_link_usage_message()는 `연동 코드` 형식 안내. 두 안내가 다른 명령어 사용
- **영향**: 사용자 혼란
- **제안**: 안내 형식 통일

### [5] AccountManager activeHouseholdId! non-null assertion — 마운트 시 null 가능

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `frontend/src/pages/AccountManager.tsx:27-33`
- **문제**: `activeHouseholdId!` 타입 assertion 사용. useEffect가 [activeHouseholdId] 의존성으로 실행되므로 마운트 시점에 null일 수 있음
- **영향**: null로 API 호출 시 에러
- **제안**: `if (!activeHouseholdId) return` 가드 추가

### [6] format_unknown_input 미사용 — 데드 코드

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/services/bot_messages.py:14-16`
- **문제**: 함수가 정의되고 테스트도 있으나 telegram.py/kakao.py 어디에서도 import하지 않음
- **영향**: 데드 코드 유지보수 부담
- **제안**: 실제 사용처 추가 또는 제거

### [7] test_api_accounts.py 가구 계좌 타 사용자 조회 테스트 누락

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `backend/tests/integration/test_api_accounts.py`
- **문제**: 가구 계좌에 대해 타 가구 사용자가 조회할 수 없어야 하는 케이스 미테스트
- **영향**: 접근 권한 회귀 미감지
- **제안**: 다른 가구 사용자로 계좌 조회 시 403/404 확인 테스트 추가

### [8] SettingsPage.test.tsx 카카오/텔레그램 연동 핸들러 테스트 없음

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `frontend/src/pages/__tests__/SettingsPage.test.tsx`
- **문제**: 연동 코드 발급(generateKakaoLinkCode), 연동 해제(unlinkKakao/Telegram) API 호출 테스트 전무
- **영향**: 연동 UI 회귀 미감지
- **제안**: 각 핸들러 클릭 → API 호출 검증 테스트 추가

---

## 긍정적인 측면

- send_telegram_message에 timeout=10.0 설정
- 봇 유저와 SSO 유저 분리(Shadow User 패턴) 명확
- 텔레그램 연동 코드 6자리 영숫자 + 10분 만료
- bot_messages.py 테스트가 메시지 포맷 정확성을 잘 검증

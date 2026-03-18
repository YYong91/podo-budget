# R2-B6: 봇/외부 연동 (성능+아키텍처)

리뷰 대상: BE 9개 파일 + FE 5개 파일

---

## Critical

### [1] answer_callback_query에 타임아웃 미설정

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/api/telegram.py:644-646`
- **문제**: send_telegram_message는 timeout=10.0 명시하지만 answer_callback_query는 미지정. 네트워크 문제 시 DB 세션과 워커 블록
- **영향**: 모든 callback 처리 경로에서 hit 가능
- **제안**: httpx.AsyncClient(timeout=10.0) 설정

### [2] handle_budget_command — N+1 쿼리: 예산별 카테고리+지출 직렬 조회

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/api/telegram.py:719-741`, `backend/app/api/kakao.py:537-550`
- **문제**: 예산 N개 → 카테고리 조회 N번 + 지출 집계 N번 = 2N 직렬 쿼리. 카카오 5초 응답 제한
- **영향**: 예산 10개면 20번 DB 왕복
- **제안**: JOIN으로 예산+카테고리 한 번에 조회, 지출 집계는 GROUP BY 단일 쿼리

### [3] _handle_multiple_expenses — 저장 후 db.refresh() N번 불필요 실행

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/api/telegram.py:419-420`, `backend/app/api/kakao.py:295-296`
- **문제**: commit 후 각 expense를 refresh하지만, 실제 사용 필드는 이미 로컬 변수에 존재. refresh 불필요
- **영향**: 지출 건수만큼 불필요한 SELECT
- **제안**: db.refresh 호출 제거

---

## High

### [4] get_or_create_bot_user에서 bcrypt 해싱 동기 실행 — async 이벤트 루프 블록

- **심각도**: High
- **카테고리**: 성능
- **위치**: `backend/app/services/bot_user_service.py:63`
- **문제**: pwd_context.hash()는 CPU 바운드 동기 함수. 봇 신규 사용자 생성 시 이벤트 루프 수백ms 블록
- **영향**: 봇 메시지 처리 지연
- **제안**: 봇 유저는 실제 로그인하지 않으므로 고정 마커 문자열 사용, 또는 run_in_executor로 오프로드

### [5] accounts.py update/delete에서 모델을 함수 내부 import — 레이어 위반

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `backend/app/api/accounts.py:61-63`, `:79-81`
- **문제**: create/get은 서비스 레이어 위임, update/delete는 API에서 직접 모델 쿼리 + 함수 내부 import
- **영향**: 아키텍처 일관성 위반
- **제안**: account_service에 update/delete 함수 추가

### [6] SettingsPage 텔레그램/카카오 연동 UI 코드 중복

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `frontend/src/pages/SettingsPage.tsx:212-520`
- **문제**: 텔레그램(330-423행)과 카카오(425-519행) 섹션이 거의 동일. 상태변수 4개씩, 핸들러 3개씩, JSX 동일
- **영향**: 버그 수정/UI 변경 시 두 곳 모두 수정 필요
- **제안**: BotLinkSection 공통 컴포넌트 추출

---

## 긍정적인 측면

- send_telegram_message에 타임아웃 설정 (answer_callback_query만 누락)
- 봇 유저와 SSO 유저 분리(Shadow User 패턴) 명확
- 텔레그램 연동 코드에 6자리 영숫자 + 10분 만료
- 봇 메시지 한국어 포맷이 사용자 친화적

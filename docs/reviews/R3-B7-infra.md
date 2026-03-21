# R3-B7: 인프라/테스트/설정 (코드품질+테스트)

리뷰 대상: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.github/workflows/*.yml`, `backend/tests/conftest.py`, `frontend/src/mocks/server.ts,handlers.ts,fixtures.ts`

---

## Critical

(이전 라운드에서 발견된 사항 제외 후 Critical 없음)

---

## High

### [1] conftest.py — dependency_overrides.clear()가 예외 시 실행 안 될 수 있음

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/tests/conftest.py:258-266,287-297,316-327`
- **문제**: client/authenticated_client/authenticated_client2 세 fixture에서 yield 후 `app.dependency_overrides.clear()`가 try/finally 없이 배치. 예외 시 오버라이드가 남아있음
- **영향**: 후속 테스트에서 예상치 못한 DB 세션 공유
- **제안**: try/finally로 감싸기

### [2] conftest.py — client/authenticated_client/authenticated_client2 코드 중복

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/tests/conftest.py:241-327`
- **문제**: 세 fixture가 override_get_db 정의, dependency_overrides 설정, AsyncClient 생성, clear() 정리를 완전 동일하게 반복. 차이는 headers 유무뿐
- **영향**: [1]번 버그가 세 곳에 동시 존재하는 원인. 유지보수 지점 3배
- **제안**: 내부 헬퍼 함수로 추출

### [3] conftest.py — mock_llm이 AnthropicProvider만 직접 패치

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/tests/conftest.py:338-347`
- **문제**: `app.services.llm_service.AnthropicProvider.parse_expense`를 직접 패치. LLM_PROVIDER 변경 시 mock 무효화
- **영향**: openai/local 프로바이더 환경에서 실제 API 호출 발생 또는 무음 실패
- **제안**: get_llm_provider 또는 LLMProvider 기반 클래스 메서드 패치

> ⚠️ R1-B7 [5]에서도 지적됨 — 코드품질 관점 재확인

### [4] fixtures.ts — mockExpenses/mockRecurringTransactions의 household_id: null

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `frontend/src/mocks/fixtures.ts:50,63,76,228,247`
- **문제**: 프로젝트 규칙 "모든 데이터는 household_id 기반 (NOT NULL)" 위반. 실제 API 응답과 mock 데이터 형식 불일치
- **영향**: household 필터링 관련 UI 테스트 시 false negative
- **제안**: `household_id: 1`로 변경

### [5] CI 워크플로우 — notify-test-result가 notify.yml 미사용하고 curl 인라인 중복

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `.github/workflows/ci.yml:35-68`, `cd.yml:144-146`
- **문제**: notify-test-start는 notify.yml 재사용하나, notify-test-result와 cd.yml의 결과 알림은 동일한 curl 명령어를 인라인 복사
- **영향**: Telegram API 변경 시 두 곳 수정 필요
- **제안**: notify.yml에 success/failure 입력 추가 또는 composite action 추출

---

## Medium

### [6] docker-compose.yml — named volume 'data' 미사용

- **심각도**: Medium
- **카테고리**: 코드품질
- **위치**: `docker-compose.yml:40-41`
- **문제**: 최상단 named volume 'data' 선언하나 실제 서비스는 bind mount(./data) 사용. named volume 미사용
- **영향**: 불필요한 volume 생성, 설정 혼동
- **제안**: 최상단 volumes: data: 선언 제거

### [7] e2e.yml — Playwright 설치 경로가 루트에서 실행

- **심각도**: Medium
- **카테고리**: 코드품질
- **위치**: `.github/workflows/e2e.yml:65-66`
- **문제**: `npm ci && npx playwright install` 이 루트에서 실행. 루트에 package.json 없으면 실패. e2e/ 디렉토리 기준이어야 함
- **영향**: E2E 워크플로우 복원 시 첫 번째 실패 지점 (현재 수동 실행 전용)
- **제안**: `cd e2e && npm ci` 형태로 경로 명시

---

## 긍정적인 측면

- CI/CD 분리 구조(CI: 테스트, CD: 배포)가 명확
- conftest.py fixture 수(12개)가 370줄 내에서 잘 정리됨
- MSW handlers.ts에서 specific-before-wildcard 순서 올바름 (stats → :id)
- concurrency 설정으로 중복 배포 방지

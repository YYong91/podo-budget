# R1-B7: 인프라/테스트/설정 (보안+버그)

리뷰 대상: Docker, Fly.io, GitHub Actions, Vite, pyproject.toml, Alembic, conftest.py

---

## Critical

### [1] Dockerfile에서 uv를 :latest 태그로 사용 — 공급망 공격 위험

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/Dockerfile:6`
- **문제**: `COPY --from=ghcr.io/astral-sh/uv:latest`로 태그 고정 없음. 빌드마다 다른 버전 사용 가능
- **영향**: 악성 버전 업로드 시 CI/CD를 통해 운영 서버에 배포
- **제안**: 특정 버전으로 고정 (`ghcr.io/astral-sh/uv:0.5.20`)

### [2] flyctl-actions/setup-flyctl@master — 브랜치 참조

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `.github/workflows/cd.yml:39`
- **문제**: `@master` 브랜치 직접 참조. 커밋이 변경되면 다음 배포 시 즉시 실행
- **영향**: 공급망 공격 시 `FLY_API_TOKEN` 포함 환경에서 임의 코드 실행
- **제안**: 특정 버전 태그 또는 SHA로 고정 (`@v1`)

### [3] 프로덕션 fly.toml에 SQLite 사용 설정

- **심각도**: Critical
- **카테고리**: 버그
- **위치**: `backend/fly.toml:21`
- **문제**: `DATABASE_URL = "sqlite+aiosqlite:////app/data/db.sqlite3"`가 프로덕션 toml에 명시. Fly.io secrets로 오버라이드하지 않으면 SQLite 사용
- **영향**: 재배포 시 데이터 유실, 다중 인스턴스 동시성 문제
- **제안**: fly.toml에서 DATABASE_URL 제거, Fly.io secrets로만 관리

---

## High

### [4] docker-compose.yml JWT_SECRET 기본값 하드코딩

- **심각도**: High
- **카테고리**: 보안
- **위치**: `docker-compose.yml:21`
- **문제**: `JWT_SECRET=${JWT_SECRET:-podo-jwt-secret-change-in-production}` — 기본값이 공개 저장소에 노출
- **영향**: `.env` 미설정 시 알려진 시크릿으로 JWT 위조 가능
- **제안**: 기본값 제거, `.env` 필수 설정 강제

### [5] conftest.py의 mock_llm이 AnthropicProvider를 직접 패치

- **심각도**: High
- **카테고리**: 버그
- **위치**: `backend/tests/conftest.py:339, 358`
- **문제**: `AnthropicProvider.parse_expense`를 직접 패치. LLM_PROVIDER를 openai로 변경하면 mock이 적용되지 않음
- **영향**: LLM_PROVIDER 변경 시 관련 테스트 무효화, 실제 LLM API 호출 시도
- **제안**: `get_llm_provider` 팩토리 함수를 패치하여 프로바이더 독립적으로 변경

### [6] docker-compose.yml에서 --reload 플래그로 실행

- **심각도**: High
- **카테고리**: 버그
- **위치**: `docker-compose.yml:23`
- **문제**: `--reload` 옵션이 포함. 셀프호스팅으로 사용 시 성능 저하
- **영향**: 파일 시스템 감시 이슈로 예기치 않은 재시작
- **제안**: 개발 전용 명시 또는 production docker-compose 별도 분리

---

## Medium

### [7] ci-test.yml에서 uv 버전 비고정

- **심각도**: Medium
- **카테고리**: 보안
- **위치**: `.github/workflows/ci-test.yml:30`, `e2e.yml:20`
- **문제**: `astral-sh/setup-uv@v4` + `version: "latest"` — 태그 재지정 가능
- **영향**: uv 새 버전에서 CI 동작 변경 가능
- **제안**: `version: "0.5.20"` 등 고정 버전 사용

### [8] fly.dev.toml에 DEBUG = "True" 명시

- **심각도**: Medium
- **카테고리**: 보안
- **위치**: `backend/fly.dev.toml:14`
- **문제**: 인터넷 공개 서버에서 DEBUG 모드 — 상세 스택 트레이스 노출
- **영향**: 에러 시 내부 코드 구조 노출
- **제안**: Fly.io secrets로 관리 또는 제거

### [9] notify.yml에서 inputs.message를 shell에 직접 삽입 — 커맨드 인젝션

- **심각도**: Medium
- **카테고리**: 보안
- **위치**: `.github/workflows/notify.yml:30`
- **문제**: `${{ inputs.message }}`가 YAML에서 직접 렌더링. PR 제목에 `$(...)` 등 포함 시 shell 실행
- **영향**: PR 제목으로 CI 환경에서 명령 실행 가능
- **제안**: 환경변수로 전달 후 `$ENV_VAR` 참조

---

## 긍정적인 측면

- Alembic 마이그레이션이 체계적으로 관리됨
- CI/CD 분리 구조 (CI: 테스트, CD: 배포)가 명확
- conftest.py의 fixture 체계가 잘 구성됨
- Fly.io secrets로 민감 정보 분리하는 구조 존재

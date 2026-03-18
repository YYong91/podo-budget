# R2-B7: 인프라/테스트/설정 (성능+아키텍처)

리뷰 대상: Docker, Fly.io, GitHub Actions, Vite, pyproject.toml, Alembic

---

## Critical

### [1] fly.toml release_command에서 중복 uv sync 실행

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/fly.toml:15`, `backend/fly.dev.toml`
- **문제**: Dockerfile에서 이미 uv sync로 의존성 설치했는데, release_command에서 다시 uv sync 실행. .venv는 이미지에 포함됨
- **영향**: 매 배포마다 불필요한 패키지 다운로드/설치 시간
- **제안**: release_command에서 uv sync 제거, alembic upgrade head만 실행

### [2] Dockerfile: 불필요한 2회 COPY pyproject.toml

- **심각도**: Critical
- **카테고리**: 아키텍처
- **위치**: `backend/Dockerfile:9,18`
- **문제**: COPY backend/ 후 다시 COPY pyproject.toml — "backend/가 덮어쓴 것을 되돌림" 방어적 복사. 캐시 레이어 효율 저하
- **영향**: 빌드 의도 불분명, 캐시 최적화 방해
- **제안**: .dockerignore에 backend/pyproject.toml 추가하여 덮어쓰기 방지

---

## High

### [3] CI ruff format --check 누락

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `.github/workflows/ci-test.yml:44`
- **문제**: workflow.md 규칙에 ruff format 필수이나 CI에 --check 없음
- **영향**: 포맷 미준수 코드가 CI 통과
- **제안**: ruff format --check backend/ 추가

---

## Medium

### [4] Vite vendor chunk splitting 미설정

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `frontend/vite.config.ts`
- **문제**: manualChunks 미설정. Recharts(d3 기반), React Router, Axios 등이 앱 코드와 함께 번들
- **영향**: 앱 코드 변경 시 vendor 청크 캐시 무효화
- **제안**: vendor-react, vendor-charts, vendor-ui로 chunk 분리

### [5] pyproject.toml 의존성 버전 과도한 고정 (==)

- **심각도**: Medium
- **카테고리**: 아키텍처
- **위치**: `pyproject.toml:7-14`
- **문제**: fastapi==0.109.0 등 2년 이상 오래된 버전에 == 고정. uv.lock으로 재현성은 보장됨
- **영향**: 보안 패치 반영 불가, uv lock --upgrade 무효
- **제안**: >= 하한 + < 메이저 상한으로 전환

---

## 긍정적인 측면

- CI/CD 분리 구조(CI: 테스트, CD: 배포)가 명확
- Fly.io health check 설정이 적절
- frontend 멀티스테이지 빌드로 Nginx 기반 경량 이미지
- alembic/env.py의 async migration 패턴 올바름
- concurrency 설정으로 중복 배포 방지

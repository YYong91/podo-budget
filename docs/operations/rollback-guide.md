# 롤백 가이드

> DB 마이그레이션 실패, 배포 장애 시 대응 절차 (#255)

## 목차

1. [마이그레이션 롤백](#1-마이그레이션-롤백)
2. [Fly.io 배포 롤백](#2-flyio-배포-롤백)
3. [데이터 백업/복원](#3-데이터-백업복원)
4. [긴급 대응 체크리스트](#4-긴급-대응-체크리스트)

---

## 1. 마이그레이션 롤백

### 1.1 마이그레이션 실패 감지

CI에서 `alembic check`로 pending 마이그레이션을 자동 감지한다. 배포 시 `alembic upgrade head`가 실패하면 Fly.io `release_command`가 실패하여 배포가 중단된다.

```bash
# 현재 마이그레이션 상태 확인
cd backend
PYTHONPATH=. alembic current

# head와 현재 상태 비교
PYTHONPATH=. alembic heads
```

### 1.2 마이그레이션 되돌리기

```bash
# 마지막 1개 마이그레이션 되돌리기
cd backend
PYTHONPATH=. alembic downgrade -1

# 특정 리비전으로 되돌리기
PYTHONPATH=. alembic downgrade <revision_id>

# 마이그레이션 히스토리 확인
PYTHONPATH=. alembic history --verbose
```

### 1.3 Fly.io에서 마이그레이션 롤백

Fly.io 환경에서는 직접 alembic 명령을 실행할 수 없으므로, SSH로 접속한다.

```bash
# Fly.io 앱에 SSH 접속
fly ssh console -a podo-budget-backend

# 앱 내부에서 마이그레이션 롤백
cd /app
PYTHONPATH=. alembic downgrade -1
```

### 1.4 주의사항

- **데이터 손실 가능**: `DROP COLUMN`, `DROP TABLE` 등의 downgrade는 데이터를 삭제한다. 반드시 백업 후 진행.
- **downgrade 함수 확인**: 모든 마이그레이션 파일의 `downgrade()` 함수가 올바르게 구현되어 있는지 사전 확인.
- **의존 관계**: 여러 마이그레이션을 되돌릴 때는 역순으로 진행된다.

---

## 2. Fly.io 배포 롤백

### 2.1 최근 릴리즈 확인

```bash
# 최근 릴리즈 목록 (앱별)
fly releases -a podo-budget-backend
fly releases -a podo-budget-dev
```

### 2.2 이전 버전으로 롤백

```bash
# 특정 이미지로 배포 (릴리즈 목록에서 이미지 확인)
fly deploy --image <registry/image:tag> -a podo-budget-backend

# 또는 이전 릴리즈 번호로 롤백
fly releases rollback -a podo-budget-backend
```

### 2.3 프론트엔드 롤백 (Cloudflare Pages)

Cloudflare Pages는 배포 히스토리를 유지한다. Cloudflare 대시보드에서 이전 배포를 프로덕션으로 승격시킬 수 있다.

```bash
# Cloudflare Pages 배포 목록 확인
npx wrangler pages deployments list --project-name podo-budget
```

---

## 3. 데이터 백업/복원

### 3.1 백업 생성

```bash
# 스크립트 사용 (권장)
./scripts/backup-db.sh podo-budget-backend

# 수동 백업
fly proxy 15432:5432 -a podo-budget-backend-db &
pg_dump "postgresql://postgres@localhost:15432/podo_budget" | gzip > backup.sql.gz
kill %1
```

### 3.2 백업 복원

```bash
# 복원 (주의: 기존 데이터 덮어쓰기)
gunzip -c backup.sql.gz | fly postgres connect -a podo-budget-backend-db -d podo_budget

# 또는 proxy를 통해 복원
fly proxy 15432:5432 -a podo-budget-backend-db &
gunzip -c backup.sql.gz | psql "postgresql://postgres@localhost:15432/podo_budget"
kill %1
```

### 3.3 배포 전 백업 권장 타이밍

- 마이그레이션이 포함된 릴리즈 전
- `DROP` / `ALTER` 계열 마이그레이션 전
- 데이터 변환 마이그레이션 (data migration) 전

---

## 4. 긴급 대응 체크리스트

### 배포 후 장애 발생 시

- [ ] **1. 상황 파악** (1분)
  - 에러 로그 확인: `fly logs -a podo-budget-backend`
  - Sentry 대시보드 확인
  - 앱 상태 확인: `fly status -a podo-budget-backend`

- [ ] **2. 즉시 롤백 판단** (2분)
  - 마이그레이션 실패 → 마이그레이션 롤백 후 앱 롤백
  - 앱 코드 버그 → 앱만 롤백 (이전 이미지로 배포)
  - 인프라 문제 → Fly.io 상태 페이지 확인

- [ ] **3. 롤백 실행** (5분)
  ```bash
  # DB 백업 (데이터 보존)
  ./scripts/backup-db.sh podo-budget-backend

  # 앱 롤백
  fly releases rollback -a podo-budget-backend

  # 필요시 마이그레이션 롤백
  fly ssh console -a podo-budget-backend
  # (내부) PYTHONPATH=. alembic downgrade -1
  ```

- [ ] **4. 확인**
  - 앱 정상 동작 확인: `curl https://podo-budget-backend.fly.dev/api/health`
  - 프론트엔드 접근 확인: `curl -I https://budget.podonest.com`

- [ ] **5. 후속 조치**
  - 장애 원인 분석 및 기록
  - 수정 사항 develop 브랜치에서 작업
  - 테스트 보강 후 재배포

### 개발 환경 장애 시

개발 환경(`podo-budget-dev`)은 동일한 절차를 `-a podo-budget-dev`로 수행한다. 개발 환경 장애는 운영에 영향을 주지 않으므로 침착하게 원인을 분석한다.

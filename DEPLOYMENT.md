# HomeNRich 배포 가이드

이 문서는 HomeNRich를 Fly.io에 배포하는 전체 과정을 안내합니다.

## 사전 준비

### 1. 계정 및 도구 설치

```bash
# Fly.io CLI 설치 (macOS)
brew install flyctl

# 로그인
flyctl auth login

# 계정 확인
flyctl auth whoami
```

### 2. 무료 티어 확인
Fly.io 무료 티어 (2025년 기준):
- 3개 앱까지 무료
- shared-cpu-1x, 256MB RAM
- 3GB PostgreSQL 스토리지
- 160GB 아웃바운드 트래픽/월

**비용 발생 조건**: 위 제한 초과 시 자동 과금

---

## Phase 1: 데이터베이스 생성

### 1.1 PostgreSQL 생성

```bash
# Fly Postgres 앱 생성 (도쿄 리전)
flyctl postgres create \
  --name homenrich-db \
  --region nrt \
  --vm-size shared-cpu-1x \
  --volume-size 3 \
  --initial-cluster-size 1

# 생성 후 출력되는 정보 저장:
# - Connection string
# - Username / Password
```

**중요**: 출력된 연결 정보를 안전한 곳에 보관하세요.

### 1.2 DB 연결 정보 확인

```bash
# 연결 문자열 확인
flyctl postgres db list --app homenrich-db

# 수동 연결 테스트
flyctl postgres connect --app homenrich-db
```

---

## Phase 2: Backend 배포

### 2.1 앱 생성

```bash
cd backend

# Fly 앱 생성 (fly.toml 자동 생성됨)
flyctl launch \
  --name homenrich-backend \
  --region nrt \
  --no-deploy

# fly.toml 파일 확인 (이미 저장소에 있음)
```

### 2.2 데이터베이스 연결 설정

```bash
# DB를 Backend 앱에 연결
flyctl postgres attach homenrich-db --app homenrich-backend

# 자동으로 DATABASE_URL 시크릿이 추가됩니다
```

### 2.3 환경 변수 설정

```bash
# 필수 시크릿 설정
flyctl secrets set \
  SECRET_KEY="$(openssl rand -hex 32)" \
  LLM_PROVIDER=anthropic \
  ANTHROPIC_API_KEY=your_actual_api_key_here \
  TELEGRAM_BOT_TOKEN=your_telegram_token_here \
  KAKAO_BOT_API_KEY=your_kakao_key_here \
  DEBUG=False \
  CORS_ORIGINS=https://homenrich.fly.dev \
  --app homenrich-backend

# 시크릿 확인 (값은 보이지 않음, 키 이름만 확인)
flyctl secrets list --app homenrich-backend
```

### 2.4 배포

```bash
# 첫 배포
flyctl deploy --remote-only

# 배포 상태 확인
flyctl status --app homenrich-backend

# 로그 확인
flyctl logs --app homenrich-backend
```

### 2.5 DB 마이그레이션 실행

```bash
# SSH 접속하여 마이그레이션 실행
flyctl ssh console --app homenrich-backend

# 컨테이너 내부에서:
$ uv run alembic upgrade head
$ exit

# 또는 원격 명령 실행:
flyctl ssh console --app homenrich-backend --command "uv run alembic upgrade head"
```

### 2.6 헬스체크 확인

```bash
curl https://homenrich-backend.fly.dev/health
# 응답: {"status":"healthy"}

curl https://homenrich-backend.fly.dev/health/db
# 응답: {"status":"healthy","database":"connected"}
```

---

## Phase 3: Frontend 배포

### 3.1 앱 생성

```bash
cd ../frontend

# Fly 앱 생성
flyctl launch \
  --name homenrich-frontend \
  --region nrt \
  --no-deploy
```

### 3.2 환경 변수 설정

```bash
# Backend URL 설정 (nginx proxy용)
flyctl secrets set \
  BACKEND_URL=https://homenrich-backend.fly.dev \
  --app homenrich-frontend
```

### 3.3 배포

```bash
# 빌드 + 배포
flyctl deploy --remote-only --build-arg VITE_API_URL=/api

# 상태 확인
flyctl status --app homenrich-frontend

# 로그 확인
flyctl logs --app homenrich-frontend
```

### 3.4 접속 확인

```bash
# 브라우저에서 열기
flyctl open --app homenrich-frontend

# 또는 직접 접속:
# https://homenrich-frontend.fly.dev
```

---

## Phase 4: 커스텀 도메인 설정 (선택)

### 4.1 Cloudflare DNS 설정

도메인을 구매한 후:

```bash
# Fly.io에서 인증서 생성
flyctl certs create homenrich.yourdomain.com --app homenrich-frontend
flyctl certs create api.homenrich.yourdomain.com --app homenrich-backend

# DNS 설정 확인 (CNAME 레코드 정보 제공됨)
flyctl certs show homenrich.yourdomain.com --app homenrich-frontend
```

Cloudflare 대시보드에서:
1. DNS > Add record
2. Type: CNAME
3. Name: `homenrich` (또는 `@` for root)
4. Target: `homenrich-frontend.fly.dev`
5. Proxy status: Proxied (주황색 구름)

Backend도 동일하게:
- Name: `api.homenrich`
- Target: `homenrich-backend.fly.dev`

### 4.2 환경 변수 업데이트

```bash
# Backend CORS 업데이트
flyctl secrets set \
  CORS_ORIGINS=https://homenrich.yourdomain.com \
  --app homenrich-backend
```

---

## Phase 5: CI/CD 설정

### 5.1 GitHub Secrets 설정

GitHub Repository > Settings > Secrets and variables > Actions:

1. `FLY_API_TOKEN` 추가:
   ```bash
   # 토큰 생성
   flyctl auth token

   # 출력된 토큰을 GitHub Secret에 저장
   ```

### 5.2 자동 배포 확인

이제 `main` 브랜치에 push하면 자동으로 배포됩니다:

```bash
git push origin main

# GitHub Actions 탭에서 배포 진행 상황 확인
```

---

## 모니터링 및 운영

### 로그 확인

```bash
# 실시간 로그 (Backend)
flyctl logs --app homenrich-backend -f

# 실시간 로그 (Frontend)
flyctl logs --app homenrich-frontend -f

# 최근 200줄
flyctl logs --app homenrich-backend --lines 200
```

### 리소스 사용량 확인

```bash
# 앱 상태
flyctl status --app homenrich-backend

# 메트릭 (Dashboard)
flyctl dashboard --app homenrich-backend
```

### DB 백업

```bash
# 수동 스냅샷 생성
flyctl volumes snapshots create vol_xyz --app homenrich-db

# 스냅샷 목록
flyctl volumes snapshots list vol_xyz --app homenrich-db

# 복원
flyctl volumes create --snapshot-id snap_abc --app homenrich-db
```

### 스케일링

```bash
# 수직 스케일 (메모리 증가)
flyctl scale memory 1024 --app homenrich-backend

# 수평 스케일 (인스턴스 추가)
flyctl scale count 2 --app homenrich-backend

# 현재 스케일 확인
flyctl scale show --app homenrich-backend
```

---

## 트러블슈팅

### 1. 앱이 시작되지 않음

```bash
# 로그 확인
flyctl logs --app homenrich-backend

# SSH 접속하여 디버깅
flyctl ssh console --app homenrich-backend

# 환경 변수 확인
flyctl ssh console --app homenrich-backend --command "env | grep DATABASE"
```

### 2. DB 연결 실패

```bash
# DB 상태 확인
flyctl status --app homenrich-db

# DB 연결 테스트
flyctl postgres connect --app homenrich-db

# 연결 문자열 확인
flyctl secrets list --app homenrich-backend
```

### 3. 배포 실패

```bash
# 로컬 빌드 테스트
docker build -t test -f backend/Dockerfile .

# Fly.io 빌더 캐시 삭제
flyctl deploy --no-cache --app homenrich-backend
```

### 4. 메모리 부족 (OOM)

```bash
# 메모리 사용량 확인
flyctl dashboard --app homenrich-backend

# 메모리 증가 (유료)
flyctl scale memory 512 --app homenrich-backend
```

---

## 비용 최적화 팁

### 무료 티어 유지 전략

1. **자동 중지 활성화**: 비활성 시 앱 자동 중지 (`auto_stop_machines = true`)
2. **최소 인스턴스 0**: 트래픽 없을 때 비용 0 (`min_machines_running = 0`)
3. **DB 스토리지 관리**: 3GB 제한 준수 (로그 정리, 오래된 데이터 아카이브)
4. **트래픽 모니터링**: 160GB/월 아웃바운드 제한 확인

### 유료 전환 시점 판단

다음 중 하나라도 해당되면 유료 전환 고려:
- 일 사용자 1000명 초과
- 응답 시간이 지속적으로 느림 (500ms+)
- DB 스토리지 2GB 초과
- 월 트래픽 100GB 초과

---

## 롤백 절차

### 이전 버전으로 롤백

```bash
# 배포 히스토리 확인
flyctl releases --app homenrich-backend

# 특정 버전으로 롤백
flyctl releases rollback v10 --app homenrich-backend

# 확인
flyctl status --app homenrich-backend
```

---

## 체크리스트

배포 전:
- [ ] `.env.example`의 모든 필수 변수 확인
- [ ] `SECRET_KEY` 강력한 값으로 생성
- [ ] LLM API 키 유효성 확인
- [ ] Alembic 마이그레이션 최신화
- [ ] 로컬에서 Docker 빌드 성공 확인

배포 후:
- [ ] `/health` 엔드포인트 200 응답
- [ ] `/health/db` DB 연결 확인
- [ ] Frontend에서 Backend API 호출 성공
- [ ] Telegram/Kakao webhook 설정
- [ ] 로그에 에러 없음 확인
- [ ] DB 백업 스냅샷 생성

---

## 추가 자료

- Fly.io 공식 문서: https://fly.io/docs
- Fly.io PostgreSQL: https://fly.io/docs/postgres
- Fly.io 가격: https://fly.io/docs/about/pricing
- Cloudflare 설정: https://developers.cloudflare.com/dns

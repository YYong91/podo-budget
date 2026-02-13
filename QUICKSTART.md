# HomeNRich 빠른 배포 가이드

5분 안에 프로덕션 환경에 배포하는 간단한 가이드입니다.

---

## 사전 준비 (1회만)

### 1. Fly.io 계정 생성
```bash
# Fly CLI 설치 (macOS)
brew install flyctl

# 로그인 (브라우저 열림)
flyctl auth login
```

### 2. GitHub Secrets 설정
Repository > Settings > Secrets and variables > Actions:
```bash
# Fly API 토큰 생성
flyctl auth token

# 출력된 토큰을 GitHub Secret에 저장
# 이름: FLY_API_TOKEN
```

---

## 자동 배포 (권장)

### 1. 스크립트 실행 권한 부여
```bash
chmod +x scripts/deploy-*.sh
```

### 2. Backend + DB 배포
```bash
./scripts/deploy-init.sh
```

대화형으로 다음 정보 입력:
- DB 이름 (기본값: homenrich-db)
- Backend 앱 이름 (기본값: homenrich-backend)
- Anthropic API Key
- Telegram Bot Token
- Kakao Bot API Key
- Frontend URL (기본값: https://homenrich-frontend.fly.dev)

### 3. Frontend 배포
```bash
cd frontend
../scripts/deploy-frontend.sh
```

입력 정보:
- Backend URL (예: https://homenrich-backend.fly.dev)
- Frontend 앱 이름 (기본값: homenrich-frontend)

### 4. CORS 업데이트
```bash
flyctl secrets set \
  CORS_ORIGINS=https://homenrich-frontend.fly.dev \
  --app homenrich-backend
```

---

## 수동 배포

### Phase 1: PostgreSQL 생성 (1분)
```bash
flyctl postgres create \
  --name homenrich-db \
  --region nrt \
  --vm-size shared-cpu-1x \
  --volume-size 3 \
  --initial-cluster-size 1

# 출력된 연결 정보 저장!
```

### Phase 2: Backend 배포 (2분)
```bash
cd backend

# 앱 생성
flyctl launch --name homenrich-backend --region nrt --no-deploy

# DB 연결
flyctl postgres attach homenrich-db --app homenrich-backend

# 환경 변수 설정
flyctl secrets set \
  SECRET_KEY="$(openssl rand -hex 32)" \
  LLM_PROVIDER=anthropic \
  ANTHROPIC_API_KEY=your_key_here \
  TELEGRAM_BOT_TOKEN=your_token_here \
  KAKAO_BOT_API_KEY=your_key_here \
  DEBUG=False \
  CORS_ORIGINS=https://homenrich-frontend.fly.dev \
  --app homenrich-backend

# 배포
flyctl deploy --remote-only

# 마이그레이션
flyctl ssh console --app homenrich-backend --command "uv run alembic upgrade head"

# 헬스체크
curl https://homenrich-backend.fly.dev/health
```

### Phase 3: Frontend 배포 (1분)
```bash
cd ../frontend

# 앱 생성
flyctl launch --name homenrich-frontend --region nrt --no-deploy

# 환경 변수
flyctl secrets set \
  BACKEND_URL=https://homenrich-backend.fly.dev \
  --app homenrich-frontend

# 배포
flyctl deploy --remote-only --build-arg VITE_API_URL=/api

# 접속
flyctl open --app homenrich-frontend
```

---

## 검증 체크리스트

```bash
# 1. Backend 헬스체크
curl https://homenrich-backend.fly.dev/health
# 응답: {"status":"healthy"}

# 2. DB 연결 확인
curl https://homenrich-backend.fly.dev/health/db
# 응답: {"status":"healthy","database":"connected"}

# 3. Frontend 접속
open https://homenrich-frontend.fly.dev

# 4. 로그 확인
flyctl logs --app homenrich-backend
flyctl logs --app homenrich-frontend

# 5. 앱 상태
flyctl status --app homenrich-backend
flyctl status --app homenrich-frontend
```

---

## CI/CD 활성화 (자동 배포)

GitHub Actions가 이미 설정되어 있으므로:

```bash
git add .
git commit -m "Initial deployment setup"
git push origin main
```

이제 `main` 브랜치에 push하면 자동으로 배포됩니다.

---

## 커스텀 도메인 설정 (선택)

### 1. 도메인 구매
Namecheap, GoDaddy 등에서 `.com` 도메인 구매 (~$12/년)

### 2. Cloudflare DNS 설정
```bash
# Fly.io에서 인증서 생성
flyctl certs create yourdomain.com --app homenrich-frontend
flyctl certs create api.yourdomain.com --app homenrich-backend

# Cloudflare에 CNAME 추가
# yourdomain.com → homenrich-frontend.fly.dev (Proxied)
# api.yourdomain.com → homenrich-backend.fly.dev (Proxied)
```

### 3. CORS 업데이트
```bash
flyctl secrets set \
  CORS_ORIGINS=https://yourdomain.com \
  --app homenrich-backend
```

---

## 비용 확인

```bash
# Fly.io 대시보드에서 비용 확인
flyctl dashboard

# 또는 CLI로:
flyctl apps list
flyctl status --app homenrich-backend
flyctl status --app homenrich-frontend
flyctl status --app homenrich-db
```

**예상 비용** (무료 티어 내):
- Frontend: $0
- Backend: $0
- Database: $0
- **총: $0/월** + LLM API 비용 (~$5~10)

---

## 트러블슈팅

### 배포 실패
```bash
# 로그 확인
flyctl logs --app homenrich-backend

# 로컬 빌드 테스트
docker build -t test -f backend/Dockerfile .
```

### DB 연결 실패
```bash
# DB 상태 확인
flyctl status --app homenrich-db

# 연결 테스트
flyctl postgres connect --app homenrich-db
```

### 환경 변수 누락
```bash
# 시크릿 목록
flyctl secrets list --app homenrich-backend

# 시크릿 재설정
flyctl secrets set KEY=value --app homenrich-backend
```

---

## 다음 단계

배포 완료 후:
1. Telegram Webhook 설정:
   ```
   https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://homenrich-backend.fly.dev/api/telegram/webhook
   ```

2. Kakao OpenBuilder Webhook 설정:
   - 스킬 URL: `https://homenrich-backend.fly.dev/api/kakao/webhook`

3. 모니터링 설정:
   - Sentry 무료 플랜 연동 (SECURITY.md 참고)
   - UptimeRobot 설정 (무료)

4. 첫 사용자 초대 및 피드백 수집

---

## 유용한 명령어

```bash
# 스케일링
flyctl scale count 2 --app homenrich-backend  # 인스턴스 증가
flyctl scale memory 1024 --app homenrich-backend  # 메모리 증가

# 재배포
flyctl deploy --app homenrich-backend

# SSH 접속
flyctl ssh console --app homenrich-backend

# DB 백업
flyctl volumes snapshots create vol_xyz --app homenrich-db

# 롤백
flyctl releases --app homenrich-backend
flyctl releases rollback v10 --app homenrich-backend
```

---

## 문서

- 상세 배포 가이드: `DEPLOYMENT.md`
- 인프라 아키텍처: `INFRASTRUCTURE.md`
- 보안 설정: `SECURITY.md`
- 프로젝트 구조: `CLAUDE.md`

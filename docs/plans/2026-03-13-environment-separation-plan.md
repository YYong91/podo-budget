# 개발/운영 환경 분리 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** develop/main 브랜치 전략으로 개발환경과 운영환경을 분리하여, 새 기능을 안전하게 테스트한 후 운영에 배포하는 체계를 구축한다.

**Architecture:** develop 브랜치 push 시 Fly.io(`podo-budget-dev`) + Cloudflare Pages(`podo-budget-dev`)에 자동 배포(CD). main 브랜치 push 시 테스트 + 배포(CI+CD). podo-auth는 공유하고 데이터만 분리.

**Tech Stack:** GitHub Actions, Fly.io, Cloudflare Pages (wrangler), Telegram Bot API

**설계 문서:** `docs/plans/2026-03-13-environment-separation-design.md`

---

### Task 1: develop 브랜치 생성

**Step 1: develop 브랜치 생성**

```bash
git checkout main
git pull origin main
git checkout -b develop
git push -u origin develop
```

**Step 2: 확인**

```bash
git branch -a | grep develop
```
Expected: `* develop` 및 `remotes/origin/develop`

---

### Task 2: Fly.io 개발환경 백엔드 앱 생성

**Files:**
- Create: `backend/fly.dev.toml`

**Step 1: Fly.io 앱 생성**

```bash
flyctl apps create podo-budget-dev --org personal
```

**Step 2: 볼륨 생성 (SQLite 저장용)**

```bash
flyctl volumes create budget_dev_data --size 1 --region nrt --app podo-budget-dev
```

**Step 3: fly.dev.toml 작성**

```toml
# Fly.io 배포 설정 - Backend (개발환경)

app = "podo-budget-dev"
primary_region = "nrt"

[build]

[deploy]
  release_command = "sh -c 'uv sync --frozen --no-dev --no-install-project && .venv/bin/alembic upgrade head'"

[env]
  PORT = "8000"
  APP_NAME = "PodoBudget-Dev"
  DEBUG = "True"
  DATABASE_URL = "sqlite+aiosqlite:////app/data/db.sqlite3"
  SENTRY_ENVIRONMENT = "development"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true   # 비용 절약: 사용 안 할 때 자동 중지
  auto_start_machines = true
  min_machines_running = 0    # 비용 절약: 최소 0대

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256

[[mounts]]
  source = "budget_dev_data"
  destination = "/app/data"
```

**Step 4: Fly.io 시크릿 설정**

```bash
# JWT_SECRET은 podo-auth와 동일한 값 필수
flyctl secrets set \
  SECRET_KEY="$(openssl rand -hex 32)" \
  JWT_SECRET="<podo-auth와 동일한 값>" \
  ANTHROPIC_API_KEY="<키>" \
  OPENAI_API_KEY="<키>" \
  TELEGRAM_BOT_TOKEN="<개발봇 토큰>" \
  TELEGRAM_WEBHOOK_SECRET="<개발봇 시크릿>" \
  CORS_ORIGINS="https://podo-budget-dev.pages.dev" \
  --app podo-budget-dev
```

**Step 5: 테스트 배포**

```bash
flyctl deploy --remote-only --config backend/fly.dev.toml --dockerfile backend/Dockerfile
```

**Step 6: 확인**

```bash
curl https://podo-budget-dev.fly.dev/health
```
Expected: `{"status":"healthy"}`

**Step 7: 커밋**

```bash
git add backend/fly.dev.toml
git commit -m "chore: 개발환경 Fly.io 설정 추가 (fly.dev.toml)"
```

---

### Task 3: GitHub Actions — 개발환경 CD 워크플로우 생성

**Files:**
- Create: `.github/workflows/deploy-dev.yml`

**Step 1: deploy-dev.yml 작성**

```yaml
name: Deploy to Development

on:
  push:
    branches: [develop]

env:
  FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

jobs:
  deploy-backend:
    name: Deploy Backend to Dev
    runs-on: ubuntu-latest
    outputs:
      failure_reason: ${{ steps.on-failure.outputs.reason }}

    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy Backend
        run: |
          set -o pipefail
          flyctl deploy --remote-only --config backend/fly.dev.toml --dockerfile backend/Dockerfile 2>&1 | tee /tmp/deploy.log

      - name: On failure
        id: on-failure
        if: failure()
        run: |
          REASON=$(grep -iE "error|failed" /tmp/deploy.log 2>/dev/null | tail -3 | sed 's/\x1b\[[0-9;]*m//g' | tr '\n' ' ' | cut -c1-300)
          echo "reason=${REASON:-Fly.io 배포 실패}" >> $GITHUB_OUTPUT

  deploy-frontend:
    name: Deploy Frontend to Dev
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    outputs:
      failure_reason: ${{ steps.on-failure.outputs.reason }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Build
        run: |
          cd frontend
          npm run build
        env:
          VITE_API_URL: https://podo-budget-dev.fly.dev
          VITE_AUTH_URL: ${{ secrets.VITE_AUTH_URL }}
          VITE_AUTH_CALLBACK_URL: https://podo-budget-dev.pages.dev/auth/callback
          VITE_BOOKSHELF_URL: ${{ secrets.VITE_BOOKSHELF_URL }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          VITE_SENTRY_ENVIRONMENT: development

      - name: Deploy to Cloudflare Pages
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          npx wrangler@3 pages deploy frontend/dist \
            --project-name=podo-budget-dev \
            --commit-message="Deploy ${{ github.sha }}" \
            --commit-hash="${{ github.sha }}" \
            --branch="develop" \
            2>&1 | tee /tmp/deploy.log

      - name: On failure
        id: on-failure
        if: failure()
        run: |
          REASON=$(grep -iE "error|failed" /tmp/deploy.log 2>/dev/null | tail -3 | sed 's/\x1b\[[0-9;]*m//g' | tr '\n' ' ' | cut -c1-300)
          echo "reason=${REASON:-Cloudflare Pages 배포 실패}" >> $GITHUB_OUTPUT

  notify-deploy-result:
    name: Notify Deploy Result
    needs: [deploy-backend, deploy-frontend]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Send Telegram notification
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          BACKEND_STATUS: ${{ needs.deploy-backend.result }}
          FRONTEND_STATUS: ${{ needs.deploy-frontend.result }}
          BACKEND_FAILURE: ${{ needs.deploy-backend.outputs.failure_reason }}
          FRONTEND_FAILURE: ${{ needs.deploy-frontend.outputs.failure_reason }}
          COMMIT_MSG: ${{ github.event.head_commit.message || 'Manual trigger' }}
          REPO: ${{ github.repository }}
          RUN_ID: ${{ github.run_id }}
        run: |
          PROJECT="podo-budget"

          if [ "$BACKEND_STATUS" = "success" ] && [ "$FRONTEND_STATUS" = "success" ]; then
            KST_TIME="$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"
            MESSAGE="$(printf '[DEV] ✅ %s 배포 완료\n📝 %s\n🔗 %s\n🕐 %s' \
              "${PROJECT}" \
              "${COMMIT_MSG}" \
              "https://github.com/${REPO}/actions/runs/${RUN_ID}" \
              "${KST_TIME}")"
          else
            MESSAGE="[DEV] ❌ ${PROJECT} 배포 실패 (backend: ${BACKEND_STATUS}, frontend: ${FRONTEND_STATUS})"
            if [ -n "$BACKEND_FAILURE" ]; then
              MESSAGE="${MESSAGE}"$'\n'"🔴 Backend: ${BACKEND_FAILURE}"
            fi
            if [ -n "$FRONTEND_FAILURE" ]; then
              MESSAGE="${MESSAGE}"$'\n'"🔴 Frontend: ${FRONTEND_FAILURE}"
            fi
          fi

          curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=${MESSAGE}"
```

**Step 2: 커밋**

```bash
git add .github/workflows/deploy-dev.yml
git commit -m "feat: 개발환경 CD 워크플로우 추가 (deploy-dev.yml)"
```

---

### Task 4: GitHub Actions — PR 테스트 워크플로우 수정

**Files:**
- Modify: `.github/workflows/deploy-staging.yml`

현재 `deploy-staging.yml`은 PR to main에서만 트리거됨. develop 브랜치 PR도 포함하도록 수정.

**Step 1: 트리거 대상 브랜치 추가**

`.github/workflows/deploy-staging.yml` 수정:

```yaml
# 변경 전
on:
  pull_request:
    branches: [main]

# 변경 후
on:
  pull_request:
    branches: [develop, main]
```

**Step 2: 커밋**

```bash
git add .github/workflows/deploy-staging.yml
git commit -m "chore: PR 테스트를 develop 브랜치에도 적용"
```

---

### Task 5: GitHub Actions — 운영 배포 알림에 [PROD] prefix 추가

**Files:**
- Modify: `.github/workflows/deploy-production.yml`

**Step 1: 알림 메시지에 [PROD] prefix 추가**

`deploy-production.yml`에서 텔레그램 알림 메시지 수정:

- `notify-test-start` job의 메시지: `🧪 podo-budget 테스트 시작` → `[PROD] 🧪 podo-budget 테스트 시작`
- `notify-test-result` job의 메시지: `✅ ${PROJECT} 테스트 완료` → `[PROD] ✅ ${PROJECT} 테스트 완료`, `❌ ${PROJECT} 테스트 실패` → `[PROD] ❌ ${PROJECT} 테스트 실패`
- `notify-deploy-start` job의 메시지: `🚀 podo-budget 배포 시작` → `[PROD] 🚀 podo-budget 배포 시작`
- `notify-deploy-result` job의 메시지: `✅ %s 배포 완료` → `[PROD] ✅ %s 배포 완료`, `❌ ${PROJECT} 배포 실패` → `[PROD] ❌ ${PROJECT} 배포 실패`

**Step 2: 커밋**

```bash
git add .github/workflows/deploy-production.yml
git commit -m "chore: 운영 배포 알림에 [PROD] prefix 추가"
```

---

### Task 6: Cloudflare Pages 개발환경 프로젝트 생성

**Step 1: wrangler로 프로젝트 생성**

```bash
npx wrangler@3 pages project create podo-budget-dev --production-branch develop
```

또는 Cloudflare 대시보드에서 수동 생성:
1. Pages → Create a project → Direct Upload
2. 프로젝트 이름: `podo-budget-dev`
3. Production branch: `develop`

**Step 2: 확인**

```bash
npx wrangler@3 pages project list | grep podo-budget-dev
```

---

### Task 7: 텔레그램 개발 봇 생성

**Step 1: @BotFather에서 봇 생성**

1. 텔레그램에서 @BotFather에게 `/newbot` 전송
2. 이름: `포도가계부 DEV`
3. username: 적절한 이름 (예: `PodoBudgetDevBot`)
4. 발급받은 토큰 저장

**Step 2: 웹훅 설정**

```bash
# 개발 봇 웹훅을 개발환경 백엔드로 연결
curl "https://api.telegram.org/bot<DEV_BOT_TOKEN>/setWebhook?url=https://podo-budget-dev.fly.dev/api/telegram/webhook&secret_token=<WEBHOOK_SECRET>"
```

**Step 3: Fly.io 시크릿에 개발 봇 토큰 설정 (Task 2에서 이미 포함)**

---

### Task 8: GitHub Secrets 설정

GitHub 리포지토리 Settings → Secrets and variables → Actions에 추가 시크릿이 필요한지 확인.

현재 시크릿은 운영환경용이므로, 개발환경 워크플로우에서 재사용 가능한 항목:
- `FLY_API_TOKEN` — 공유 (같은 Fly 계정)
- `CLOUDFLARE_API_TOKEN` — 공유 (같은 Cloudflare 계정)
- `CLOUDFLARE_ACCOUNT_ID` — 공유
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — 공유 (CI/CD 알림용, prefix로 구분)
- `VITE_AUTH_URL` — 공유 (같은 podo-auth)
- `VITE_BOOKSHELF_URL` — 공유

개발환경 전용 시크릿은 `deploy-dev.yml`에서 하드코딩됨:
- `VITE_API_URL`: `https://podo-budget-dev.fly.dev` (워크플로우에 직접 기재)
- `VITE_AUTH_CALLBACK_URL`: `https://podo-budget-dev.pages.dev/auth/callback` (워크플로우에 직접 기재)

→ **추가 GitHub 시크릿 불필요**

---

### Task 9: podo-auth 콜백 URL 등록

podo-auth에서 개발환경 프론트엔드의 콜백 URL을 허용해야 합니다.

**확인 필요:** podo-auth가 콜백 URL을 화이트리스트로 관리하는지, 아니면 동적으로 받는지 확인 후 조치.

- 추가할 URL: `https://podo-budget-dev.pages.dev/auth/callback`
- podo-auth의 CORS에 `https://podo-budget-dev.pages.dev` 추가

---

### Task 10: GitHub 브랜치 보호 규칙 설정

**Step 1: develop 브랜치 보호**

GitHub → Settings → Branches → Add rule:
- Branch name pattern: `develop`
- Require a pull request before merging: ✅
- Require status checks to pass: ✅ (test-backend, test-frontend)

**Step 2: main 브랜치 보호 (이미 있으면 확인)**

GitHub → Settings → Branches:
- Branch name pattern: `main`
- Require a pull request before merging: ✅
- Require status checks to pass: ✅

---

### Task 11: 문서 업데이트

**Files:**
- Modify: `CLAUDE.md`

**Step 1: CLAUDE.md에 환경 정보 추가**

브랜치 전략과 환경 정보 섹션을 CLAUDE.md에 추가:

```markdown
## 환경 구성

| 항목 | Development (개발) | Production (운영) |
|------|-------------------|-------------------|
| **Git 브랜치** | `develop` | `main` |
| **BE URL** | `podo-budget-dev.fly.dev` | `podo-budget-backend.fly.dev` |
| **FE URL** | `podo-budget-dev.pages.dev` | `budget.podonest.com` |
| **Fly 설정** | `backend/fly.dev.toml` | `backend/fly.toml` |
| **텔레그램 봇** | `@PodoBudgetDevBot` | `@PodoBudgetBot` |

### 브랜치 전략
- `feature/*`, `fix/*` → `develop`에 PR (CI 테스트)
- develop 머지 → 개발환경 자동 배포 (CD)
- `develop` → `main` PR → 운영 배포 (CI+CD)
```

**Step 2: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: 개발/운영 환경 구성 정보 추가"
```

---

### Task 12: E2E 검증

**Step 1: develop 브랜치에 변경사항 push**

```bash
git checkout develop
git push origin develop
```

**Step 2: GitHub Actions에서 deploy-dev 워크플로우 실행 확인**

```bash
gh run list --workflow=deploy-dev.yml --limit 1
```
Expected: 워크플로우 실행 중 또는 성공

**Step 3: 개발환경 백엔드 확인**

```bash
curl https://podo-budget-dev.fly.dev/health
```
Expected: `{"status":"healthy"}`

**Step 4: 개발환경 프론트엔드 확인**

브라우저에서 `https://podo-budget-dev.pages.dev` 접속:
- podo-auth 로그인 리디렉션 동작 확인
- 로그인 후 대시보드 로드 확인
- 거래 입력 기능 확인

**Step 5: 텔레그램 알림 확인**

- `[DEV] ✅ podo-budget 배포 완료` 메시지 수신 확인

**Step 6: 텔레그램 개발 봇 동작 확인**

- 개발 봇에게 "오늘 점심 8000원" 메시지 전송
- 개발환경 DB에 거래가 생성되는지 확인

---

## 실행 순서 요약

```
Task 1  → develop 브랜치 생성
Task 2  → Fly.io 개발 앱 + fly.dev.toml 생성
Task 6  → Cloudflare Pages 프로젝트 생성
Task 7  → 텔레그램 개발 봇 생성
Task 8  → GitHub Secrets 확인
Task 9  → podo-auth 콜백 URL 등록
Task 3  → deploy-dev.yml 워크플로우 생성
Task 4  → PR 테스트 워크플로우 수정
Task 5  → 운영 알림 [PROD] prefix 추가
Task 10 → 브랜치 보호 규칙
Task 11 → 문서 업데이트
Task 12 → E2E 검증
```

Task 2, 6, 7은 병렬 실행 가능. Task 3~5는 병렬 실행 가능.

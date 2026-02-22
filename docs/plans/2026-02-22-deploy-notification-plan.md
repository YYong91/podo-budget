# Deploy Notification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 3개 podonest 프로젝트 GitHub Actions 워크플로우에 배포 완료/실패 Telegram 알림 추가

**Architecture:** 각 `deploy-production.yml`에 `notify` job 추가. `needs: [deploy-backend, deploy-frontend]` + `if: always()`로 양쪽 결과를 취합해 `curl`로 Telegram Bot API 직접 호출.

**Tech Stack:** GitHub Actions YAML, Telegram Bot API, curl

---

## 사전 준비 (수동 작업 — Claude가 실행 불가)

아래 작업을 먼저 완료해야 코드 변경이 동작한다.

### Step P-1: Telegram 배포 전용 봇 생성

1. Telegram에서 `@BotFather` 대화 시작
2. `/newbot` 명령 전송
3. 봇 이름 입력 (예: `Podo Deploy Bot`)
4. 봇 username 입력 (예: `podo_deploy_bot`)
5. 발급된 API Token 저장 → 이것이 `TELEGRAM_BOT_TOKEN`

### Step P-2: 본인 Chat ID 확인

1. 방금 만든 봇에게 `/start` 메시지 전송
2. 브라우저에서 다음 URL 접속 (TOKEN을 실제 값으로 교체):
   ```
   https://api.telegram.org/bot{TOKEN}/getUpdates
   ```
3. 응답 JSON에서 `result[0].message.chat.id` 값 저장 → 이것이 `TELEGRAM_CHAT_ID`

### Step P-3: 3개 GitHub 레포에 Secrets 추가

각 레포의 `Settings → Secrets and variables → Actions → New repository secret`에서:

| Secret 이름 | 값 |
|------------|-----|
| `TELEGRAM_BOT_TOKEN` | Step P-1에서 발급된 토큰 |
| `TELEGRAM_CHAT_ID` | Step P-2에서 확인한 chat ID |

대상 레포:
- `github.com/YYong91/podo-auth`
- `github.com/YYong91/podo-bookshelf`
- `github.com/YYong91/podo-budget`

---

## Task 1: podo-auth workflow에 notify job 추가

**Files:**
- Modify: `podo-auth/.github/workflows/deploy-production.yml` (파일 끝에 추가)

**Step 1: 현재 workflow 마지막 줄 확인**

```bash
tail -5 /Users/yyong/Developer/podo-auth/.github/workflows/deploy-production.yml
```

Expected: `deploy-frontend` job이 마지막임을 확인

**Step 2: notify job 추가**

`deploy-production.yml` 파일 끝에 아래 job을 추가한다 (들여쓰기 2칸 — 기존 job들과 동일):

```yaml
  notify:
    name: Notify Deployment
    needs: [deploy-backend, deploy-frontend]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Send Telegram notification
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          BACKEND_STATUS="${{ needs.deploy-backend.result }}"
          FRONTEND_STATUS="${{ needs.deploy-frontend.result }}"
          PROJECT="podo-auth"
          COMMIT_MSG="${{ github.event.head_commit.message || 'Manual trigger' }}"

          if [ "$BACKEND_STATUS" = "success" ] && [ "$FRONTEND_STATUS" = "success" ]; then
            ICON="✅"
            STATUS_LINE="${ICON} *${PROJECT}* 배포 성공"
          else
            ICON="❌"
            STATUS_LINE="${ICON} *${PROJECT}* 배포 실패"$'\n'"🔴 backend: ${BACKEND_STATUS}, frontend: ${FRONTEND_STATUS}"
          fi

          MESSAGE="${STATUS_LINE}
          📝 ${COMMIT_MSG}
          🔗 https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}
          🕐 $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"

          curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="${MESSAGE}" \
            -d parse_mode="Markdown"
```

**Step 3: YAML 유효성 검증**

```bash
python3 -c "import yaml; yaml.safe_load(open('/Users/yyong/Developer/podo-auth/.github/workflows/deploy-production.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`

**Step 4: Commit**

```bash
cd /Users/yyong/Developer/podo-auth
git add .github/workflows/deploy-production.yml
git commit -m "feat: 배포 완료 시 Telegram 알림 추가"
```

---

## Task 2: podo-bookshelf workflow에 notify job 추가

**Files:**
- Modify: `podo-bookshelf/.github/workflows/deploy-production.yml`

**Step 1: notify job 추가**

Task 1과 동일하되 `PROJECT="podo-bookshelf"` 로 변경:

```yaml
  notify:
    name: Notify Deployment
    needs: [deploy-backend, deploy-frontend]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Send Telegram notification
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          BACKEND_STATUS="${{ needs.deploy-backend.result }}"
          FRONTEND_STATUS="${{ needs.deploy-frontend.result }}"
          PROJECT="podo-bookshelf"
          COMMIT_MSG="${{ github.event.head_commit.message || 'Manual trigger' }}"

          if [ "$BACKEND_STATUS" = "success" ] && [ "$FRONTEND_STATUS" = "success" ]; then
            ICON="✅"
            STATUS_LINE="${ICON} *${PROJECT}* 배포 성공"
          else
            ICON="❌"
            STATUS_LINE="${ICON} *${PROJECT}* 배포 실패"$'\n'"🔴 backend: ${BACKEND_STATUS}, frontend: ${FRONTEND_STATUS}"
          fi

          MESSAGE="${STATUS_LINE}
          📝 ${COMMIT_MSG}
          🔗 https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}
          🕐 $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"

          curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="${MESSAGE}" \
            -d parse_mode="Markdown"
```

**Step 2: YAML 유효성 검증**

```bash
python3 -c "import yaml; yaml.safe_load(open('/Users/yyong/Developer/podo-bookshelf/.github/workflows/deploy-production.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`

**Step 3: Commit**

```bash
cd /Users/yyong/Developer/podo-bookshelf
git add .github/workflows/deploy-production.yml
git commit -m "feat: 배포 완료 시 Telegram 알림 추가"
```

---

## Task 3: podo-budget workflow에 notify job 추가

**Files:**
- Modify: `podo-budget/.github/workflows/deploy-production.yml`

**Step 1: notify job 추가**

Task 1과 동일하되 `PROJECT="podo-budget"` 로 변경:

```yaml
  notify:
    name: Notify Deployment
    needs: [deploy-backend, deploy-frontend]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Send Telegram notification
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          BACKEND_STATUS="${{ needs.deploy-backend.result }}"
          FRONTEND_STATUS="${{ needs.deploy-frontend.result }}"
          PROJECT="podo-budget"
          COMMIT_MSG="${{ github.event.head_commit.message || 'Manual trigger' }}"

          if [ "$BACKEND_STATUS" = "success" ] && [ "$FRONTEND_STATUS" = "success" ]; then
            ICON="✅"
            STATUS_LINE="${ICON} *${PROJECT}* 배포 성공"
          else
            ICON="❌"
            STATUS_LINE="${ICON} *${PROJECT}* 배포 실패"$'\n'"🔴 backend: ${BACKEND_STATUS}, frontend: ${FRONTEND_STATUS}"
          fi

          MESSAGE="${STATUS_LINE}
          📝 ${COMMIT_MSG}
          🔗 https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}
          🕐 $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"

          curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d parse_mode="Markdown" \
            -d text="${MESSAGE}"
```

**Step 2: YAML 유효성 검증**

```bash
python3 -c "import yaml; yaml.safe_load(open('/Users/yyong/Developer/podo-budget/.github/workflows/deploy-production.yml'))" && echo "YAML OK"
```

Expected: `YAML OK`

**Step 3: Commit**

```bash
cd /Users/yyong/Developer/podo-budget
git add .github/workflows/deploy-production.yml
git commit -m "feat: 배포 완료 시 Telegram 알림 추가"
```

---

## Task 4: 3개 레포 Push 및 검증

**Step 1: 3개 레포 push**

```bash
cd /Users/yyong/Developer/podo-auth && git push
cd /Users/yyong/Developer/podo-bookshelf && git push
cd /Users/yyong/Developer/podo-budget && git push
```

**Step 2: GitHub Actions 실행 확인**

각 레포의 GitHub Actions 탭에서 `Deploy to Production` 워크플로우 실행 확인:
- `notify` job이 워크플로우 그래프에 표시되는지 확인
- `deploy-backend`, `deploy-frontend` 완료 후 `notify` 실행되는지 확인

**Step 3: Telegram 수신 확인**

배포 완료 후 설정한 Telegram 계정으로 알림 메시지 수신 여부 확인.

예상 메시지:
```
✅ podo-auth 배포 성공
📝 feat: 배포 완료 시 Telegram 알림 추가
🔗 https://github.com/YYong91/podo-auth/actions/runs/...
🕐 2026-02-22 22:XX KST
```

---

## 트러블슈팅

**알림이 오지 않을 때:**
1. GitHub Secrets 이름 오타 확인 (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)
2. Bot에게 먼저 `/start` 메시지를 보냈는지 확인 (안 보내면 chat_id로 메시지 불가)
3. `getUpdates` API로 chat_id 재확인
4. workflow `notify` job 로그에서 `curl` 응답 확인

**YAML 오류가 날 때:**
- 들여쓰기가 정확히 2칸인지 확인 (탭 금지)
- `notify:` job이 `jobs:` 블록 안에 있는지 확인

# 배포 완료 시 Telegram 알림 연동 설계

## 개요

podo-auth, podo-bookshelf, podo-budget 세 프로젝트의 GitHub Actions 배포 워크플로우에 Telegram 알림을 추가한다. 배포 성공/실패 모두 알림을 발송하며, 배포 전용 봇을 신규 생성해 3개 레포가 공유한다.

## 결정 사항

- **채널**: Telegram (podo-budget 기존 봇과 분리된 배포 전용 봇)
- **발송 조건**: 성공 + 실패 모두
- **메시지 내용**: 프로젝트명 + 상태, 커밋 메시지, GitHub Actions 링크, 배포 시간(KST)
- **구현 방식**: 각 workflow에 `notify` job 직접 추가 (reusable workflow 미사용)

## 아키텍처

### GitHub Secrets (3개 레포 공통)

| Secret | 값 |
|--------|-----|
| `TELEGRAM_BOT_TOKEN` | 배포 전용 봇 토큰 (@BotFather에서 발급) |
| `TELEGRAM_CHAT_ID` | 수신할 Telegram chat ID (개인 user ID) |

### Workflow 변경

각 `deploy-production.yml`에 `notify` job 추가:

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
        PROJECT="podo-auth"  # 각 파일별로 변경

        if [ "$BACKEND_STATUS" = "success" ] && [ "$FRONTEND_STATUS" = "success" ]; then
          ICON="✅"
          STATUS_LINE="${ICON} *${PROJECT}* 배포 성공"
        else
          ICON="❌"
          STATUS_LINE="${ICON} *${PROJECT}* 배포 실패"$'\n'"🔴 backend: ${BACKEND_STATUS}, frontend: ${FRONTEND_STATUS}"
        fi

        MESSAGE="${STATUS_LINE}
        📝 ${{ github.event.head_commit.message }}
        🔗 https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}
        🕐 $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"

        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
          -d chat_id="${TELEGRAM_CHAT_ID}" \
          -d text="${MESSAGE}" \
          -d parse_mode="Markdown"
```

### 메시지 예시

성공:
```
✅ podo-auth 배포 성공
📝 feat: 배포 완료 시 메신저 알림 연동
🔗 https://github.com/YYong91/podo-auth/actions/runs/123456789
🕐 2026-02-22 22:49 KST
```

실패:
```
❌ podo-budget 배포 실패
🔴 backend: failure, frontend: success
📝 fix: 결제 API 오류 수정
🔗 https://github.com/YYong91/podo-budget/actions/runs/987654321
🕐 2026-02-22 23:05 KST
```

## 에러 처리

- Telegram 알림 실패가 배포 결과에 영향을 주지 않도록 `curl`은 별도 오류 처리 없이 실행
- `if: always()` 조건으로 배포 실패 시에도 반드시 실행

## 준비 작업 (일회성)

1. @BotFather → `/newbot` → 배포 전용 봇 생성
2. 봇에게 `/start` 메시지 전송 후 `https://api.telegram.org/bot{TOKEN}/getUpdates`로 chat_id 확인
3. GitHub 레포 Settings → Secrets → Actions에 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 추가 (3개 레포 모두)

## 영향 범위

- 수정 파일: `podo-auth/.github/workflows/deploy-production.yml`
- 수정 파일: `podo-bookshelf/.github/workflows/deploy-production.yml`
- 수정 파일: `podo-budget/.github/workflows/deploy-production.yml`
- 신규 인프라: Telegram 배포 전용 봇 (BotFather 생성)
- 신규 GitHub Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` × 3개 레포 # pragma: allowlist secret

# Phase 0: 사전 준비 체크리스트

서비스 배포 전 **개발자가 직접** 해야 하는 작업입니다.
예상 소요: 약 1-2시간

---

## 1. Fly.io 계정 설정 (10분)

- [ ] 회원가입: https://fly.io/app/sign-up
- [ ] 신용카드 등록 (무료 티어 사용에도 필요)
- [ ] CLI 설치:
  ```bash
  brew install flyctl
  ```
- [ ] 로그인:
  ```bash
  flyctl auth login
  ```

---

## 2. Anthropic API 키 발급 (10분)

- [ ] 계정 생성: https://console.anthropic.com/
- [ ] API 키 발급 (Settings > API Keys)
- [ ] 예산 알림 설정: $20, $50 임계값 (Settings > Billing > Alerts)
- [ ] 발급받은 키 안전한 곳에 메모 (배포 시 필요)

---

## 3. 텔레그램 봇 생성 (10분)

- [ ] 텔레그램에서 [@BotFather](https://t.me/BotFather) 검색
- [ ] `/newbot` 명령으로 봇 생성
- [ ] 봇 이름/유저네임 설정 (예: 포도가계부 Bot / podo_budget_bot)
- [ ] 발급받은 **Bot Token** 안전한 곳에 메모

> Webhook URL은 배포 완료 후 설정합니다:
> `https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://{백엔드URL}/api/telegram/webhook`

---

## 4. GitHub Secret 설정 (5분)

- [ ] Fly.io API 토큰 생성:
  ```bash
  flyctl auth token
  ```
- [ ] GitHub > Repository > Settings > Secrets and variables > Actions
- [ ] `FLY_API_TOKEN` 이름으로 위 토큰 등록

> CI/CD 자동 배포에 사용됩니다 (main push 시 자동 배포)

---

## 5. 도메인 구매 (선택, 10분)

- [ ] 도메인 구매 (Namecheap, 가비아 등) — 연 $10-15
- [ ] 또는 Cloudflare Pages 기본 도메인 사용

> 커스텀 도메인은 나중에 추가 가능하므로, 처음엔 기본 도메인으로 시작해도 됩니다.

---

## 6. Cloudflare 계정 설정 (5분)

- [ ] Cloudflare 계정 생성: https://dash.cloudflare.com/sign-up
- [ ] Cloudflare Pages 프로젝트 생성 (podo-budget)
- [ ] API Token 발급 (Cloudflare Pages 배포 권한)
- [ ] GitHub Secrets에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 등록

---

## 준비 완료 후 다음 단계

위 항목을 모두 완료하면:
1. feature 브랜치에서 개발 후 PR 생성
2. CI 통과 확인 후 main 머지
3. CD가 자동으로 Fly.io + Cloudflare Pages에 배포

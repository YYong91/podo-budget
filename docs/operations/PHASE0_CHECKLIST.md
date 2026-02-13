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
- [ ] 봇 이름/유저네임 설정 (예: HomeNRich Bot / homenrich_bot)
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
- [ ] 또는 Fly.io 기본 도메인 사용: `homenrich-frontend.fly.dev`

> 커스텀 도메인은 나중에 추가 가능하므로, 처음엔 기본 도메인으로 시작해도 됩니다.

---

## 6. 배포 스크립트 실행 권한 (1분)

```bash
chmod +x scripts/deploy-init.sh scripts/deploy-frontend.sh
```

---

## 준비 완료 후 다음 단계

위 항목을 모두 완료하면, Phase 1(코드 보강)을 AI 에이전트에게 요청하세요:

```
Phase 1 코드 보강 시작해줘:
- 개인정보처리방침 + 이용약관 페이지
- 회원가입 이메일 필드 + 약관 동의
- 계정 삭제 기능
- Rate Limiting
- Axios 401 처리
```

Phase 1 완료 후 실제 배포는 `QUICKSTART.md`를 따라 진행합니다.

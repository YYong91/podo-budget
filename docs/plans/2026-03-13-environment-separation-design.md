# 개발/운영 환경 분리 설계

## 개요

포도가계부를 다른 사용자들에게 공개하기 전, 개발환경과 운영환경을 분리하여 새 기능/버그 수정을 안전하게 테스트할 수 있는 체계를 구축한다.

## 결정 사항

- **명칭**: Development(개발) / Production(운영) — staging은 향후 필요 시 별도 추가
- **테스터**: 본인만 (개발환경에서 직접 확인)
- **SSO**: podo-auth는 공유 (auth.podonest.com), 데이터만 분리
- **비용**: 월 ~$0.65 (Fly.io auto_stop + Cloudflare Pages 무료)

## 아키텍처

```
feature/xxx ──PR──▶ develop ──PR──▶ main
fix/xxx     ──PR──┘     │              │
                   자동 CD          자동 CI+CD
                   (배포만)         (테스트+배포)
                        │              │
                   개발환경          운영환경
```

## 환경별 리소스

| 항목 | Development (개발) | Production (운영) |
|------|-------------------|-------------------|
| **Git 브랜치** | `develop` | `main` |
| **BE Fly 앱** | `podo-budget-dev` | `podo-budget-backend` |
| **FE Cloudflare** | `podo-budget-dev` | `podo-budget` |
| **BE URL** | `podo-budget-dev.fly.dev` | `podo-budget-backend.fly.dev` |
| **FE URL** | `podo-budget-dev.pages.dev` | `budget.podonest.com` |
| **DB** | SQLite (별도 볼륨) | SQLite (별도 볼륨) |
| **Auth** | `auth.podonest.com` (공유) | `auth.podonest.com` (공유) |
| **Telegram 봇** | `@PodoBudgetDevBot` (신규) | `@PodoBudgetBot` (기존) |

## 브랜치 전략

1. 기능/버그 수정 브랜치 → `develop`에 PR 머지
2. PR에서 CI(테스트) 통과 필수
3. develop 머지 시 → 개발환경 자동 배포 (CD만)
4. 개발환경에서 확인 완료 → `develop` → `main` PR 생성
5. main 머지 시 → CI+CD (테스트 → 운영 배포)

## CI/CD 워크플로우

| 워크플로우 | 트리거 | 동작 |
|-----------|--------|------|
| `test-pr.yml` | PR to develop | CI — 테스트만 (BE lint+pytest, FE lint+build) |
| `deploy-dev.yml` (신규) | develop push | CD — 개발환경 배포 + 텔레그램 알림 `[DEV]` |
| `deploy-production.yml` (수정) | main push | CI+CD — 테스트 → 운영 배포 + 텔레그램 알림 `[PROD]` |

## Fly.io 설정

| 설정 | Development | Production |
|------|-------------|------------|
| `auto_stop_machines` | `true` | `false` |
| `min_machines_running` | `0` | `1` |
| `SENTRY_ENVIRONMENT` | `development` | `production` |
| `DEBUG` | `true` | `false` |

## 시크릿 관리

| 시크릿 | 공유 여부 | 비고 |
|--------|----------|------|
| `ANTHROPIC_API_KEY` | 공유 | 같은 계정 |
| `OPENAI_API_KEY` | 공유 | 같은 계정 |
| `JWT_SECRET` | 공유 필수 | podo-auth와 동일해야 함 |
| `TELEGRAM_BOT_TOKEN` | **분리** | 개발 봇 별도 토큰 |
| `SECRET_KEY` | **분리** | 환경별 다른 키 |
| `SENTRY_DSN` | 공유 (환경 태그 구분) | `SENTRY_ENVIRONMENT`으로 구분 |
| `CORS_ORIGINS` | **분리** | 각 환경 프론트엔드 URL |
| `FLY_API_TOKEN` | 공유 | 같은 Fly 계정 |

## 텔레그램 봇 분리

- **프로덕션**: `@PodoBudgetBot` → webhook: `podo-budget-backend.fly.dev`
- **개발**: `@PodoBudgetDevBot` (신규 생성) → webhook: `podo-budget-dev.fly.dev`
- **CI/CD 알림**: 같은 채팅방, `[DEV]`/`[PROD]` prefix로 구분

## podo-auth 연동

- podo-auth 콜백 허용 URL에 `https://podo-budget-dev.pages.dev/auth/callback` 추가 필요
- JWT_SECRET은 podo-auth와 동일한 값 사용
- 개발환경 프론트엔드 빌드 시 `VITE_AUTH_CALLBACK_URL`을 개발 URL로 설정

## 예상 비용

| 항목 | 월 비용 |
|------|---------|
| Fly.io 개발 백엔드 (auto_stop) | ~$0.50 |
| Fly.io 볼륨 1GB | $0.15 |
| Cloudflare Pages 개발 FE | $0 |
| **합계** | **~$0.65/월** |

## GitHub 브랜치 보호 규칙

- `develop`: PR 필수, CI 통과 필수
- `main`: PR 필수, CI 통과 필수

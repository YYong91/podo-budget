# 포도가계부 배포 전략 요약 (Executive Summary)

이 문서는 의사결정권자 또는 빠른 검토를 원하는 개발자를 위한 배포 전략 핵심 요약입니다.

---

## 최종 아키텍처

**Backend**: Fly.io (도쿄 리전) — FastAPI + SQLite
**Frontend**: Cloudflare Pages — React 19 SPA
**CI/CD**: GitHub Actions — CI(PR 테스트) / CD(배포) 분리
**비용**: $0~5/월 (MVP), $50~100/월 (1000명)

---

## 핵심 결정 사항

### 1. Backend: Fly.io ✅

| 항목 | 선택 | 이유 |
|------|------|------|
| 플랫폼 | **Fly.io** | 무료 티어로 MVP 커버, Docker 네이티브 |
| 리전 | 도쿄 (nrt) | 한국과 40~60ms 레이턴시 |
| DB | **SQLite** (Fly Volume) | 단일 인스턴스에 충분, 운영 비용 $0 |
| 대안 | AWS Seoul | 서울 리전 필요 시 ($300+/월), 1000 DAU 이후 검토 |

### 2. Frontend: Cloudflare Pages ✅

| 항목 | 선택 | 이유 |
|------|------|------|
| 호스팅 | **Cloudflare Pages** | 글로벌 CDN, 무료, 자동 HTTPS |
| 빌드 | Vite 7 | 빠른 빌드, 최적화 |
| 배포 | Wrangler CLI | GitHub Actions에서 자동 배포 |

### 3. CI/CD: GitHub Actions ✅

| 항목 | 선택 | 이유 |
|------|------|------|
| CI/CD | **GitHub Actions** | 무료, GitHub 통합 |
| CI 트리거 | PR → main | 테스트 통과해야 머지 가능 |
| CD 트리거 | main push | 머지 후 자동 배포 |
| 알림 | Telegram Bot | 배포 시작/완료/실패 알림 |

**워크플로우**:
1. feature 브랜치에서 개발
2. PR 생성 → CI 자동 실행 (lint + test + build check)
3. CI 통과 + 리뷰 → PR 머지
4. main push → CD 자동 배포 (Fly.io + Cloudflare Pages)

---

## 비용 분석 (사용자 규모별)

### MVP (10~100명): $0~6/월

| 항목 | 비용 | 비고 |
|------|------|------|
| Fly.io (Backend) | **$0** | 무료 티어 |
| Cloudflare Pages | **$0** | 무료 플랜 |
| Anthropic Claude | **~$5** | 1000 요청/월 |
| 도메인 | **~$1** | .com 도메인 |
| **총계** | **$5~6** | |

### 성장기 (100~1000명): $50~100/월

| 항목 | 비용 | 비고 |
|------|------|------|
| Fly.io | **$35** | Backend 2 instances + PostgreSQL 전환 |
| Cloudflare | **$0** | 무료 지속 |
| Anthropic Claude | **~$30** | 10,000 요청/월 |
| Sentry | **$0** | 에러 트래킹 (무료) |
| **총계** | **$65** | |

---

## 아키텍처 다이어그램

```
사용자 (한국)
    ↓
Cloudflare
- DNS + CDN + DDoS 방어 + 자동 HTTPS
    ↓
┌─────────────────────────────┐
│ Cloudflare Pages            │
│ React 19 SPA (정적 파일)    │
└──────┬──────────────────────┘
       │ /api/* → Backend
       ↓
┌─────────────────────────────┐
│ Fly.io (도쿄)               │
│ Backend (FastAPI)           │
│ 512MB, shared-cpu           │
│ Python 3.12 + uvicorn       │
│ SQLite on Fly Volume        │
└─────────────────────────────┘

외부 API (종량제):
- Anthropic Claude (LLM)
- Telegram (무료)
- Kakao OpenBuilder (무료)
```

---

## CI/CD 파이프라인

```
GitHub Actions 워크플로우:

ci-test.yml     재사용: 백엔드/프론트엔드 테스트 로직
notify.yml      재사용: 텔레그램 알림

ci.yml          PR → ci-test.yml 호출 (테스트 통과해야 머지 가능)
cd.yml          main push → Backend(Fly.io) + Frontend(Cloudflare Pages) 배포
e2e.yml         수동 실행 전용 (Playwright)
```

---

## 보안 체크리스트

- [x] HTTPS 강제 (Fly.io + Cloudflare 자동)
- [x] 환경 변수 암호화 (Fly Secrets + GitHub Secrets)
- [x] CORS 명시적 설정 (와일드카드 금지)
- [x] 보안 헤더 (CSP, HSTS, X-Frame-Options 등)
- [x] Rate limiting (Cloudflare)
- [x] Sentry 에러 트래킹
- [x] Pre-commit 시크릿 스캔 (detect-secrets)

---

## 모니터링

### 기본 (무료)

- **Fly Metrics**: CPU, 메모리, 네트워크, 응답 시간
- **Fly Logs**: 실시간 로그 (7일 보관)
- **UptimeRobot**: 무료 업타임 모니터링 (5분 간격)

### 추가 (선택)

- **Sentry**: 에러 트래킹 (무료 5000 이벤트/월)

---

## 스케일 업 트리거

| 지표 | 현재 → 다음 | 행동 |
|------|-------------|------|
| **DAU** | 100 → 1,000 | Fly.io 유료 전환, PostgreSQL 전환 |
| **응답 시간** | 100ms → 200ms+ | Backend 수평 스케일링 |
| **DB 크기** | SQLite 한계 | PostgreSQL 전환 |
| **레이턴시** | 60ms → critical | AWS Seoul 이전 검토 |

---

## 리스크 및 대응

### 리스크 1: Fly.io 장애

**대응**: 멀티 리전 배포 (유료 플랜), DR 플랜: AWS Lightsail 예비 구성

### 리스크 2: LLM API 비용 폭증

**대응**: Rate limiting + LLM 응답 캐싱 + API 예산 알림

### 리스크 3: SQLite 한계 도달

**대응**: PostgreSQL 전환 (Fly Postgres 또는 Supabase)

---

## 성공 지표 (KPI)

- **가용성**: 99.9% 이상
- **응답 시간**: p95 < 500ms
- **에러율**: < 0.1%
- **배포 빈도**: 주 1회 이상
- **MVP 비용**: $10/월 이하

---

## 참고 문서

- **프로젝트 규칙**: `/CLAUDE.md`
- **운영 체크리스트**: `/docs/operations/production-checklist.md`
- **사전 준비**: `/docs/operations/PHASE0_CHECKLIST.md`

---

**최종 업데이트**: 2026-03-13
**문서 버전**: 2.0

# HomeNRich 배포 전략 요약 (Executive Summary)

이 문서는 의사결정권자 또는 빠른 검토를 원하는 개발자를 위한 배포 전략 핵심 요약입니다.

---

## 최종 추천 아키텍처

**Platform**: Fly.io (도쿄 리전) + Cloudflare (CDN/DNS)
**비용**: $0~5/월 (MVP), $50~100/월 (1000명), $300+/월 (10,000명)
**배포 시간**: 5분 (자동화 스크립트)

---

## 핵심 결정 사항

### 1. 클라우드 플랫폼: Fly.io ✅

| 항목 | 선택 | 이유 |
|------|------|------|
| 플랫폼 | **Fly.io** | 무료 티어로 MVP 완전 커버, Docker 네이티브 |
| 리전 | 도쿄 (nrt) | 한국과 40~60ms 레이턴시 (서울 리전 없음) |
| 대안 | AWS Seoul | 서울 리전 필요 시 ($300+/월), 1000 DAU 이후 검토 |

**Trade-off**:
- 포기: 서울 리전 (20ms 레이턴시)
- 얻는 것: $0 운영비, 간단한 배포, Docker 이식성

### 2. 데이터베이스: Fly Postgres ✅

| 항목 | 선택 | 이유 |
|------|------|------|
| DB | **Fly Postgres** | 3GB 무료, 자동 백업, Private network |
| 백업 | 일일 자동 (7일) | Fly.io 기본 제공 |
| 마이그레이션 | Alembic | 이미 프로젝트에 설정됨 |

**스케일 업 시점**: DB 2GB 초과 → 10GB 유료 플랜 ($15/월)

### 3. Frontend 서빙: Nginx (Fly 앱) ✅

| 항목 | 선택 | 이유 |
|------|------|------|
| 서버 | **Nginx** | 정적 파일 + API 프록시 |
| 빌드 | Vite 7 | 빠른 빌드, 최적화 |
| CDN | Cloudflare 무료 | 자동 캐싱, DDoS 방어 |

### 4. CI/CD: GitHub Actions ✅

| 항목 | 선택 | 이유 |
|------|------|------|
| CI/CD | **GitHub Actions** | 무료, GitHub 통합 |
| 배포 타겟 | Fly.io | `flyctl deploy` 자동화 |
| 트리거 | main 브랜치 push | 자동 배포 |

**워크플로우**:
1. PR 생성 → 테스트 실행
2. `main` 브랜치 merge → 자동 배포 (Production)

---

## 비용 분석 (사용자 규모별)

### MVP (10~100명): $0~6/월

| 항목 | 비용 | 비고 |
|------|------|------|
| Fly.io (3 앱 + DB) | **$0** | 무료 티어 |
| Cloudflare | **$0** | 무료 플랜 |
| Anthropic Claude | **~$5** | 1000 요청/월 |
| 도메인 | **~$1** | .com 도메인 |
| **총계** | **$5~6** | |

**제약사항**:
- 비활성 시 자동 중지 (콜드 스타트 1~2초)
- DB 3GB 제한
- 트래픽 160GB/월 제한

### 성장기 (100~1000명): $50~100/월

| 항목 | 비용 | 비고 |
|------|------|------|
| Fly.io | **$35** | Backend 2 instances + DB 10GB |
| Cloudflare | **$0** | 무료 지속 |
| Anthropic Claude | **~$30** | 10,000 요청/월 |
| Redis (Upstash) | **$0** | 캐싱 (무료 티어) |
| Sentry | **$0** | 에러 트래킹 (무료) |
| **총계** | **$65** | |

**변경사항**:
- Backend 수평 스케일링 (2 instances)
- DB 전용 CPU + 메모리 증가
- Redis 캐싱 추가

### 확장기 (1000~10,000명): $300~500/월

| 항목 | 비용 | 비고 |
|------|------|------|
| Fly.io | **$190** | Backend 4 instances + DB 50GB |
| Cloudflare Pro | **$20** | 보안 + 성능 |
| Anthropic Claude | **~$200** | 100,000 요청/월 |
| Upstash Redis | **$10** | Pro 플랜 |
| Sentry Team | **$29** | 팀 플랜 |
| **총계** | **$449** | |

**검토사항**: AWS 서울 이전 고려 (레이턴시 critical 시)

---

## 아키텍처 다이어그램 (Phase 1: MVP)

```
사용자 (한국)
    ↓
Cloudflare (무료)
- DNS + CDN
- DDoS 방어
- 자동 HTTPS
    ↓
Fly.io (도쿄)
┌─────────────────────────┐
│ Frontend (nginx)        │
│ 256MB, shared-cpu       │
│ React 19 빌드           │
└──────┬──────────────────┘
       │ /api/* proxy
       ↓
┌─────────────────────────┐
│ Backend (FastAPI)       │
│ 512MB, shared-cpu       │
│ Python 3.12 + uvicorn   │
└──────┬──────────────────┘
       │ asyncpg
       ↓
┌─────────────────────────┐
│ PostgreSQL 16           │
│ 3GB, 256MB RAM          │
│ 자동 일일 백업          │
└─────────────────────────┘

외부 API (종량제):
- Anthropic Claude
- Telegram (무료)
- Kakao OpenBuilder (무료)
```

---

## 배포 절차 (5분)

### 자동 배포 (권장)

```bash
# 1. Fly CLI 설치 및 로그인
brew install flyctl
flyctl auth login

# 2. 스크립트 실행
chmod +x scripts/deploy-*.sh
./scripts/deploy-init.sh                      # Backend + DB
cd frontend && ../scripts/deploy-frontend.sh  # Frontend

# 3. 완료!
open https://homenrich-frontend.fly.dev
```

### CI/CD 활성화

```bash
# GitHub Actions 토큰 설정
flyctl auth token
# → GitHub Secrets에 FLY_API_TOKEN 저장

# 자동 배포 테스트
git push origin main
```

---

## 보안 체크리스트

- [x] HTTPS 강제 (Fly.io 자동 적용)
- [x] 환경 변수 암호화 (Fly Secrets)
- [x] DB Private network (외부 접근 차단)
- [x] CORS 명시적 설정 (와일드카드 금지)
- [x] 보안 헤더 (nginx 설정)
- [x] Rate limiting (Cloudflare 기본 제공)
- [x] 자동 백업 (Fly.io 일일)
- [ ] Sentry 에러 트래킹 (선택)
- [ ] 의존성 스캔 (Dependabot)

---

## 모니터링

### 기본 (무료)

- **Fly Metrics**: CPU, 메모리, 네트워크, 응답 시간
- **Fly Logs**: 실시간 로그 (7일 보관)
- **UptimeRobot**: 무료 업타임 모니터링 (5분 간격)

### 추가 (선택)

- **Sentry**: 에러 트래킹 (무료 5000 이벤트/월)
- **Datadog**: APM + 로그 (유료, $31+/월)

---

## 스케일 업 트리거

| 지표 | 현재 → 다음 단계 | 행동 |
|------|----------------|------|
| **DAU** | 100 → 1,000 | Fly.io 유료 전환 ($35/월) |
| **응답 시간** | 100ms → 200ms+ | Backend 수평 스케일링 (2 instances) |
| **DB 크기** | 2GB → 3GB | DB 10GB 플랜 ($15/월) |
| **레이턴시** | 60ms → critical | AWS Seoul 이전 검토 ($300+/월) |
| **월 비용** | $100 → $300 | AWS 이전 또는 최적화 |
| **에러율** | 0.1% → 1% | Sentry 추가 + 로그 분석 |

---

## 리스크 및 대응

### 리스크 1: Fly.io 장애

**확률**: 낮음 (Uptime 99.9%+)
**영향**: 서비스 중단

**대응**:
- 멀티 리전 배포 (유료 플랜, $50+/월)
- DR 플랜: AWS Lightsail 예비 구성 (1시간 복구 목표)

### 리스크 2: LLM API 비용 폭증

**확률**: 중간 (봇/스팸 공격 시)
**영향**: 예상 외 비용

**대응**:
- Rate limiting (Cloudflare + FastAPI)
- LLM 응답 캐싱 (Redis)
- API 예산 알림 (Anthropic/OpenAI 대시보드)

### 리스크 3: DB 3GB 초과

**확률**: 중간 (6개월~1년 후)
**영향**: 무료 티어 초과 → 자동 과금

**대응**:
- 모니터링: 매주 DB 크기 확인
- 오래된 데이터 아카이브 (S3)
- 10GB 플랜 전환 ($15/월)

---

## 성공 지표 (KPI)

### 인프라

- **가용성**: 99.9% 이상 (UptimeRobot)
- **응답 시간**: p95 < 500ms
- **에러율**: < 0.1%
- **배포 빈도**: 주 1회 이상

### 비용

- **MVP**: $10/월 이하
- **성장기**: $100/월 이하
- **LLM 비용**: 사용자당 $0.5/월 이하

---

## 다음 단계

### 즉시 (Week 1)

1. Fly.io 계정 생성
2. 자동 배포 스크립트 실행
3. 도메인 구매 (선택)
4. Telegram/Kakao Webhook 설정

### 단기 (Week 2-4)

1. Sentry 연동 (에러 트래킹)
2. UptimeRobot 설정 (업타임 모니터링)
3. LLM 캐싱 구현 (비용 절감)
4. DB 인덱스 최적화

### 중기 (Month 2-3)

1. 사용자 피드백 수집
2. 성능 모니터링 및 최적화
3. 백업 복구 테스트
4. 보안 점검 (월 1회)

### 장기 (Month 6+)

1. 1000 DAU 달성 시 Fly.io 유료 전환
2. AWS Seoul 이전 검토 (레이턴시 critical 시)
3. 멀티 리전 배포 (글로벌 확장 시)

---

## 참고 문서

- **빠른 배포**: `/QUICKSTART.md`
- **상세 배포 가이드**: `/DEPLOYMENT.md`
- **인프라 아키텍처**: `/INFRASTRUCTURE.md`
- **보안 가이드**: `/SECURITY.md`
- **프로젝트 규칙**: `/CLAUDE.md`
- **README**: `/README.md`

---

## 연락처

- 프로젝트 관리자: [설정 필요]
- 보안 이슈: security@yourdomain.com [설정 필요]
- 기술 지원: GitHub Issues

---

**최종 업데이트**: 2025-02-13
**문서 버전**: 1.0
**검토자**: Senior DevOps Architect (Claude)

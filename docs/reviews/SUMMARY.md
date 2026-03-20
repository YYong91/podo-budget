# 종합 코드 리뷰 최종 요약

**프로젝트:** 포도가계부 (podo-budget)
**기간:** 2026-03-19
**범위:** BE 78 파일 / 11.3k 라인, FE 147 파일 / 23.7k 라인

---

## 리뷰 구조

| 라운드 | 초점 | 배치 수 | 발견 건수 |
|--------|------|---------|----------|
| R1 | 보안 + 버그 | 7 | 57 |
| R2 | 성능 + 아키텍처 | 7 | 51 |
| R3 | 코드품질 + 테스트 | 7 | 56 |
| **합계** | | **21** | **164** |

---

## 심각도 분포

| 심각도 | R1 | R2 | R3 | 합계 |
|--------|-----|-----|-----|------|
| Critical | 16 | 16 | 10 | **42** |
| High | 33 | 17 | 39 | **89** |
| Medium | 8 | 18 | 7 | **33** |

---

## 도메인별 이슈 분포

| 도메인 | R1 | R2 | R3 | 합계 |
|--------|-----|-----|-----|------|
| B1 인증/보안 | 8 | 6 | 12 | 26 |
| B2 거래 핵심 | 8 | 12 | 8 | 28 |
| B3 가구/초대 | 9 | 7 | 7 | 23 |
| B4 부가 기능 | 8 | 9 | 9 | 26 |
| B5 FE 공통 | 7 | 6 | 5 | 18 |
| B6 봇/외부 | 8 | 6 | 8 | 22 |
| B7 인프라 | 9 | 5 | 7 | 21 |

---

## GitHub 이슈 등록 현황

| 라운드 | 이슈 번호 | 건수 |
|--------|----------|------|
| R1 | #120 ~ #141 | 22 |
| R2 | #162 ~ #182 | 21 |
| R3 | #183 ~ #204 | 22 |
| **합계** | | **65** |

> 164건의 원시 발견 사항을 중복 제거 및 그룹화하여 65건의 GitHub 이슈로 정리

---

## 우선 수정 권장 목록

### P0: Critical (즉시 수정)

| # | 도메인 | 문제 | 라운드 |
|---|--------|------|--------|
| 1 | B6 봇 | Webhook 시크릿 미설정 시 인증 없이 LLM/메시지 실행 | R1 |
| 2 | B3 가구 | 초대 수락 레이스 컨디션 → 중복 멤버 생성 | R1 |
| 3 | B4 자산 | /assets/snapshots 가구 권한 검증 누락 | R1+R3 |
| 4 | B3 가구 | onboarding.py datetime.now() UTC 누락 | R3 |
| 5 | B3 가구 | email_service resend 동기 호출 → 이벤트 루프 블로킹 | R3 |
| 6 | B2 거래 | 연간 통계 12회 직렬 DB 쿼리 | R2 |
| 7 | B4 자산 | N+1 외부 API 호출 (자산 시세) | R2 |
| 8 | B6 봇 | callback_query 타임아웃 미설정 + N+1 쿼리 | R2 |
| 9 | B5 FE공통 | Layout 풀 구독 리렌더링 + ToastContext 타이머 리셋 | R2+R3 |

### P1: High (1주 내 수정)

| # | 도메인 | 문제 | 라운드 |
|---|--------|------|--------|
| 1 | B1 인증 | 인증 레이어 테스트 커버리지 갭 5개 영역 | R3 |
| 2 | 전체 | Pydantic v1 Config → v2 일괄 수정 (6개 스키마) | R3 |
| 3 | B3 가구 | households.py 740행 → services 분리 필요 | R3 |
| 4 | B6 봇 | telegram↔kakao 코드 대규모 중복 | R3 |
| 5 | B4 자산 | 환율 조회 이중화 (price_service + exchange_rate) | R3 |
| 6 | B2 거래 | ExpenseForm↔IncomeForm 핵심 로직 복제 | R2+R3 |
| 7 | B3 가구 | N+1 쿼리 (list_households, get_household, invitations) | R2 |
| 8 | B7 인프라 | fly.toml 중복 uv sync + Dockerfile 2회 COPY | R2 |

---

## 전체 관찰 요약

### 강점
- SSO(podo-auth) 단일 인증 경로가 잘 통합됨
- Zustand 스토어 가구 전환 로직 캡슐화 우수
- lazy import 코드 스플리팅 적용
- CI/CD 분리 구조 명확
- Promise.allSettled 사용으로 개별 API 실패 격리

### 주요 개선 방향
1. **N+1 쿼리 해소** — 가구/거래/자산 전반에 걸친 직렬 쿼리 패턴 → JOIN/서브쿼리로 통합
2. **코드 중복 제거** — 봇(telegram↔kakao), 폼(Expense↔Income), 유틸(날짜, 포맷) 추출
3. **테스트 커버리지 확대** — 권한 검증, 비동기 상태, 시세 계산, 피드백 API 등 핵심 경로
4. **아키텍처 규칙 준수** — households.py 서비스 분리, 인라인 import 정리, Pydantic v2 통일
5. **외부 API 의존 최적화** — asyncio.gather 병렬화, singleflight 패턴, 환율 서비스 통합

---

## 리포트 파일 목록

```
docs/reviews/
├── R1-B1-auth-security.md
├── R1-B2-transactions.md
├── R1-B3-household.md
├── R1-B4-features.md
├── R1-B5-frontend-common.md
├── R1-B6-bot-external.md
├── R1-B7-infra.md
├── R2-B1-auth-security.md
├── R2-B2-transactions.md
├── R2-B3-household.md
├── R2-B4-features.md
├── R2-B5-frontend-common.md
├── R2-B6-bot-external.md
├── R2-B7-infra.md
├── R3-B1-auth-security.md
├── R3-B2-transactions.md
├── R3-B3-household.md
├── R3-B4-features.md
├── R3-B5-frontend-common.md
├── R3-B6-bot-external.md
├── R3-B7-infra.md
└── SUMMARY.md
```

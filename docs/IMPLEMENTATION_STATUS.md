# HomeNRich 구현 현황 (Implementation Status)

**최종 업데이트**: 2026-02-15
**기준 문서**: `PRODUCT.md`, `ROADMAP.md`

기능별 구현 완료도를 추적합니다. 기능 완료/변경 시 이 문서를 업데이트합니다.

---

## 전체 진행률

| Phase | 진행률 | 상태 |
|-------|--------|------|
| Phase 1 (Core MVP) | **100%** | 완료 |
| Phase 2 (Household) | **100%** | 완료 (이메일 발송 구현 완료) |
| Phase 3 (Bot) | **95%** | 보안/타임아웃/삭제확인 보강 완료 |
| Phase 4 (배포) | **85%** | QA 완료, 결제 활성화 후 배포 |

---

## 백엔드 (FastAPI)

### 인증 (Authentication)

| 기능 | 상태 | 파일 | 테스트 |
|------|------|------|--------|
| 회원가입 | 완료 | api/auth.py | 있음 |
| 로그인 | 완료 | api/auth.py | 있음 |
| JWT 검증 | 완료 | core/auth.py | 있음 |
| 비밀번호 재설정 | 완료 | core/auth.py, api/auth.py | 있음 |

### 지출 (Expense)

| 기능 | 상태 | 파일 | 테스트 | 비고 |
|------|------|------|--------|------|
| 지출 CRUD | 완료 | api/expenses.py | 있음 | - |
| 날짜 필터링 | 완료 | api/expenses.py | 있음 | - |
| household_id 필터링 | 완료 | api/expenses.py | 있음 | 멤버 검증 + 가구 전체 조회 |
| household_id 자동감지 | 완료 | api/dependencies.py | 있음 | 활성 가구 자동 설정 |

### LLM 자연어 파싱

| 기능 | 상태 | 파일 | 테스트 | 비고 |
|------|------|------|--------|------|
| LLMProvider 인터페이스 | 완료 | services/llm_service.py | 있음 | Strategy 패턴, Mock 테스트 |
| OpenAI API 호출 | 완료 | services/llm_service.py | 있음 (skip) | API 키 없으면 skip |
| Anthropic API 호출 | 완료 | services/llm_service.py | 있음 | Mock 기반 6개 테스트 |
| 프롬프트 엔지니어링 | 완료 | services/prompts.py | 없음 | Few-shot 예시 포함 |
| 컨텍스트 탐지 | 완료 | services/expense_context_detector.py | 있음 (27개) | 공유/개인 키워드 감지 |

### 카테고리 / 예산

| 기능 | 상태 | 파일 | 테스트 |
|------|------|------|--------|
| 카테고리 CRUD | 완료 | api/categories.py | 있음 |
| 예산 CRUD | 완료 | api/budget.py | 있음 |
| 예산 초과 알림 | 완료 | api/insights.py | 있음 |
| AI 인사이트 생성 | 완료 | services/llm_service.py | 없음 |

### 가구 (Household)

| 기능 | 상태 | 파일 | 테스트 | 비고 |
|------|------|------|--------|------|
| 가구 CRUD | 완료 | api/households.py | 있음 | - |
| 멤버 관리 | 완료 | api/households.py | 있음 | owner/member/viewer 역할 |
| 초대 생성/수락/거절 | 완료 | api/invitations.py | 있음 | - |
| Expense 연결 | 완료 | api/expenses.py, api/chat.py | 있음 | 생성/조회 시 household_id 자동 설정 |
| 이메일 발송 | 완료 | services/email_service.py | 있음 (Mock) | Resend API |
| Expense 권한 검증 | 완료 | api/dependencies.py | 있음 | get_household_member()로 멤버 검증 |

### 봇 통합

| 기능 | 상태 | 파일 | 테스트 | 비고 |
|------|------|------|--------|------|
| Telegram Webhook | 완료 | api/telegram.py | 있음 (22개) | LLM 파싱 + Household 연동 |
| Telegram 카테고리 변경 | 완료 | api/telegram.py | 있음 | 인라인 키보드 선택 |
| Telegram 지출 삭제 | 완료 | api/telegram.py | 있음 | 2단계 확인 프롬프트 |
| Telegram 시크릿 검증 | 완료 | api/telegram.py | 있음 | X-Telegram-Bot-Api-Secret-Token |
| Kakao OpenBuilder | 완료 | api/kakao.py | 있음 (18개) | LLM 파싱 + Household 연동 |
| Kakao 5초 타임아웃 | 완료 | api/kakao.py | 있음 | asyncio.timeout(4.5) |
| Kakao API 키 검증 | 완료 | api/kakao.py | 있음 | Authorization 헤더 |
| 봇 Household 연동 | 완료 | telegram.py, kakao.py | 있음 | 컨텍스트 탐지 자동 연결 |

### 데이터베이스

| 항목 | 상태 | 비고 |
|------|------|------|
| SQLAlchemy 모델 | 완료 | User, Expense, Category, Budget, Household, HouseholdMember, HouseholdInvitation |
| Alembic 마이그레이션 | 완료 | 초기 마이그레이션 ef6a56f45278 |
| Alembic 마이그레이션 #2 | 완료 | 인덱스 + FK CASCADE 정비 (a1b2c3d4e5f6) |
| Alembic 마이그레이션 #3 | 완료 | Float → Numeric(12,2) for monetary fields |
| 인덱스 | 완료 | user_id, household_id, date, category_id + 복합 인덱스 |
| FK CASCADE | 완료 | expenses/categories/budgets → households (SET NULL) |

---

## 프론트엔드 (React 19)

### 인증

| 기능 | 상태 | 테스트 |
|------|------|--------|
| 회원가입 페이지 | 완료 | 있음 |
| 로그인 페이지 | 완료 | 있음 |
| JWT 자동 로그인 | 완료 | 있음 |
| 비밀번호 찾기 페이지 | 완료 | 있음 |
| 비밀번호 재설정 페이지 | 완료 | 있음 |

### 대시보드

| 기능 | 상태 | 테스트 |
|------|------|--------|
| 지출 요약 (이번 달) | 완료 | 있음 |
| 최근 지출 목록 | 완료 | 있음 |
| 예산 진행률 | 완료 | 있음 |
| 통합 뷰 (공유+개인) | 완료 | 있음 |

### 지출 관리

| 기능 | 상태 | 테스트 | 비고 |
|------|------|--------|------|
| 지출 목록/생성/수정/삭제 | 완료 | 있음 | - |
| 자연어 입력 UI | 완료 | 있음 | 자연어/폼 2모드 제공 |
| 파싱 결과 확인/수정 | 완료 | - | 프리뷰 → 수정 → 확인 |

### 가구 관리

| 기능 | 상태 | 테스트 | 비고 |
|------|------|--------|------|
| 가구 목록/생성 | 완료 | 있음 | - |
| 멤버 초대 | 완료 | 있음 | - |
| Household 전환 UI | 완료 | - | 사이드바 드롭다운 |
| 초대 승인 페이지 | 완료 | 있음 | /invitations/accept?token= |
| 멤버별 필터링 | 완료 | - | 드롭다운 + 작성자 열 |

### 기타

| 기능 | 상태 | 테스트 |
|------|------|--------|
| 카테고리 관리 | 완료 | 있음 |
| 예산 관리 | 완료 | 있음 |
| 인사이트 페이지 | 완료 | 있음 (API stub) |

---

## 인프라

| 항목 | 상태 | 비고 |
|------|------|------|
| Docker Compose (개발) | 완료 | PostgreSQL + Backend + Frontend |
| Backend Dockerfile | 완료 | Python 3.12-slim, uv |
| Frontend Dockerfile | 완료 | Node.js + Nginx |
| Fly.io 배포 | **설정 완료** | 앱 3개 생성 + 시크릿 설정, 트라이얼 만료로 결제 활성화 필요 |
| CI/CD (GitHub Actions) | **완료** | deploy-production.yml + deploy-staging.yml (PR 테스트) |
| Sentry 에러 트래킹 | **완료** | Backend + Frontend 통합, DSN 없으면 비활성화 |
| PWA (오프라인 + 홈 화면) | **완료** | vite-plugin-pwa, 오프라인 앱 셸, 자동 업데이트 |

---

## 테스트 현황

| 영역 | 테스트 수 | 커버리지 |
|------|-----------|----------|
| 백엔드 (pytest) | 299개 (5 skip) | 측정 완료 (핵심 모듈 80%+) |
| 프론트엔드 (Vitest) | 343개 (all pass) | 미측정 |
| E2E (Playwright) | 15개 (4 파일) | 인증, 지출 CRUD, 대시보드, 네비게이션 |

---

## 알려진 이슈

### P0 (Critical)
- ~~LLM 파싱 미구현~~ (2026-02-14 해결: Anthropic/OpenAI/프롬프트 구현 완료)
- ~~Alembic 미초기화~~ (2026-02-14 해결: 초기 마이그레이션 완료)
- ~~Household <-> Expense 미연결~~ (2026-02-14 해결)
- ~~Telegram callback IDOR 취약점~~ (2026-02-14 해결: 소유권 검증 추가)
- ~~HouseholdMember 재가입 불가~~ (2026-02-14 해결: 기존 레코드 복원 로직)
- ~~health_db raw SQL text() 누락~~ (2026-02-14 해결)
- ~~InsightsPage XSS 취약점~~ (2026-02-14 해결: dangerouslySetInnerHTML 제거)

### P1 (High)
- ~~이메일 발송 미구현~~ (2026-02-15 해결: Resend API 연동 완료)
- ~~Telegram/Kakao 봇 미완성~~ (2026-02-14 해결: LLM 파싱 + Household 연동 + 카테고리 변경 + Webhook 보안 + 타임아웃)
- ~~프론트엔드 자연어 입력 UI 없음~~ (2026-02-14 해결: 프리뷰/수정/확인 플로우 구현)
- ~~datetime.utcnow() deprecated~~ (2026-02-14 해결: datetime.now(UTC) 전면 교체)
- ~~Expense 금액 검증 누락~~ (2026-02-14 해결: Field(gt=0) 추가)
- ~~InvitationCreate owner 역할 허용~~ (2026-02-14 해결: member|admin만 허용)
- ~~UserCreate email 검증 누락~~ (2026-02-14 해결: EmailStr 적용)
- ~~category_id 0 falsy 처리~~ (2026-02-14 해결: is not None 체크)
- ~~에러 메시지 내부 정보 노출~~ (2026-02-14 해결: 로깅 분리)
- ~~Category race condition~~ (2026-02-14 해결: IntegrityError 재조회)
- ~~Nginx 보안 헤더 누락~~ (2026-02-14 해결: HSTS, CSP, Referrer-Policy 추가)

### P2 (Medium)
- ~~테스트 커버리지 미측정~~ (2026-02-15 해결: 측정 완료, 핵심 모듈 80%+)
- ~~LLM API 실패 시 에러 핸들링 부족~~ (2026-02-14 해결: Kakao 타임아웃, Telegram 에러 로깅)
- ~~DB 인덱스 부족~~ (2026-02-14 해결: date, category_id, 복합 인덱스 추가)
- ~~대시보드 통합 뷰 미구현~~ (2026-02-15 해결: 공유 우선 + 개인 접기 구현)
- ~~Float → Numeric 타입 변경~~ (2026-02-15 해결: Numeric(12,2) 마이그레이션 완료)

---

## 참조 문서

- **프로젝트 기준**: `PRODUCT.md`
- **구현 계획**: `ROADMAP.md`

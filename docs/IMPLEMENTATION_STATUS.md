# HomeNRich 구현 현황 (Implementation Status)

**최종 업데이트**: 2026-02-14
**기준 문서**: `PRODUCT.md`, `ROADMAP.md`

기능별 구현 완료도를 추적합니다. 기능 완료/변경 시 이 문서를 업데이트합니다.

---

## 전체 진행률

| Phase | 진행률 | 상태 |
|-------|--------|------|
| Phase 1 (Core MVP) | 85% | API/UI/LLM 파싱 완료, 자연어 입력 UI 미완 |
| Phase 2 (Household) | 70% | Expense 연결 완료, 전환 UI 미완 |
| Phase 3 (Bot) | 스켈레톤 | 실제 동작 안 함 |
| Phase 4 (배포) | 0% | 미착수 |

---

## 백엔드 (FastAPI)

### 인증 (Authentication)

| 기능 | 상태 | 파일 | 테스트 |
|------|------|------|--------|
| 회원가입 | 완료 | api/auth.py | 있음 |
| 로그인 | 완료 | api/auth.py | 있음 |
| JWT 검증 | 완료 | core/auth.py | 있음 |
| 비밀번호 재설정 | 미구현 | - | - |

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
| LLMProvider 인터페이스 | 완료 | services/llm_service.py | 없음 | Strategy 패턴 |
| OpenAI API 호출 | 완료 | services/llm_service.py | 없음 | parse_expense() 구현 |
| Anthropic API 호출 | 완료 | services/llm_service.py | 없음 | parse_expense() 구현 |
| 프롬프트 엔지니어링 | 완료 | services/prompts.py | 없음 | Few-shot 예시 포함 |

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
| 이메일 발송 | 미구현 | - | - | SendGrid 연동 필요 |
| Expense 권한 검증 | 완료 | api/dependencies.py | 있음 | get_household_member()로 멤버 검증 |

### 봇 통합

| 기능 | 상태 | 파일 | 테스트 |
|------|------|------|--------|
| Telegram Webhook | 스켈레톤 | api/telegram.py | 없음 |
| Kakao OpenBuilder | 스켈레톤 | api/kakao.py | 없음 |

### 데이터베이스

| 항목 | 상태 | 비고 |
|------|------|------|
| SQLAlchemy 모델 | 완료 | User, Expense, Category, Budget, Household, HouseholdMember, HouseholdInvitation |
| Alembic 마이그레이션 | 완료 | 초기 마이그레이션 ef6a56f45278 |
| 인덱스 | 부분 | user_id, household_id에만 |

---

## 프론트엔드 (React 19)

### 인증

| 기능 | 상태 | 테스트 |
|------|------|--------|
| 회원가입 페이지 | 완료 | 있음 |
| 로그인 페이지 | 완료 | 있음 |
| JWT 자동 로그인 | 완료 | 있음 |

### 대시보드

| 기능 | 상태 | 테스트 |
|------|------|--------|
| 지출 요약 (이번 달) | 완료 | 있음 |
| 최근 지출 목록 | 완료 | 있음 |
| 예산 진행률 | 완료 | 있음 |

### 지출 관리

| 기능 | 상태 | 테스트 | 비고 |
|------|------|--------|------|
| 지출 목록/생성/수정/삭제 | 완료 | 있음 | - |
| 자연어 입력 UI | 미구현 | - | 채팅 인터페이스 |
| 파싱 결과 확인/수정 | 미구현 | - | - |

### 가구 관리

| 기능 | 상태 | 테스트 | 비고 |
|------|------|--------|------|
| 가구 목록/생성 | 완료 | 있음 | - |
| 멤버 초대 | 완료 | 있음 | - |
| Household 전환 UI | 미구현 | - | 헤더 드롭다운 |
| 초대 승인 페이지 | 미구현 | - | /invite/{token} |
| 멤버별 필터링 | 미구현 | - | - |

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
| Fly.io 배포 | 미구현 | - |
| CI/CD (GitHub Actions) | 미구현 | - |
| Sentry 에러 트래킹 | 미구현 | - |

---

## 테스트 현황

| 영역 | 테스트 수 | 커버리지 |
|------|-----------|----------|
| 백엔드 (pytest) | 199개 | 미측정 |
| 프론트엔드 (Vitest) | 157개 | 미측정 |
| E2E | 0개 | - |

---

## 알려진 이슈

### P0 (Critical)
- ~~LLM 파싱 미구현~~ (2026-02-14 해결: Anthropic/OpenAI/프롬프트 구현 완료)
- ~~Alembic 미초기화~~ (2026-02-14 해결: 초기 마이그레이션 완료)
- ~~Household <-> Expense 미연결~~ (2026-02-14 해결)

### P1 (High)
- 이메일 발송 미구현: 초대 링크를 직접 복사해야 함
- Telegram/Kakao 봇 미완성: 스켈레톤만 있음
- 프론트엔드 자연어 입력 UI 없음: 폼 입력만 가능

### P2 (Medium)
- 테스트 커버리지 미측정
- LLM API 실패 시 에러 핸들링 부족
- DB 인덱스 부족 (날짜 범위 조회 성능)

---

## 참조 문서

- **프로젝트 기준**: `PRODUCT.md`
- **구현 계획**: `ROADMAP.md`

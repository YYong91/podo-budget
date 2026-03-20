# 종합 코드 리뷰 디자인

## 목표

포도가계부 전체 코드베이스(BE 78파일/11.3k줄, FE 147파일/23.7k줄)를 종합 점검하여 보안 취약점, 잠재 버그, 성능 이슈, 코드 품질 문제를 도출한다.

## 산출물

1. **배치별 리뷰 리포트** — 발견 사항 + 심각도(Critical/High/Medium/Low)
2. **GitHub 이슈** — 발견 사항별 이슈 등록 (레이블: `code-review`, 심각도, 도메인)
3. **프로젝트 보드 정리** — 이슈를 우선순위별로 프로젝트에 배치

## 리뷰 관점

| 관점 | 체크 포인트 |
|------|------------|
| **보안** | SQL 인젝션, XSS, CSRF, 인증/인가 우회, 시크릿 노출, 입력 검증 누락 |
| **버그** | 에러 핸들링 누락, 레이스 컨디션, null/undefined 미처리, 타입 불일치 |
| **성능** | N+1 쿼리, 불필요한 리렌더링, 번들 사이즈, DB 인덱스 누락, 메모리 누수 |
| **코드 품질** | 중복 코드, 컨벤션 위반, 과도한 복잡도, 미사용 코드, BE↔FE 불일치 |
| **테스트** | 커버리지 갭, 테스트 품질, 엣지 케이스 누락 |

## 진행 방식 — 3라운드 × 7배치 (총 21회)

각 배치는 code-reviewer 에이전트로 실행한다. 3라운드에 걸쳐 관점을 달리하며 동일 코드를 반복 점검한다.

### 라운드 구조

| 라운드 | 초점 | 목적 |
|--------|------|------|
| **R1: 보안 + 버그** | 취약점, 인증/인가 우회, 데이터 유실, 에러 핸들링 누락, 레이스 컨디션 | Critical/High 조기 발견 |
| **R2: 성능 + 아키텍처** | N+1 쿼리, 리렌더링, 번들 사이즈, DB 인덱스, BE↔FE 불일치, 레이어 위반 | 구조적 개선점 도출 |
| **R3: 코드 품질 + 테스트** | 중복 코드, 컨벤션 위반, 미사용 코드, 커버리지 갭, 테스트 품질 | 유지보수성 향상 |

### 실행 순서

```
R1-B1 → R1-B2 → R1-B3 → R1-B4 → R1-B5 → R1-B6 → R1-B7  (보안+버그)
  ↓ 이슈 등록
R2-B1 → R2-B2 → R2-B3 → R2-B4 → R2-B5 → R2-B6 → R2-B7  (성능+아키텍처)
  ↓ 이슈 등록
R3-B1 → R3-B2 → R3-B3 → R3-B4 → R3-B5 → R3-B6 → R3-B7  (코드품질+테스트)
  ↓ 이슈 등록
```

각 라운드 종료 시 발견 사항을 GitHub 이슈로 일괄 등록하고 프로젝트 보드에 배치한다.

### 배치 1: 인증/보안 레이어

**BE**: `core/auth.py`, `core/rate_limit.py`, `core/exceptions.py`, `api/auth.py`, `api/dependencies.py`, `main.py`(CORS)
**FE**: `contexts/AuthContext.tsx`, `components/ProtectedRoute.tsx`, `api/client.ts`, `api/auth.ts`
**중점**: 인증 우회, 토큰 처리, CORS 설정, rate limiting

### 배치 2: 거래 핵심 (지출/수입/카테고리/LLM)

**BE**: `api/expenses.py`, `api/income.py`, `api/categories.py`, `api/chat.py`, `models/expense.py`, `models/income.py`, `models/category.py`, `models/category_mapping.py`, `schemas/expense.py`, `schemas/income.py`, `schemas/category.py`, `schemas/chat.py`, `services/llm_service.py`, `services/category_service.py`, `services/category_hint_service.py`, `services/category_mapping_service.py`, `services/expense_context_detector.py`, `services/prompts.py`
**FE**: `pages/TransactionList.tsx`, `pages/ExpenseForm.tsx`, `pages/ExpenseDetail.tsx`, `pages/IncomeForm.tsx`, `pages/IncomeDetail.tsx`, `pages/CategoryManager.tsx`, `components/MiniCalendar.tsx`, `components/TransactionItem.tsx`, `components/CategoryBottomSheet.tsx`, `api/expenses.ts`, `api/income.ts`, `api/categories.ts`, `api/chat.ts`
**중점**: 금액 처리(Numeric 정확도), LLM 프롬프트 인젝션, 쿼리 성능, 입력 검증

### 배치 3: 가구/멤버/초대/관리

**BE**: `api/households.py`, `api/invitations.py`, `api/onboarding.py`, `api/admin.py`, `models/household.py`, `models/household_member.py`, `models/household_invitation.py`, `models/user.py`, `schemas/household.py`, `schemas/onboarding.py`, `schemas/admin.py`, `services/admin_service.py`, `services/email_service.py`
**FE**: `pages/HouseholdListPage.tsx`, `pages/HouseholdDetailPage.tsx`, `pages/OnboardingPage.tsx`, `pages/AcceptInvitationPage.tsx`, `pages/InvitationListPage.tsx`, `pages/AdminPage.tsx`, `components/CreateHouseholdModal.tsx`, `components/InviteMemberModal.tsx`, `api/households.ts`, `api/onboarding.ts`, `api/admin.ts`, `stores/useHouseholdStore.ts`
**중점**: 권한 검증(owner/member), 초대 토큰 보안, 데이터 격리

### 배치 4: 부가 기능 (정기거래/예산/인사이트/자산/피드백)

**BE**: `api/recurring.py`, `api/budget.py`, `api/insights.py`, `api/assets.py`, `api/feedback.py`, `models/recurring_transaction.py`, `models/budget.py`, `models/asset.py`, `models/asset_goal.py`, `models/asset_snapshot.py`, `models/feedback.py`, `schemas/recurring_transaction.py`, `schemas/budget.py`, `schemas/insights.py`, `schemas/asset.py`, `schemas/asset_goal.py`, `schemas/feedback.py`, `services/recurring_service.py`, `services/asset_service.py`, `services/asset_goal_service.py`, `services/asset_parse_service.py`, `services/price_service.py`, `services/exchange_rate.py`
**FE**: `pages/RecurringList.tsx`, `pages/BudgetManager.tsx`, `pages/InsightsPage.tsx`, `pages/AssetDashboard.tsx`, `pages/AssetForm.tsx`, `pages/FeedbackPage.tsx`, `components/PendingRecurring.tsx`, `components/RegisterRecurringModal.tsx`, `components/stats/*.tsx`, `api/recurring.ts`, `api/budgets.ts`, `api/insights.ts`, `api/assets.ts`, `api/feedback.ts`
**중점**: 날짜/반복 로직, 금액 계산 정확도, 외부 API(환율/시세) 에러 처리

### 배치 5: 프론트엔드 공통 레이어

**FE**: `App.tsx`, `main.tsx`, `index.css`, `components/Layout.tsx`, `components/FloatingActionButton.tsx`, `components/EmptyState.tsx`, `components/ErrorState.tsx`, `components/LoadingSpinner.tsx`, `components/PullToRefresh.tsx`, `components/Toast.tsx`, `contexts/ThemeContext.tsx`, `contexts/ToastContext.tsx`, `hooks/*.ts`, `utils/*.ts`, `types/*.ts`, `stores/useHouseholdStore.ts`
**중점**: 라우팅 보안, 전역 상태 관리, 타입 정합성, 유틸리티 정확도

### 배치 6: 봇/외부 연동 (텔레그램/카카오/계좌)

**BE**: `api/telegram.py`, `api/kakao.py`, `api/webhooks.py`, `api/accounts.py`, `models/account.py`, `schemas/account.py`, `services/bot_messages.py`, `services/bot_user_service.py`, `services/account_service.py`
**FE**: `pages/SettingsPage.tsx`, `pages/AccountManager.tsx`, `api/telegram.ts`, `api/kakao.ts`, `api/accounts.ts`
**중점**: 웹훅 인증, 봇 명령어 인젝션, 외부 API 에러 처리

### 배치 7: 인프라/테스트/설정

**파일**: `docker-compose*.yml`, `fly.toml`, `fly.dev.toml`, `.github/workflows/*.yml`, `vite.config.ts`, `pyproject.toml`, `alembic/`, `backend/tests/conftest.py`, 테스트 커버리지 분석
**중점**: CI/CD 보안, 도커 설정, 테스트 커버리지 갭, 빌드 최적화

## 심각도 분류

| 심각도 | 기준 | GitHub 레이블 |
|--------|------|---------------|
| **Critical** | 보안 취약점, 데이터 유실 가능성 | `P0: critical` |
| **High** | 버그, 권한 문제, 심각한 성능 이슈 | `P1: high` |
| **Medium** | 코드 품질, 경미한 성능, 에러 처리 개선 | `P2: medium` |
| **Low** | 컨벤션, 리팩토링, 미사용 코드 정리 | `P3: low` |

## 이슈 등록 규칙

- 레이블: `code-review` + 심각도 + 도메인 태그
- 제목 형식: `[코드리뷰] 카테고리: 문제 설명`
- 본문: 문제 설명 + 위치 + 영향 + 제안 수정 방향
- 프로젝트 보드: Critical/High → Todo, Medium/Low → Backlog

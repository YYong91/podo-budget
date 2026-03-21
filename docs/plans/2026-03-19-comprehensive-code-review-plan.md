# 종합 코드 리뷰 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 포도가계부 전체 코드베이스를 3라운드 × 7배치로 종합 점검하고, 발견 사항을 GitHub 이슈로 등록하여 프로젝트 보드에 정리한다.

**Architecture:** code-reviewer 에이전트가 각 배치를 리뷰하고 리포트를 `docs/reviews/` 디렉토리에 마크다운으로 저장한다. 라운드 종료 시 리포트를 취합하여 GitHub 이슈를 일괄 생성하고 프로젝트 보드("포도가계부 로드맵")에 배치한다.

**Tech Stack:** GitHub CLI (`gh`), GitHub Projects GraphQL API, code-reviewer subagent

---

## 사전 준비

### Task 0: 리뷰 인프라 준비

**Step 1: `code-review` 레이블 생성**

```bash
gh label create "code-review" --description "종합 코드 리뷰 발견 사항" --color "5319E7"
```

**Step 2: 리뷰 리포트 디렉토리 생성**

```bash
mkdir -p docs/reviews
```

**Step 3: 커밋**

```bash
git add docs/reviews docs/plans/2026-03-19-comprehensive-code-review-design.md docs/plans/2026-03-19-comprehensive-code-review-plan.md
git commit -m "docs: 종합 코드 리뷰 계획 및 리포트 디렉토리 추가"
```

---

## 라운드 1: 보안 + 버그

> 초점: 취약점, 인증/인가 우회, 데이터 유실, 에러 핸들링 누락, 레이스 컨디션
> 심각도 기준: Critical/High 위주

### Task 1: R1-B1 인증/보안 레이어 (보안+버그)

**리뷰 대상:**
- `backend/app/core/auth.py` — JWT 검증, get_current_user
- `backend/app/core/rate_limit.py` — rate limiter 구현
- `backend/app/core/exceptions.py` — 커스텀 예외
- `backend/app/api/auth.py` — 인증 API 엔드포인트
- `backend/app/api/dependencies.py` — 공유 디펜던시 (가구 권한 검증)
- `backend/app/main.py` — CORS 설정, 미들웨어
- `frontend/src/contexts/AuthContext.tsx` — SSO 인증 상태 관리
- `frontend/src/components/ProtectedRoute.tsx` — 라우트 보호
- `frontend/src/api/client.ts` — axios 인스턴스, 인터셉터
- `frontend/src/api/auth.ts` — 인증 API 클라이언트

**체크리스트:**
- [ ] JWT 토큰 검증이 모든 보호된 엔드포인트에 적용되는가
- [ ] CORS 설정이 프로덕션 도메인만 허용하는가
- [ ] rate limiter가 인증 엔드포인트에 적용되는가
- [ ] 토큰 만료/갱신 처리가 안전한가
- [ ] FE에서 토큰 저장 방식이 XSS에 안전한가
- [ ] 401 응답 시 SSO 리디렉션이 올바른가
- [ ] 에러 응답에 민감한 정보가 노출되지 않는가

**Step 1: code-reviewer 에이전트로 위 파일들 리뷰**

에이전트에게 전달할 프롬프트:
```
포도가계부 프로젝트의 인증/보안 레이어를 "보안 + 버그" 관점으로 코드 리뷰해주세요.

리뷰 대상 파일:
- backend/app/core/auth.py
- backend/app/core/rate_limit.py
- backend/app/core/exceptions.py
- backend/app/api/auth.py
- backend/app/api/dependencies.py
- backend/app/main.py (CORS 설정 부분)
- frontend/src/contexts/AuthContext.tsx
- frontend/src/components/ProtectedRoute.tsx
- frontend/src/api/client.ts
- frontend/src/api/auth.ts

집중 관점:
1. 보안 취약점: JWT 검증 우회, CORS 미설정, rate limit 누락, XSS, CSRF
2. 버그: 에러 핸들링 누락, 레이스 컨디션, null 미처리, 토큰 만료 미처리

발견 사항마다 다음 형식으로 보고:
- **심각도**: Critical / High / Medium / Low
- **카테고리**: 보안 / 버그
- **위치**: 파일명:라인번호
- **문제**: 구체적 설명
- **영향**: 이 문제가 발생하면 어떤 일이 일어나는가
- **제안**: 수정 방향

confidence 80% 이상인 것만 보고해주세요. 추측성 이슈는 제외.
```

**Step 2: 리포트 저장**

리뷰 결과를 `docs/reviews/R1-B1-auth-security.md`에 저장

---

### Task 2: R1-B2 거래 핵심 (보안+버그)

**리뷰 대상:**
- `backend/app/api/expenses.py`, `api/income.py`, `api/categories.py`, `api/chat.py`
- `backend/app/models/expense.py`, `models/income.py`, `models/category.py`, `models/category_mapping.py`
- `backend/app/schemas/expense.py`, `schemas/income.py`, `schemas/category.py`, `schemas/chat.py`
- `backend/app/services/llm_service.py`, `services/category_service.py`, `services/category_hint_service.py`, `services/category_mapping_service.py`, `services/expense_context_detector.py`, `services/prompts.py`
- `frontend/src/pages/TransactionList.tsx`, `pages/ExpenseForm.tsx`, `pages/ExpenseDetail.tsx`, `pages/IncomeForm.tsx`, `pages/IncomeDetail.tsx`, `pages/CategoryManager.tsx`
- `frontend/src/components/MiniCalendar.tsx`, `components/TransactionItem.tsx`, `components/CategoryBottomSheet.tsx`
- `frontend/src/api/expenses.ts`, `api/income.ts`, `api/categories.ts`, `api/chat.ts`

**체크리스트:**
- [ ] 금액 필드가 Numeric(12,2)로 정확하게 처리되는가
- [ ] LLM 프롬프트에 사용자 입력이 안전하게 이스케이프되는가
- [ ] household_id 기반 데이터 격리가 모든 CRUD에 적용되는가
- [ ] 음수 금액, 0원, 극단적 큰 금액 등 엣지 케이스 처리
- [ ] 카테고리 삭제 시 연관 거래 처리
- [ ] 날짜 범위 쿼리에 timezone 이슈 없는가

**Step 1: code-reviewer 에이전트로 리뷰**

프롬프트 패턴은 Task 1과 동일. 집중 관점:
1. 보안: LLM 프롬프트 인젝션, SQL 인젝션(ORM이지만 raw query 확인), household_id 격리 누락
2. 버그: 금액 정확도, 날짜 처리, null 체크, 에러 핸들링

**Step 2: 리포트 저장** → `docs/reviews/R1-B2-transactions.md`

---

### Task 3: R1-B3 가구/멤버/초대/관리 (보안+버그)

**리뷰 대상:**
- `backend/app/api/households.py`, `api/invitations.py`, `api/onboarding.py`, `api/admin.py`
- `backend/app/models/household.py`, `models/household_member.py`, `models/household_invitation.py`, `models/user.py`
- `backend/app/schemas/household.py`, `schemas/onboarding.py`, `schemas/admin.py`
- `backend/app/services/admin_service.py`, `services/email_service.py`
- `frontend/src/pages/HouseholdListPage.tsx`, `pages/HouseholdDetailPage.tsx`, `pages/OnboardingPage.tsx`, `pages/AcceptInvitationPage.tsx`, `pages/InvitationListPage.tsx`, `pages/AdminPage.tsx`
- `frontend/src/components/CreateHouseholdModal.tsx`, `components/InviteMemberModal.tsx`
- `frontend/src/api/households.ts`, `api/onboarding.ts`, `api/admin.ts`
- `frontend/src/stores/useHouseholdStore.ts`

**체크리스트:**
- [ ] owner만 할 수 있는 작업(멤버 삭제, 가구 삭제)에 권한 검증
- [ ] 초대 토큰이 충분히 랜덤하고 만료 처리되는가
- [ ] admin 엔드포인트에 admin 권한 검증
- [ ] 타인의 가구 데이터에 접근 불가한가
- [ ] 이메일 발송 시 injection 방지

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R1-B3-household.md`

---

### Task 4: R1-B4 부가 기능 (보안+버그)

**리뷰 대상:**
- `backend/app/api/recurring.py`, `api/budget.py`, `api/insights.py`, `api/assets.py`, `api/feedback.py`
- `backend/app/models/recurring_transaction.py`, `models/budget.py`, `models/asset.py`, `models/asset_goal.py`, `models/asset_snapshot.py`, `models/feedback.py`
- `backend/app/schemas/recurring_transaction.py`, `schemas/budget.py`, `schemas/insights.py`, `schemas/asset.py`, `schemas/asset_goal.py`, `schemas/feedback.py`
- `backend/app/services/recurring_service.py`, `services/asset_service.py`, `services/asset_goal_service.py`, `services/asset_parse_service.py`, `services/price_service.py`, `services/exchange_rate.py`
- `frontend/src/pages/RecurringList.tsx`, `pages/BudgetManager.tsx`, `pages/InsightsPage.tsx`, `pages/AssetDashboard.tsx`, `pages/AssetForm.tsx`, `pages/FeedbackPage.tsx`
- `frontend/src/components/PendingRecurring.tsx`, `components/RegisterRecurringModal.tsx`
- `frontend/src/components/stats/*.tsx`
- `frontend/src/api/recurring.ts`, `api/budgets.ts`, `api/insights.ts`, `api/assets.ts`, `api/feedback.ts`

**체크리스트:**
- [ ] 정기거래 실행 시 중복 실행 방지 (멱등성)
- [ ] 외부 API(환율, 시세) 실패 시 fallback 처리
- [ ] 자산 금액 계산 정확도 (소수점, 환율 적용)
- [ ] 예산 초과 계산 로직 정확성
- [ ] household_id 격리 일관성

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R1-B4-features.md`

---

### Task 5: R1-B5 프론트엔드 공통 레이어 (보안+버그)

**리뷰 대상:**
- `frontend/src/App.tsx`, `main.tsx`, `index.css`
- `frontend/src/components/Layout.tsx`, `components/FloatingActionButton.tsx`, `components/EmptyState.tsx`, `components/ErrorState.tsx`, `components/LoadingSpinner.tsx`, `components/PullToRefresh.tsx`, `components/Toast.tsx`
- `frontend/src/contexts/ThemeContext.tsx`, `contexts/ToastContext.tsx`
- `frontend/src/hooks/*.ts`, `utils/*.ts`, `types/*.ts`

**체크리스트:**
- [ ] XSS: dangerouslySetInnerHTML 사용 여부
- [ ] 라우트 보호: 인증되지 않은 사용자가 접근 가능한 경로
- [ ] 타입 정의와 실제 API 응답 간 불일치
- [ ] 유틸리티 함수 엣지 케이스 (0, null, undefined, 빈 배열)

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R1-B5-frontend-common.md`

---

### Task 6: R1-B6 봇/외부 연동 (보안+버그)

**리뷰 대상:**
- `backend/app/api/telegram.py`, `api/kakao.py`, `api/webhooks.py`, `api/accounts.py`
- `backend/app/models/account.py`
- `backend/app/schemas/account.py`
- `backend/app/services/bot_messages.py`, `services/bot_user_service.py`, `services/account_service.py`
- `frontend/src/pages/SettingsPage.tsx`, `pages/AccountManager.tsx`
- `frontend/src/api/telegram.ts`, `api/kakao.ts`, `api/accounts.ts`

**체크리스트:**
- [ ] 웹훅 요청의 출처 검증 (텔레그램 시크릿 토큰 등)
- [ ] 봇 명령어를 통한 인젝션 가능성
- [ ] 텔레그램 계정 연동 코드의 보안 (추측 불가, 만료)
- [ ] 외부 API 실패 시 에러 처리

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R1-B6-bot-external.md`

---

### Task 7: R1-B7 인프라/테스트/설정 (보안+버그)

**리뷰 대상:**
- `docker-compose.yml`, `docker-compose.dev.yml` (있으면)
- `backend/fly.toml`, `backend/fly.dev.toml`
- `.github/workflows/*.yml`
- `frontend/vite.config.ts`
- `backend/pyproject.toml`
- `backend/alembic/` (migration 파일들)
- `backend/tests/conftest.py`

**체크리스트:**
- [ ] CI/CD 시크릿이 안전하게 관리되는가
- [ ] Docker 이미지에 불필요한 파일/시크릿 포함 여부
- [ ] GitHub Actions에서 third-party 액션 버전 고정
- [ ] Alembic 마이그레이션 downgrade 구현 여부
- [ ] 테스트 fixture에서 시크릿 하드코딩 여부

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R1-B7-infra.md`

---

### Task 8: R1 이슈 등록

**Step 1: R1 리포트 취합**

`docs/reviews/R1-*.md` 파일 7개를 읽고 발견 사항을 취합한다.

**Step 2: GitHub 이슈 일괄 생성**

발견 사항마다 이슈 생성:
```bash
gh issue create \
  --title "[코드리뷰] 보안: 문제 설명" \
  --label "code-review,P0: critical" \
  --body "$(cat <<'EOF'
## 문제
구체적 설명

## 위치
- `파일명:라인번호`

## 영향
이 문제가 발생하면...

## 제안 수정 방향
...

---
📋 발견: 종합 코드 리뷰 R1 (보안+버그)
EOF
)"
```

**Step 3: 프로젝트 보드에 이슈 배치**

```bash
# 이슈를 프로젝트에 추가
gh project item-add 1 --owner yyong-brs --url <issue-url>

# Critical/High → Todo, Medium/Low → Backlog
```

**Step 4: 커밋**

```bash
git add docs/reviews/R1-*.md
git commit -m "docs: 코드 리뷰 R1(보안+버그) 리포트 추가"
```

---

## 라운드 2: 성능 + 아키텍처

> 초점: N+1 쿼리, 리렌더링, 번들 사이즈, DB 인덱스, BE↔FE 불일치, 레이어 위반
> 이전 라운드에서 발견된 내용은 스킵

### Task 9: R2-B1 인증/보안 레이어 (성능+아키텍처)

**리뷰 대상:** Task 1과 동일 파일

**체크리스트:**
- [ ] JWT 검증이 매 요청마다 DB 조회하는가 (캐시 가능?)
- [ ] rate limiter가 메모리 기반이면 멀티 인스턴스에서 동작하는가
- [ ] AuthContext에서 불필요한 리렌더링 유발하는가
- [ ] 인증 관련 코드가 아키텍처 레이어를 위반하는가

**Step 1: code-reviewer 에이전트로 리뷰 (성능+아키텍처 관점)**
**Step 2: 리포트 저장** → `docs/reviews/R2-B1-auth-security.md`

---

### Task 10: R2-B2 거래 핵심 (성능+아키텍처)

**리뷰 대상:** Task 2와 동일 파일

**체크리스트:**
- [ ] 거래 목록 조회 시 N+1 쿼리 (카테고리 join)
- [ ] TransactionList 리렌더링 최적화 (memo, useMemo)
- [ ] LLM 호출 타임아웃/재시도 전략
- [ ] BE↔FE 스키마 불일치 (필드명, 타입)
- [ ] 불필요한 API 호출 (같은 데이터 중복 fetch)

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R2-B2-transactions.md`

---

### Task 11: R2-B3 가구/멤버/초대/관리 (성능+아키텍처)

**리뷰 대상:** Task 3과 동일 파일

**체크리스트:**
- [ ] 가구 목록/상세 조회 시 N+1 (멤버, 초대)
- [ ] useHouseholdStore 구독 범위 최적화
- [ ] 불필요한 상태 중복 (store vs local state)
- [ ] 초대 수락 플로우의 아키텍처 일관성

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R2-B3-household.md`

---

### Task 12: R2-B4 부가 기능 (성능+아키텍처)

**리뷰 대상:** Task 4와 동일 파일

**체크리스트:**
- [ ] 인사이트 페이지 API 호출 수 (한 번에 여러 개?)
- [ ] 자산 시세 조회 캐싱 전략
- [ ] 환율 API 호출 빈도/캐싱
- [ ] stats 컴포넌트 리렌더링 최적화
- [ ] 정기거래 서비스와 API 레이어 책임 분리

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R2-B4-features.md`

---

### Task 13: R2-B5 프론트엔드 공통 레이어 (성능+아키텍처)

**리뷰 대상:** Task 5와 동일 파일

**체크리스트:**
- [ ] lazy import가 적절하게 사용되는가
- [ ] 번들 사이즈 최적화 (tree-shaking, dynamic import)
- [ ] Context provider nesting depth
- [ ] 타입 정의 구조 (중복, barrel export)
- [ ] CSS 사용량 (unused classes)

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R2-B5-frontend-common.md`

---

### Task 14: R2-B6 봇/외부 연동 (성능+아키텍처)

**리뷰 대상:** Task 6과 동일 파일

**체크리스트:**
- [ ] 봇 메시지 처리 응답 시간
- [ ] 외부 API 호출 타임아웃/서킷 브레이커
- [ ] 봇 서비스와 API 레이어 책임 분리
- [ ] 계좌 연동 아키텍처 확장성

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R2-B6-bot-external.md`

---

### Task 15: R2-B7 인프라/테스트/설정 (성능+아키텍처)

**리뷰 대상:** Task 7과 동일 파일

**체크리스트:**
- [ ] Docker 빌드 캐시 최적화
- [ ] CI 파이프라인 실행 시간 최적화
- [ ] Fly.io 설정 (auto-scaling, health check)
- [ ] Vite 빌드 설정 (chunk splitting, 압축)
- [ ] DB 마이그레이션 실행 속도

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R2-B7-infra.md`

---

### Task 16: R2 이슈 등록

Task 8과 동일 패턴. R2 리포트 취합 → 이슈 생성 → 프로젝트 보드 배치.

```bash
git add docs/reviews/R2-*.md
git commit -m "docs: 코드 리뷰 R2(성능+아키텍처) 리포트 추가"
```

---

## 라운드 3: 코드 품질 + 테스트

> 초점: 중복 코드, 컨벤션 위반, 미사용 코드, 커버리지 갭, 테스트 품질
> 이전 라운드에서 발견된 내용은 스킵

### Task 17: R3-B1 인증/보안 레이어 (코드품질+테스트)

**리뷰 대상:** Task 1 파일 + 관련 테스트 파일
- `backend/tests/unit/test_auth.py`
- `backend/tests/integration/test_api_auth.py`
- `frontend/src/components/__tests__/ProtectedRoute.test.tsx`
- `frontend/src/api/__tests__/client.test.ts`, `auth.test.ts`

**체크리스트:**
- [ ] 테스트 커버리지 갭 (테스트되지 않는 경로)
- [ ] 테스트 품질 (assertion 충분성, 엣지 케이스)
- [ ] 코드 중복 (BE↔FE 간 로직 중복 포함)
- [ ] 네이밍 컨벤션 준수

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R3-B1-auth-security.md`

---

### Task 18: R3-B2 거래 핵심 (코드품질+테스트)

**리뷰 대상:** Task 2 파일 + 관련 테스트 파일
- `backend/tests/integration/test_api_expenses.py`, `test_api_income.py`, `test_api_categories.py`, `test_api_chat.py`, `test_api_categories_extra.py`, `test_api_chat_extra.py`
- `backend/tests/unit/test_llm_service.py`, `test_category_service.py`, `test_category_hint_service.py`, `test_expense_context_detector.py`
- `frontend/src/pages/__tests__/TransactionList.test.tsx`, `ExpenseForm.test.tsx`, `ExpenseDetail.test.tsx`, `IncomeForm.test.tsx`, `IncomeDetail.test.tsx`, `CategoryManager.test.tsx`
- `frontend/src/components/__tests__/MiniCalendar.test.tsx`, `TransactionItem.test.tsx`
- `frontend/src/api/__tests__/expenses.test.ts`, `income.test.ts`, `categories.test.ts`, `chat.test.ts`

**체크리스트:**
- [ ] 테스트 커버리지 갭
- [ ] 중복 코드 (ExpenseForm ↔ IncomeForm 패턴 중복)
- [ ] 컨벤션 위반 (한국어/영어 혼용, 타입 선언 스타일)
- [ ] 미사용 import, 변수, 함수

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R3-B2-transactions.md`

---

### Task 19: R3-B3 가구/멤버/초대/관리 (코드품질+테스트)

**리뷰 대상:** Task 3 파일 + 관련 테스트 파일
- `backend/tests/integration/test_api_households.py`, `test_data_isolation.py`
- `frontend/src/pages/__tests__/HouseholdDetailPage.test.tsx`, `HouseholdListPage.test.tsx`, `AcceptInvitationPage.test.tsx`, `InvitationListPage.test.tsx`
- `frontend/src/components/__tests__/CreateHouseholdModal.test.tsx`, `InviteMemberModal.test.tsx`
- `frontend/src/stores/__tests__/useHouseholdStore.test.ts`

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R3-B3-household.md`

---

### Task 20: R3-B4 부가 기능 (코드품질+테스트)

**리뷰 대상:** Task 4 파일 + 관련 테스트 파일
- `backend/tests/integration/test_api_recurring.py`, `test_api_budget.py`, `test_api_budget_bulk.py`, `test_api_budget_extra.py`, `test_api_insights.py`, `test_api_stats.py`
- `backend/tests/test_assets.py`, `test_asset_goal.py`, `test_insights_comprehensive.py`, `test_api_feedback.py`
- `backend/tests/unit/test_recurring_service.py`
- `frontend/src/pages/__tests__/RecurringList.test.tsx`, `BudgetManager.test.tsx`, `InsightsPage.test.tsx`, `FeedbackPage.test.tsx`
- `frontend/src/__tests__/AssetDashboard.test.tsx`, `AssetForm.test.tsx`
- `frontend/src/components/stats/__tests__/*.test.tsx`

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R3-B4-features.md`

---

### Task 21: R3-B5 프론트엔드 공통 레이어 (코드품질+테스트)

**리뷰 대상:** Task 5 파일 + 관련 테스트 파일
- `frontend/src/components/__tests__/EmptyState.test.tsx`, `ErrorState.test.tsx`, `FloatingActionButton.test.tsx`, `Layout.test.tsx`, `PullToRefresh.test.tsx`, `Toast.test.tsx`
- `frontend/src/hooks/__tests__/useChangelog.test.ts`
- `frontend/src/utils/__tests__/calendar.test.ts`, `format.test.ts`, `healthScore.test.ts`
- `frontend/src/data/__tests__/changelogs.test.ts`

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R3-B5-frontend-common.md`

---

### Task 22: R3-B6 봇/외부 연동 (코드품질+테스트)

**리뷰 대상:** Task 6 파일 + 관련 테스트 파일
- `backend/tests/integration/test_api_telegram.py`, `test_api_telegram_link.py`, `test_api_kakao.py`, `test_api_kakao_link.py`, `test_api_webhooks.py`, `test_api_accounts.py`
- `backend/tests/unit/test_bot_messages.py`, `test_bot_messages_extra.py`, `test_bot_user_service.py`, `test_bot_unknown_migration.py`
- `frontend/src/pages/__tests__/SettingsPage.test.tsx`

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R3-B6-bot-external.md`

---

### Task 23: R3-B7 인프라/테스트/설정 (코드품질+테스트)

**리뷰 대상:** Task 7 파일 + 테스트 인프라
- `backend/tests/conftest.py`
- `frontend/src/__tests__/setup.ts`
- `frontend/src/mocks/server.ts`, `handlers.ts`, `fixtures.ts`
- 전체 테스트 커버리지 분석

**체크리스트:**
- [ ] conftest.py fixture 중복/복잡도
- [ ] MSW handler 누락 (테스트되지 않는 API)
- [ ] mock fixture 데이터 현실성
- [ ] CI 워크플로우 코드 중복

**Step 1: code-reviewer 에이전트로 리뷰**
**Step 2: 리포트 저장** → `docs/reviews/R3-B7-infra.md`

---

### Task 24: R3 이슈 등록 + 최종 정리

**Step 1: R3 리포트 취합 → 이슈 생성 → 프로젝트 보드 배치**

Task 8/16과 동일 패턴.

**Step 2: 전체 리뷰 요약 작성**

`docs/reviews/SUMMARY.md`에 3라운드 전체 요약:
- 라운드별 발견 건수/심각도 분포
- 도메인별 이슈 분포
- 우선 수정 권장 목록 (Critical → High)

**Step 3: 커밋**

```bash
git add docs/reviews/
git commit -m "docs: 코드 리뷰 R3(코드품질+테스트) 리포트 및 최종 요약 추가"
```

---

## 실행 참고사항

- 각 배치(Task 1~7, 9~15, 17~23)는 **code-reviewer 에이전트**로 실행
- 이슈 등록 태스크(Task 8, 16, 24)는 **메인 세션**에서 직접 실행
- 이전 라운드에서 이미 발견된 이슈는 중복 보고하지 않음
- 리뷰 중 즉시 수정이 필요한 Critical 이슈 발견 시 별도 표시하되, 이 계획에서는 수정하지 않음

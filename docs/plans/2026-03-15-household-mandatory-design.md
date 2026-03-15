# 가구(Household) 필수화 리팩토링 — Design Document

## 배경

현재 포도가계부는 데이터 소유권이 이중 스코프(user_id OR household_id)로 되어 있다. `household_id`가 모든 모델에서 nullable이라 개인/가구 데이터가 혼재하고, 가구 없이도 데이터를 만들 수 있다. 인사이트 API는 household_id를 아예 무시하는 버그도 있다.

## 목표

모든 유저가 반드시 하나 이상의 가구에 소속되고, 모든 데이터(지출, 수입, 자산, 예산, 목표, 리포트)가 가구 기반으로 동작하도록 통일한다.

## 핵심 결정

| 항목 | 결정 |
|------|------|
| 기존 NULL 데이터 처리 | 마이그레이션으로 자동 할당. 가구 없는 유저에게 기본 가구 생성 |
| 여러 가구 전환 | 유지 (현재 드롭다운 UI 그대로) |
| 온보딩 | 전용 `/onboarding` 페이지. 가구 생성 또는 초대 수락 |
| user_id 필드 | 유지 — "누가 입력했는지" 기록 + 멤버별 필터링 |
| DB 제약 | NOT NULL 마이그레이션 적용 |
| 기본 가구 이름 | "{username}님의 가계부" |

## 현재 상태

### 데이터 소유권 (모든 모델에서 household_id nullable)

| 모델 | household_id | user_id | 비고 |
|------|-------------|---------|------|
| Expense | nullable | nullable | 개인/가구 혼재 |
| Income | nullable | required | 동일 |
| Budget | nullable | nullable | scope filter로 분기 |
| Asset | nullable | required (created_by) | 동일 |
| AssetSnapshot | nullable | required | 동일 |
| AssetGoal | nullable | required | 동일 |

### API 필터링 패턴

```
household_id 있으면 → household 기준 조회 (멤버 검증)
없으면 → user_id 기준 조회 (개인 데이터)
```

### 문제점

1. 인사이트 API가 household_id를 무시 (user_id로만 필터)
2. 온보딩 플로우 없음 — 가구 0개 상태 허용
3. 프론트엔드 전체에 `activeHouseholdId ?? undefined` 분기 산재
4. 채팅 서비스에 3단계 household_id fallback 로직

## 구현 계획 (3 Phase)

### Phase 1: 데이터 정비 (백엔드 마이그레이션)

1. **Alembic 마이그레이션:**
   - `users` 테이블 순회, 가구 미소속 유저 찾기
   - 해당 유저에게 "{username}님의 가계부" 가구 생성 + owner로 멤버 등록
   - 각 테이블에서 `household_id=NULL` 레코드 → 해당 유저의 기본 가구로 UPDATE
   - 대상 테이블: expenses, incomes, budgets, assets, asset_snapshots, asset_goals
   - `household_id` 컬럼에 NOT NULL 제약 추가

2. **마이그레이션 순서:**
   ```
   기본 가구 생성 → NULL 데이터 이전 → NOT NULL 제약 추가
   ```

### Phase 2: API + 서비스 로직 변경 (백엔드)

1. **API 변경:**
   - expenses, income, budgets, assets API에서 household_id 필수화
   - `get_user_active_household_id()` fallback은 유지 (프론트가 안 보내면 기본 가구 사용)
   - 인사이트 API에 household_id 지원 추가 (현재 user_id 전용 → household_id 기반으로)

2. **서비스 로직 정리:**
   - `_budget_scope_filter()` NULL 분기 제거
   - `resolve_household_id()` 간소화
   - 인사이트 서비스에서 household_id 기반 필터

3. **온보딩 엔드포인트:**
   - `GET /api/onboarding/status` — 가구 소속 여부 확인
   - `POST /api/onboarding/create-household` — 기본 가구 생성

### Phase 3: 프론트엔드

1. **온보딩 페이지 (`/onboarding`):**
   - `ProtectedRoute`에서 가구 0개이면 `/onboarding`으로 리디렉션
   - 선택지: "새 가계부 만들기" / "초대받은 가계부 참여"
   - 완료 후 `/`로 이동

2. **코드 정리:**
   - `activeHouseholdId`가 항상 존재한다고 가정
   - API 호출에서 항상 `household_id` 포함
   - `?? undefined`, `?? null` 분기 코드 제거
   - Layout의 "가계부를 만들어주세요" 분기 제거 (온보딩에서 처리)

## 영향 범위

### 백엔드 변경 파일
- `backend/alembic/versions/` — 새 마이그레이션
- `backend/app/api/expenses.py` — household_id 필수화
- `backend/app/api/income.py` — 동일
- `backend/app/api/budget.py` — 동일
- `backend/app/api/assets.py` — 동일
- `backend/app/api/insights.py` — household_id 지원 추가
- `backend/app/api/dependencies.py` — NULL 분기 정리
- `backend/app/services/asset_service.py` — 동일
- `backend/app/services/asset_goal_service.py` — 동일
- 새 파일: `backend/app/api/onboarding.py`

### 프론트엔드 변경 파일
- 새 파일: `frontend/src/pages/OnboardingPage.tsx`
- `frontend/src/components/ProtectedRoute.tsx` — 온보딩 리디렉션
- `frontend/src/stores/useHouseholdStore.ts` — null 허용 제거
- `frontend/src/pages/TransactionList.tsx` — household_id 항상 전달
- `frontend/src/pages/AssetDashboard.tsx` — 동일
- `frontend/src/pages/InsightsPage.tsx` — 동일
- `frontend/src/components/Layout.tsx` — 가구 없음 분기 제거
- `frontend/src/App.tsx` — /onboarding 라우트 추가

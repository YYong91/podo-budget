# podo-budget 전체 코드 리뷰 결과

> **날짜**: 2026-03-11
> **범위**: backend/ + frontend/ 전체 (65+ Python, 60+ TSX 파일)
> **검증**: 1차 에이전트 리뷰 → 2차 시니어 수동 검증 완료. False positive 10건 제거.

---

## 요약

| 심각도 | 건수 | 핵심 |
|--------|------|------|
| 실제 버그 | 2 | 외화 응답 금액 오류, 의존성 CVE |
| 성능 | 2 | N+1 쿼리, 연간 통계 다중 쿼리 |
| 접근성/UX | 5 | 모달 a11y, label 연결, 스크롤 차단, 터치 타겟, 더블 서브밋 |
| 인프라 | 3 | Docker root, Nginx CSP, 의존성 업데이트 |
| 코드 품질 | ~10 | 코드 중복, 타입 불일치, 테스트 누락 |

### ⚠️ 1차 리뷰에서 제거된 False Positive (10건)

에이전트가 코드를 잘못 읽거나 이미 수정된 내용을 문제로 보고한 항목들:

| 원래 ID | 주장 | 실제 |
|---------|------|------|
| C1 | python-jose 사용 중 | `import jwt` + PyJWT 이미 적용 완료 |
| C2 | /api/assets/search 인증 없음 | `Depends(get_current_user)` 있음 |
| C3 | household 멤버십 미검증 | `get_household_member()` 호출 있음 |
| C4 | Object URL revoke 안 함 | `revokeObjectURL()` ref 패턴으로 처리됨 |
| C5 | 페이지네이션 로직 오류 | `expenses.length < 20 && incomes.length < 20` 정상 |
| C6 | 계좌 삭제 confirm 없음 | `confirm()` 있음 |
| C7 | FK ondelete 누락 | 4개 모델 모두 `ondelete="SET NULL"` 있음 |
| C8 | PUT/PATCH 불일치 | `apiClient.patch()` 올바르게 사용 |
| I1 | Webhook 무인증 수락 | 프로덕션에서 503 차단 구현됨 |
| I5 | DB rollback 없음 | `except: await session.rollback()` 있음 |

---

## 실제 버그 (확인됨)

### B1. 외화 지출 응답 메시지에 변환 전 금액 표시
- **파일**: `backend/app/api/chat.py:221`
- **설명**: `sum(item["amount"] for item in items)` — 루프에서 `amount` 지역변수만 변환하고 `item["amount"]`는 원본 유지. DB에는 KRW 저장되지만 응답 메시지는 외화 금액으로 합산
- **수정**: 변환된 금액 리스트를 따로 추적하거나 `item["amount"]` 자체를 변환

### B2. python-multipart==0.0.6 CVE-2024-24762 (DoS)
- **파일**: `pyproject.toml:15`
- **설명**: 알려진 DoS 취약점. FastAPI의 파일 업로드 의존
- **수정**: `python-multipart>=0.0.7`로 업데이트

---

## 성능 (확인됨)

### P1. 예산 알림 N+1 쿼리 (2N+1회)
- **파일**: `backend/app/api/budget.py:166-213`
- **설명**: `for budget in budgets:` 루프 안에서 Category 개별 SELECT (line 178) + Expense SUM 개별 SELECT (line 183). 예산 10개 = 21회 쿼리
- **수정**: Category `id.in_()` 배치 로드 + `GROUP BY category_id` SUM 단일 쿼리

### P2. 연간 통계 비교 24+회 순차 쿼리
- **파일**: `backend/app/api/expenses.py:380-394`
- **설명**: `_month_total()` 을 12개월 × 2년 = 24회 개별 호출 + 트렌드용 추가 호출
- **수정**: `GROUP BY year, month` 단일 쿼리로 통합

---

## 접근성/UX (확인됨)

### A1. 모달 focus trap / ESC / ARIA 없음
- **파일**: CategoryManager, ExpenseDetail, CreateHouseholdModal, InviteMemberModal, RecurringList, RegisterRecurringModal
- **설명**: `role="dialog"`, `aria-modal`, focus trap, ESC 닫기 모두 미구현. grep 결과 0건
- **수정**: 공유 Modal 래퍼 컴포넌트로 통합

### A2. Form label-input htmlFor/id 미연결
- **파일**: ExpenseForm, IncomeForm, ExpenseDetail, RecurringList, BudgetManager
- **설명**: `htmlFor` grep 결과 0건 (ExpenseForm 기준). 스크린리더 label↔input 연결 불가
- **수정**: 모든 label-input 쌍에 htmlFor/id 추가

### A3. 모바일 사이드바/모달 배경 스크롤 미차단
- **파일**: `frontend/src/components/Layout.tsx`, 모든 모달
- **설명**: overlay 위에서도 배경 콘텐츠 스크롤 가능
- **수정**: open 시 `document.body.style.overflow = 'hidden'`

### A4. 모바일 터치 타겟 44px 미만
- **파일**: Layout.tsx(사이드바 닫기 `p-1.5`), RecurringList(카드 액션 `p-1`), CategoryManager(정렬 `p-0.5`), AccountManager(삭제 `p-1.5`)
- **설명**: 최소 권장 44px 미만. 파괴적 액션에서 미스탭 위험
- **수정**: 패딩 증가

### A5. 더블 서브밋 가드 부분적 누락
- **파일**: CategoryManager(handleAdd), ExpenseDetail(handleDelete), RecurringList(handleDelete)
- **설명**: loading/disabled 상태 없이 비동기 작업 실행. 빠른 더블클릭으로 중복 요청 가능
- **수정**: isSubmitting 가드 또는 useRef 가드 추가 (미검증 — 실제 코드 확인 필요)

---

## 인프라 (확인됨)

### F1. Docker 컨테이너 root 실행
- **파일**: `backend/Dockerfile`
- **설명**: USER directive 없음. 개인 프로젝트에서 실질적 리스크는 낮지만 best practice 위반
- **수정**: `adduser` + `USER appuser`

### F2. Nginx CSP connect-src 불일치
- **파일**: `frontend/nginx.conf:52`
- **설명**: Cloudflare _headers에는 fly.dev + auth.podonest.com 포함하지만 Nginx에는 없음
- **수정**: 동기화 (Docker 로컬 사용 시에만 영향)

### F3. 핵심 의존성 고정 버전 (2023-2024)
- **파일**: `pyproject.toml`
- **설명**: fastapi==0.109.0, sqlalchemy==2.0.25, pydantic==2.5.3 등. 보안 패치 미포함 가능
- **수정**: `uv lock --upgrade` 후 테스트

---

## 코드 품질/리팩토링 (미검증 — 구조상 가능성 높음)

### Q1. formatAmount 함수 다수 파일에 중복
- TransactionList, CategoryBreakdown, ComparisonChart, TrendChart, UnifiedSummaryCards 등
- **수정**: `src/utils/format.ts`로 추출

### Q2. DATE_PRESETS 중복
- TransactionList, ExpenseList, IncomeList
- **수정**: `src/utils/datePresets.ts`로 추출

### Q3. 날짜 유틸 함수 backend expenses↔income 중복
- `backend/app/api/expenses.py`, `income.py`
- **수정**: `app/core/date_utils.py`로 추출

### Q4. household 유틸 함수 3파일 중복
- HouseholdListPage, HouseholdDetailPage, InvitationListPage
- **수정**: `src/utils/household.ts`로 추출

### Q5. 빈 import type { } from 'react'
- Layout, CreateHouseholdModal, InviteMemberModal 등 7개 파일
- **수정**: 제거

### Q6. Toast 라이브러리 혼용
- SettingsPage, InsightsPage만 `react-hot-toast` 직접 import, 나머지는 커스텀 `useToast`
- **수정**: 하나로 통일 (미검증)

### Q7. Frontend 타입 불일치 (미검증)
- ParsedExpenseItem 환율 필드 누락, AcceptInvitationResponse 필드 부족, Budget alert_threshold nullable 불일치
- **수정**: 백엔드 스키마와 동기화

### Q8. response_model 누락 엔드포인트
- insights/generate, expenses/stats/monthly, recurring/skip
- **수정**: Pydantic response schema 정의

### Q9. 테스트 누락 (미검증)
- AuthCallbackPage, TransactionList, HouseholdDetailPage, AccountManager, price_service, account_service, exclude_from_stats 동작
- bulk budget 테스트 4개 CI에서 --ignore 처리 중

### Q10. 기타 접근성 (미검증)
- 커스텀 토글 `role="switch"` 없음, 아이콘 전용 링크 aria-label 없음, household 드롭다운 ARIA 없음, FAB 메뉴 role 없음
- Alembic 마이그레이션 batch/non-batch 혼용
- docker-compose.yml 미사용 named volume
- useEffect 의존성 eslint-disable

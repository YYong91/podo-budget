# 월간 결산 리포트 설계 문서

작성일: 2026-04-26
상태: 설계 확정

---

## 배경 및 목표

### 문제

기존 AI 분석은 사용자가 "분석하기" 버튼을 누를 때만 실행되고, 결과가 로컬 state에만 저장되어 페이지 이탈 시 사라진다. 이는 두 가지 문제를 만든다:

1. **재분석 피로**: 같은 달 데이터를 볼 때마다 몇 초를 기다려야 함
2. **일회성 소비**: 리포트가 쌓이지 않아 시계열 비교가 불가능함

### 가계부 도메인 통찰

가계부는 **월말 마감 사이클**로 움직인다. 월급, 카드값, 공과금이 모두 월 단위이므로 월 중간 분석은 미완성 데이터다. 진짜 의미 있는 분석은 마감 후, 즉 **다음 달 초**다.

이 도메인 특성을 살리면 수동 트리거가 불필요해진다. 마감된 달의 데이터는 고정되므로 **매월 1일 자동 생성**이 정확하고 자연스럽다.

### 단계별 로드맵

```
단계 1 (현재): 월간 결산 리포트 자동 생성 + 앱 내 표시
  → 사용자가 아무것도 안 해도 매달 리포트가 쌓임

단계 2 (다음): 이전 리포트 컨텍스트 활용 + 리포트 컬렉션 뷰
  → "지난달에 식비 줄이자 했는데 이번달도 또 늘었네요" 연속성
  → 잡지 컬렉션처럼 시간순 카드 그리드

단계 3 (이후): 이메일 뉴스레터 자동 발송
  → 매월 1일 새벽 생성된 리포트를 오전에 이메일로 발송
  → 이미 자동 생성 인프라가 있으므로 발송 채널만 추가
  → 유료 플랜 진입점
```

단계 3을 전제로 설계한다. 특히 리포트 상세 화면의 딥링크(`/insights/reports/:month`)는 단계 3 이메일의 "앱에서 보기" 목적지가 된다.

---

## 아키텍처 개요

```
[Supabase pg_cron] (매월 1일 03:00 KST = 전날 18:00 UTC)
        │ HTTP POST + HMAC 서명
        ▼
[POST /api/internal/reports/generate-monthly]
        │
        ├─ HMAC 검증
        ├─ 자격 통과 가구 조회 (단일 SQL)
        ├─ pending row 일괄 INSERT (ON CONFLICT DO NOTHING)
        ├─ 즉시 응답 (200 OK) ← webhook 타임아웃 방지
        │
        └─ BackgroundTasks: process_pending_reports(month)
                │
                ├─ recover_stale_processing()  ← 좀비 row 복구
                ├─ Semaphore(5) 동시 LLM 호출 제한
                │
                ├─ pick_next_pending() [SKIP LOCKED] → status='processing'
                ├─ build_report_data() ← 백엔드 직접 집계
                ├─ format_insights_data_for_llm()
                ├─ llm.generate_comprehensive_insights_v2()  30초 timeout
                └─ mark_completed() or mark_failed()

[사용자 조회]
GET /api/reports/monthly?month=YYYY-MM
GET /api/reports/latest
        │
        └─ status별 분기 응답 (pending / completed / failed / 404)
```

---

## 데이터 모델

### `MonthlyReport` 테이블

```python
class MonthlyReport(Base):
    __tablename__ = "monthly_reports"

    id: Mapped[int] = mapped_column(primary_key=True)

    # ── 식별 ──
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    month: Mapped[str] = mapped_column(
        String(7), nullable=False,
        comment="YYYY-MM 형식 (예: 2026-04)",
    )

    # ── 상태 머신 ──
    status: Mapped[str] = mapped_column(
        String(15), nullable=False, default="pending",
        comment="pending | processing | completed | failed",
    )
    attempt_count: Mapped[int] = mapped_column(
        default=0, nullable=False,
        comment="LLM 호출 시도 횟수. 0=Phase 1 완료, 1+=Phase 2 시도",
    )
    last_error: Mapped[str | None] = mapped_column(
        String(2000), nullable=True,
        comment="마지막 실패 사유 (2000자 truncate)",
    )
    trigger_source: Mapped[str] = mapped_column(
        String(15), nullable=False, default="auto",
        comment="auto | admin | retry",
    )

    # ── 데이터 스냅샷 ──
    report_data: Mapped[dict] = mapped_column(
        JSON, nullable=False,
        comment="분석 시점의 입력 스냅샷 (ComprehensiveInsightsRequest 구조). "
                "이후 거래 추가/수정과 무관하게 리포트는 이 시점 데이터 기준.",
    )
    insights: Mapped[dict | None] = mapped_column(
        JSON, nullable=True,
        comment="LLM 출력 (StructuredInsightsResponse 구조). completed 시에만 채워짐.",
    )
    insights_version: Mapped[int] = mapped_column(
        default=1, nullable=False,
        comment="LLM 출력 스키마 버전. 스키마 변경 시 증가. 하위 호환 처리 기준.",
    )

    # ── 메타 ──
    llm_tokens_used: Mapped[int | None] = mapped_column(nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(),
        server_default=func.now(), nullable=False,
    )

    household: Mapped["Household"] = relationship(back_populates="monthly_reports")

    __table_args__ = (
        UniqueConstraint(
            "household_id", "month",
            name="uq_monthly_report_household_month",
        ),
        Index("ix_monthly_reports_month_status", "month", "status"),
        # cron 처리 시 (month, status) 조합 쿼리 최적화
    )
```

**설계 결정 근거**:
- `JSON` (not `JSONB`): 테스트 환경이 SQLite in-memory라 cross-dialect 호환 필요
- `report_data` 스냅샷: 리포트 생성 후 거래가 추가/수정돼도 리포트 내용 불변
- `insights_version`: LLM 출력 구조가 진화할 때 (단계 2 action_items 구조화 등) 하위 호환 처리 기준
- unique constraint가 인덱스 역할도 하므로 `(household_id, month)` 별도 인덱스 불필요

### Household 변경

```python
# models/household.py에 추가
monthly_reports: Mapped[list["MonthlyReport"]] = relationship(
    back_populates="household",
    cascade="all, delete-orphan",
)
```

---

## 자격 검증

### 임계값

리포트가 의미 있으려면 충분한 데이터와 개인화 컨텍스트가 필요하다.

| 조건 | 값 | 이유 |
|------|-----|------|
| HouseholdProfile Step 1 완료 | 필수 (INNER JOIN) | 개인화 없으면 일반론만 나옴 |
| 해당 월 거래 수 | ≥ 15건 | 미만이면 카테고리 패턴 분석 불가 |
| 해당 월 카테고리 수 | ≥ 3개 | 단일 카테고리는 비교 불가 |
| 해당 월 총 지출 | ≥ 200,000원 | 테스트 거래만 있는 경우 필터링 |

`exclude_from_stats=true` 거래는 집계에서 제외.

### 자격 검증 SQL

```python
async def find_eligible_households(
    db: AsyncSession, month: str
) -> list[int]:
    start, end = month_boundaries(month)  # (date(2026, 3, 1), date(2026, 4, 1))

    result = await db.execute(
        select(Household.id)
        .join(HouseholdProfile, HouseholdProfile.household_id == Household.id)
        # INNER JOIN: 프로필 없는 가구 자동 제외
        .outerjoin(
            Expense,
            and_(
                Expense.household_id == Household.id,
                Expense.date >= start,
                Expense.date < end,
                Expense.exclude_from_stats == False,  # noqa: E712
            ),
        )
        .group_by(Household.id)
        .having(
            func.count(Expense.id) >= 15,
            func.count(func.distinct(Expense.category_id)) >= 3,
            func.coalesce(func.sum(Expense.amount), 0) >= 200000,
        )
    )
    return [row[0] for row in result.all()]
```

---

## 백엔드 구현

### 디렉토리 구조

```
backend/app/
├── api/
│   ├── reports.py                 # 사용자 조회 (GET /reports/monthly, /reports/latest)
│   ├── admin/reports.py           # 관리자 (retry, manual-trigger)
│   └── internal/reports_webhook.py  # pg_cron webhook 수신
├── models/
│   └── monthly_report.py          # MonthlyReport 모델
├── schemas/
│   └── monthly_report.py          # 응답 스키마 + EligibilityResponse
├── services/
│   ├── report_eligibility.py      # 자격 검증 SQL
│   ├── report_data_builder.py     # 집계 로직 (핵심 신규 서비스)
│   ├── report_generator.py        # LLM 호출 + 상태 전이
│   └── report_scheduler.py        # Phase 1/2 오케스트레이션
└── core/
    └── webhook_auth.py            # HMAC 검증
```

### `report_data_builder.py` — 가장 큰 신규 작업

기존에 프론트엔드(`InsightsPage.tsx`)가 7~8개 API를 호출해 조립하던 데이터를 **백엔드에서 직접 집계**한다. 이것이 단계 1의 가장 큰 작업량이다.

집계해야 하는 필드 목록 (`ComprehensiveInsightsRequest` 기준):

```
income_total               # Income 테이블 합계
expense_total              # Expense 테이블 합계 (exclude_from_stats 제외)
top_expense_categories     # 카테고리별 합계 상위 5개 + 비율
budget                     # Budget 테이블 (설정된 경우)
savings_rate               # (income - expense) / income × 100
financial_score            # 4지표 계산 (savings_rate, budget_adherence, fixed_expense_ratio, spending_stability)
trend                      # 직전 3개월 income/expense 트렌드
savings_total              # Income 중 type='savings' 합계
recurring_total            # RecurringTransaction execute 금액 합계
previous_month_expense     # 전월 expense_total
previous_month_income      # 전월 income_total
```

> **이관 전략**: 기존 `generate-comprehensive` 엔드포인트가 받던 프론트 입력과 동일한 구조를 `report_data_builder.py`가 생성한다. 이 서비스를 기존 엔드포인트도 내부적으로 사용하도록 리팩토링하면 로직 중복이 제거된다. 단, 단계 1에서는 기존 엔드포인트 동작을 보존하면서 신규 서비스를 추가하는 방식으로 진행한다 (점진적 이관).

### Phase 1 — webhook 수신

```python
@router.post("/generate-monthly")
async def trigger_monthly_reports(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    verify_webhook_signature(request)  # HMAC 검증

    target_month = previous_month_kst()  # 직전 마감 월 (KST 기준)

    eligible_ids = await find_eligible_households(db, target_month)

    # 각 가구별 report_data 집계 + pending row 생성
    for household_id in eligible_ids:
        report_data = await build_report_data(db, household_id, target_month)
        await db.execute(
            insert(MonthlyReport)
            .values(
                household_id=household_id,
                month=target_month,
                status="pending",
                report_data=report_data,
                trigger_source="auto",
            )
            .on_conflict_do_nothing()
        )
    await db.commit()

    background_tasks.add_task(process_pending_reports, target_month)

    return {"queued": len(eligible_ids), "month": target_month}
```

### Phase 2 — 백그라운드 워커

```python
async def process_pending_reports(month: str) -> None:
    async with AsyncSessionLocal() as db:
        await recover_stale_processing(db, threshold_minutes=15)
        await db.commit()

    sem = asyncio.Semaphore(5)

    async def _process_one() -> None:
        async with sem:
            async with AsyncSessionLocal() as db:
                report = await pick_next_pending(db, month)
                if not report:
                    return
            await _run_llm(report)

    # 최대 처리 수 제한 (비용 안전장치)
    tasks = [asyncio.create_task(_process_one()) for _ in range(MAX_REPORTS_PER_RUN)]
    await asyncio.gather(*tasks)


async def pick_next_pending(db: AsyncSession, month: str) -> MonthlyReport | None:
    """SELECT FOR UPDATE SKIP LOCKED로 원자적 픽업"""
    report = await db.scalar(
        select(MonthlyReport)
        .where(
            MonthlyReport.month == month,
            MonthlyReport.status == "pending",
            MonthlyReport.attempt_count < 3,
        )
        .order_by(MonthlyReport.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if report:
        report.status = "processing"
        report.started_at = datetime.utcnow()
        report.attempt_count += 1
        await db.commit()
    return report
```

**참고**: `SELECT FOR UPDATE SKIP LOCKED`는 PostgreSQL 전용이므로 이 함수는 단위 테스트 대신 통합 테스트(PostgreSQL)로만 검증한다.

### 좀비 row 복구

```python
async def recover_stale_processing(
    db: AsyncSession, threshold_minutes: int = 15
) -> None:
    """processing 상태로 N분 이상 된 row를 pending으로 복구"""
    cutoff = datetime.utcnow() - timedelta(minutes=threshold_minutes)
    await db.execute(
        update(MonthlyReport)
        .where(
            MonthlyReport.status == "processing",
            MonthlyReport.started_at < cutoff,
        )
        .values(status="pending")
    )
```

Phase 2 시작 시 항상 먼저 호출한다.

### 상태 전이 요약

```
pending  ──pick_next_pending()──▶  processing  ──성공──▶  completed
                                       │
                                    실패/timeout
                                       │
                                       ▼
                                     failed
                                       │
                               attempt_count < 3
                                       │
                              다음 cron에서 재시도
```

### 사용자 조회 API

```python
# GET /api/reports/monthly?month=YYYY-MM
# GET /api/reports/latest

# 응답 스키마
class MonthlyReportResponse(BaseModel):
    id: int
    month: str
    status: Literal["pending", "processing", "completed", "failed"]
    insights: StructuredInsightsResponse | None  # completed 시에만
    completed_at: datetime | None

class MonthlyReportEligibility(BaseModel):
    has_profile: bool
    transaction_count: int
    transactions_needed: int   # 15 - transaction_count (음수면 0)
    category_count: int
    total_spend: float
    is_eligible: bool
    blocker: Literal[
        "profile_missing",
        "transactions_short",
        "categories_short",
        "spend_short",
        "first_month",
    ] | None

# 리포트 없을 때 자격 정보 함께 반환
class MonthlyReportOrEligibility(BaseModel):
    report: MonthlyReportResponse | None
    eligibility: MonthlyReportEligibility | None  # report=None일 때만 채워짐
```

### 환경 변수 추가

```
WEBHOOK_SECRET            # HMAC 서명 검증 (Supabase Vault에도 동일 값 저장)
MONTHLY_REPORT_AUTO_ENABLED  # true(prod) | false(dev). dev 환경에서 자동 실행 방지
MAX_REPORTS_PER_RUN       # Phase 2 최대 처리 수 (기본 500, 비용 안전장치)
```

---

## Supabase pg_cron 설정

### 설치 (Supabase SQL Editor)

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- pg_net의 HTTP 요청은 Supabase 공개 IP에서 나가므로
-- Fly.io allowlist에 추가 필요 없음 (public endpoint)
```

### Supabase Vault에 시크릿 저장

```sql
SELECT vault.create_secret(
  'WEBHOOK_SECRET_VALUE_HERE',
  'monthly_report_webhook_secret'
);
```

### cron job 등록

```sql
-- 매월 1일 18:00 UTC = KST 다음날 03:00
-- 실패 복구를 위해 18:30, 21:00에도 추가 실행 (백엔드 멱등이므로 안전)
SELECT cron.schedule(
  'monthly-reports-primary',
  '0 18 1 * *',
  $$ SELECT net.http_post(
       url := 'https://podo-budget-backend.fly.dev/api/internal/reports/generate-monthly',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'X-Webhook-Signature', (SELECT decrypted_secret FROM vault.decrypted_secrets
                                  WHERE name = 'monthly_report_webhook_secret')
       ),
       body := '{}'::jsonb
     ); $$
);

SELECT cron.schedule('monthly-reports-retry-1', '30 18 1 * *', $$ ... $$);
SELECT cron.schedule('monthly-reports-retry-2', '0 21 1 * *', $$ ... $$);
```

> **개발 환경**: dev Supabase에는 cron job 등록하지 않는다. `MONTHLY_REPORT_AUTO_ENABLED=false`. 수동 테스트는 admin API로만.

---

## 프론트엔드 구현

### 파일 구조

```
frontend/src/
├── api/reports.ts                  # 리포트 API 클라이언트
├── pages/ReportDetailPage.tsx      # 결산 리포트 상세 (/insights/reports/:month)
└── components/reports/
    ├── MonthlyReportCard.tsx       # 모아보기 상단 표지 카드
    ├── ReportContent.tsx           # 리포트 본문 (상세 페이지용)
    ├── ReportEmptyState.tsx        # 자격 미충족 안내
    └── ReportPendingState.tsx      # pending/processing 중 안내
```

### 라우팅 추가

```tsx
// App.tsx
<Route path="/insights/reports/:month" element={<ReportDetailPage />} />
```

`:month`는 `YYYY-MM` 형식. 단계 3 이메일 딥링크의 목적지.

### InsightsPage 변경 요약

**제거**:
- `structuredInsights` useState + `aiLoading` 상태
- "분석하기" 버튼 + `generateInsights` 함수
- AI 섹션 내 `StructuredInsightsView` 직접 렌더링

**추가**:
- Hero 직후 `<MonthlyReportCard />` (useQuery로 latest 리포트 자동 fetch)

### 결산 카드 위치 — Hero 직후

```
┌─────────────────────────────────────┐
│  Hero — 5월 (이번 달, 진행 중)      │
│  ₩2,500,000 / 예산 ₩3,000,000      │
└─────────────────────────────────────┘

┌─ 4월호 결산 리포트 ─────────────────┐  ← MonthlyReportCard
│  📬 4월 결산 리포트가 도착했어요    │
│  "식비가 23% 늘었어요"              │
│  보러 가기 →                         │
└─────────────────────────────────────┘

┌─ 카테고리 TOP / 예산 / 자산변동 등 ─┐
```

**배치 근거**: 현재(Hero) → 지난 달 회고(결산 카드) → 현재 상세(데이터 섹션)의 자연스러운 시간 흐름.

### 상세 페이지 레이아웃 — 잡지형 가독성

```
┌──────────────────────────────────┐
│ ← 모아보기로                      │
├──────────────────────────────────┤
│        2026년 4월호               │  메타 (14px, muted)
│   식비가 늘었지만 저축률은        │  표지 헤드라인 (36px, bold)
│   유지했어요                      │
│   📬 4월 1일 도착 · 가구명       │  부제 (14px)
│   ───────────────────────────    │  구분선
├──────────────────────────────────┤
│   "이번 달도 수고하셨어요."       │  인용구 (18px, 좌측 grape 바)
├──────────────────────────────────┤
│   💡 핵심 발견                    │
│                                   │
│   ① 식비가 23% 늘었어요          │  What (22px, bold)
│   외식 비중이 높았고 주말에…      │  So What (16px, line-h 1.7)
│   ┌────────────────────────────┐ │
│   │ → 다음 달엔 외식을 주 2회로 │ │  Now What (강조 박스, leaf-50)
│   └────────────────────────────┘ │
│                                   │
│   ② ... (구분선 후 반복)          │
├──────────────────────────────────┤
│   🎯 이번 달 액션                 │
│   ⭕ 식비 50만원 이내 유지       │
│   ⭕ 정기구독 점검               │
│   ⭕ 비상금 충전                 │
├──────────────────────────────────┤
│   ⓘ 일반적인 재무 정보...        │  disclaimer (12px)
└──────────────────────────────────┘
```

**타이포그래피**: 좌우 마진 16px, max-width 640px (콘텐츠 기사 표준), section gap 64px+

### 상태별 UI 분기

| 응답 | 컴포넌트 | 핵심 메시지 |
|------|----------|------------|
| 404 + `profile_missing` | ReportEmptyState | "가구 프로필을 완성하면 결산 리포트를 받아볼 수 있어요" |
| 404 + `transactions_short` | ReportEmptyState | "이번 달 15건 이상 거래하면 다음 달 1일 결산 리포트가 도착해요 (현재 N건)" |
| 404 + `first_month` | ReportEmptyState | "다음 달 1일에 첫 결산 리포트가 도착해요" |
| `pending` / `processing` | ReportPendingState | "리포트를 준비하고 있어요" (30초 폴링) |
| `completed` | MonthlyReportCard | 표지 카드 |
| `failed` | ReportEmptyState | 사용자에게 실패 노출 안 함 (부드러운 안내) |

### React Query 캐시

```typescript
// staleTime 5분 — 리포트는 자주 바뀌지 않음
const { data: report } = useQuery({
  queryKey: ['report-latest', activeHouseholdId],
  queryFn: () => reportsApi.getLatest(activeHouseholdId),
  staleTime: 5 * 60 * 1000,
  // pending/processing 상태일 때만 폴링
  refetchInterval: (data) =>
    data?.status === 'pending' || data?.status === 'processing'
      ? 30_000
      : false,
})
```

---

## 에러 처리

| 케이스 | 처리 |
|--------|------|
| HMAC 검증 실패 | 401 응답 + 에러 로그 |
| pg_cron 발사 실패 (Fly.io 다운) | 18:30, 21:00 재시도 cron이 복구 |
| LLM 타임아웃 (30초) | `failed` + last_error, 다른 가구 무관 |
| LLM rate limit (429) | `failed`, 다음 cron 재시도 |
| LLM 파싱 실패 | `failed` + raw response 로깅 |
| processing 좀비 | 다음 cron의 `recover_stale_processing`이 복구 |
| `failed` 상태 (사용자 조회 시) | `ReportEmptyState` 표시 (실패 노출 X) |

---

## 테스트 전략

### 백엔드

```
tests/
├── unit/
│   ├── test_report_eligibility.py    # 경계값 (14건/15건, 카테고리 2/3개 등)
│   ├── test_report_data_builder.py   # 집계 정확성 (각 필드별)
│   ├── test_webhook_auth.py          # HMAC 검증 성공/실패
│   └── test_kst_month_helpers.py     # 월 경계/시간대 변환
└── integration/
    ├── test_api_reports.py           # 4가지 status별 응답
    ├── test_api_reports_eligibility.py  # blocker별 eligibility 응답
    └── test_reports_scheduler.py     # Phase 1/2 통합 (mock LLM)
    # NOTE: pick_next_pending (SKIP LOCKED)은 PostgreSQL 전용
    #       SQLite 테스트 환경에서는 락 없이 동작하는 별도 경로로 테스트
```

**핵심 테스트 케이스**:

```python
# 멱등성
- webhook 두 번 호출 → pending row 1개만 생성

# 경계값
- 거래 14건 → 미달 / 15건 → 통과
- exclude_from_stats=true 거래는 카운트 제외

# 실패 격리
- 100가구 중 5개 LLM 실패 → 95개 completed, 5개 failed

# 좀비 복구
- started_at 30분 전 + processing → recover 후 pending 전환

# attempt_count 상한
- attempt_count=3 → pick_next_pending에서 제외 (재시도 안 함)
```

### 프론트엔드

```
components/reports/__tests__/
├── MonthlyReportCard.test.tsx       # 4 status × 3 eligibility blocker
├── ReportContent.test.tsx           # 핵심 발견/액션 렌더링
├── ReportEmptyState.test.tsx        # blocker별 카피
└── ReportPendingState.test.tsx      # 폴링 동작 (vi.useFakeTimers)
```

MSW 핸들러: `GET /api/reports/monthly`, `GET /api/reports/latest` 추가.

---

## 모니터링

### 구조화 로그

```python
logger.info("[monthly-reports] cron_started month=%s", month)
logger.info("[monthly-reports] eligible_households count=%d month=%s", n, month)
logger.info("[monthly-reports] phase1_complete queued=%d", n)
logger.info("[monthly-reports] phase2_complete completed=%d failed=%d duration_s=%d", c, f, d)
logger.warning("[monthly-reports] llm_failed household_id=%d error=%s", h, e)
```

`grep '[monthly-reports]'`로 한 달 처리 흐름 한 눈에 확인.

### Sentry

- LLM 호출 실패 자동 캡처 (기존 DSN 사용)
- 실패 시 `household_id`, `month`, `attempt_count` 태그 포함

### 매월 1일 운영 체크 (단계 1 초반)

1. 로그에서 `cron_started`가 KST 03:00경 찍혔는지 확인
2. `phase2_complete`의 `failed` 수치 확인
3. Sentry 알림 여부 확인
4. 실패 가구는 admin retry API로 재시도

---

## 보안

- **Webhook secret**: Supabase Vault 저장. `.env`에 동일 값. 절대 git 커밋 금지.
- **Admin 엔드포인트**: 기존 `require_admin` 의존성 재사용
- **사용자 조회 rate limit**: `@limiter.limit("60/minute")`
- **LLM 비용 폭주 방지**: `MAX_REPORTS_PER_RUN` 환경변수로 상한 제어

---

## 단계 1 범위 (미포함)

다음은 단계 2/3에서 구현한다:

- 이전 리포트 컨텍스트를 LLM 프롬프트에 포함 (단계 2)
- "지난 리포트" 시간순 카드 그리드 (`/insights/reports`) (단계 2)
- 홈 페이지에 "새 리포트 도착" 알림 카드 + 읽음 상태 (단계 3)
- 이메일 뉴스레터 발송 (단계 3, Resend)
- 리포트 수신 설정 (단계 3)
- 유료 플랜 게이팅 (단계 4)

---

## 출시 전 체크리스트

- [ ] Alembic 마이그레이션 작성 및 dev 환경 검증
- [ ] Supabase pg_cron + pg_net 설치 확인
- [ ] Vault에 webhook secret 저장
- [ ] Fly.io `WEBHOOK_SECRET`, `MONTHLY_REPORT_AUTO_ENABLED=true` 환경변수 설정
- [ ] dev 환경 `MONTHLY_REPORT_AUTO_ENABLED=false` 확인
- [ ] admin manual-trigger로 첫 배포 후 직전 달(4월) 리포트 일괄 생성
- [ ] 생성된 리포트 샘플 품질 검토
- [ ] 자격 미달 가구 eligibility 응답 프론트 표시 확인
- [ ] pending → polled → completed 시나리오 E2E 확인

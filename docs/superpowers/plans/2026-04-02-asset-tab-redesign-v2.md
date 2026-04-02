# 자산탭 리디자인 v2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자산 대시보드를 순자산 히어로 + 성과 카드 + 마일스톤 + 인터랙티브 차트 + 유형별 그룹 + 온보딩으로 전면 리디자인

**Architecture:** BE 변경 최소화 (Asset 모델에 original_amount 추가, monthly-savings API 로직 변경). FE AssetDashboard.tsx(500줄)를 7개 컴포넌트로 분해하여 재작성. 마일스톤/스트릭 로직은 순수 FE 계산.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Alembic, React 19, TypeScript, Tailwind CSS v4, Recharts

**Design Doc:** `docs/superpowers/specs/2026-04-02-asset-tab-redesign-v2-design.md`

---

## 파일 구조

### 백엔드 변경
| 파일 | 변경 | 역할 |
|------|------|------|
| `backend/app/models/asset.py` | 수정 | `original_amount` 컬럼 추가 |
| `backend/app/schemas/asset.py` | 수정 | AssetBase/AssetUpdate/AssetResponse에 `original_amount` 추가 |
| `backend/app/services/asset_goal_service.py` | 수정 | `get_monthly_savings` 로직 변경 (저축성지출 카테고리 기반) |
| `backend/alembic/versions/` | 생성 | add_original_amount_to_assets 마이그레이션 |

### 프론트엔드 변경
| 파일 | 변경 | 역할 |
|------|------|------|
| `frontend/src/types/index.ts` | 수정 | MonthlySavings 타입 변경, Asset에 original_amount 추가 |
| `frontend/src/api/assets.ts` | 수정 | getMonthlySavings 반환 타입 변경 |
| `frontend/src/components/asset/NetWorthHero.tsx` | 생성 | 순자산 히어로 |
| `frontend/src/components/asset/MonthlyPerformanceCard.tsx` | 생성 | 이번 달 성과 + 변화량 분해 |
| `frontend/src/components/asset/MilestoneProgress.tsx` | 생성 | 마일스톤 프로그레스 |
| `frontend/src/components/asset/NetWorthChart.tsx` | 생성 | 추이 차트 (인터랙티브) |
| `frontend/src/components/asset/AssetGroupList.tsx` | 생성 | 유형별 그룹 목록 + "+" 버튼 + 대출 진척도 |
| `frontend/src/components/asset/AssetOnboarding.tsx` | 생성 | 빈 상태 온보딩 |
| `frontend/src/components/asset/UpdateNudge.tsx` | 생성 | 업데이트 넛지 (수동 자산만) |
| `frontend/src/pages/AssetDashboard.tsx` | 재작성 | 컴포넌트 조합 + 데이터 fetching |
| `frontend/src/pages/AssetForm.tsx` | 수정 | original_amount 필드 + query param type 읽기 |

### 테스트
| 파일 | 변경 | 역할 |
|------|------|------|
| `backend/tests/integration/test_api_assets.py` | 수정 | monthly-savings + original_amount 테스트 |
| `frontend/src/components/asset/__tests__/MonthlyPerformanceCard.test.tsx` | 생성 | 성과 카드 단위 테스트 |
| `frontend/src/components/asset/__tests__/MilestoneProgress.test.tsx` | 생성 | 마일스톤 계산 테스트 |
| `frontend/src/components/asset/__tests__/NetWorthChart.test.tsx` | 생성 | 차트 렌더링 테스트 |

---

### Task 1: BE — Asset 모델에 original_amount 추가

**Files:**
- Modify: `backend/app/models/asset.py:34` (monthly_payment 아래)
- Modify: `backend/app/schemas/asset.py:17,38,41`
- Create: Alembic migration

- [ ] **Step 1: 테스트 작성**

`backend/tests/integration/test_api_assets.py`에 추가:

```python
@pytest.mark.asyncio
async def test_create_loan_with_original_amount(authenticated_client, test_household):
    """대출 등록 시 original_amount 필드가 저장된다"""
    resp = await authenticated_client.post("/api/assets", json={
        "name": "주담대",
        "type": "loan",
        "is_liability": True,
        "manual_value": 78000000,
        "original_amount": 200000000,
        "household_id": test_household.id,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["original_amount"] == 200000000


@pytest.mark.asyncio
async def test_create_asset_without_original_amount(authenticated_client, test_household):
    """original_amount 없이도 정상 등록된다"""
    resp = await authenticated_client.post("/api/assets", json={
        "name": "신한 적금",
        "type": "deposit",
        "manual_value": 5000000,
        "household_id": test_household.id,
    })
    assert resp.status_code == 201
    assert resp.json()["original_amount"] is None
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd backend && python -m pytest tests/integration/test_api_assets.py::test_create_loan_with_original_amount -v
```
Expected: FAIL (original_amount 필드 없음)

- [ ] **Step 3: 모델에 original_amount 추가**

`backend/app/models/asset.py:34` (monthly_payment 아래):
```python
    original_amount = Column(Numeric(18, 2), nullable=True)  # 대출 원금 (상환 진척도용)
```

- [ ] **Step 4: 스키마에 original_amount 추가**

`backend/app/schemas/asset.py`:

AssetBase (line 17, memo 위):
```python
    original_amount: float | None = None
```

AssetUpdate (line 38, memo 위):
```python
    original_amount: float | None = None
```

- [ ] **Step 5: Alembic 마이그레이션 생성**

```bash
cd backend && alembic revision --autogenerate -m "add_original_amount_to_assets"
```

- [ ] **Step 6: 마이그레이션 적용 + 테스트 통과 확인**

```bash
cd backend && alembic upgrade head && python -m pytest tests/integration/test_api_assets.py -v -k "original_amount"
```
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add backend/app/models/asset.py backend/app/schemas/asset.py backend/alembic/versions/ backend/tests/
git commit -m "feat: Asset 모델에 original_amount 필드 추가 (대출 상환 진척도용)"
```

---

### Task 2: BE — monthly-savings API를 저축성지출 카테고리 기반으로 변경

**Files:**
- Modify: `backend/app/services/asset_goal_service.py:145-177`

- [ ] **Step 1: 테스트 작성**

`backend/tests/integration/test_api_assets.py`에 추가:

```python
@pytest.mark.asyncio
async def test_monthly_savings_uses_savings_category(authenticated_client, test_household, db_session):
    """monthly-savings가 저축성지출 카테고리 기반으로 계산된다"""
    from app.models.category import Category
    from app.models.expense import Expense
    from datetime import date

    today = date.today()

    # 저축성 카테고리 생성
    savings_cat = Category(
        name="적금", type="expense", household_id=test_household.id,
        is_savings=True, exclude_auto_payment=False,
    )
    db_session.add(savings_cat)
    await db_session.flush()

    # 일반 카테고리 생성
    normal_cat = Category(
        name="식비", type="expense", household_id=test_household.id,
        is_savings=False, exclude_auto_payment=False,
    )
    db_session.add(normal_cat)
    await db_session.flush()

    # 저축성 지출 50만원
    db_session.add(Expense(
        amount=500000, description="적금 이체", date=today,
        household_id=test_household.id, category_id=savings_cat.id,
    ))
    # 일반 지출 30만원 (저축에 포함되면 안 됨)
    db_session.add(Expense(
        amount=300000, description="점심", date=today,
        household_id=test_household.id, category_id=normal_cat.id,
    ))
    await db_session.commit()

    resp = await authenticated_client.get(
        "/api/assets/monthly-savings",
        params={"household_id": test_household.id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["savings"] == 500000
    assert "month" in data
    assert "total_income" not in data  # 기존 필드 제거됨
    assert "net_savings" not in data
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd backend && python -m pytest tests/integration/test_api_assets.py::test_monthly_savings_uses_savings_category -v
```
Expected: FAIL (기존 로직은 수입-지출)

- [ ] **Step 3: get_monthly_savings 로직 변경**

`backend/app/services/asset_goal_service.py`의 `get_monthly_savings` 함수를 교체:

```python
async def get_monthly_savings(household_id: int, db: AsyncSession) -> dict[str, Any]:
    """이번 달 저축성지출 카테고리 합산"""
    today = datetime.now(ZoneInfo("Asia/Seoul")).date()
    year = today.year
    month = today.month

    # 저축성 카테고리 ID 조회
    savings_cat_q = select(Category.id).where(
        Category.is_savings.is_(True),
        Category.household_id == household_id,
    )

    # 이번 달 저축성 지출 합산 (통계 제외 항목도 제외)
    savings_q = select(func.coalesce(func.sum(Expense.amount), 0)).where(
        extract("year", Expense.date) == year,
        extract("month", Expense.date) == month,
        Expense.household_id == household_id,
        Expense.category_id.in_(savings_cat_q),
        Expense.exclude_from_stats.is_(False),
    )

    result = await db.execute(savings_q)
    savings = float(result.scalar_one())

    return {
        "month": f"{year}-{month:02d}",
        "savings": savings,
    }
```

import에 `Category` 추가 필요:
```python
from app.models.category import Category
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd backend && python -m pytest tests/integration/test_api_assets.py -v -k "monthly_savings"
```
Expected: PASS

- [ ] **Step 5: 기존 테스트 깨짐 확인 및 수정**

```bash
cd backend && python -m pytest tests/ -v
```
기존 monthly_savings 관련 테스트가 있다면 새 응답 형식에 맞게 수정.

- [ ] **Step 6: 커밋**

```bash
git add backend/app/services/asset_goal_service.py backend/tests/
git commit -m "feat: monthly-savings를 저축성지출 카테고리 기반으로 변경"
```

---

### Task 3: FE — 타입 + API 클라이언트 변경

**Files:**
- Modify: `frontend/src/types/index.ts:98-103,105-120`
- Modify: `frontend/src/api/assets.ts:60-63`

- [ ] **Step 1: MonthlySavings 타입 변경**

`frontend/src/types/index.ts:98-103` 교체:
```typescript
export interface MonthlySavings {
  month: string
  savings: number
}
```

- [ ] **Step 2: Asset/CreateAssetParams에 original_amount 추가**

`frontend/src/types/index.ts`의 Asset 인터페이스에 추가 (profit_loss_pct 아래):
```typescript
  original_amount: number | null
```

CreateAssetParams에 추가 (memo 위):
```typescript
  original_amount?: number | null
```

- [ ] **Step 3: API 클라이언트 getMonthlySavings 변경**

`frontend/src/api/assets.ts:60-63` 교체:
```typescript
  getMonthlySavings: (householdId: number) =>
    apiClient.get<MonthlySavings>('/assets/monthly-savings', {
      params: { household_id: householdId },
    }),
```

(배열 `MonthlySavings[]` → 단일 `MonthlySavings`로 변경)

- [ ] **Step 4: AssetDashboard.tsx 최소 수정 (빌드 깨짐 방지)**

`frontend/src/pages/AssetDashboard.tsx`에서 `monthlySavings` 관련 참조를 새 타입에 맞게 수정:
- `monthlySavings.net_savings` → `monthlySavings.savings`
- `monthlySavings.month` (기존 string이므로 변경 없음)
- `MonthlySavings[]` → `MonthlySavings` (배열에서 단일 객체로)
- `setMonthlySavings` 초기화 로직에서 배열 처리 코드 제거

또한 `frontend/src/api/__tests__/assets.test.ts`에서 getMonthlySavings 관련 테스트가 있다면 새 형식으로 수정.

- [ ] **Step 5: 빌드 확인**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/types/index.ts frontend/src/api/assets.ts frontend/src/pages/AssetDashboard.tsx frontend/src/api/__tests__/ frontend/src/mocks/
git commit -m "feat: MonthlySavings 타입 변경 + Asset에 original_amount 추가"
```

---

### Task 4: FE — NetWorthHero 컴포넌트

**Files:**
- Create: `frontend/src/components/asset/NetWorthHero.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```typescript
/**
 * @file NetWorthHero.tsx
 * @description 순자산 히어로 — 순자산 큰 숫자 + 자산/부채 소계
 */

import { formatAmount } from '../../utils/format'

interface NetWorthHeroProps {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
}

export default function NetWorthHero({ netWorth, totalAssets, totalLiabilities }: NetWorthHeroProps) {
  const isPositive = netWorth >= 0

  return (
    <div className={`rounded-2xl border shadow-sm p-6 ${
      isPositive
        ? 'bg-gradient-to-br from-grape-50 to-grape-100 border-grape-200/60'
        : 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-200/60'
    }`}>
      <p className="text-sm text-[var(--text-tertiary)] mb-1">순자산</p>
      <p className={`text-3xl font-bold tracking-tight ${isPositive ? 'text-grape-600' : 'text-rose-600'}`}>
        {formatAmount(netWorth)}
      </p>
      <div className="flex gap-4 mt-3 text-xs text-[var(--text-tertiary)]">
        <span>자산 {formatAmount(totalAssets)}</span>
        <span>부채 {formatAmount(totalLiabilities)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
mkdir -p frontend/src/components/asset
git add frontend/src/components/asset/NetWorthHero.tsx
git commit -m "feat: NetWorthHero 컴포넌트 추가"
```

---

### Task 5: FE — MonthlyPerformanceCard 컴포넌트

**Files:**
- Create: `frontend/src/components/asset/MonthlyPerformanceCard.tsx`
- Create: `frontend/src/components/asset/__tests__/MonthlyPerformanceCard.test.tsx`

- [ ] **Step 1: 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonthlyPerformanceCard, { computeBreakdownDiff, computeStreak } from '../MonthlyPerformanceCard'

describe('computeBreakdownDiff', () => {
  it('breakdown 차이를 올바르게 계산한다', () => {
    const current = { breakdown: { stock_kr: 7000000, deposit: 5500000 }, totalLiabilities: 78000000 }
    const previous = { breakdown: { stock_kr: 6800000, deposit: 5000000 }, totalLiabilities: 79000000 }
    const diff = computeBreakdownDiff(current, previous)
    expect(diff.find(d => d.label === '투자')?.amount).toBe(200000)
    expect(diff.find(d => d.label === '예적금')?.amount).toBe(500000)
    expect(diff.find(d => d.label === '대출 상환')?.amount).toBe(1000000) // 부호 반전
  })

  it('변화량 0인 항목은 제외한다', () => {
    const current = { breakdown: { stock_kr: 5000000 }, totalLiabilities: 78000000 }
    const previous = { breakdown: { stock_kr: 5000000 }, totalLiabilities: 78000000 }
    const diff = computeBreakdownDiff(current, previous)
    expect(diff).toHaveLength(0)
  })
})

describe('computeStreak', () => {
  it('연속 증가 개월 수를 계산한다', () => {
    const snapshots = [
      { net_worth: 200 },
      { net_worth: 190 },
      { net_worth: 180 },
    ] // 최신→과거
    expect(computeStreak(snapshots)).toBe(3)
  })

  it('감소가 있으면 스트릭이 끊긴다', () => {
    const snapshots = [
      { net_worth: 200 },
      { net_worth: 210 }, // 감소 (200 < 210)
      { net_worth: 180 },
    ]
    expect(computeStreak(snapshots)).toBe(0)
  })
})

describe('MonthlyPerformanceCard', () => {
  it('변화량을 표시한다', () => {
    render(
      <MonthlyPerformanceCard
        netWorthChange={480000}
        breakdownDiff={[{ label: '투자', amount: 320000 }, { label: '예적금', amount: 500000 }]}
        streak={3}
        savings={500000}
      />
    )
    expect(screen.getByText(/\+48만원/)).toBeInTheDocument()
  })

  it('스트릭 뱃지를 표시한다', () => {
    render(
      <MonthlyPerformanceCard netWorthChange={100000} breakdownDiff={[]} streak={3} savings={0} />
    )
    expect(screen.getByText(/3개월 연속/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd frontend && npx vitest run src/components/asset/__tests__/MonthlyPerformanceCard.test.tsx
```

- [ ] **Step 3: 컴포넌트 구현**

`frontend/src/components/asset/MonthlyPerformanceCard.tsx`:

```typescript
/**
 * @file MonthlyPerformanceCard.tsx
 * @description 이번 달 성과 카드 — 변화량 + 스트릭 + 변화 분해
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatAmount } from '../../utils/format'
import type { AssetSnapshot, AssetSummary } from '../../types'

interface BreakdownItem {
  label: string
  amount: number
}

interface MonthlyPerformanceCardProps {
  netWorthChange: number
  breakdownDiff: BreakdownItem[]
  streak: number
  savings: number
  /** 감소 시 긍정 메시지 */
  positiveMessage?: string | null
}

/** 유형 그룹 정의 */
const DISPLAY_GROUPS: { label: string; keys: string[] }[] = [
  { label: '투자', keys: ['stock_kr', 'stock_us', 'crypto'] },
  { label: '예적금', keys: ['deposit'] },
  { label: '부동산/기타', keys: ['real_estate', 'other'] },
]

/** breakdown 차이 + 부채 차이를 합산하여 표시 항목 생성 */
export function computeBreakdownDiff(
  current: { breakdown: Record<string, number>; totalLiabilities: number },
  previous: { breakdown: Record<string, number> | null; totalLiabilities: number },
): BreakdownItem[] {
  const prevBreakdown = previous.breakdown ?? {}
  const items: BreakdownItem[] = []

  for (const group of DISPLAY_GROUPS) {
    const curSum = group.keys.reduce((s, k) => s + (current.breakdown[k] ?? 0), 0)
    const prevSum = group.keys.reduce((s, k) => s + (prevBreakdown[k] ?? 0), 0)
    const diff = curSum - prevSum
    if (diff !== 0) {
      items.push({ label: group.label, amount: diff })
    }
  }

  // 부채 변화 (부호 반전: 부채 감소 = 양수)
  const liabilityDiff = previous.totalLiabilities - current.totalLiabilities
  if (liabilityDiff !== 0) {
    items.push({ label: '대출 상환', amount: liabilityDiff })
  }

  return items
}

/** 스트릭 계산: 최신→과거 순 스냅샷에서 연속 증가 개월 수 */
export function computeStreak(snapshots: Pick<AssetSnapshot, 'net_worth'>[]): number {
  if (snapshots.length < 2) return 0
  let count = 0
  for (let i = 0; i < snapshots.length - 1; i++) {
    if (snapshots[i].net_worth > snapshots[i + 1].net_worth) {
      count++
    } else {
      break
    }
  }
  return count
}

/** 감소 시 긍정 요소 찾기 */
export function findPositiveMessage(breakdownDiff: BreakdownItem[], savings: number): string | null {
  const loanItem = breakdownDiff.find(d => d.label === '대출 상환' && d.amount > 0)
  if (loanItem) return `대출 잔액이 ${formatAmount(loanItem.amount)} 줄었어요`
  if (savings > 0) return `저축은 꾸준히 ${formatAmount(savings)} 유지 중`
  return null
}

export default function MonthlyPerformanceCard({
  netWorthChange,
  breakdownDiff,
  streak,
  savings,
  positiveMessage,
}: MonthlyPerformanceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isPositive = netWorthChange >= 0

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-5">
      {/* 변화량 */}
      <p className={`text-2xl font-bold ${isPositive ? 'text-leaf-600' : 'text-rose-600'}`}>
        {isPositive ? '+' : ''}{formatAmount(netWorthChange)}
      </p>

      {/* 스트릭 or 긍정 메시지 */}
      {isPositive && streak >= 2 && (
        <p className="text-sm text-leaf-600 mt-1">{streak}개월 연속 순자산 증가 중</p>
      )}
      {!isPositive && positiveMessage && (
        <p className="text-sm text-[var(--text-tertiary)] mt-1">{positiveMessage}</p>
      )}

      {/* 변화 상세 토글 */}
      {breakdownDiff.length > 0 && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          변화 상세
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {breakdownDiff.map(item => (
            <div key={item.label} className="flex justify-between text-sm">
              <span className="text-[var(--text-tertiary)]">{item.label}</span>
              <span className={item.amount >= 0 ? 'text-leaf-600' : 'text-rose-600'}>
                {item.amount >= 0 ? '+' : ''}{formatAmount(item.amount)}
              </span>
            </div>
          ))}
          {savings > 0 && (
            <>
              <div className="border-t border-[var(--border-subtle)] my-1.5" />
              <div className="flex justify-between text-xs text-[var(--text-muted)]">
                <span>이 중 저축성 지출</span>
                <span>{formatAmount(savings)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/asset/__tests__/MonthlyPerformanceCard.test.tsx
```

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/asset/MonthlyPerformanceCard.tsx frontend/src/components/asset/__tests__/
git commit -m "feat: MonthlyPerformanceCard 컴포넌트 — 성과 카드 + 변화량 분해"
```

---

### Task 6: FE — MilestoneProgress 컴포넌트

**Files:**
- Create: `frontend/src/components/asset/MilestoneProgress.tsx`
- Create: `frontend/src/components/asset/__tests__/MilestoneProgress.test.tsx`

- [ ] **Step 1: 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MilestoneProgress, { computeMilestone } from '../MilestoneProgress'

describe('computeMilestone', () => {
  it('1억 미만: 500만원 단위', () => {
    const m = computeMilestone(43000000)
    expect(m.unit).toBe(5000000)
    expect(m.next).toBe(45000000)
    expect(m.prev).toBe(40000000)
    expect(m.progressPct).toBeCloseTo(60)
  })

  it('1억~5억: 1000만원 단위', () => {
    const m = computeMilestone(234000000)
    expect(m.unit).toBe(10000000)
    expect(m.next).toBe(240000000)
    expect(m.prev).toBe(230000000)
  })

  it('5억 이상: 5000만원 단위', () => {
    const m = computeMilestone(520000000)
    expect(m.unit).toBe(50000000)
    expect(m.next).toBe(550000000)
  })

  it('정확히 경계값이면 다음 단위로 전진', () => {
    const m = computeMilestone(250000000)
    expect(m.next).toBe(260000000)
    expect(m.prev).toBe(250000000)
  })

  it('순자산 0 이하면 null 반환', () => {
    expect(computeMilestone(0)).toBeNull()
    expect(computeMilestone(-5000000)).toBeNull()
  })
})

describe('MilestoneProgress', () => {
  it('마일스톤 프로그레스 바를 표시한다', () => {
    render(<MilestoneProgress netWorth={234000000} goal={{ target_net_worth: 1000000000, target_date: '2030-12-31' }} onGoalEdit={() => {}} />)
    expect(screen.getByText(/다음 목표/)).toBeInTheDocument()
    expect(screen.getByText(/2억 4,000만원/)).toBeInTheDocument()
  })

  it('순자산 0 이하면 렌더링하지 않는다', () => {
    const { container } = render(<MilestoneProgress netWorth={-100} goal={null} onGoalEdit={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('목표 미설정 시 CTA를 표시한다', () => {
    render(<MilestoneProgress netWorth={100000000} goal={null} onGoalEdit={() => {}} />)
    expect(screen.getByText(/순자산 목표를 설정/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 컴포넌트 구현**

`frontend/src/components/asset/MilestoneProgress.tsx`:

```typescript
/**
 * @file MilestoneProgress.tsx
 * @description 마일스톤 프로그레스 — 다음 단기 목표 + 트레일
 */

import { Target } from 'lucide-react'
import { formatAmount } from '../../utils/format'
import type { AssetGoal } from '../../types'

interface MilestoneData {
  unit: number
  prev: number
  next: number
  progressPct: number
  remaining: number
}

interface MilestoneProgressProps {
  netWorth: number
  goal: Pick<AssetGoal, 'target_net_worth' | 'target_date'> | null
  onGoalEdit: () => void
}

export function computeMilestone(netWorth: number): MilestoneData | null {
  if (netWorth <= 0) return null

  let unit: number
  if (netWorth < 100000000) unit = 5000000
  else if (netWorth < 500000000) unit = 10000000
  else unit = 50000000

  // 정확히 경계값이면 다음 단위로 전진
  const next = netWorth % unit === 0
    ? netWorth + unit
    : Math.ceil(netWorth / unit) * unit
  const prev = next - unit
  const progressPct = ((netWorth - prev) / unit) * 100
  const remaining = next - netWorth

  return { unit, prev, next, progressPct, remaining }
}

/** 마일스톤 트레일 포인트 생성 */
function buildTrail(netWorth: number, unit: number, next: number): { value: number; status: 'done' | 'current' | 'future' }[] {
  const points: { value: number; status: 'done' | 'current' | 'future' }[] = []
  // 이전 2개
  const start = Math.max(next - unit * 3, 0)
  for (let v = start; v < next - unit; v += unit) {
    if (v > 0) points.push({ value: v, status: 'done' })
  }
  // 이전 마일스톤 (달성)
  const prev = next - unit
  if (prev > 0) points.push({ value: prev, status: 'done' })
  // 현재 (진행 중)
  points.push({ value: next, status: 'current' })
  // 다음 1개
  points.push({ value: next + unit, status: 'future' })
  return points.slice(-5) // 최대 5개
}

export default function MilestoneProgress({ netWorth, goal, onGoalEdit }: MilestoneProgressProps) {
  const milestone = computeMilestone(netWorth)

  if (!milestone) return null

  if (!goal) {
    return (
      <button
        onClick={onGoalEdit}
        className="w-full bg-[var(--surface-card)] rounded-2xl border-2 border-dashed border-[var(--border-default)] p-5 flex items-center justify-center gap-2 text-[var(--text-muted)] hover:border-grape-300 hover:text-grape-500 transition-colors"
      >
        <Target className="w-5 h-5" />
        <span className="text-sm font-medium">순자산 목표를 설정하면 마일스톤이 생겨요</span>
      </button>
    )
  }

  const trail = buildTrail(netWorth, milestone.unit, milestone.next)

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[var(--text-secondary)]">
          다음 목표: {formatAmount(milestone.next)}
        </p>
        <button onClick={onGoalEdit} className="text-xs text-[var(--text-muted)] hover:text-grape-600">
          최종 목표 {formatAmount(goal.target_net_worth)} · {goal.target_date.slice(0, 4)}년
        </button>
      </div>

      {/* 프로그레스 바 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
          <div
            className="h-full bg-grape-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(milestone.progressPct, 100)}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-grape-600 w-10 text-right">
          {Math.round(milestone.progressPct)}%
        </span>
      </div>

      <p className="text-xs text-[var(--text-muted)] mb-3">
        {formatAmount(milestone.remaining)} 남았어요
      </p>

      {/* 마일스톤 트레일 */}
      <div className="flex items-center justify-between">
        {trail.map((point, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${
              point.status === 'done' ? 'bg-grape-500' :
              point.status === 'current' ? 'bg-grape-300 ring-2 ring-grape-200' :
              'bg-[var(--surface-hover)] border border-[var(--border-default)]'
            }`} />
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatAmount(point.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/asset/__tests__/MilestoneProgress.test.tsx
```

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/asset/MilestoneProgress.tsx frontend/src/components/asset/__tests__/
git commit -m "feat: MilestoneProgress 컴포넌트 — 단기 마일스톤 + 트레일"
```

---

### Task 7: FE — NetWorthChart 컴포넌트

**Files:**
- Create: `frontend/src/components/asset/NetWorthChart.tsx`

- [ ] **Step 1: 컴포넌트 구현**

```typescript
/**
 * @file NetWorthChart.tsx
 * @description 순자산 추이 차트 — 기간 선택 + Y축 자동 스케일 + 영역 차트
 */

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatAmount } from '../../utils/format'
import type { AssetSnapshot } from '../../types'

interface NetWorthChartProps {
  /** 과거→최신 순 정렬된 스냅샷 */
  snapshots: AssetSnapshot[]
}

type Period = 3 | 6 | 12

export default function NetWorthChart({ snapshots }: NetWorthChartProps) {
  const [period, setPeriod] = useState<Period>(6)

  const filteredData = useMemo(() => {
    const sliced = snapshots.slice(-period)
    return sliced.map(s => ({
      month: s.snapshot_date.slice(0, 7),
      netWorth: s.net_worth,
    }))
  }, [snapshots, period])

  const actualMonths = filteredData.length

  // 기간별 변화량
  const periodChange = filteredData.length >= 2
    ? filteredData[filteredData.length - 1].netWorth - filteredData[0].netWorth
    : null

  // Y축 자동 스케일 (최소~최대, 상하 10% 여백)
  const yDomain = useMemo(() => {
    if (filteredData.length === 0) return [0, 0]
    const values = filteredData.map(d => d.netWorth)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || Math.abs(max) * 0.1 || 1000000
    return [Math.floor(min - range * 0.1), Math.ceil(max + range * 0.1)]
  }, [filteredData])

  if (snapshots.length <= 1) {
    return (
      <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-5 text-center">
        <p className="text-sm text-[var(--text-muted)]">다음 달부터 추이를 볼 수 있어요</p>
      </div>
    )
  }

  // 활성 탭 판별 (스냅샷 수 기반)
  const availablePeriods: Period[] = [3]
  if (snapshots.length > 3) availablePeriods.push(6)
  if (snapshots.length > 6) availablePeriods.push(12)

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)]">순자산 추이</h2>
        <div className="flex gap-1">
          {([3, 6, 12] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              disabled={!availablePeriods.includes(p)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                period === p
                  ? 'bg-grape-100 text-grape-600 font-medium'
                  : availablePeriods.includes(p)
                    ? 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                    : 'text-[var(--text-muted)] opacity-40 cursor-not-allowed'
              }`}
            >
              {p}M
            </button>
          ))}
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9333EA" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#9333EA" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis
              domain={yDomain}
              tickFormatter={(v) => `${(Number(v) / 10000).toLocaleString()}만`}
              tick={{ fontSize: 9 }}
              width={60}
            />
            <Tooltip
              formatter={(v: number) => formatAmount(v)}
              labelFormatter={(label) => `${label}`}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="#9333EA"
              strokeWidth={2}
              fill="url(#netWorthGradient)"
              dot={{ r: 3, fill: '#9333EA' }}
              activeDot={{ r: 5 }}
              name="순자산"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 기간 요약 */}
      {periodChange != null && (
        <p className="text-xs text-[var(--text-muted)] text-center mt-2">
          {actualMonths}개월간 {periodChange >= 0 ? '+' : ''}{formatAmount(periodChange)}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/asset/NetWorthChart.tsx
git commit -m "feat: NetWorthChart 컴포넌트 — 인터랙티브 추이 차트"
```

---

### Task 8: FE — AssetGroupList, AssetOnboarding, UpdateNudge 컴포넌트

**Files:**
- Create: `frontend/src/components/asset/AssetGroupList.tsx`
- Create: `frontend/src/components/asset/AssetOnboarding.tsx`
- Create: `frontend/src/components/asset/UpdateNudge.tsx`

- [ ] **Step 1: AssetGroupList 구현**

```typescript
/**
 * @file AssetGroupList.tsx
 * @description 유형별 자산 그룹 목록 + "+" 버튼 + 대출 상환 진척도
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Landmark, Building2,
  ChevronDown, ChevronUp, ChevronRight, Plus,
} from 'lucide-react'
import { formatAmount } from '../../utils/format'
import type { Asset } from '../../types'

const TYPE_LABELS: Record<string, string> = {
  stock_kr: '한국주식', stock_us: '미국주식', crypto: '코인',
  deposit: '예적금', real_estate: '부동산', other: '기타', loan: '대출',
}

interface TypeGroup {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  types: string[]
  isLiability?: boolean
  iconColorClass: string
  defaultType: string // "+" 클릭 시 사전 선택 타입
}

const TYPE_GROUPS: TypeGroup[] = [
  { key: 'investment', label: '투자', icon: TrendingUp, types: ['stock_kr', 'stock_us', 'crypto'], iconColorClass: 'text-grape-500', defaultType: 'stock_kr' },
  { key: 'deposit', label: '예적금', icon: Landmark, types: ['deposit'], iconColorClass: 'text-leaf-600', defaultType: 'deposit' },
  { key: 'real_estate', label: '부동산/기타', icon: Building2, types: ['real_estate', 'other'], iconColorClass: 'text-[var(--text-tertiary)]', defaultType: 'real_estate' },
  { key: 'liability', label: '부채', icon: TrendingDown, types: ['loan'], isLiability: true, iconColorClass: 'text-rose-500', defaultType: 'loan' },
]

function formatPct(pct: number | null): string {
  if (pct == null) return ''
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

interface AssetGroupListProps {
  assets: Asset[]
}

export default function AssetGroupList({ assets }: AssetGroupListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const groups = TYPE_GROUPS.map(group => {
    const items = group.isLiability
      ? assets.filter(a => a.is_liability)
      : assets.filter(a => !a.is_liability && group.types.includes(a.type))
    const total = items.reduce((sum, a) => sum + (a.current_value ?? 0), 0)
    return { ...group, items, total }
  }).filter(g => g.items.length > 0)

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const Icon = group.icon
        const isCollapsed = collapsed[group.key] ?? false
        return (
          <div key={group.key} className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => setCollapsed(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity"
              >
                <Icon className={`w-4 h-4 ${group.iconColorClass}`} />
                <span className="text-sm font-semibold text-[var(--text-secondary)]">{group.label}</span>
                <span className={`text-sm font-semibold ml-auto ${group.isLiability ? 'text-rose-600' : 'text-[var(--text-primary)]'}`}>
                  {formatAmount(group.total)}
                </span>
                {isCollapsed
                  ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  : <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                }
              </button>
              <Link
                to={`/assets/new?type=${group.defaultType}`}
                className="ml-2 p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                aria-label={`${group.label} 자산 추가`}
              >
                <Plus className="w-4 h-4 text-[var(--text-muted)]" />
              </Link>
            </div>
            {!isCollapsed && (
              <div className="px-4 pb-3">
                {group.items.map(asset => (
                  <div key={asset.id}>
                    <Link
                      to={`/assets/${asset.id}`}
                      className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-elevated)] rounded transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{asset.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{TYPE_LABELS[asset.type] ?? asset.type}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${asset.is_liability ? 'text-rose-600' : 'text-[var(--text-primary)]'}`}>
                            {asset.current_value != null ? formatAmount(asset.current_value) : '-'}
                          </p>
                          {asset.profit_loss_pct != null && (
                            <p className={`text-xs ${asset.profit_loss_pct >= 0 ? 'text-leaf-600' : 'text-rose-600'}`}>
                              {formatPct(asset.profit_loss_pct)}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                      </div>
                    </Link>
                    {/* 대출 상환 진척도 — 각 항목 바로 아래 */}
                    {asset.is_liability && asset.original_amount && asset.current_value != null && (
                      <div className="px-2 pb-2 pt-1">
                        <div className="w-full h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-leaf-500 rounded-full"
                            style={{ width: `${Math.min(((asset.original_amount - asset.current_value) / asset.original_amount) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">
                          원금 {formatAmount(asset.original_amount)} 중 {formatAmount(asset.original_amount - asset.current_value)} 상환
                          ({Math.round(((asset.original_amount - asset.current_value) / asset.original_amount) * 100)}%)
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* 자산 추가 버튼 (목록 하단) */}
      <Link
        to="/assets/new"
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-[var(--text-muted)] hover:text-grape-600 transition-colors"
      >
        <Plus className="w-4 h-4" />
        자산 추가
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: AssetOnboarding 구현**

```typescript
/**
 * @file AssetOnboarding.tsx
 * @description 빈 상태 온보딩 — 자산 유형 선택 카드
 */

import { Link } from 'react-router-dom'
import { Landmark, TrendingUp, Bitcoin, Building2, Package, CreditCard } from 'lucide-react'

const TYPES = [
  { type: 'deposit', label: '예적금', icon: Landmark, color: 'text-leaf-600' },
  { type: 'stock_kr', label: '주식', icon: TrendingUp, color: 'text-grape-500' },
  { type: 'crypto', label: '코인', icon: Bitcoin, color: 'text-amber-500' },
  { type: 'real_estate', label: '부동산', icon: Building2, color: 'text-blue-500' },
  { type: 'other', label: '기타', icon: Package, color: 'text-[var(--text-tertiary)]' },
  { type: 'loan', label: '대출', icon: CreditCard, color: 'text-rose-500' },
]

export default function AssetOnboarding() {
  return (
    <div className="text-center py-12">
      <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        우리 가족 자산을 정리해볼까요?
      </p>
      <p className="text-sm text-[var(--text-muted)] mb-8">
        하나만 등록하면 바로 순자산이 보여요
      </p>
      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {TYPES.map(({ type, label, icon: Icon, color }) => (
          <Link
            key={type}
            to={`/assets/new?type=${type}`}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] hover:border-grape-300 hover:shadow-sm transition-all"
          >
            <Icon className={`w-6 h-6 ${color}`} />
            <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: UpdateNudge 구현**

```typescript
/**
 * @file UpdateNudge.tsx
 * @description 수동 자산 업데이트 넛지 카드
 */

import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import type { Asset } from '../../types'

const MANUAL_TYPES = new Set(['deposit', 'real_estate', 'other', 'loan'])
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

interface UpdateNudgeProps {
  assets: Asset[]
}

export default function UpdateNudge({ assets }: UpdateNudgeProps) {
  const now = Date.now()
  const staleAssets = assets.filter(a =>
    MANUAL_TYPES.has(a.type) &&
    (now - new Date(a.updated_at).getTime()) > THIRTY_DAYS_MS
  )

  if (staleAssets.length === 0) return null

  const names = staleAssets.slice(0, 3).map(a => a.name).join(', ')
  const firstId = staleAssets[0].id

  return (
    <Link
      to={`/assets/${firstId}`}
      className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl p-4 flex items-start gap-3 hover:bg-amber-100/50 transition-colors"
    >
      <Bell className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">자산 현황을 업데이트해보세요</p>
        <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">{names}</p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/asset/AssetGroupList.tsx frontend/src/components/asset/AssetOnboarding.tsx frontend/src/components/asset/UpdateNudge.tsx
git commit -m "feat: AssetGroupList, AssetOnboarding, UpdateNudge 컴포넌트 추가"
```

---

### Task 9: FE — AssetDashboard 재작성

**Files:**
- Rewrite: `frontend/src/pages/AssetDashboard.tsx`

- [ ] **Step 1: AssetDashboard 전면 재작성**

기존 500줄을 컴포넌트 조합으로 교체. 데이터 fetching + 상태 관리 + 컴포넌트 배치만 담당:

```typescript
/**
 * @file AssetDashboard.tsx
 * @description 자산 대시보드 — 컴포넌트 조합 + 데이터 fetching
 */

import { useEffect, useState, useCallback } from 'react'
import { X, Target } from 'lucide-react'
import { assetApi } from '../api/assets'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import ErrorState from '../components/ErrorState'
import LoadingSpinner from '../components/LoadingSpinner'
import NetWorthHero from '../components/asset/NetWorthHero'
import MonthlyPerformanceCard, { computeBreakdownDiff, computeStreak, findPositiveMessage } from '../components/asset/MonthlyPerformanceCard'
import MilestoneProgress from '../components/asset/MilestoneProgress'
import NetWorthChart from '../components/asset/NetWorthChart'
import AssetGroupList from '../components/asset/AssetGroupList'
import AssetOnboarding from '../components/asset/AssetOnboarding'
import UpdateNudge from '../components/asset/UpdateNudge'
import { formatAmount } from '../utils/format'
import type { Asset, AssetSummary, AssetSnapshot, AssetGoal, MonthlySavings } from '../types'

export default function AssetDashboard() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [summary, setSummary] = useState<AssetSummary | null>(null)
  const [snapshots, setSnapshots] = useState<AssetSnapshot[]>([])
  const [goal, setGoal] = useState<AssetGoal | null>(null)
  const [savings, setSavings] = useState<MonthlySavings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalAmount, setGoalAmount] = useState('')
  const [goalDate, setGoalDate] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  const fetchData = useCallback(() => {
    if (!activeHouseholdId) return
    setLoading(true)
    setError(null)
    const hid = activeHouseholdId
    Promise.all([
      assetApi.getAll(hid),
      assetApi.getSummary(hid),
      assetApi.getSnapshots(hid, 12),
      assetApi.getGoal(hid).catch(() => ({ data: null })),
      assetApi.getMonthlySavings(hid).catch(() => ({ data: null })),
    ])
      .then(([assetsRes, summaryRes, snapshotsRes, goalRes, savingsRes]) => {
        setAssets(assetsRes.data)
        setSummary(summaryRes.data)
        setSnapshots(snapshotsRes.data.slice().reverse()) // 과거→최신 순
        setGoal(goalRes.data)
        setSavings(savingsRes.data)
      })
      .catch(() => setError('자산 정보를 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [activeHouseholdId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveGoal = async () => {
    const amount = Number(goalAmount)
    if (!amount || !goalDate) return
    setGoalSaving(true)
    try {
      const res = await assetApi.setGoal({
        target_net_worth: amount,
        target_date: goalDate,
        household_id: activeHouseholdId!,
      })
      setGoal(res.data)
      setShowGoalModal(false)
    } catch { /* 실패 시 모달 유지 */ } finally {
      setGoalSaving(false)
    }
  }

  const handleDeleteGoal = async () => {
    setGoalSaving(true)
    try {
      await assetApi.deleteGoal(activeHouseholdId!)
      setGoal(null)
      setShowGoalModal(false)
    } catch { /* 무시 */ } finally {
      setGoalSaving(false)
    }
  }

  const openGoalModal = () => {
    if (goal) {
      setGoalAmount(String(goal.target_net_worth))
      setGoalDate(goal.target_date)
    } else {
      setGoalAmount('')
      setGoalDate('')
    }
    setShowGoalModal(true)
  }

  if (loading) return <LoadingSpinner className="min-h-[50vh]" />
  if (error) return <ErrorState message={error} onRetry={fetchData} />

  // 빈 상태
  if (assets.length === 0) return <AssetOnboarding />

  const netWorth = summary?.net_worth ?? 0
  const totalAssets = summary?.total_assets ?? 0
  const totalLiabilities = summary?.total_liabilities ?? 0

  // 성과 카드 데이터 (스냅샷이 있을 때만)
  const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const prevSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null
  const netWorthChange = prevSnapshot ? netWorth - prevSnapshot.net_worth : null

  const breakdownDiff = prevSnapshot && summary
    ? computeBreakdownDiff(
        { breakdown: summary.breakdown, totalLiabilities },
        { breakdown: prevSnapshot.breakdown, totalLiabilities: prevSnapshot.total_liabilities },
      )
    : []

  // live 순자산을 prepend하여 이번 달도 스트릭에 포함
  const streak = computeStreak(
    [{ net_worth: netWorth }, ...[...snapshots].reverse().map(s => ({ net_worth: s.net_worth }))],
  )

  const savingsAmount = savings?.savings ?? 0
  const positiveMessage = netWorthChange != null && netWorthChange < 0
    ? findPositiveMessage(breakdownDiff, savingsAmount)
    : null

  return (
    <div className="space-y-4">
      <NetWorthHero
        netWorth={netWorth}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
      />

      {netWorthChange != null && (
        <MonthlyPerformanceCard
          netWorthChange={netWorthChange}
          breakdownDiff={breakdownDiff}
          streak={streak}
          savings={savingsAmount}
          positiveMessage={positiveMessage}
        />
      )}

      <MilestoneProgress
        netWorth={netWorth}
        goal={goal ? { target_net_worth: goal.target_net_worth, target_date: goal.target_date } : null}
        onGoalEdit={openGoalModal}
      />

      <NetWorthChart snapshots={snapshots} />

      <AssetGroupList assets={assets} />

      <UpdateNudge assets={assets} />

      {/* 목표 설정 모달 */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGoalModal(false)} />
          <div className="relative bg-[var(--surface-card)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 id="goal-modal-title" className="text-lg font-bold text-[var(--text-primary)]">순자산 목표 설정</h2>
              <button onClick={() => setShowGoalModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]" aria-label="닫기">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="goal-amount" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">목표 금액</label>
                <input id="goal-amount" type="number" inputMode="numeric" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} placeholder="예: 100000000" className="w-full px-3 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/40 focus:border-grape-400" />
              </div>
              <div>
                <label htmlFor="goal-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">목표 날짜</label>
                <input id="goal-date" type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="w-full px-3 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/40 focus:border-grape-400" />
              </div>
            </div>
            <div className="flex gap-3">
              {goal && (
                <button onClick={handleDeleteGoal} disabled={goalSaving} className="px-4 py-2.5 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50">삭제</button>
              )}
              <div className="flex-1" />
              <button onClick={() => setShowGoalModal(false)} className="px-4 py-2.5 text-sm font-medium text-[var(--text-tertiary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors">취소</button>
              <button onClick={handleSaveGoal} disabled={goalSaving || !goalAmount || !goalDate} className="px-4 py-2.5 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors disabled:opacity-50">{goalSaving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/AssetDashboard.tsx
git commit -m "feat: AssetDashboard 전면 재작성 — 7개 컴포넌트 조합"
```

---

### Task 10: FE — AssetForm에 original_amount + query param type 지원

**Files:**
- Modify: `frontend/src/pages/AssetForm.tsx`

- [ ] **Step 1: useSearchParams로 type query param 읽기**

AssetForm 상단에 추가:
```typescript
import { useSearchParams } from 'react-router-dom'
// ...
const [searchParams] = useSearchParams()
const preselectedType = searchParams.get('type')
```

type 초기값을 `preselectedType ?? 'deposit'`으로 설정.

- [ ] **Step 2: 대출 폼에 "원래 대출금" 필드 추가**

대출 전용 필드 영역(repayment_type, monthly_payment 근처)에 추가:
```tsx
<div>
  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">원래 대출금 (선택)</label>
  <input
    type="number"
    inputMode="numeric"
    value={form.original_amount ?? ''}
    onChange={e => setForm(prev => ({ ...prev, original_amount: e.target.value ? Number(e.target.value) : null }))}
    placeholder="대출 원금 (상환 진척도 표시용)"
    className="w-full px-3 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/40"
  />
</div>
```

- [ ] **Step 3: 빌드 확인**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/AssetForm.tsx
git commit -m "feat: AssetForm — original_amount 필드 + query param type 사전 선택"
```

---

### Task 11: 전체 테스트 + 가이드 + 새소식

**Files:**
- Modify: `frontend/src/pages/GuidePage.tsx`
- Modify: `frontend/src/data/changelogs.ts`

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd backend && python -m pytest tests/ -v
```

- [ ] **Step 2: 프론트엔드 lint + 테스트 + 빌드**

```bash
cd frontend && npm run lint && npm run test:run && npm run build
```

- [ ] **Step 3: GuidePage 자산 탭 섹션 업데이트**

자산 탭 관련 가이드를 새 UI에 맞게 수정 (순자산 히어로, 마일스톤, 변화 분해 설명).

- [ ] **Step 4: changelogs.ts에 새소식 추가**

```typescript
{
  version: '0.15.0',
  date: '2026-04-02',
  title: '자산 탭 리뉴얼',
  items: [
    { tag: '개선', text: '순자산 중심 UI로 자산 탭 전면 리디자인' },
    { tag: '신규', text: '이번 달 성과 카드 — 변화량과 원인을 한눈에' },
    { tag: '신규', text: '마일스톤 프로그레스 — 매달 체감 가능한 성장 지표' },
    { tag: '개선', text: '추이 차트 — 기간 선택, 역동적 Y축, 영역 차트' },
    { tag: '신규', text: '자산 0개일 때 온보딩 — 유형 선택으로 바로 등록' },
    { tag: '신규', text: '대출 상환 진척도 표시' },
  ],
},
```

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/pages/GuidePage.tsx frontend/src/data/changelogs.ts
git commit -m "docs: 자산 탭 리뉴얼 가이드 및 새소식 업데이트"
```

---

### Task 12: 최종 검증 + MSW 핸들러 업데이트

**Files:**
- Modify: `frontend/src/mocks/handlers.ts` (monthly-savings 응답 형식)
- Modify: `frontend/src/mocks/fixtures.ts` (Asset에 original_amount)

- [ ] **Step 1: MSW 핸들러 업데이트**

`handlers.ts`에서 monthly-savings 핸들러 응답을 새 형식으로:
```typescript
http.get('/api/assets/monthly-savings', () =>
  HttpResponse.json({ month: '2026-04', savings: 500000 })
),
```

`fixtures.ts`에서 Asset mock에 `original_amount: null` 추가.

- [ ] **Step 2: 전체 테스트 재실행**

```bash
cd backend && python -m pytest tests/ -v
cd frontend && npm run lint && npm run test:run && npm run build
```

- [ ] **Step 3: 기존 AssetDashboard 테스트 업데이트**

기존 `frontend/src/__tests__/AssetDashboard.test.tsx`가 새 컴포넌트 구조에 맞게 동작하는지 확인 및 수정.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/mocks/ frontend/src/__tests__/
git commit -m "test: MSW 핸들러 + fixture 업데이트 (monthly-savings 새 형식)"
```

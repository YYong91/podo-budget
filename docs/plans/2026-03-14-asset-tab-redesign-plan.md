# 자산 탭 고도화 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 자산 탭을 순자산 중심 + 목표 기반 코칭 UI로 전면 리디자인

**Architecture:** AssetGoal 모델 추가, monthly-savings API로 가계부 연동, 프론트엔드 AssetDashboard 전면 재작성. 기존 Asset/AssetSnapshot/price_service는 그대로 활용.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Alembic, React 19, TypeScript, Tailwind CSS v4, Chart.js

**Design Doc:** `docs/plans/2026-03-14-asset-tab-redesign-design.md`

---

## Task 1: AssetGoal 백엔드 모델 + 마이그레이션

**Files:**
- Create: `backend/app/models/asset_goal.py`
- Modify: `backend/app/models/__init__.py`
- Create: Alembic migration via `alembic revision`

**Step 1: AssetGoal 모델 생성**

```python
# backend/app/models/asset_goal.py
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.sql import func

from app.core.database import Base


class AssetGoal(Base):
    __tablename__ = "asset_goals"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_net_worth = Column(Numeric(18, 2), nullable=False)
    target_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

**Step 2: `__init__.py`에 등록**

`backend/app/models/__init__.py`에 추가:
```python
from app.models.asset_goal import AssetGoal  # noqa: F401
```

**Step 3: Alembic 마이그레이션 생성 및 적용**

```bash
cd backend && alembic revision --autogenerate -m "add_asset_goals_table"
alembic upgrade head
```

**Step 4: 커밋**

```bash
git add backend/app/models/asset_goal.py backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat: AssetGoal 모델 및 마이그레이션 추가"
```

---

## Task 2: AssetGoal 스키마 + 서비스

**Files:**
- Create: `backend/app/schemas/asset_goal.py`
- Create: `backend/app/services/asset_goal_service.py`

**Step 1: Pydantic 스키마**

```python
# backend/app/schemas/asset_goal.py
from datetime import date, datetime

from pydantic import BaseModel, Field


class AssetGoalCreate(BaseModel):
    target_net_worth: float = Field(..., gt=0)
    target_date: date
    household_id: int | None = None


class AssetGoalResponse(BaseModel):
    id: int
    target_net_worth: float
    target_date: date
    household_id: int | None = None
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssetGoalWithInsight(AssetGoalResponse):
    """목표 + 페이스 인사이트"""
    progress_pct: float  # 0~100
    monthly_required: float | None  # 월 필요 저축액
    estimated_date: date | None  # 예상 도달일
    pace_status: str  # "ahead" | "on_track" | "behind"
    pace_message: str  # 사용자에게 보여줄 메시지
```

**Step 2: 서비스 로직**

```python
# backend/app/services/asset_goal_service.py
import json
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset_goal import AssetGoal
from app.models.asset_snapshot import AssetSnapshot
from app.services.asset_service import get_asset_summary


async def get_goal(user_id: int, household_id: int | None, db: AsyncSession) -> AssetGoal | None:
    """활성 목표 조회 (사용자/가구 당 최신 1개)"""
    q = select(AssetGoal).where(AssetGoal.user_id == user_id)
    if household_id:
        q = q.where(AssetGoal.household_id == household_id)
    q = q.order_by(AssetGoal.created_at.desc()).limit(1)
    result = await db.execute(q)
    return result.scalar_one_or_none()


async def upsert_goal(
    user_id: int, household_id: int | None,
    target_net_worth: float, target_date: date,
    db: AsyncSession,
) -> AssetGoal:
    """목표 upsert: 기존 있으면 업데이트, 없으면 생성"""
    existing = await get_goal(user_id, household_id, db)
    if existing:
        existing.target_net_worth = target_net_worth
        existing.target_date = target_date
        await db.flush()
        await db.refresh(existing)
        return existing
    goal = AssetGoal(
        user_id=user_id,
        household_id=household_id,
        target_net_worth=target_net_worth,
        target_date=target_date,
    )
    db.add(goal)
    await db.flush()
    await db.refresh(goal)
    return goal


async def delete_goal(user_id: int, household_id: int | None, db: AsyncSession) -> bool:
    """목표 삭제"""
    goal = await get_goal(user_id, household_id, db)
    if not goal:
        return False
    await db.delete(goal)
    return True


async def get_goal_with_insight(
    user_id: int, household_id: int | None, db: AsyncSession
) -> dict | None:
    """목표 + 페이스 인사이트 계산"""
    goal = await get_goal(user_id, household_id, db)
    if not goal:
        return None

    # 현재 순자산
    summary = await get_asset_summary(user_id, household_id, db)
    current_nw = summary["net_worth"]
    target_nw = float(goal.target_net_worth)

    # 진행률
    progress_pct = min((current_nw / target_nw * 100) if target_nw > 0 else 0, 100)

    # 남은 개월
    today = date.today()
    days_left = (goal.target_date - today).days
    months_left = max(days_left / 30.0, 0.1)
    remaining = target_nw - current_nw

    # 월 필요 저축액
    monthly_required = remaining / months_left if remaining > 0 else 0

    # 최근 3개월 평균 순자산 증가율 (스냅샷 기반)
    snapshots = await _get_recent_snapshots(user_id, household_id, db, months=4)
    avg_monthly_growth = _calc_avg_monthly_growth(snapshots)

    # 예상 도달일
    estimated_date = None
    if avg_monthly_growth and avg_monthly_growth > 0 and remaining > 0:
        months_needed = remaining / avg_monthly_growth
        estimated_date = today + timedelta(days=int(months_needed * 30))

    # 페이스 판정
    if remaining <= 0:
        pace_status = "ahead"
        pace_message = "목표를 달성했어요! 🎉"
    elif estimated_date and estimated_date <= goal.target_date:
        diff_months = (goal.target_date - estimated_date).days // 30
        pace_status = "ahead"
        if diff_months > 0:
            pace_message = f"목표보다 {diff_months}개월 빠른 페이스!"
        else:
            pace_message = "순항 중! 이 페이스를 유지하세요"
    elif estimated_date:
        pace_status = "behind"
        pace_message = f"현재 페이스로는 {estimated_date.year}년 {estimated_date.month}월 예상"
    else:
        pace_status = "on_track"
        pace_message = "스냅샷이 쌓이면 예상 도달일을 알려드릴게요"

    return {
        **{c.name: getattr(goal, c.name) for c in goal.__table__.columns},
        "progress_pct": round(progress_pct, 1),
        "monthly_required": round(monthly_required),
        "estimated_date": estimated_date,
        "pace_status": pace_status,
        "pace_message": pace_message,
    }


async def _get_recent_snapshots(
    user_id: int, household_id: int | None, db: AsyncSession, months: int = 4
) -> list[AssetSnapshot]:
    q = select(AssetSnapshot).where(AssetSnapshot.user_id == user_id)
    if household_id:
        q = q.where(AssetSnapshot.household_id == household_id)
    q = q.order_by(AssetSnapshot.snapshot_date.desc()).limit(months)
    result = await db.execute(q)
    return list(result.scalars().all())


def _calc_avg_monthly_growth(snapshots: list[AssetSnapshot]) -> float | None:
    """최근 스냅샷에서 월평균 순자산 증가율 계산"""
    if len(snapshots) < 2:
        return None
    # 최신→과거 순으로 정렬되어 있음
    newest = float(snapshots[0].net_worth)
    oldest = float(snapshots[-1].net_worth)
    months = len(snapshots) - 1
    return (newest - oldest) / months if months > 0 else None
```

**Step 3: 커밋**

```bash
git add backend/app/schemas/asset_goal.py backend/app/services/asset_goal_service.py
git commit -m "feat: AssetGoal 스키마 및 서비스 로직 추가"
```

---

## Task 3: AssetGoal API 엔드포인트 + monthly-savings

**Files:**
- Modify: `backend/app/api/assets.py` — 4개 엔드포인트 추가

**Step 1: API 엔드포인트 추가**

`backend/app/api/assets.py`에 기존 엔드포인트 뒤에 추가:

```python
from app.schemas.asset_goal import AssetGoalCreate, AssetGoalResponse, AssetGoalWithInsight
from app.services import asset_goal_service

# --- 순자산 목표 ---

@router.get("/goal", response_model=AssetGoalWithInsight | None)
async def get_goal(
    household_id: int | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hid = household_id or await get_user_active_household_id(current_user.id, db)
    return await asset_goal_service.get_goal_with_insight(current_user.id, hid, db)


@router.post("/goal", response_model=AssetGoalResponse, status_code=201)
async def set_goal(
    body: AssetGoalCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hid = body.household_id or await get_user_active_household_id(current_user.id, db)
    goal = await asset_goal_service.upsert_goal(
        current_user.id, hid, body.target_net_worth, body.target_date, db,
    )
    await db.commit()
    return goal


@router.delete("/goal", status_code=204)
async def delete_goal(
    household_id: int | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    hid = household_id or await get_user_active_household_id(current_user.id, db)
    deleted = await asset_goal_service.delete_goal(current_user.id, hid, db)
    if not deleted:
        raise HTTPException(404, "목표가 없습니다")
    await db.commit()


# --- 월간 저축액 ---

@router.get("/monthly-savings")
async def get_monthly_savings(
    household_id: int | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """이번 달 수입 - 지출 = 순저축액"""
    from datetime import date
    from sqlalchemy import func as sqlfunc
    from app.models.expense import Expense
    from app.models.income import Income

    hid = household_id or await get_user_active_household_id(current_user.id, db)
    today = date.today()
    first_of_month = today.replace(day=1)

    # 이번 달 지출 합계
    exp_q = select(sqlfunc.coalesce(sqlfunc.sum(Expense.amount), 0)).where(
        Expense.date >= first_of_month,
        Expense.date <= today,
    )
    if hid:
        exp_q = exp_q.where(Expense.household_id == hid)
    else:
        exp_q = exp_q.where(Expense.user_id == current_user.id)
    total_expense = (await db.execute(exp_q)).scalar()

    # 이번 달 수입 합계
    inc_q = select(sqlfunc.coalesce(sqlfunc.sum(Income.amount), 0)).where(
        Income.date >= first_of_month,
        Income.date <= today,
    )
    if hid:
        inc_q = inc_q.where(Income.household_id == hid)
    else:
        inc_q = inc_q.where(Income.user_id == current_user.id)
    total_income = (await db.execute(inc_q)).scalar()

    return {
        "month": today.strftime("%Y-%m"),
        "total_income": float(total_income),
        "total_expense": float(total_expense),
        "net_savings": float(total_income) - float(total_expense),
    }
```

**주의:** `/goal`, `/monthly-savings` 경로를 `/{id}` 보다 **위에** 등록해야 함 (FastAPI 라우팅 순서)

**Step 2: 테스트 작성**

`backend/tests/test_asset_goal.py`:

```python
import pytest
from datetime import date, timedelta


@pytest.mark.asyncio
async def test_goal_crud(authenticated_client):
    # 목표 설정
    resp = await authenticated_client.post("/api/assets/goal", json={
        "target_net_worth": 100000000,
        "target_date": (date.today() + timedelta(days=365)).isoformat(),
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["target_net_worth"] == 100000000

    # 목표 조회 (insight 포함)
    resp = await authenticated_client.get("/api/assets/goal")
    assert resp.status_code == 200

    # 목표 업데이트 (upsert)
    resp = await authenticated_client.post("/api/assets/goal", json={
        "target_net_worth": 200000000,
        "target_date": (date.today() + timedelta(days=730)).isoformat(),
    })
    assert resp.status_code == 201
    assert resp.json()["target_net_worth"] == 200000000

    # 목표 삭제
    resp = await authenticated_client.delete("/api/assets/goal")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_monthly_savings(authenticated_client):
    resp = await authenticated_client.get("/api/assets/monthly-savings")
    assert resp.status_code == 200
    data = resp.json()
    assert "net_savings" in data
    assert "total_income" in data
    assert "total_expense" in data
```

**Step 3: 테스트 실행**

```bash
cd backend && pytest tests/test_asset_goal.py -v
```

**Step 4: 커밋**

```bash
git add backend/app/api/assets.py backend/tests/test_asset_goal.py
git commit -m "feat: 순자산 목표 API + monthly-savings 엔드포인트 추가"
```

---

## Task 4: 프론트엔드 API 클라이언트 + 타입

**Files:**
- Modify: `frontend/src/api/assets.ts` — goal/monthly-savings API 추가
- Modify: `frontend/src/types/index.ts` — AssetGoal 타입 추가

**Step 1: 타입 추가**

`frontend/src/types/index.ts`에 추가:

```typescript
export interface AssetGoal {
  id: number
  target_net_worth: number
  target_date: string
  household_id: number | null
  user_id: number
  progress_pct: number
  monthly_required: number | null
  estimated_date: string | null
  pace_status: 'ahead' | 'on_track' | 'behind'
  pace_message: string
  created_at: string
  updated_at: string
}

export interface MonthlySavings {
  month: string
  total_income: number
  total_expense: number
  net_savings: number
}
```

**Step 2: API 클라이언트 추가**

`frontend/src/api/assets.ts`에 추가:

```typescript
getGoal: (householdId?: number) =>
  api.get<AssetGoal | null>('/api/assets/goal', { params: { household_id: householdId } }),

setGoal: (data: { target_net_worth: number; target_date: string; household_id?: number }) =>
  api.post<AssetGoal>('/api/assets/goal', data),

deleteGoal: (householdId?: number) =>
  api.delete('/api/assets/goal', { params: { household_id: householdId } }),

getMonthlySavings: (householdId?: number) =>
  api.get<MonthlySavings>('/api/assets/monthly-savings', { params: { household_id: householdId } }),
```

**Step 3: 커밋**

```bash
git add frontend/src/types/index.ts frontend/src/api/assets.ts
git commit -m "feat: AssetGoal 프론트엔드 타입 및 API 클라이언트 추가"
```

---

## Task 5: AssetDashboard 프론트엔드 리디자인

**Files:**
- Rewrite: `frontend/src/pages/AssetDashboard.tsx`

이 태스크가 가장 크므로 단계별로 진행.

**Step 1: 데이터 fetching 업데이트**

기존 Promise.all에 goal + monthlySavings 추가:

```typescript
const [assetsRes, summaryRes, snapshotsRes, goalRes, savingsRes] = await Promise.all([
  assetApi.getAll(hid),
  assetApi.getSummary(hid),
  assetApi.getSnapshots(hid, 12),
  assetApi.getGoal(hid),
  assetApi.getMonthlySavings(hid),
])
```

**Step 2: 순자산 히어로 섹션**

기존 3-카드 그리드를 단일 히어로 섹션으로 교체:

```tsx
{/* 순자산 히어로 */}
<div className="bg-gradient-to-br from-grape-50 to-grape-100 border border-grape-200/60 rounded-2xl p-6">
  <p className="text-sm text-warm-500">순자산</p>
  <p className="text-3xl font-bold text-grape-700 mt-1">{formatAmount(netWorth)}</p>
  {/* 전월 대비 변화 */}
  {prevMonthDiff != null && (
    <p className={`text-sm mt-1 ${prevMonthDiff >= 0 ? 'text-leaf-600' : 'text-rose-600'}`}>
      전월 대비 {prevMonthDiff >= 0 ? '+' : ''}{formatAmount(prevMonthDiff)}
    </p>
  )}
  {/* 자산/부채 소계 */}
  <div className="flex gap-4 mt-3 text-xs text-warm-400">
    <span>자산 {formatAmount(totalAssets)}</span>
    <span>부채 {formatAmount(totalLiabilities)}</span>
  </div>
  {/* 이번 달 저축 */}
  {monthlySavings && monthlySavings.net_savings !== 0 && (
    <p className="text-xs text-warm-500 mt-2">
      이번 달 {monthlySavings.net_savings >= 0 ? '+' : ''}{formatAmount(monthlySavings.net_savings)} 저축 중
    </p>
  )}
</div>
```

**Step 3: 목표 프로그레스 바**

```tsx
{/* 목표 */}
{goal ? (
  <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5">
    <div className="flex items-center justify-between mb-2">
      <h2 className="text-sm font-semibold text-warm-700">순자산 목표</h2>
      <button onClick={() => setShowGoalModal(true)} className="text-xs text-grape-600">수정</button>
    </div>
    <div className="flex items-center justify-between text-xs text-warm-500 mb-1">
      <span>{formatAmount(netWorth)}</span>
      <span>{formatAmount(goal.target_net_worth)}</span>
    </div>
    <div className="w-full bg-warm-100 rounded-full h-3">
      <div
        className="bg-grape-500 h-3 rounded-full transition-all"
        style={{ width: `${Math.min(goal.progress_pct, 100)}%` }}
      />
    </div>
    <p className="text-sm text-warm-600 mt-2">{goal.pace_message}</p>
    {goal.monthly_required != null && goal.monthly_required > 0 && (
      <p className="text-xs text-warm-400 mt-1">
        월 {formatAmount(goal.monthly_required)} 저축 필요
      </p>
    )}
  </div>
) : (
  <button
    onClick={() => setShowGoalModal(true)}
    className="w-full bg-white rounded-2xl border border-dashed border-grape-300 p-5 text-center hover:bg-grape-50 transition-colors"
  >
    <Target className="w-6 h-6 text-grape-400 mx-auto mb-1" />
    <p className="text-sm text-grape-600 font-medium">순자산 목표를 설정해보세요</p>
  </button>
)}
```

**Step 4: 추이 차트 (목표선 포함)**

기존 라인차트에 목표선 데이터셋 추가:

```typescript
const lineDatasets = [
  {
    label: '순자산',
    data: snapshots.map(s => s.net_worth),
    borderColor: '#9333EA',
    backgroundColor: 'rgba(147,51,234,0.08)',
    fill: true,
    tension: 0.3,
    pointRadius: 4,
  },
]

// 목표가 있으면 목표선 추가
if (goal) {
  lineDatasets.push({
    label: '목표',
    data: snapshots.map((_, i) => {
      // 현재 순자산에서 목표까지 선형 보간
      const totalMonths = /* target_date까지 남은 개월 */
      const monthsFromStart = i
      return netWorth + (goal.target_net_worth - netWorth) * (monthsFromStart / totalMonths)
    }),
    borderColor: '#D1D5DB',
    borderDash: [5, 5],
    fill: false,
    tension: 0,
    pointRadius: 0,
  })
}
```

**Step 5: 유형별 그룹핑 자산 목록**

파이차트 + 종목별/계좌별 토글 제거, 유형 그룹으로 교체:

```tsx
const ASSET_GROUPS = [
  { label: '투자', types: ['stock_kr', 'stock_us', 'crypto'], icon: TrendingUp },
  { label: '예적금', types: ['deposit'], icon: Landmark },
  { label: '부동산/기타', types: ['real_estate', 'other'], icon: Building },
]

{ASSET_GROUPS.map(group => {
  const items = nonLiabilities.filter(a => group.types.includes(a.type))
  if (items.length === 0) return null
  const groupTotal = items.reduce((s, a) => s + (a.current_value ?? 0), 0)
  return (
    <CollapsibleSection key={group.label} title={group.label} total={groupTotal} icon={group.icon}>
      {items.map(asset => <AssetRow key={asset.id} asset={asset} />)}
    </CollapsibleSection>
  )
})}

{/* 부채 별도 */}
{liabilities.length > 0 && (
  <CollapsibleSection title="부채" total={totalLiabilities} icon={TrendingDown} variant="danger">
    {liabilities.map(asset => <AssetRow key={asset.id} asset={asset} />)}
  </CollapsibleSection>
)}
```

**Step 6: 목표 설정 모달**

간단한 모달: 목표 금액 + 목표 날짜 입력:

```tsx
{showGoalModal && (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center">
    <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6">
      <h3 className="text-lg font-semibold text-warm-800 mb-4">순자산 목표 설정</h3>
      <label className="text-sm text-warm-600">목표 금액</label>
      <input type="number" ... />
      <label className="text-sm text-warm-600 mt-3">목표 날짜</label>
      <input type="date" ... />
      <div className="flex gap-2 mt-6">
        <button onClick={handleSaveGoal} className="flex-1 bg-grape-600 text-white ...">저장</button>
        <button onClick={() => setShowGoalModal(false)} className="flex-1 border ...">취소</button>
      </div>
    </div>
  </div>
)}
```

**Step 7: 월간 업데이트 넛지**

```tsx
{lastUpdated && daysSinceUpdate > 30 && (
  <Link to="/assets/new" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
    <Bell className="w-5 h-5 text-amber-500" />
    <div>
      <p className="text-sm font-medium text-warm-700">자산 현황을 업데이트해보세요</p>
      <p className="text-xs text-warm-400">마지막 업데이트: {lastUpdated}</p>
    </div>
  </Link>
)}
```

**Step 8: 테스트 실행 + 빌드 확인**

```bash
cd frontend && npm run lint && npm run build
```

**Step 9: 커밋**

```bash
git add frontend/src/pages/AssetDashboard.tsx
git commit -m "feat: 자산 탭 순자산 중심 + 목표 기반 UI로 리디자인"
```

---

## Task 6: 테스트 + 가이드 + 새소식 업데이트

**Files:**
- Modify: `frontend/src/pages/GuidePage.tsx` — 자산 탭 설명 업데이트
- Modify: `frontend/src/data/changelogs.ts` — 새소식 추가
- Modify: `frontend/vite.config.ts` — PWA 캐시 버전 업

**Step 1: 백엔드 전체 테스트**

```bash
cd backend && pytest -v
```

**Step 2: 프론트엔드 테스트 + 빌드**

```bash
cd frontend && npm run lint && npm test -- --run && npm run build
```

**Step 3: GuidePage 자산 탭 섹션 업데이트**

자산 탭 관련 가이드 내용을 새 UI에 맞게 수정.

**Step 4: changelogs.ts에 새소식 추가**

```typescript
{
  version: '1.8.0',
  date: '2026-03-14',
  title: '자산 탭 리뉴얼',
  items: [
    { tag: '개선', text: '순자산 중심 UI로 자산 탭 전면 리디자인' },
    { tag: '신규', text: '순자산 목표 설정 및 달성 페이스 인사이트' },
    { tag: '신규', text: '가계부 연동 월간 저축액 표시' },
  ],
},
```

**Step 5: PWA 캐시 버전 업**

`frontend/vite.config.ts`에서 `cacheId` 버전 올리기.

**Step 6: 커밋**

```bash
git add frontend/src/pages/GuidePage.tsx frontend/src/data/changelogs.ts frontend/vite.config.ts
git commit -m "docs: 자산 탭 리뉴얼 가이드 및 새소식 업데이트"
```

---

## Task 7: 최종 검증 + PR

**Step 1: 전체 테스트**

```bash
cd backend && pytest -v
cd frontend && npm run lint && npm test -- --run && npm run build
```

**Step 2: PR 생성**

```bash
git push -u origin feature/asset-tab-redesign
gh pr create --base develop --title "feat: 자산 탭 순자산 중심 + 목표 기반 UI 리디자인"
```

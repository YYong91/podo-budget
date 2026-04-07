# 성능 최적화 Round 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** exchange_rate httpx 풀링, /prices 엔드포인트 병렬화, React Query staleTime 튜닝, 일일 스냅샷 자동 생성 4가지 최적화.

**Architecture:** BE는 기존 price_service 공유 클라이언트 활용 + asyncio.gather 병렬화. FE는 자산 쿼리 staleTime 연장. 일일 스냅샷은 Fly.io scheduled machine으로 cron API 호출.

**Tech Stack:** FastAPI, httpx, asyncio, React Query, Fly.io Machines API

---

### Task 1: exchange_rate.py httpx 풀링

**Files:**
- Modify: `backend/app/services/exchange_rate.py:50`

**Step 1: 공유 클라이언트 import + 적용**

`backend/app/services/exchange_rate.py`에서 `async with httpx.AsyncClient(timeout=5.0) as client:` 를 price_service의 공유 클라이언트로 교체:

```python
# 기존
async with httpx.AsyncClient(timeout=5.0) as client:
    resp = await client.get(f"https://api.frankfurter.dev/v1/latest?base={currency}&symbols=KRW")

# 변경
from app.services.price_service import _get_http_client
client = _get_http_client()
resp = await client.get(f"https://api.frankfurter.dev/v1/latest?base={currency}&symbols=KRW")
```

`import httpx` 는 더 이상 직접 사용하지 않으므로 제거.

**Step 2: BE 테스트 실행**

Run: `cd backend && pytest tests/ -x -q`
Expected: 전체 PASS

**Step 3: 커밋**

```
perf: exchange_rate 서비스도 공유 httpx 클라이언트 사용

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 2: /prices 엔드포인트 병렬화

**Files:**
- Modify: `backend/app/api/assets.py:186-202`

**Step 1: 순차 루프를 asyncio.gather로 교체**

```python
# 기존 (순차)
prices = {}
for asset in assets:
    if asset.ticker:
        info = await price_service.get_asset_current_value(asset, db)
        prices[asset.id] = info
return prices

# 변경 (병렬)
import asyncio
ticker_assets = [a for a in assets if a.ticker]
if not ticker_assets:
    return {}
results = await asyncio.gather(*[
    price_service.get_asset_current_value(a, db) for a in ticker_assets
])
return {a.id: info for a, info in zip(ticker_assets, results)}
```

**Step 2: BE 테스트 실행**

Run: `cd backend && pytest tests/ -x -q`
Expected: 전체 PASS

**Step 3: 커밋**

```
perf: /prices 엔드포인트 순차 루프 → asyncio.gather 병렬화

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 3: React Query staleTime 튜닝

**Files:**
- Modify: `frontend/src/pages/AssetDashboard.tsx:75-146`

현재 전역 staleTime이 30초. 자산 데이터는 자주 안 변하므로 자산 관련 쿼리에 staleTime을 늘려서 불필요한 refetch 방지.

**Step 1: 자산 관련 useQuery에 staleTime 추가**

`frontend/src/pages/AssetDashboard.tsx`의 4개 useQuery에 staleTime 추가:

```typescript
// assets — DB 데이터만이라 자주 안 변함
const { data: assets = [], ... } = useQuery({
  queryKey: ['assets', activeHouseholdId],
  queryFn: () => assetApi.getAll(activeHouseholdId!).then(r => r.data),
  enabled: !!activeHouseholdId,
  staleTime: 5 * 60 * 1000,  // 5분
})

// snapshots — 수동 갱신이라 더 길어도 됨
const { data: snapshots = [] } = useQuery({
  queryKey: ['asset-snapshots', activeHouseholdId],
  queryFn: () => assetApi.getSnapshots(activeHouseholdId!, 12).then(r => [...r.data].reverse()),
  enabled: !!activeHouseholdId,
  staleTime: 10 * 60 * 1000,  // 10분
})

// goal — 거의 안 변함
const { data: goal = null } = useQuery({
  ...
  staleTime: 10 * 60 * 1000,  // 10분
})

// savings — 월 단위 데이터
const { data: savings = null } = useQuery({
  ...
  staleTime: 10 * 60 * 1000,  // 10분
})
```

**Step 2: FE 테스트 + lint**

Run: `cd frontend && npx vitest run && npm run lint`
Expected: PASS

**Step 3: 커밋**

```
perf: 자산 대시보드 React Query staleTime 튜닝

자산/스냅샷/목표/저축 쿼리에 5~10분 staleTime 설정.
탭 전환 시 불필요한 refetch 방지.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 4: 일일 스냅샷 자동 생성 API + Fly.io cron

**Files:**
- Modify: `backend/app/api/assets.py` (내부 스냅샷 생성 엔드포인트 추가)
- Modify: `backend/fly.toml` (scheduled machine 설정)

현재 createSnapshot을 AssetForm에서 제거했으므로, 일일 자동 스냅샷이 없으면 순자산 추이 차트가 갱신되지 않음.

**Step 1: 전체 가구 스냅샷 배치 엔드포인트 추가**

`backend/app/api/assets.py`에 내부용 배치 엔드포인트 추가:

```python
@router.post("/snapshots/batch")
async def create_all_snapshots(
    x_cron_secret: str = Header(None, alias="X-Cron-Secret"),
    db: AsyncSession = Depends(get_db),
) -> object:
    """전체 가구 일일 스냅샷 배치 생성 (cron 전용)"""
    import os
    expected = os.getenv("CRON_SECRET", "")
    if not expected or x_cron_secret != expected:
        raise HTTPException(status_code=403, detail="Forbidden")

    # 활성 가구 목록 조회
    from app.models.household import Household
    result = await db.execute(select(Household))
    households = list(result.scalars().all())

    created = 0
    for household in households:
        # 가구의 첫 번째 멤버를 user로 사용 (스냅샷 저장용)
        from app.models.household import HouseholdMember
        member_result = await db.execute(
            select(HouseholdMember).where(
                HouseholdMember.household_id == household.id
            ).limit(1)
        )
        member = member_result.scalar_one_or_none()
        if not member:
            continue

        from app.models.user import User
        user_result = await db.execute(select(User).where(User.id == member.user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            continue

        try:
            await asset_service.create_snapshot(db, user, household.id)
            created += 1
        except Exception:
            logger.exception(f"스냅샷 생성 실패: household_id={household.id}")

    return {"created": created, "total_households": len(households)}
```

**Step 2: Fly.io secret 설정 + cron 호출**

Fly.io에서 cron은 scheduled machine 또는 외부 cron 서비스(GitHub Actions, cron-job.org 등)로 구현.

가장 간단한 방식: **GitHub Actions scheduled workflow**

`.github/workflows/daily-snapshot.yml`:
```yaml
name: Daily Asset Snapshot
on:
  schedule:
    - cron: '0 15 * * *'  # UTC 15:00 = KST 00:00
  workflow_dispatch:

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger snapshot batch
        run: |
          curl -sf -X POST \
            "${{ secrets.API_BASE_URL }}/api/assets/snapshots/batch" \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

**Step 3: BE 테스트 작성 + 실행**

```python
@pytest.mark.asyncio
async def test_snapshot_batch_forbidden_without_secret(authenticated_client):
    """cron secret 없이 호출하면 403"""
    response = await authenticated_client.post("/api/assets/snapshots/batch")
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_snapshot_batch_with_secret(authenticated_client, test_household, monkeypatch):
    """cron secret으로 호출하면 스냅샷 생성"""
    monkeypatch.setenv("CRON_SECRET", "test-secret")  # pragma: allowlist secret
    response = await authenticated_client.post(
        "/api/assets/snapshots/batch",
        headers={"X-Cron-Secret": "test-secret"},  # pragma: allowlist secret
    )
    assert response.status_code == 200
    assert response.json()["created"] >= 0
```

Run: `cd backend && pytest tests/integration/test_api_assets.py -x -q`
Expected: PASS

**Step 4: 커밋**

```
feat: 일일 스냅샷 배치 API + GitHub Actions cron

전체 가구의 자산 스냅샷을 매일 자정(KST) 자동 생성.
X-Cron-Secret 헤더로 인증.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## 수정 파일 요약

| Task | 파일 | 변경 |
|------|------|------|
| 1 | `backend/app/services/exchange_rate.py` | httpx 공유 클라이언트 사용 |
| 2 | `backend/app/api/assets.py` | /prices 병렬화 |
| 3 | `frontend/src/pages/AssetDashboard.tsx` | staleTime 추가 |
| 4 | `backend/app/api/assets.py` | /snapshots/batch 엔드포인트 |
| 4 | `.github/workflows/daily-snapshot.yml` | 일일 cron |
| 4 | `backend/tests/integration/test_api_assets.py` | 배치 테스트 |

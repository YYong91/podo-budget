# 자산유형 추가 (insurance, vehicle) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 자산유형에 보험/연금(insurance)과 자동차(vehicle)를 추가하여 가족 자산 현황을 더 완전하게 파악할 수 있게 한다.

**Architecture:** 기존 manual-value 패턴(deposit, real_estate, other와 동일)을 따르는 2개 타입 추가. BE schema regex + FE type union + 6개 UI 매핑 테이블 수정.

**Tech Stack:** FastAPI/Pydantic (BE), React/TypeScript (FE), Vitest/pytest (Test)

---

### Task 1: Backend — Pydantic 스키마 type regex 업데이트

**Files:**
- Modify: `backend/app/schemas/asset.py:8` (AssetBase.type 패턴)
- Modify: `backend/app/schemas/asset.py:29` (AssetUpdate.type 패턴)
- Test: `backend/tests/integration/test_api_assets.py`

**Step 1: 기존 자산 생성 테스트가 통과하는지 확인**

Run: `cd backend && pytest tests/integration/test_api_assets.py -v --timeout=30 -x`
Expected: PASS

**Step 2: insurance/vehicle 타입 생성 테스트 작성**

`backend/tests/integration/test_api_assets.py` 끝에 추가:

```python
@pytest.mark.asyncio
async def test_create_insurance_asset(authenticated_client, test_household):
    """보험/연금 자산유형 생성"""
    response = await authenticated_client.post("/api/assets", json={
        "name": "국민연금",
        "type": "insurance",
        "manual_value": 15000000,
        "household_id": test_household.id,
    })
    assert response.status_code == 201
    assert response.json()["type"] == "insurance"
    assert response.json()["manual_value"] == 15000000


@pytest.mark.asyncio
async def test_create_vehicle_asset(authenticated_client, test_household):
    """자동차 자산유형 생성"""
    response = await authenticated_client.post("/api/assets", json={
        "name": "현대 아이오닉6",
        "type": "vehicle",
        "manual_value": 35000000,
        "household_id": test_household.id,
    })
    assert response.status_code == 201
    assert response.json()["type"] == "vehicle"
    assert response.json()["manual_value"] == 35000000
```

**Step 3: 테스트 실행 → 실패 확인**

Run: `cd backend && pytest tests/integration/test_api_assets.py::test_create_insurance_asset tests/integration/test_api_assets.py::test_create_vehicle_asset -v`
Expected: FAIL (422 Validation Error — regex 불일치)

**Step 4: 스키마 수정**

`backend/app/schemas/asset.py` 두 곳의 regex 패턴에 `insurance|vehicle` 추가:

Line 8 (AssetBase):
```python
type: str = Field(..., pattern="^(stock_kr|stock_us|crypto|deposit|real_estate|other|loan|insurance|vehicle)$")
```

Line 29 (AssetUpdate):
```python
type: str | None = Field(None, pattern="^(stock_kr|stock_us|crypto|deposit|real_estate|other|loan|insurance|vehicle)$")
```

**Step 5: 테스트 실행 → 통과 확인**

Run: `cd backend && pytest tests/integration/test_api_assets.py::test_create_insurance_asset tests/integration/test_api_assets.py::test_create_vehicle_asset -v`
Expected: PASS

**Step 6: 전체 BE 테스트 회귀 확인**

Run: `cd backend && pytest -x --timeout=30`
Expected: 전체 PASS

**Step 7: 커밋**

```
feat: 자산유형 insurance/vehicle 스키마 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 2: Backend — 자연어 파싱 프롬프트 업데이트

**Files:**
- Modify: `backend/app/services/asset_parse_service.py:12` (ASSET_PARSE_PROMPT의 type 목록)

**Step 1: 프롬프트 수정**

`ASSET_PARSE_PROMPT` 내 type 목록에 `insurance`, `vehicle` 추가:

```
- type: stock_kr | stock_us | crypto | deposit | real_estate | other | loan | insurance | vehicle
```

**Step 2: 커밋**

```
feat: 자연어 파싱 프롬프트에 insurance/vehicle 유형 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 3: Frontend — TypeScript 타입 + AssetForm 매핑

**Files:**
- Modify: `frontend/src/types/index.ts:3` (AssetType union)
- Modify: `frontend/src/pages/AssetForm.tsx:18` (로컬 AssetType union)
- Modify: `frontend/src/pages/AssetForm.tsx:20-28` (TYPE_LABELS)
- Test: `frontend/src/pages/__tests__/AssetForm.test.tsx`

**Step 1: AssetForm 테스트 추가**

`frontend/src/pages/__tests__/AssetForm.test.tsx`에 추가:

```typescript
it('보험/연금 유형이 직접 입력 드롭다운에 표시된다', async () => {
  renderNewAssetForm()
  await userEvent.click(screen.getByText('직접 입력'))
  const select = screen.getByRole('combobox')
  await userEvent.selectOptions(select, 'insurance')
  expect((select as HTMLSelectElement).value).toBe('insurance')
})

it('자동차 유형이 직접 입력 드롭다운에 표시된다', async () => {
  renderNewAssetForm()
  await userEvent.click(screen.getByText('직접 입력'))
  const select = screen.getByRole('combobox')
  await userEvent.selectOptions(select, 'vehicle')
  expect((select as HTMLSelectElement).value).toBe('vehicle')
})
```

**Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run src/pages/__tests__/AssetForm.test.tsx`
Expected: FAIL

**Step 3: 타입 + 매핑 수정**

`frontend/src/types/index.ts:3`:
```typescript
export type AssetType = 'stock_kr' | 'stock_us' | 'crypto' | 'deposit' | 'real_estate' | 'other' | 'loan' | 'insurance' | 'vehicle'
```

`frontend/src/pages/AssetForm.tsx:18`:
```typescript
type AssetType = 'stock_kr' | 'stock_us' | 'crypto' | 'deposit' | 'real_estate' | 'other' | 'loan' | 'insurance' | 'vehicle'
```

`frontend/src/pages/AssetForm.tsx:20-28` TYPE_LABELS에 추가:
```typescript
const TYPE_LABELS: Record<AssetType, string> = {
  stock_kr: '한국주식/ETF',
  stock_us: '미국주식/ETF',
  crypto: '코인',
  deposit: '예적금',
  real_estate: '부동산',
  insurance: '보험/연금',
  vehicle: '자동차',
  other: '기타자산',
  loan: '대출/부채',
}
```

**Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run src/pages/__tests__/AssetForm.test.tsx`
Expected: PASS

**Step 5: 커밋**

```
feat: FE 타입 + AssetForm에 insurance/vehicle 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 4: Frontend — 대시보드 그룹 + 온보딩 + 통계

**Files:**
- Modify: `frontend/src/components/asset/AssetGroupList.tsx:16-22` (ASSET_GROUPS)
- Modify: `frontend/src/components/asset/AssetOnboarding.tsx:14-21` (ASSET_TYPES)
- Modify: `frontend/src/components/stats/AssetChangeSummary.tsx:11-19` (TYPE_LABELS)

**Step 1: AssetGroupList에 보험/연금, 자동차 그룹 추가**

`frontend/src/components/asset/AssetGroupList.tsx:16-22`:
```typescript
const ASSET_GROUPS: { label: string; types: AssetType[]; isLiability?: boolean }[] = [
  { label: '투자', types: ['stock_kr', 'stock_us', 'crypto'] },
  { label: '예적금', types: ['deposit'] },
  { label: '부동산', types: ['real_estate'] },
  { label: '보험/연금', types: ['insurance'] },
  { label: '자동차', types: ['vehicle'] },
  { label: '기타', types: ['other'] },
  { label: '부채 (대출)', types: ['loan'], isLiability: true },
]
```

**Step 2: AssetOnboarding에 보험/연금, 자동차 카드 추가**

`frontend/src/components/asset/AssetOnboarding.tsx:14-21`:
```typescript
const ASSET_TYPES: { type: AssetType; label: string; emoji: string }[] = [
  { type: 'deposit', label: '예·적금', emoji: '🏦' },
  { type: 'stock_kr', label: '국내 주식', emoji: '📈' },
  { type: 'crypto', label: '코인', emoji: '🪙' },
  { type: 'real_estate', label: '부동산', emoji: '🏠' },
  { type: 'insurance', label: '보험/연금', emoji: '🔒' },
  { type: 'vehicle', label: '자동차', emoji: '🚗' },
  { type: 'other', label: '기타 자산', emoji: '💼' },
  { type: 'loan', label: '대출', emoji: '📋' },
]
```

**Step 3: AssetChangeSummary TYPE_LABELS 업데이트**

`frontend/src/components/stats/AssetChangeSummary.tsx:11-19`:
```typescript
const TYPE_LABELS: Record<string, string> = {
  stock_kr: '국내주식',
  stock_us: '해외주식',
  crypto: '암호화폐',
  deposit: '예적금',
  real_estate: '부동산',
  insurance: '보험/연금',
  vehicle: '자동차',
  other: '기타',
  loan: '대출',
}
```

**Step 4: FE 전체 테스트 + lint + build**

Run: `cd frontend && npx vitest run && npm run lint`
Expected: PASS

**Step 5: 커밋**

```
feat: 대시보드/온보딩/통계에 insurance/vehicle 유형 표시

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 5: 테스트 fixture/mock 업데이트 + 전체 회귀 테스트

**Files:**
- Check: `frontend/src/mocks/fixtures.ts` (insurance/vehicle fixture 필요 시 추가)
- Check: `frontend/src/mocks/handlers.ts` (mock 핸들러 확인)
- Check: `frontend/src/__tests__/AssetDashboard.test.tsx`

**Step 1: fixture/mock에 새 타입 관련 데이터 필요 여부 확인**

기존 테스트가 특정 타입에 의존하는지 확인. 새 타입은 기존과 동일한 manual_value 패턴이므로 기존 mock에 영향 없을 가능성 높음.

**Step 2: FE 전체 테스트**

Run: `cd frontend && npx vitest run`
Expected: PASS

**Step 3: BE 전체 테스트**

Run: `cd backend && pytest -x --timeout=30`
Expected: PASS

**Step 4: FE build 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: PASS (기존 타입 에러 제외)

**Step 5: 최종 커밋 (필요 시)**

테스트/fixture 수정이 필요했다면 커밋:
```
test: insurance/vehicle 타입 추가에 따른 테스트 업데이트

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## 수정 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/schemas/asset.py` | type regex에 `insurance\|vehicle` 추가 (2곳) |
| `backend/app/services/asset_parse_service.py` | LLM 프롬프트 type 목록 업데이트 |
| `backend/tests/integration/test_api_assets.py` | insurance/vehicle 생성 테스트 추가 |
| `frontend/src/types/index.ts` | AssetType union 추가 |
| `frontend/src/pages/AssetForm.tsx` | 로컬 타입 + TYPE_LABELS 추가 |
| `frontend/src/components/asset/AssetGroupList.tsx` | ASSET_GROUPS 추가 |
| `frontend/src/components/asset/AssetOnboarding.tsx` | ASSET_TYPES 카드 추가 |
| `frontend/src/components/stats/AssetChangeSummary.tsx` | TYPE_LABELS 추가 |
| `frontend/src/pages/__tests__/AssetForm.test.tsx` | 새 타입 드롭다운 테스트 |

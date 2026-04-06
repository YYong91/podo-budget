# 자산 기능 비활성화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 피처 플래그(`VITE_FEATURE_ASSETS=false`)로 자산/계좌 기능을 비활성화하여 가계부 핵심에 집중 + 성능 개선

**Architecture:** 환경변수 기반 피처 플래그 → 네비게이션/라우팅/돌아보기/가이드 등에서 조건부 렌더링. 백엔드 API/DB는 유지(데이터 보존). GitHub Actions cron 비활성화.

**Tech Stack:** React 19, TypeScript, Vite 환경변수, React Query, Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-asset-disable-floating-tabbar-design.md`

---

## 파일 구조

### 신규 파일
- `frontend/src/config/features.ts` — 피처 플래그 설정

### 수정 파일
- `frontend/src/components/Layout.tsx:18-22` — navItems에서 자산 탭 조건부 제외
- `frontend/src/App.tsx:25-27,113-116` — 자산/계좌 라우트 조건부 + 리다이렉트
- `frontend/src/pages/InsightsPage.tsx:22,173-213,287-301,423-425` — 자산 쿼리/섹션/AI분석 제거
- `frontend/src/components/stats/UnifiedSummaryCards.tsx:75-82` — 순자산 카드 조건부
- `frontend/src/components/stats/SectionToggleModal.tsx:53` — 자산 토글 조건부
- `frontend/src/components/stats/StructuredInsightsView.tsx:31-41` — 자산 분석 섹션 조건부
- `frontend/src/pages/GuidePage.tsx:29,226-249` — 자산 관리 섹션 조건부
- `frontend/src/utils/healthScore.ts` — totalAssets/totalLiabilities 기본값 처리
- `.github/workflows/daily-snapshot.yml` — schedule 제거
- `frontend/src/data/changelogs.ts` — 변경사항 기록

### 테스트 수정
- `frontend/src/components/__tests__/Layout.test.tsx:82,102-104` — 자산 탭 테스트 조건부
- `frontend/src/pages/__tests__/InsightsPage.test.tsx` — 자산 관련 assertion 제거
- `frontend/src/components/stats/__tests__/UnifiedSummaryCards.test.tsx` — 순자산 카드 테스트

---

### Task 1: 피처 플래그 설정 파일

**Files:**
- Create: `frontend/src/config/features.ts`

- [ ] **Step 1: 피처 플래그 파일 생성**

```typescript
// frontend/src/config/features.ts
export const FEATURES = {
  assets: import.meta.env.VITE_FEATURE_ASSETS === 'true',
}
```

- [ ] **Step 2: 환경변수 파일에 기본값 추가**

`frontend/.env.development`에 추가:
```
VITE_FEATURE_ASSETS=false
```

`frontend/.env.production`이 있으면 동일하게 추가. 없으면 빌드 시 기본값 `undefined` → `false` 처리됨.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/config/features.ts frontend/.env.development
git commit -m "feat: 피처 플래그 설정 — VITE_FEATURE_ASSETS"
```

---

### Task 2: 네비게이션에서 자산 탭 제거

**Files:**
- Modify: `frontend/src/components/Layout.tsx:18-22`
- Modify: `frontend/src/components/__tests__/Layout.test.tsx`

- [ ] **Step 1: Layout.tsx navItems 수정**

`Layout.tsx`의 `navItems` 배열에서 자산 탭을 `FEATURES.assets` 조건부로 필터링:

```typescript
import { FEATURES } from '../config/features'

const navItems: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/home', label: '가계부', icon: Receipt },
  ...(FEATURES.assets ? [{ path: '/assets', label: '자산', icon: Landmark }] : []),
  { path: '/insights', label: '돌아보기', icon: TrendingUp },
  { path: '/settings', label: '더보기', icon: SettingsIcon },
]
```

`Landmark` import는 유지 (FEATURES.assets=true일 때 필요). 단 `FEATURES.assets=false`일 때 ESLint `no-unused-vars` 에러가 날 수 있으므로, spread 구문 안에서 인라인으로 참조하거나, lint 에러가 나면 Task 8 전체 검증에서 수정.

- [ ] **Step 2: Layout 테스트 업데이트**

`Layout.test.tsx`에서 자산 탭 관련 테스트:

Line 82: `expect(screen.getAllByRole('link', { name: /^자산$/i }).length).toBe(2)` → 조건부 또는 제거

Line 102-104: `/assets 경로에서 자산 탭이 활성화된다` 테스트 → 조건부 스킵:

```typescript
// 피처 플래그가 false이면 자산 탭이 없으므로 스킵
it.skipIf(!FEATURES.assets)('/assets 경로에서 자산 탭이 활성화된다', () => {
  // 기존 코드 유지
})
```

자산 탭 개수 assertion도 동적으로 변경:

```typescript
const expectedNavCount = FEATURES.assets ? 4 : 3
```

- [ ] **Step 3: 테스트 실행**

Run: `cd frontend && npx vitest run src/components/__tests__/Layout.test.tsx`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/Layout.tsx frontend/src/components/__tests__/Layout.test.tsx
git commit -m "feat: 네비게이션에서 자산 탭 조건부 제거"
```

---

### Task 3: 라우팅에서 자산/계좌 경로 제거

**Files:**
- Modify: `frontend/src/App.tsx:25-27,113-116`

- [ ] **Step 1: App.tsx 수정**

lazy import는 그대로 유지 (lazy는 렌더 시에만 로드되므로 비용 없음):
```typescript
import { FEATURES } from './config/features'
// lazy import는 변경 없이 유지
```

라우트만 조건부로:
```tsx
{FEATURES.assets && (
  <>
    <Route path="/assets" element={<AssetDashboard />} />
    <Route path="/assets/new" element={<AssetForm />} />
    <Route path="/assets/:id" element={<AssetForm />} />
    <Route path="/accounts" element={<AccountManager />} />
  </>
)}
{/* 비활성 상태에서 자산/계좌 URL 직접 접근 시 홈으로 리다이렉트 */}
{!FEATURES.assets && (
  <>
    <Route path="/assets/*" element={<Navigate to="/home" replace />} />
    <Route path="/accounts/*" element={<Navigate to="/home" replace />} />
  </>
)}
```

`Navigate` import 추가: `import { Navigate } from 'react-router-dom'` (이미 있으면 확인만).

- [ ] **Step 2: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공 (타입 에러 없음)

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/App.tsx
git commit -m "feat: 자산/계좌 라우트 조건부 제거 + 리다이렉트"
```

---

### Task 4: 돌아보기에서 자산 데이터 제거

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`
- Modify: `frontend/src/pages/__tests__/InsightsPage.test.tsx`

- [ ] **Step 1: InsightsPage.tsx 수정**

1) import에 피처 플래그 추가:
```typescript
import { FEATURES } from '../config/features'
```

2) Group 4 (자산 쿼리) 조건부:
```typescript
// ── Group 4: 자산 — 피처 플래그로 비활성화 가능 ──
const { data: snapshots = [] } = useQuery({
  queryKey: ['insights-snapshots', activeHouseholdId],
  queryFn: () => assetApi.getSnapshots(activeHouseholdId!, 2).then(r => r.data),
  enabled: !!activeHouseholdId && FEATURES.assets,
})
```

3) assetSummary 파생 — `FEATURES.assets`가 false이면 null:
```typescript
const { prevSnapshot, assetSummary } = useMemo(() => {
  if (!FEATURES.assets) return { prevSnapshot: null, assetSummary: null }
  // 기존 스냅샷 파생 로직 유지
}, [snapshots])
```

4) 건강점수 — 자산 값을 0으로:
```typescript
totalLiabilities: assetSummary?.total_liabilities ?? 0,
totalAssets: assetSummary?.total_assets ?? 0,
```
이건 이미 `?? 0` 처리되어 있으므로 assetSummary가 null이면 자동으로 0. 수정 불필요.

5) AI 분석 요청 데이터에서 자산 부분 조건부:
```typescript
if (FEATURES.assets && assetSummary) {
  // 기존 assets 데이터 전달 코드
}
```

6) AssetChangeSummary 섹션:
```typescript
{FEATURES.assets && sectionVisibility.assets && (
  <AssetChangeSummary ... />
)}
```

7) assetApi import — FEATURES.assets가 false이면 사용하지 않지만, 빌드 에러 방지를 위해 import는 유지.

- [ ] **Step 2: InsightsPage 테스트 업데이트**

파일: `frontend/src/pages/__tests__/InsightsPage.test.tsx`

`FEATURES.assets=false`이므로 `enabled: false` → 스냅샷 쿼리 미실행 → 자산 관련 UI 미렌더링.

테스트에서 자산 관련 assertion 확인:
```bash
grep -n "asset\|자산\|snapshot\|순자산\|net_worth" frontend/src/pages/__tests__/InsightsPage.test.tsx
```

있으면 제거하거나 `FEATURES.assets` 조건부 스킵. 없으면 수정 불필요.

- [ ] **Step 3: 테스트 실행**

Run: `cd frontend && npx vitest run src/pages/__tests__/InsightsPage.test.tsx`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/InsightsPage.tsx frontend/src/pages/__tests__/InsightsPage.test.tsx
git commit -m "feat: 돌아보기에서 자산 쿼리/섹션 조건부 비활성화"
```

---

### Task 5: 요약카드 + 섹션토글 + 인사이트뷰 조건부

**Files:**
- Modify: `frontend/src/components/stats/UnifiedSummaryCards.tsx:75-82`
- Modify: `frontend/src/components/stats/SectionToggleModal.tsx:53`
- Modify: `frontend/src/components/stats/StructuredInsightsView.tsx:31-41`
- Modify: 해당 테스트 파일들

- [ ] **Step 1: UnifiedSummaryCards 순자산 카드 숨김**

```typescript
import { FEATURES } from '../../config/features'

// 순자산 카드 렌더링 조건에 FEATURES.assets 추가
{FEATURES.assets && netWorth != null && (
  <Link to="/assets" ...>
    ...순자산 카드...
  </Link>
)}
```

- [ ] **Step 2: SectionToggleModal 자산 토글 숨김**

`sections` 배열에서 assets 항목 필터링:
```typescript
import { FEATURES } from '../../config/features'

const filteredSections = sections.filter(s => {
  if (s.key === 'assets' && !FEATURES.assets) return false
  return true
})
```

또는 렌더링 시 조건부:
```typescript
{FEATURES.assets && <ToggleItem key="assets" ... />}
```

- [ ] **Step 3: StructuredInsightsView 자산 분석 숨김**

```typescript
import { FEATURES } from '../../config/features'

{FEATURES.assets && insights.asset_analysis && (
  // 기존 자산 분석 섹션
)}
```

- [ ] **Step 4: 테스트 업데이트**

파일: `frontend/src/components/stats/__tests__/UnifiedSummaryCards.test.tsx`

순자산 카드 관련 assertion 확인:
```bash
grep -n "asset\|자산\|순자산\|net_worth\|/assets" frontend/src/components/stats/__tests__/UnifiedSummaryCards.test.tsx
```

순자산 카드 클릭 → `/assets` 이동 테스트가 있으면 `it.skipIf(!FEATURES.assets)` 또는 제거.

- [ ] **Step 5: 테스트 실행**

Run: `cd frontend && npx vitest run src/components/stats/__tests__/`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/stats/
git commit -m "feat: 요약카드/섹션토글/인사이트뷰 자산 관련 조건부 숨김"
```

---

### Task 6: 가이드 페이지 자산 섹션 숨김

**Files:**
- Modify: `frontend/src/pages/GuidePage.tsx:29,226-249`

- [ ] **Step 1: GuidePage 수정**

섹션 목록에서 assets 항목 필터링:
```typescript
import { FEATURES } from '../config/features'

// 섹션 목록 정의 부분
const sections = [
  ...
  ...(FEATURES.assets ? [{ id: 'assets', icon: Landmark, label: '자산 관리' }] : []),
  ...
]
```

섹션 콘텐츠(Line 226-249)도 조건부:
```typescript
{FEATURES.assets && (
  <SectionCard id="assets" icon={Landmark} title="자산 관리">
    ...기존 내용...
  </SectionCard>
)}
```

돌아보기 섹션 내 자산 언급(Line 203, 212, 218, 221)도 조건부 텍스트 처리 또는 유지 (사소한 수준이면 유지).

- [ ] **Step 2: LandingPage 자산 문구 확인**

`frontend/src/pages/LandingPage.tsx`에서 자산 관련 문구를 검색:
```bash
grep -n "자산\|asset\|순자산" frontend/src/pages/LandingPage.tsx
```

자산 관련 문구가 있으면 `FEATURES.assets` 조건부로 숨기거나, 가계부 중심 문구로 교체.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/GuidePage.tsx frontend/src/pages/LandingPage.tsx
git commit -m "feat: 가이드/랜딩 페이지 자산 관련 조건부 숨김"
```

---

### Task 7: GitHub Actions cron 비활성화

**Files:**
- Modify: `.github/workflows/daily-snapshot.yml`

- [ ] **Step 1: schedule 트리거 제거**

```yaml
name: Daily Asset Snapshot
on:
  # schedule 비활성화 — 자산 기능 일시 중단 (VITE_FEATURE_ASSETS=false)
  # 복원 시: cron: '0 15 * * *' (UTC 15:00 = KST 00:00) 추가
  workflow_dispatch:

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger snapshot batch
        run: |
          curl -sf -X POST \
            "${{ secrets.PROD_API_URL }}/api/assets/snapshots/batch" \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

- [ ] **Step 2: 커밋**

```bash
git add .github/workflows/daily-snapshot.yml
git commit -m "chore: 일일 스냅샷 cron 비활성화 — 자산 기능 일시 중단"
```

---

### Task 8: changelogs + 전체 검증

**Files:**
- Modify: `frontend/src/data/changelogs.ts`

- [ ] **Step 1: changelogs 업데이트**

```typescript
{
  version: '0.16.0',
  date: '2026-04-06',
  title: '가계부 집중 업데이트',
  items: [
    { tag: '변경', text: '자산 기능을 일시 비활성화하여 가계부 핵심에 집중합니다' },
  ],
},
```

- [ ] **Step 2: 전체 테스트**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: lint 0 errors, 전체 테스트 PASS, 빌드 성공

- [ ] **Step 3: 백엔드 테스트 (변경 없지만 확인)**

Run: `cd backend && python -m pytest tests/ -x -q`
Expected: 전체 PASS

- [ ] **Step 4: CLAUDE.md 업데이트**

`CLAUDE.md`의 Current State 섹션에 자산 비활성화 상태 반영:
- "4탭 네비게이션(가계부/리포트/자산/설정)" → "3탭 네비게이션(가계부/리포트/설정) — 자산 피처 플래그 비활성화"
- 자산 관련 현황 문구에 "(비활성화)" 표시

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/data/changelogs.ts CLAUDE.md
git commit -m "docs: changelogs + CLAUDE.md 자산 기능 비활성화 반영"
```

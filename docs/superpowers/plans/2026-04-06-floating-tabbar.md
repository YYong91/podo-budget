# 플로팅 탭바 구현 계획 (PR 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 전체 너비 하단 탭바를 iOS 26 리퀴드 글래스 스타일 플로팅 아일랜드로 교체하고 FAB을 제거

**Architecture:** `FloatingTabBar.tsx` 신규 컴포넌트 → Layout.tsx에서 기존 탭바 교체. glass morphism CSS 변수를 `index.css`에 추가. FAB(`FloatingActionButton.tsx`) 삭제. 입력 버튼은 아일랜드 내부 우측에 배치.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-06-asset-disable-floating-tabbar-design.md` (서브프로젝트 2)

---

## 파일 구조

### 신규 파일
- `frontend/src/components/FloatingTabBar.tsx` — 플로팅 아일랜드 탭바 (모바일 전용)
- `frontend/src/components/__tests__/FloatingTabBar.test.tsx` — 탭바 테스트

### 수정 파일
- `frontend/src/index.css` — glass morphism CSS 변수 추가
- `frontend/src/components/Layout.tsx` — 기존 하단 탭바 → FloatingTabBar 교체, FAB 모바일 제거(데스크톱 유지), pb-40 → pb-24 조정
- `frontend/src/components/__tests__/Layout.test.tsx` — 탭바 관련 테스트 업데이트
- `frontend/vite.config.ts` — PWA cacheId 버전업
- `frontend/src/data/changelogs.ts` — 변경사항 기록

### 수정 (모바일 숨김)
- `frontend/src/components/FloatingActionButton.tsx` — 모바일 숨김 (`hidden md:flex`), PR 3에서 완전 삭제 예정

---

### Task 1: glass morphism CSS 변수 + PWA CSS 정리

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: CSS 변수 추가**

`frontend/src/index.css`의 `:root` 섹션에 추가:
```css
/* 리퀴드 글래스 탭바 */
--glass-bg: rgba(255, 255, 255, 0.7);
--glass-border: rgba(255, 255, 255, 0.2);
```

`.dark` 섹션에 추가:
```css
/* 리퀴드 글래스 탭바 (다크모드) */
--glass-bg: rgba(35, 30, 48, 0.7);
--glass-border: rgba(255, 255, 255, 0.1);
```

- [ ] **Step 1.5: PWA standalone 스타일 업데이트**

`@media (display-mode: standalone)` 블록(line ~204-218)에서:
- `.pwa-nav-container`, `.pwa-nav-icon`, `.pwa-nav-label` 규칙 삭제 (기존 탭바용 — FloatingTabBar는 자체 사이징 사용)
- `.pwa-fab-position` 규칙 삭제 (FAB 제거됨)
- 대신 FloatingTabBar용 PWA standalone 스타일 추가:
```css
@media (display-mode: standalone) {
  /* 플로팅 아일랜드 — standalone 모드에서 아이콘/라벨 확대 */
  .floating-island-icon {
    width: 1.5rem !important;
    height: 1.5rem !important;
  }
  .floating-island-label {
    font-size: 11px !important;
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd /Users/seungyong/projects/podo-budget-asset-disable/frontend && npm run build 2>&1 | tail -5`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-asset-disable
git add frontend/src/index.css
git commit -m "style: glass morphism CSS 변수 추가"
```

---

### Task 2: FloatingTabBar 컴포넌트 (TDD)

**Files:**
- Create: `frontend/src/components/FloatingTabBar.tsx`
- Create: `frontend/src/components/__tests__/FloatingTabBar.test.tsx`

- [ ] **Step 1: 테스트 파일 먼저 작성**

`frontend/src/components/__tests__/FloatingTabBar.test.tsx`:

```typescript
/**
 * @file FloatingTabBar.test.tsx
 * @description 플로팅 아일랜드 탭바 컴포넌트 테스트
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FloatingTabBar from '../FloatingTabBar'

function renderTabBar(onInputOpen = vi.fn(), initialPath = '/home') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <FloatingTabBar onInputOpen={onInputOpen} />
    </MemoryRouter>
  )
}

describe('FloatingTabBar', () => {
  it('3개 탭(가계부/돌아보기/더보기)을 렌더링한다', () => {
    renderTabBar()
    expect(screen.getByRole('link', { name: '가계부' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '돌아보기' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '더보기' })).toBeInTheDocument()
  })

  it('입력 버튼을 렌더링한다', () => {
    renderTabBar()
    expect(screen.getByRole('button', { name: '거래 입력' })).toBeInTheDocument()
  })

  it('현재 경로(/home)에서 가계부 탭이 활성화된다', () => {
    renderTabBar()
    const link = screen.getByRole('link', { name: '가계부' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('입력 버튼 클릭 시 onInputOpen 콜백을 호출한다', () => {
    const onInputOpen = vi.fn()
    renderTabBar(onInputOpen)
    fireEvent.click(screen.getByRole('button', { name: '거래 입력' }))
    expect(onInputOpen).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd /Users/seungyong/projects/podo-budget-asset-disable/frontend && npx vitest run src/components/__tests__/FloatingTabBar.test.tsx 2>&1 | tail -10`
Expected: FAIL (FloatingTabBar.tsx 없음)

- [ ] **Step 3: FloatingTabBar.tsx 구현**

`frontend/src/components/FloatingTabBar.tsx`:

```typescript
/**
 * @file FloatingTabBar.tsx
 * @description iOS 26 리퀴드 글래스 스타일 플로팅 아일랜드 탭바 (모바일 전용)
 */
import { Link, useLocation } from 'react-router-dom'
import { Receipt, TrendingUp, Settings as SettingsIcon, Pencil } from 'lucide-react'
import { FEATURES } from '../config/features'

interface FloatingTabBarProps {
  /** 입력 버튼 클릭 시 호출 */
  onInputOpen: () => void
  /** 읽지 않은 changelog 있을 때 true */
  hasUnreadChangelog?: boolean
}

const NAV_ITEMS = [
  { path: '/home', label: '가계부', icon: Receipt },
  ...(FEATURES.assets ? [{ path: '/assets', label: '자산', icon: Receipt }] : []),
  { path: '/insights', label: '돌아보기', icon: TrendingUp },
  { path: '/settings', label: '더보기', icon: SettingsIcon },
]

export default function FloatingTabBar({ onInputOpen, hasUnreadChangelog }: FloatingTabBarProps) {
  const { pathname } = useLocation()

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  return (
    /* 모바일 전용 — md 이상은 숨김 */
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      {/* 플로팅 아일랜드 */}
      <nav
        aria-label="하단 탭 메뉴"
        className="pointer-events-auto flex items-center gap-1 px-6 py-2 rounded-full shadow-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl"
      >
        {/* 탭 목록 */}
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path)
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${
                active
                  ? 'text-grape-600'
                  : 'text-[var(--text-muted)] active:text-[var(--text-tertiary)]'
              }`}
            >
              <span className="relative">
                <Icon className={`w-5 h-5 floating-island-icon ${active ? 'stroke-[2.5]' : ''}`} />
                {item.path === '/settings' && hasUnreadChangelog && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </span>
              <span className={`text-[10px] leading-tight floating-island-label ${active ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* 구분선 */}
        <div className="w-px h-8 bg-[var(--glass-border)] mx-1" aria-hidden="true" />

        {/* 입력 버튼 */}
        <button
          onClick={onInputOpen}
          aria-label="거래 입력"
          className="w-10 h-10 rounded-full bg-grape-600 hover:bg-grape-700 active:bg-grape-800 flex items-center justify-center transition-colors shadow-sm"
        >
          <Pencil className="w-4.5 h-4.5 text-white" />
        </button>
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd /Users/seungyong/projects/podo-budget-asset-disable/frontend && npx vitest run src/components/__tests__/FloatingTabBar.test.tsx 2>&1 | tail -15`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-asset-disable
git add frontend/src/components/FloatingTabBar.tsx frontend/src/components/__tests__/FloatingTabBar.test.tsx
git commit -m "feat: FloatingTabBar 컴포넌트 — 리퀴드 글래스 플로팅 아일랜드"
```

---

### Task 3: Layout.tsx — 탭바 교체 + FAB 제거

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Delete: `frontend/src/components/FloatingActionButton.tsx`
- Modify: `frontend/src/components/__tests__/Layout.test.tsx`

- [ ] **Step 1: Layout 테스트 업데이트 (TDD)**

`Layout.test.tsx`에서 하단 탭바 관련 테스트 업데이트:

1. FAB 관련 테스트가 있으면 제거
2. 하단 탭바가 `fixed bottom-0` → `포인트-events-none` 컨테이너 안 `nav`로 변경되므로 `getByRole('navigation', { name: '하단 탭 메뉴' })`가 여전히 동작하는지 확인
3. 탭 개수 assertion: `FEATURES.assets=false`이면 3개 탭 (가계부/돌아보기/더보기)

현재 Layout 테스트가 FloatingTabBar를 분리된 컴포넌트로 렌더링하므로 Layout 테스트에서 탭 링크가 2개(사이드바 + FloatingTabBar) → FloatingTabBar는 별도 컴포넌트이므로 Layout 테스트에서는 mock 처리 가능.

FloatingTabBar를 mock하는 방식으로 Layout 테스트 단순화:
```typescript
vi.mock('../FloatingTabBar', () => ({
  default: ({ onInputOpen }: { onInputOpen: () => void }) => (
    <nav aria-label="하단 탭 메뉴" data-testid="floating-tab-bar">
      <button onClick={onInputOpen}>거래 입력</button>
    </nav>
  ),
}))
```

- [ ] **Step 2: Layout.tsx 수정**

변경 사항:
1. `FloatingTabBar` import 추가
2. 기존 모바일 `<nav aria-label="하단 탭 메뉴" ...>...</nav>` 전체를 `<FloatingTabBar onInputOpen={() => {}} hasUnreadChangelog={hasUnreadChangelog} />`로 교체
   - `onInputOpen`은 PR 3(즉시 입력 UX)에서 구현. 현재는 no-op.
3. `pb-40` → `pb-24` (아일랜드가 더 작아지므로):
   - `<main className="flex-1 p-4 pb-24 md:p-6 md:pb-24 ...">` (pb-40 → pb-24)
4. **FAB: 모바일에서만 숨기기**. 기존 FAB 컴포넌트는 유지하되, 모바일에서 숨김 처리 (`hidden md:flex`):
   - `FloatingActionButton.tsx`의 최상위 div에 `hidden md:flex` 추가 (기존 `flex` → `hidden md:flex`)
   - 이유: 데스크톱에서 FAB이 지출+수입 양쪽 경로를 제공하므로, PR 3 QuickInput 구현 전까지 유지
   - PR 3에서 QuickInput 완성 시 FAB 완전 삭제

- [ ] **Step 3: FAB 모바일 숨김 처리**

`FloatingActionButton.tsx`의 최상위 div 클래스에서:
```
className="fixed bottom-[calc(...)] md:bottom-6 right-4 md:right-6 z-40 flex flex-col items-end gap-3 pwa-fab-position"
```
→
```
className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col items-end gap-3"
```
- `hidden md:flex`: 모바일 숨김, 데스크톱 표시
- 모바일용 `bottom` 계산 제거 (모바일에서 안 보이므로 불필요)
- `pwa-fab-position` 클래스 제거 (standalone PWA에서도 데스크톱만 표시)

- [ ] **Step 3.5: FloatingActionButton 테스트 업데이트**

`FloatingActionButton.test.tsx`가 있으면 읽고, 모바일 숨김 관련 테스트 업데이트 필요 여부 확인.
JSDOM에서 `hidden md:flex`는 CSS로만 동작하므로 기존 테스트는 그대로 통과해야 함.

- [ ] **Step 4: 전체 테스트 실행**

Run: `cd /Users/seungyong/projects/podo-budget-asset-disable/frontend && npm run test:run 2>&1 | tail -20`
Expected: 전체 PASS

- [ ] **Step 5: 빌드 확인**

Run: `cd /Users/seungyong/projects/podo-budget-asset-disable/frontend && npm run build 2>&1 | tail -10`
Expected: 빌드 성공

- [ ] **Step 6: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-asset-disable
git add frontend/src/components/Layout.tsx frontend/src/components/__tests__/Layout.test.tsx frontend/src/components/FloatingActionButton.tsx
git commit -m "feat: Layout — FloatingTabBar 교체, FAB 모바일 숨김"
```

---

### Task 4: PWA cacheId 버전업 + changelogs

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/data/changelogs.ts`

- [ ] **Step 1: vite.config.ts cacheId 업데이트**

Read `frontend/vite.config.ts`, find `cacheId` (currently `podo-budget-v15`) and increment to `podo-budget-v16`.

- [ ] **Step 2: changelogs.ts 업데이트**

가장 최근 항목 (PR 1에서 추가한 `0.16.0`) 뒤가 아닌, 맨 앞에 새 버전 추가:

현재 changelogs.ts 맨 앞 확인 후 버전 결정. PR 1에서 `0.16.0`을 추가했으므로 이 PR도 같은 버전에 items 추가하거나, 별도 배포라면 `0.16.1` 또는 해당 changelogs 구조에 맞게.

실제로는 같은 PR 사이클이므로 PR 1과 동일 버전(`0.16.0`) items에 추가:
```typescript
{ tag: '개선', text: '하단 메뉴가 리퀴드 글래스 아일랜드로 새로워졌어요' },
```

- [ ] **Step 3: 전체 테스트 + 빌드**

Run:
```bash
cd /Users/seungyong/projects/podo-budget-asset-disable/frontend && npm run lint && npm run test:run && npm run build 2>&1 | tail -20
```
Expected: 전체 PASS

- [ ] **Step 4: Push + PR 생성**

```bash
cd /Users/seungyong/projects/podo-budget-asset-disable
git add frontend/vite.config.ts frontend/src/data/changelogs.ts
git commit -m "chore: PWA cacheId v16, changelogs 탭바 리뉴얼 반영"
git push origin feature/asset-disable
```

PR 생성 (from main repo):
```bash
cd /Users/seungyong/projects/podo-budget
gh pr create \
  --title "feat: 플로팅 아일랜드 탭바 — 리퀴드 글래스 스타일" \
  --base develop \
  --head feature/asset-disable \
  --body "$(cat <<'EOF'
## Summary

- iOS 26 리퀴드 글래스 스타일 플로팅 아일랜드 탭바 구현
- 기존 전체 너비 하단 탭바 → 하단 중앙 플로팅 아일랜드로 교체
- 3탭(가계부/돌아보기/더보기) + 구분선 + 입력 버튼(✏️)이 하나의 아일랜드
- backdrop-blur-xl + glass morphism CSS 변수 신규 정의
- safe-area-inset-bottom 대응 (iOS 노치/다이나믹 아일랜드)
- FAB은 모바일에서만 숨김 (`hidden md:flex`), 데스크톱 유지 — PR 3에서 완전 제거
- PWA cacheId v16 (Layout 대규모 변경 후 캐시 충돌 방지)

## Test plan

- [x] FloatingTabBar.test.tsx — 4 tests PASS
- [x] Layout.test.tsx — 전체 PASS
- [x] npm run lint — 0 errors
- [x] npm run test:run — 전체 PASS
- [x] npm run build — 빌드 성공

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Note: PR 2는 feature/asset-disable 브랜치에 PR 1 커밋 위에 쌓이므로, PR 1 머지 후 rebase하거나 같은 브랜치로 PR 생성.
실제로는 PR 1이 먼저 머지된 후 PR 2를 별도 브랜치로 분리하는 게 이상적이나, 여기서는 동일 브랜치를 사용.

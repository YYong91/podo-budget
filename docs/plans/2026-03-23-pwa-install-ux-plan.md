# PWA 설치 유도 UX 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PWA 미설치 사용자에게 하단 배너 + 설정 메뉴로 설치를 유도하고, iOS 사용자에게는 수동 안내 모달을 제공한다.

**Architecture:** `useInstallPrompt` 커스텀 훅이 beforeinstallprompt 이벤트 캡처, iOS 감지, standalone 감지, localStorage 상태를 관리. InstallBanner와 SettingsPage가 이 훅을 사용. iOS 안내는 IosInstallGuide 모달 컴포넌트.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + RTL, lucide-react

---

### Task 1: useInstallPrompt 커스텀 훅

**Files:**
- Create: `frontend/src/hooks/useInstallPrompt.ts`
- Test: `frontend/src/hooks/__tests__/useInstallPrompt.test.ts`

**Step 1: 테스트 작성**

`frontend/src/hooks/__tests__/useInstallPrompt.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from '../useInstallPrompt'

describe('useInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    // standalone이 아닌 기본 상태
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('기본 상태에서 isInstalled=false, isBannerVisible=true', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isInstalled).toBe(false)
    expect(result.current.isBannerVisible).toBe(true)
  })

  it('standalone 모드이면 isInstalled=true, isBannerVisible=false', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isInstalled).toBe(true)
    expect(result.current.isBannerVisible).toBe(false)
  })

  it('dismissBanner 호출 시 localStorage에 기록되고 isBannerVisible=false', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isBannerVisible).toBe(true)

    act(() => {
      result.current.dismissBanner()
    })

    expect(result.current.isBannerVisible).toBe(false)
    expect(localStorage.getItem('pwa-install-banner-dismissed')).toBe('true')
  })

  it('localStorage에 dismissed가 있으면 처음부터 isBannerVisible=false', () => {
    localStorage.setItem('pwa-install-banner-dismissed', 'true')
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isBannerVisible).toBe(false)
  })

  it('iOS userAgent를 감지한다', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    })
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isIOS).toBe(true)
  })
})
```

**Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useInstallPrompt.test.ts`
Expected: FAIL — 모듈 없음

**Step 3: 훅 구현**

`frontend/src/hooks/useInstallPrompt.ts`:

```typescript
/**
 * @file useInstallPrompt.ts
 * @description PWA 설치 프롬프트 관리 훅
 * - beforeinstallprompt 이벤트 캡처 (Android/Chrome)
 * - iOS 감지 (Safari 수동 안내 필요)
 * - standalone 모드 감지 (이미 설치됨)
 * - 배너 dismiss 상태 관리 (localStorage)
 */

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa-install-banner-dismissed'

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches
  )
  const [isIOS] = useState(() =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
  )
  const [isDismissed, setIsDismissed] = useState(() =>
    localStorage.getItem(DISMISSED_KEY) === 'true'
  )

  // beforeinstallprompt 이벤트 캡처
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // standalone 모드 변경 감지 (설치 완료 시)
  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)')
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const dismissBanner = useCallback(() => {
    setIsDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }, [])

  const isBannerVisible = !isInstalled && !isDismissed

  return {
    deferredPrompt,
    isInstalled,
    isIOS,
    isBannerVisible,
    promptInstall,
    dismissBanner,
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useInstallPrompt.test.ts`
Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/hooks/useInstallPrompt.ts frontend/src/hooks/__tests__/useInstallPrompt.test.ts
git commit -m "feat: useInstallPrompt 커스텀 훅 추가

beforeinstallprompt 캡처, iOS 감지, standalone 감지, 배너 dismiss 관리

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: IosInstallGuide 모달

**Files:**
- Create: `frontend/src/components/IosInstallGuide.tsx`
- Test: `frontend/src/components/__tests__/IosInstallGuide.test.tsx`

**Step 1: 테스트 작성**

`frontend/src/components/__tests__/IosInstallGuide.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import IosInstallGuide from '../IosInstallGuide'

describe('IosInstallGuide', () => {
  it('모달이 3단계 안내를 표시한다', () => {
    render(<IosInstallGuide onClose={vi.fn()} />)
    expect(screen.getByText(/공유 버튼/)).toBeInTheDocument()
    expect(screen.getByText(/홈 화면에 추가/)).toBeInTheDocument()
    expect(screen.getByText(/추가/)).toBeInTheDocument()
  })

  it('확인 버튼 클릭 시 onClose 호출', () => {
    const onClose = vi.fn()
    render(<IosInstallGuide onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('배경 딤 클릭 시 onClose 호출', () => {
    const onClose = vi.fn()
    render(<IosInstallGuide onClose={onClose} />)
    fireEvent.click(screen.getByTestId('ios-guide-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/IosInstallGuide.test.tsx`
Expected: FAIL

**Step 3: 컴포넌트 구현**

`frontend/src/components/IosInstallGuide.tsx`:

```tsx
/**
 * @file IosInstallGuide.tsx
 * @description iOS Safari에서 PWA 설치하는 방법을 안내하는 모달
 */

import { Share, PlusSquare, CheckSquare } from 'lucide-react'

interface Props {
  onClose: () => void
}

const steps = [
  {
    icon: Share,
    title: '공유 버튼 탭',
    description: 'Safari 하단의 공유 버튼(□↑)을 탭하세요',
  },
  {
    icon: PlusSquare,
    title: '"홈 화면에 추가" 선택',
    description: '메뉴에서 "홈 화면에 추가"를 찾아 탭하세요',
  },
  {
    icon: CheckSquare,
    title: '"추가" 탭',
    description: '오른쪽 상단의 "추가"를 탭하면 완료!',
  },
]

export default function IosInstallGuide({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <div
        data-testid="ios-guide-backdrop"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-[var(--surface-card)] rounded-2xl shadow-xl max-w-sm w-full p-6 animate-slide-up">
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
          앱으로 설치하기
        </h3>
        <p className="text-sm text-[var(--text-tertiary)] mb-5">
          Safari에서 홈 화면에 추가하세요
        </p>

        <div className="space-y-4">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div key={idx} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-grape-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-grape-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {idx + 1}. {step.title}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-grape-600 text-white rounded-xl text-sm font-semibold hover:bg-grape-700 transition-colors"
        >
          확인
        </button>
      </div>
    </div>
  )
}
```

**Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/IosInstallGuide.test.tsx`
Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/components/IosInstallGuide.tsx frontend/src/components/__tests__/IosInstallGuide.test.tsx
git commit -m "feat: iOS PWA 설치 안내 모달 (IosInstallGuide)

3단계 시각적 가이드: 공유 버튼 → 홈 화면에 추가 → 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: InstallBanner 컴포넌트

**Files:**
- Create: `frontend/src/components/InstallBanner.tsx`
- Test: `frontend/src/components/__tests__/InstallBanner.test.tsx`

**Step 1: 테스트 작성**

`frontend/src/components/__tests__/InstallBanner.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import InstallBanner from '../InstallBanner'

// useInstallPrompt 훅 모킹
const mockPromptInstall = vi.fn()
const mockDismissBanner = vi.fn()

vi.mock('../../hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({
    deferredPrompt: null,
    isInstalled: false,
    isIOS: false,
    isBannerVisible: true,
    promptInstall: mockPromptInstall,
    dismissBanner: mockDismissBanner,
  }),
}))

describe('InstallBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('배너가 노출된다', () => {
    render(<InstallBanner />)
    expect(screen.getByText(/앱으로 설치/)).toBeInTheDocument()
  })

  it('닫기 버튼 클릭 시 dismissBanner 호출', () => {
    render(<InstallBanner />)
    fireEvent.click(screen.getByLabelText('배너 닫기'))
    expect(mockDismissBanner).toHaveBeenCalledTimes(1)
  })
})
```

별도 테스트 파일로 isBannerVisible=false 상태 테스트:

```tsx
// 같은 파일 내에서 vi.mock override 불가하므로 조건부 렌더링으로 처리
// InstallBanner 내부에서 isBannerVisible=false면 null 반환하도록 구현
```

**Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/InstallBanner.test.tsx`
Expected: FAIL

**Step 3: 컴포넌트 구현**

`frontend/src/components/InstallBanner.tsx`:

```tsx
/**
 * @file InstallBanner.tsx
 * @description PWA 설치 유도 하단 배너
 * - Android: 네이티브 프롬프트 호출
 * - iOS: IosInstallGuide 모달 열기
 * - 닫기 시 localStorage에 기록, 다시 안 보임
 */

import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import IosInstallGuide from './IosInstallGuide'

export default function InstallBanner() {
  const { isIOS, isBannerVisible, deferredPrompt, promptInstall, dismissBanner } = useInstallPrompt()
  const [showIosGuide, setShowIosGuide] = useState(false)

  if (!isBannerVisible) return null

  const handleInstall = () => {
    if (isIOS) {
      setShowIosGuide(true)
    } else if (deferredPrompt) {
      promptInstall()
    }
  }

  return (
    <>
      <div className="fixed bottom-16 md:bottom-4 left-4 right-4 z-40 mx-auto max-w-md animate-slide-up">
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-lg border border-[var(--border-default)] p-4 flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-grape-50 flex items-center justify-center">
            <img src="/pwa-64x64.png" alt="" className="w-7 h-7 rounded" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">앱으로 설치</p>
            <p className="text-xs text-[var(--text-tertiary)]">홈 화면에서 바로 실행하세요</p>
          </div>
          <button
            onClick={handleInstall}
            className="flex-shrink-0 px-3 py-1.5 bg-grape-600 text-white text-xs font-semibold rounded-lg hover:bg-grape-700 transition-colors flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            {isIOS ? '방법 보기' : '설치'}
          </button>
          <button
            onClick={dismissBanner}
            aria-label="배너 닫기"
            className="flex-shrink-0 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIosGuide && (
        <IosInstallGuide onClose={() => setShowIosGuide(false)} />
      )}
    </>
  )
}
```

**Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run src/components/__tests__/InstallBanner.test.tsx`
Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/components/InstallBanner.tsx frontend/src/components/__tests__/InstallBanner.test.tsx
git commit -m "feat: PWA 설치 유도 배너 (InstallBanner)

Android: 네이티브 프롬프트, iOS: 안내 모달, 닫기 시 다시 안 보임

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Layout에 InstallBanner 배치

**Files:**
- Modify: `frontend/src/components/Layout.tsx:209` (FloatingActionButton 아래)

**Step 1: Layout에 InstallBanner import + 렌더링**

`frontend/src/components/Layout.tsx` 수정:

```tsx
// import 추가
import InstallBanner from './InstallBanner'

// FloatingActionButton 아래에 추가 (line 210 부근)
<FloatingActionButton />
<InstallBanner />
```

**Step 2: 프론트엔드 빌드 + 테스트 확인**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: ALL PASS

**Step 3: 커밋**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: Layout에 InstallBanner 배치

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 설정 페이지에 "앱으로 설치" 메뉴 추가

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

**Step 1: 설정 메뉴에 앱 설치 항목 추가**

`frontend/src/pages/SettingsPage.tsx` 수정:

1. import 추가:
```tsx
import { Download } from 'lucide-react'  // 기존 import 목록에 추가
import { useInstallPrompt } from '../hooks/useInstallPrompt'
```

2. SettingsPage 컴포넌트 내부에 훅 사용:
```tsx
const { isInstalled, isIOS, deferredPrompt, promptInstall } = useInstallPrompt()
const [showIosGuide, setShowIosGuide] = useState(false)
```

3. menuItems 배열에서 "화면 모드" 앞에 추가:
```tsx
// "앱으로 설치" — PWA 미설치 시에만 클릭 가능
...(!isInstalled ? [{
  to: '#',  // 실제로는 onClick으로 처리
  label: '앱으로 설치',
  description: isIOS ? 'Safari에서 홈 화면에 추가' : '홈 화면에서 바로 실행',
  icon: Download,
}] : []),
```

이 방식은 기존 MenuItem 구조(Link 기반)와 맞지 않으므로, 대신 menuItems 바로 위에 별도 버튼으로 렌더링하는 방식을 사용:

**SettingsMenu 렌더링 전에 설치 버튼 카드 추가:**

```tsx
if (!section) {
  return (
    <div className="space-y-4">
      {/* PWA 설치 안내 (미설치 시에만) */}
      {!isInstalled && (
        <button
          onClick={() => isIOS ? setShowIosGuide(true) : promptInstall()}
          className="w-full bg-gradient-to-r from-grape-500 to-grape-600 rounded-2xl shadow-sm p-4 flex items-center gap-4 hover:from-grape-600 hover:to-grape-700 transition-all"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-white">앱으로 설치</p>
            <p className="text-xs text-white/70">
              {isIOS ? 'Safari에서 홈 화면에 추가' : '홈 화면에서 바로 실행하세요'}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/50" />
        </button>
      )}
      <SettingsMenu menuItems={menuItems} />
      {showIosGuide && <IosInstallGuide onClose={() => setShowIosGuide(false)} />}
    </div>
  )
}
```

4. IosInstallGuide import:
```tsx
import IosInstallGuide from '../components/IosInstallGuide'
```

**Step 2: 프론트엔드 빌드 + 테스트 확인**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: ALL PASS

**Step 3: 커밋**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat: 설정 페이지에 PWA 설치 버튼 추가

미설치 시 grape 그래디언트 카드로 설치 유도
iOS: 안내 모달, Android: 네이티브 프롬프트

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: animate-slide-up CSS 추가 + changelogs 업데이트

**Files:**
- Modify: `frontend/src/index.css` — slide-up 애니메이션 추가
- Modify: `frontend/src/data/changelogs.ts` — 새소식 추가

**Step 1: CSS 애니메이션 추가**

`frontend/src/index.css`에 추가:

```css
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
```

**Step 2: changelogs 업데이트**

`frontend/src/data/changelogs.ts` 최신 항목에 추가 또는 새 버전:

```typescript
{
  version: '0.8.0',
  date: '2026-03-23',
  title: '카테고리 개편 + PWA 설치 유도',
  items: [
    { tag: '개선', text: '카테고리 체계를 25개(지출 18 + 수입 7)로 정립했습니다' },
    { tag: '신규', text: '자녀/육아, 대출/이자, 세금/공과금 카테고리가 추가되었습니다' },
    { tag: '개선', text: '시스템 기본 카테고리에 잠금 표시가 됩니다' },
    { tag: '신규', text: '앱 설치 안내 배너가 표시됩니다 (설정에서도 접근 가능)' },
  ],
},
```

**Step 3: 프론트엔드 빌드 + 테스트 확인**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: ALL PASS

**Step 4: 커밋**

```bash
git add frontend/src/index.css frontend/src/data/changelogs.ts
git commit -m "feat: slide-up 애니메이션 + PWA 설치 유도 changelog 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 전체 검증

**Step 1: 프론트엔드 전체 검증**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: lint 0 errors, tests ALL PASS, build 성공

**Step 2: 로컬에서 수동 확인 (선택)**

- `npm run dev`로 로컬 서버 실행
- 모바일 브라우저(Chrome)에서 접속 → 하단 배너 확인
- 설정 페이지 → "앱으로 설치" 카드 확인
- X 버튼으로 닫기 → 새로고침해도 안 나옴 확인
- localStorage에서 `pwa-install-banner-dismissed` 삭제 → 다시 나옴 확인

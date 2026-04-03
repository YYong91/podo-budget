# 랜딩 페이지 v0 통합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v0 브랜치(origin/v0/yyong91-54374fe4)의 Next.js 랜딩 페이지 7개 섹션을 기존 React + Vite + Tailwind v4 프론트엔드에 통합

**Architecture:** v0의 섹션별 컴포넌트 구조를 그대로 유지하되, Next.js 의존성(next/image, next/link, style jsx)을 React/React Router로 변환하고, Tailwind v3 CSS 변수 기반 색상을 Grape 디자인 시스템 토큰으로 매핑한다. 모든 커스텀 애니메이션은 index.css의 @theme 블록에 통합.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, React Router v7, Vite 7

**Spec:** `docs/superpowers/specs/2026-03-31-landing-page-v0-integration-design.md`

**v0 소스:** `git show origin/v0/yyong91-54374fe4:<path>` 로 참조

---

## 색상 매핑 참조표

구현 중 v0 코드의 색상을 변환할 때 이 표를 참조:

| v0 클래스 | → Grape 토큰 |
|---|---|
| `bg-primary` | `bg-grape-500` |
| `text-primary` | `text-grape-500` |
| `text-primary-foreground` | `text-white` |
| `bg-primary/10`, `bg-primary/20` | `bg-grape-500/10`, `bg-grape-500/20` |
| `border-primary/20` | `border-grape-500/20` |
| `bg-accent` | `bg-leaf-500` |
| `text-accent` | `text-leaf-500` |
| `bg-background` | `bg-cream` |
| `text-foreground` | `text-warm-900` |
| `text-secondary-foreground` | `text-warm-900` |
| `text-muted-foreground` | `text-warm-500` |
| `bg-muted`, `bg-muted/30` | `bg-warm-100`, `bg-warm-100/30` |
| `border-border` | `border-warm-300` |
| `bg-card` | `bg-white` |
| `bg-[#f3e8ff]` | `bg-grape-100` |
| `text-[#7e22ce]` | `text-grape-700` |
| `bg-[#e9d5ff]` | `bg-grape-200` |
| `border-[#e9d5ff]` | `border-grape-200` |
| `bg-[#dcfce7]` | `bg-leaf-100` |
| `text-[#16a34a]` | `text-leaf-600` |
| `border-[#bbf7d0]` | `border-leaf-200` |
| `bg-[#fef3c7]` | `bg-amber-100` |
| `text-[#d97706]` | `text-amber-600` |
| `border-[#fde68a]` | `border-amber-200` |

---

### Task 1: index.css에 랜딩페이지 애니메이션 추가

**Files:**
- Modify: `frontend/src/index.css` — @theme 블록에 애니메이션 키프레임 4개 추가

- [ ] **Step 1: @theme 블록에 애니메이션 변수 + 키프레임 추가**

`frontend/src/index.css`의 `@theme { ... }` 블록 내부, 기존 `@keyframes bounce-in` 뒤에 추가:

```css
  /* 랜딩페이지 애니메이션 */
  --animate-fade-in-up: fade-in-up 0.6s ease-out both;
  --animate-float-glow: float-glow 8s ease-in-out infinite;
  --animate-bubble-in: bubble-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
  --animate-cta-pulse: cta-pulse 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;

  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes float-glow {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
    50%      { transform: translate(-50%, -52%) scale(1.06); opacity: 0.7; }
  }

  @keyframes bubble-in {
    from { opacity: 0; transform: translateY(10px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes cta-pulse {
    0%   { box-shadow: 0 0 0 0 oklch(0.55 0.27 295 / 0.5); }
    60%  { box-shadow: 0 0 0 12px oklch(0.55 0.27 295 / 0); }
    100% { box-shadow: 0 0 0 0 oklch(0.55 0.27 295 / 0); }
  }
```

- [ ] **Step 2: @theme 블록 밖에 TypingDots bounce 키프레임 추가**

`@theme { }` 블록 닫는 중괄호 **바로 뒤**, `.dark {` 블록 **앞**에 추가:

```css
/* 히어로 채팅 타이핑 점 애니메이션 */
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
```

- [ ] **Step 3: 빌드 검증**

Run: `cd frontend && npm run build`
Expected: 빌드 성공, CSS 파싱 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/index.css
git commit -m "feat: 랜딩페이지 애니메이션 키프레임 추가 (fade-in-up, float-glow, bubble-in, cta-pulse)"
```

---

### Task 2: useInView 훅 생성

**Files:**
- Create: `frontend/src/hooks/useInView.ts`

- [ ] **Step 1: v0의 useInView 훅을 가져와서 변환**

v0 원본: `git show origin/v0/yyong91-54374fe4:hooks/use-in-view.ts`

`frontend/src/hooks/useInView.ts` 생성 — `"use client"` 지시문 제거 (Vite에서 불필요):

```typescript
import { useEffect, useRef, useState } from 'react'

interface UseInViewOptions {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
}

export function useInView(options: UseInViewOptions = {}) {
  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options
  const ref = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          if (triggerOnce) {
            observer.unobserve(element)
          }
        } else if (!triggerOnce) {
          setIsInView(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [threshold, rootMargin, triggerOnce])

  return { ref, isInView }
}
```

- [ ] **Step 2: lint 검증**

Run: `cd frontend && npx eslint src/hooks/useInView.ts`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/hooks/useInView.ts
git commit -m "feat: useInView 스크롤 트리거 훅 추가"
```

---

### Task 3: Header 컴포넌트

**Files:**
- Create: `frontend/src/components/landing/Header.tsx`

- [ ] **Step 1: v0 Header를 변환하여 생성**

v0 원본: `git show origin/v0/yyong91-54374fe4:components/landing/header.tsx`

변환 사항:
- `"use client"` 제거
- `import Image from "next/image"` → `<img>` 태그
- `<Image src="/logo.png" ... />` → `<img src="/maskable-icon-512x512.png" ... />`
- `bg-background/80` → `bg-cream/80`
- `text-foreground` → `text-warm-900`
- `text-muted-foreground` → `text-warm-500`
- `bg-primary` → `bg-grape-500`
- `text-primary-foreground` → `text-white`
- `<a href="/login">` → `<Link to="/login">`

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-cream/80 backdrop-blur-md shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/maskable-icon-512x512.png"
              alt="포도가계부"
              className="h-8 w-8 rounded-lg"
            />
            <span className="text-lg font-bold text-warm-900">
              포도가계부
            </span>
          </div>
          <Link
            to="/login"
            className="rounded-full bg-grape-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-grape-600"
          >
            로그인
          </Link>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: lint 검증**

Run: `cd frontend && npx eslint src/components/landing/Header.tsx`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/landing/Header.tsx
git commit -m "feat: 랜딩 Header 컴포넌트 추가"
```

---

### Task 4: HeroSection 컴포넌트

**Files:**
- Create: `frontend/src/components/landing/HeroSection.tsx`

- [ ] **Step 1: v0 HeroSection 변환하여 생성**

v0 원본: `git show origin/v0/yyong91-54374fe4:components/landing/hero-section.tsx`

변환 사항:
- `"use client"` 제거
- `<style jsx>` bounce 키프레임 → index.css의 `typing-bounce` 참조 (Task 1에서 추가됨)
- 모든 `primary` 색상 → `grape-*` 토큰
- 모든 `foreground` → `warm-900`
- 모든 `muted-foreground` → `warm-500`
- 모든 `bg-card` → `bg-white`
- 모든 `border-border` → `border-warm-300`
- `hsl(var(--primary))` 인라인 스타일 → Grape 색상 hex값
- `bg-primary/20` → `bg-grape-500/20`
- `text-accent` → `text-leaf-500`
- CTA 링크: `<Link to="/login">`

이 컴포넌트는 v0에서 가장 큰 파일(~295줄). 핵심 구조:
1. `CHAT_SEQUENCE` 배열로 채팅 메시지 타이밍 정의
2. `TypingDots` — 타이핑 중 점 3개 bounce
3. `ParsedCard` — AI 파싱 결과 카드
4. `HeroSection` 메인 — 좌측 텍스트/CTA + 우측 폰 목업(채팅 데모)
5. 배경에 grape 글로우 오브 (animate-float-glow)

v0 코드를 그대로 가져오되, 색상 매핑표에 따라 모든 Tailwind 클래스를 변환.
`<style jsx>` 블록의 `@keyframes bounce`를 `typing-bounce`로 참조 변경:
- `animation: bounce 1.2s ease-in-out infinite` → `animation: typing-bounce 1.2s ease-in-out infinite`

인라인 스타일의 `hsl(var(--primary))` 그라데이션:
```
background: linear-gradient(135deg, hsl(var(--primary)), ...)
```
→
```
background: linear-gradient(135deg, #a855f7, ...)
```
(`#a855f7` = grape-500, `#7c3aed` = grape-700)

- [ ] **Step 2: lint 검증**

Run: `cd frontend && npx eslint src/components/landing/HeroSection.tsx`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/landing/HeroSection.tsx
git commit -m "feat: 랜딩 HeroSection 컴포넌트 추가 (채팅 타이핑 데모 + 글로우)"
```

---

### Task 5: MessengerSection 컴포넌트

**Files:**
- Create: `frontend/src/components/landing/MessengerSection.tsx`

- [ ] **Step 1: v0 MessengerSection 변환하여 생성**

v0 원본: `git show origin/v0/yyong91-54374fe4:components/landing/messenger-section.tsx`

변환 사항:
- `"use client"` 제거
- `import { useInView } from "@/hooks/use-in-view"` → `import { useInView } from '../../hooks/useInView'`
- 색상 매핑표에 따라 모든 클래스 변환
- `bg-[#f3e8ff]` → `bg-grape-100`, `text-[#7e22ce]` → `text-grape-700` 등

- [ ] **Step 2: lint 검증**

Run: `cd frontend && npx eslint src/components/landing/MessengerSection.tsx`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/landing/MessengerSection.tsx
git commit -m "feat: 랜딩 MessengerSection 컴포넌트 추가 (봇 연동 소개)"
```

---

### Task 6: SharedSection 컴포넌트

**Files:**
- Create: `frontend/src/components/landing/SharedSection.tsx`

- [ ] **Step 1: v0 SharedSection 변환하여 생성**

v0 원본: `git show origin/v0/yyong91-54374fe4:components/landing/shared-section.tsx`

변환 사항:
- `"use client"` 제거
- useInView import 경로 변환
- 하드코딩 색상 → Grape 토큰
- `rotate-2`, `-rotate-3` 등은 Tailwind v4 네이티브 지원이므로 그대로 유지

- [ ] **Step 2: lint 검증**

Run: `cd frontend && npx eslint src/components/landing/SharedSection.tsx`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/landing/SharedSection.tsx
git commit -m "feat: 랜딩 SharedSection 컴포넌트 추가 (공유 가계부)"
```

---

### Task 7: InsightsSection 컴포넌트

**Files:**
- Create: `frontend/src/components/landing/InsightsSection.tsx`

- [ ] **Step 1: v0 InsightsSection 변환하여 생성**

v0 원본: `git show origin/v0/yyong91-54374fe4:components/landing/insights-section.tsx`

변환 사항:
- `"use client"` 제거
- useInView import 경로 변환
- 하드코딩 색상 → Grape 토큰
- SVG 도넛 차트의 하드코딩 `stroke="#a855f7"` 등은 유지 (SVG 내부는 Tailwind 클래스 사용 불가)

- [ ] **Step 2: lint 검증**

Run: `cd frontend && npx eslint src/components/landing/InsightsSection.tsx`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/landing/InsightsSection.tsx
git commit -m "feat: 랜딩 InsightsSection 컴포넌트 추가 (리포트 카드 + 도넛 차트)"
```

---

### Task 8: FeaturesSection 컴포넌트

**Files:**
- Create: `frontend/src/components/landing/FeaturesSection.tsx`

- [ ] **Step 1: v0 FeaturesSection 변환하여 생성**

v0 원본: `git show origin/v0/yyong91-54374fe4:components/landing/features-section.tsx`

변환 사항:
- `"use client"` 제거
- useInView import 경로 변환
- 하드코딩 `highlightBg`, `iconBg` 색상 → Grape/Leaf/Amber 토큰
  - `"bg-[#f3e8ff] text-[#7e22ce]"` → `"bg-grape-100 text-grape-700"`
  - `"bg-[#dcfce7] text-[#16a34a]"` → `"bg-leaf-100 text-leaf-600"`
  - `"bg-[#fef3c7] text-[#d97706]"` → `"bg-amber-100 text-amber-600"`
- hover 클래스: `hover:border-[#c084fc]` → `hover:border-grape-400`

- [ ] **Step 2: lint 검증**

Run: `cd frontend && npx eslint src/components/landing/FeaturesSection.tsx`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/landing/FeaturesSection.tsx
git commit -m "feat: 랜딩 FeaturesSection 컴포넌트 추가 (6개 기능 카드)"
```

---

### Task 9: SocialProofSection 컴포넌트

**Files:**
- Create: `frontend/src/components/landing/SocialProofSection.tsx`

- [ ] **Step 1: v0 SocialProofSection 변환하여 생성**

v0 원본: `git show origin/v0/yyong91-54374fe4:components/landing/social-proof-section.tsx`

변환 사항:
- `"use client"` 제거
- useInView import 경로 변환
- 이 컴포넌트는 `bg-violet-50`, `text-violet-700` 등 표준 Tailwind 색상을 사용 — Grape 토큰으로 매핑:
  - `bg-violet-50` → `bg-grape-50`
  - `text-violet-700` → `text-grape-700`
  - `bg-violet-100` → `bg-grape-100`
  - `border-violet-200` → `border-grape-200`
  - `bg-emerald-100` → `bg-leaf-100`
  - `text-emerald-700` → `text-leaf-700`
  - `border-emerald-200` → `border-leaf-200`
- `useCountUp` 커스텀 훅은 이 파일 내부에 정의되어 있으므로 그대로 유지

- [ ] **Step 2: lint 검증**

Run: `cd frontend && npx eslint src/components/landing/SocialProofSection.tsx`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/landing/SocialProofSection.tsx
git commit -m "feat: 랜딩 SocialProofSection 컴포넌트 추가 (스펙 카운트업 + 시나리오)"
```

---

### Task 10: CTAFooter 컴포넌트

**Files:**
- Create: `frontend/src/components/landing/CTAFooter.tsx`

- [ ] **Step 1: v0 CTAFooter 변환하여 생성**

v0 원본: `git show origin/v0/yyong91-54374fe4:components/landing/cta-footer.tsx`

변환 사항:
- `"use client"` 제거
- `import Image from "next/image"` 제거 → `<img>` 사용
- `import Link from "next/link"` → `import { Link } from 'react-router-dom'`
- useInView import 경로 변환
- `<Image src="/logo.png" ... />` → `<img src="/maskable-icon-512x512.png" ... />`
- 색상 매핑표에 따라 변환
- CTA 링크: `href` → `<Link to="/login">`
- 푸터 링크: 개인정보처리방침(`/privacy`), 이용약관(`/terms`) 등 기존 경로 유지

- [ ] **Step 2: lint 검증**

Run: `cd frontend && npx eslint src/components/landing/CTAFooter.tsx`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/landing/CTAFooter.tsx
git commit -m "feat: 랜딩 CTAFooter 컴포넌트 추가 (CTA + 푸터)"
```

---

### Task 11: LandingPage 조합 + 기존 테스트 확인

**Files:**
- Modify: `frontend/src/pages/LandingPage.tsx` — 기존 내용 전체 교체

- [ ] **Step 1: LandingPage.tsx 교체**

기존 파일을 새 버전으로 교체. 인증 리디렉션 로직은 반드시 유지:

```typescript
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Header } from '../components/landing/Header'
import { HeroSection } from '../components/landing/HeroSection'
import { MessengerSection } from '../components/landing/MessengerSection'
import { SharedSection } from '../components/landing/SharedSection'
import { InsightsSection } from '../components/landing/InsightsSection'
import { FeaturesSection } from '../components/landing/FeaturesSection'
import { SocialProofSection } from '../components/landing/SocialProofSection'
import { CTAFooter } from '../components/landing/CTAFooter'

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/home', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  if (loading || isAuthenticated) {
    return null
  }

  return (
    <main className="min-h-screen bg-cream">
      <Header />
      <HeroSection />
      <MessengerSection />
      <SharedSection />
      <InsightsSection />
      <FeaturesSection />
      <SocialProofSection />
      <CTAFooter />
    </main>
  )
}
```

- [ ] **Step 2: lint + 빌드 검증**

Run: `cd frontend && npm run lint && npm run build`
Expected: 에러 없음

- [ ] **Step 3: 기존 테스트 통과 확인**

Run: `cd frontend && npm run test:run`
Expected: 기존 테스트 모두 통과 (랜딩페이지 관련 테스트가 있다면 import 경로 변경으로 깨질 수 있으니 수정)

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/LandingPage.tsx
git commit -m "feat: LandingPage v0 디자인 통합 — 7개 섹션 조합 (#500)"
```

---

### Task 12: 최종 검증 + 시각적 확인

- [ ] **Step 1: 전체 빌드 + lint + 테스트**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: 모두 통과

- [ ] **Step 2: 개발 서버에서 시각적 확인**

Run: `cd frontend && npm run dev`

확인 항목:
- [ ] `/` 접속 시 랜딩페이지 렌더링
- [ ] Header 스크롤 시 backdrop blur 동작
- [ ] HeroSection 채팅 타이핑 애니메이션 재생
- [ ] 글로우 오브 float 애니메이션
- [ ] 각 섹션 스크롤 시 fade-in-up 트리거
- [ ] MessengerSection 채팅 버블 순차 등장
- [ ] FeaturesSection 카드 hover 효과
- [ ] SocialProofSection 카운트업 애니메이션
- [ ] CTAFooter pulse 글로우
- [ ] CTA 버튼 클릭 → `/login` 이동
- [ ] 모바일 반응형 (브라우저 DevTools)

- [ ] **Step 3: 문제 수정 (있다면)**

시각적 확인에서 발견된 문제 수정 후 추가 커밋

- [ ] **Step 4: 최종 커밋 (필요시)**

```bash
git add -A
git commit -m "fix: 랜딩페이지 시각적 검증 후 수정"
```

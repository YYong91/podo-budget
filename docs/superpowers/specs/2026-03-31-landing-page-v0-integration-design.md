# 랜딩 페이지 v0 코드 통합 디자인

> **이슈**: #500 — feat: 랜딩 페이지 디자인 고도화
> **날짜**: 2026-03-31
> **범위**: v0/yyong91-54374fe4 브랜치의 7개 섹션을 기존 React+Vite 프론트엔드에 통합

## 배경

v0로 제작한 Next.js 기반 랜딩 페이지를 기존 React + Vite + Tailwind CSS v4 프론트엔드에 통합한다. 디자인/레이아웃은 v0 결과물 그대로 유지하되, 기술 스택 차이(Next.js → React, Tailwind v3 → v4)와 코드 품질 이슈(하드코딩 색상, 중복 애니메이션 정의, config 누락)를 해결한다.

## 섹션 구성 (v0 그대로)

1. **Header** — 고정 네비, 스크롤 시 backdrop blur
2. **HeroSection** — 채팅 타이핑 데모 + grape 글로우 오브 + 텍스트 그라데이션
3. **MessengerSection** — 카카오/텔레그램 봇 연동 소개, 채팅 버블 애니메이션
4. **SharedSection** — 공유 가계부, 아바타 클러스터 + 플로팅 카드(틸트)
5. **InsightsSection** — 월간 리포트 카드, 도넛 차트, AI 인사이트
6. **FeaturesSection** — 6개 기능 카드 그리드, hover 효과
7. **SocialProofSection** — 스펙 숫자 카운트업 + 시나리오 카드
8. **CTAFooter** — CTA 버튼(pulse 글로우) + 신뢰 지표 + 푸터

## 파일 구조

```
frontend/src/
├── hooks/useInView.ts                    # IntersectionObserver 기반 스크롤 트리거 훅 (v0에서 가져옴)
├── components/landing/
│   ├── Header.tsx                        # 고정 네비게이션
│   ├── HeroSection.tsx                   # 히어로 섹션
│   ├── MessengerSection.tsx              # 메신저 봇 소개
│   ├── SharedSection.tsx                 # 공유 가계부 소개
│   ├── InsightsSection.tsx               # 리포트 카드
│   ├── FeaturesSection.tsx               # 기능 카드 그리드
│   ├── SocialProofSection.tsx            # 소셜 프루프
│   └── CTAFooter.tsx                     # CTA + 푸터
├── pages/LandingPage.tsx                 # 기존 파일 교체 — 섹션 조합만
└── index.css                             # @theme 블록에 애니메이션 추가
```

## 변환 규칙

### Next.js → React

| v0 (Next.js) | 변환 (React + Vite) |
|---|---|
| `import Image from 'next/image'` | `<img>` 태그 직접 사용 |
| `import Link from 'next/link'` | `import { Link } from 'react-router-dom'` |
| `<Image src="/logo.png" ... />` | `<img src="/maskable-icon-512x512.png" ... />` |
| `app/page.tsx` (App Router) | `pages/LandingPage.tsx` (React Router) |
| `<style jsx>` | `index.css`로 이동 |

### Tailwind v3 CSS 변수 → v4 Grape 토큰

| v0 클래스/변수 | Grape 토큰 | 색상값 (동일) |
|---|---|---|
| `bg-primary`, `hsl(var(--primary))` | `bg-grape-500` | #a855f7 |
| `text-primary` | `text-grape-500` | #a855f7 |
| `text-primary-foreground` | `text-white` | #ffffff |
| `bg-accent`, `hsl(var(--accent))` | `bg-leaf-500` | #22c55e |
| `bg-background`, `hsl(var(--background))` | `bg-cream` | #fefce8 |
| `text-foreground`, `hsl(var(--foreground))` | `text-warm-900` | ~#1c1917 |
| `text-secondary-foreground` | `text-warm-900` | ~#1c1917 |
| `text-muted-foreground` | `text-warm-500` | #78716c |
| `bg-muted`, `bg-muted/30` | `bg-warm-100`, `bg-warm-100/30` | #f5f5f4 |
| `border-border` | `border-warm-300` | #d6d3d1 |
| `bg-card` | `bg-white` | #ffffff |
| `bg-[#f3e8ff]` (하드코딩) | `bg-grape-100` | #f3e8ff (동일) |
| `text-[#7e22ce]` (하드코딩) | `text-grape-700` | #7c3aed (≈ 동일) |
| `bg-[#e9d5ff]` (하드코딩) | `bg-grape-200` | #e9d5ff (동일) |
| `bg-[#dcfce7]` (하드코딩) | `bg-leaf-100` | #dcfce7 (동일) |
| `text-[#16a34a]` (하드코딩) | `text-leaf-600` | #16a34a (동일) |
| `bg-[#fef3c7]` (하드코딩) | `bg-amber-100` | 표준 Tailwind amber |
| `text-[#d97706]` (하드코딩) | `text-amber-600` | 표준 Tailwind amber |

### 애니메이션 통합

v0의 `tailwind.config.ts` 키프레임 + `globals.css` 키프레임 중복을 **`index.css`의 `@theme` 블록 하나로 통일**:

```css
@theme {
  /* 기존 애니메이션 유지 */
  --animate-slideIn: slideIn 0.3s ease-out;
  --animate-grape-pop: grape-pop 0.4s ease-out;
  --animate-bounce-in: bounce-in 0.3s ease-out;
  --animate-toastIn: toastIn 0.3s ease-out;

  /* 랜딩페이지 애니메이션 추가 */
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
    0%   { box-shadow: 0 0 0 0 hsla(270, 82%, 55%, 0.5); }
    60%  { box-shadow: 0 0 0 12px hsla(270, 82%, 55%, 0); }
    100% { box-shadow: 0 0 0 0 hsla(270, 82%, 55%, 0); }
  }

  /* 기존 키프레임들은 그대로 유지 */
}
```

### rotate 유틸리티

Tailwind v4는 `rotate-2`, `-rotate-3` 등을 네이티브 지원하므로 변환 불필요. v0 클래스 그대로 사용.

## 라우팅

변경 없음. 기존 구조 유지:
- `GET /` → `LandingPage` (비인증 사용자용)
- **인증된 사용자는 `/home`으로 자동 리디렉션** (기존 로직 유지)
- CTA 버튼 → `<Link to="/login">` → Supabase Auth Google OAuth
- 로그인 후 → `/home`

## 다크모드

랜딩 페이지는 항상 라이트 모드로 표시. 다크모드 대응은 이번 범위에서 제외 (별도 이슈로 분리 가능).

## 이미지 에셋

| 용도 | 경로 |
|---|---|
| 헤더/푸터 로고 | `/maskable-icon-512x512.png` |

## useInView 훅

v0의 `hooks/use-in-view.ts`를 `frontend/src/hooks/useInView.ts`로 가져온다:
- IntersectionObserver 기반, ~40줄
- `threshold`, `triggerOnce` 옵션 지원
- 외부 의존성 없음

## 코드 품질 개선 (v0 대비)

1. **하드코딩 색상 제거** → Grape/Leaf/Warm 토큰으로 통일
2. **CSS 중복 제거** → `@theme` 블록 하나로 관리
3. **`<style jsx>` 제거** → 모든 키프레임 index.css로
4. **Next.js 의존성 제거** → `next/image`, `next/link` 불필요
5. **타입 안전성** — 컴포넌트 props에 TypeScript 타입 적용

## 테스트 계획

- `npm run lint` — ESLint 통과
- `npm run build` — 빌드 에러 없음
- `npm run dev` — 로컬에서 시각적 확인
  - 모든 섹션 렌더링
  - 스크롤 애니메이션 동작 (fade-in-up, bubble-in)
  - 히어로 채팅 타이핑 애니메이션
  - CTA pulse 애니메이션
  - 반응형 (모바일/데스크톱)
  - CTA 클릭 → `/login` 이동
- 기존 프론트엔드 테스트 깨지지 않음 (`npm run test:run`)

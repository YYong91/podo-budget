# Landing Page Renewal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랜딩페이지 콘텐츠를 최신 기능과 싱크하고, 자산 트래킹 제거 + 가계부 핵심 기능 집중으로 리뉴얼한다.

**Architecture:** 기존 컴포넌트 구조(7개 섹션) 유지, 콘텐츠/데이터를 `landingData.ts`로 분리하여 중앙 관리. 스크린샷은 `ScreenshotImage` 공유 컴포넌트로 fallback 처리. 디자인 톤(Grape), 애니메이션(CSS 키프레임 + IntersectionObserver), 반응형 구조 모두 유지.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite 7

**Spec:** `docs/superpowers/specs/2026-04-09-landing-page-renewal-design.md`

**Worktree:** `/Users/seungyong/projects/podo-budget-landing` (branch: `feature/landing-renewal`)

---

## File Structure

| 파일 | 작업 | 책임 |
|------|------|------|
| `src/data/landingData.ts` | 새로 생성 | 스크린샷 경로, 기능 카드 데이터, 소셜 프루프 데이터 중앙 관리 |
| `src/components/landing/ScreenshotImage.tsx` | 새로 생성 | 이미지 렌더링 + grape 그라디언트 fallback 플레이스홀더 |
| `src/components/landing/HeroSection.tsx` | 수정 | 카피 + ChatPhone 채팅 예시 교체 |
| `src/components/landing/MessengerSection.tsx` | 대폭 수정 | 메신저 전용 → 쉽고 빠른 입력 (메신저 + 앱) |
| `src/components/landing/SharedSection.tsx` | 소폭 수정 | 설명 + 거래 예시 교체 |
| `src/components/landing/InsightsSection.tsx` | 대폭 수정 | 폰 캐러셀 → 카드 이미지 격자 |
| `src/components/landing/FeaturesSection.tsx` | 수정 | 데이터 파일 import + 자산→검색 카드 교체 |
| `src/components/landing/SocialProofSection.tsx` | 대폭 수정 | 가짜 후기 → 시나리오 전환, 데이터 파일 import |
| `src/components/landing/CTAFooter.tsx` | 소폭 수정 | 카피만 교체 |
| `public/screenshots/` | 새 디렉토리 | 스크린샷 이미지 저장소 |

---

### Task 1: landingData.ts 데이터 파일 생성

**Files:**
- Create: `frontend/src/data/landingData.ts`

- [ ] **Step 1: 데이터 파일 생성**

```typescript
// frontend/src/data/landingData.ts

// --- 스크린샷 ---
export const landingScreenshots = {
  hero: {
    path: '/screenshots/hero-chat.jpg',
    alt: '메신저로 가계부 입력하는 화면',
  },
  input: {
    messenger: {
      path: '/screenshots/input-messenger.jpg',
      alt: '메신저 입력 화면',
    },
    app: {
      path: '/screenshots/input-app.jpg',
      alt: '앱 내 직접 입력 화면',
    },
  },
  overview: [
    { path: '/screenshots/card-budget.jpg', caption: '예산 현황', alt: '예산 히어로 카드' },
    { path: '/screenshots/card-category.jpg', caption: '카테고리 TOP', alt: '카테고리별 지출' },
    { path: '/screenshots/card-recurring.jpg', caption: '정기결제 알림', alt: '정기결제 알림 카드' },
    { path: '/screenshots/card-insight.jpg', caption: 'AI 인사이트', alt: 'AI 분석 카드' },
  ],
}

// --- 편의 기능 카드 ---
// icon SVG는 FeaturesSection.tsx 내에서 id 기반 매핑
export const featureCards = [
  { id: 'budget' as const, title: '예산 관리', description: '우리 집 예산, 얼마나 썼는지 한눈에 봐요. 넘으면 알려줘요', highlight: '한눈에', iconBg: 'bg-grape-100', iconColor: 'text-grape-700', highlightBg: 'bg-grape-100 text-grape-700' },
  { id: 'recurring' as const, title: '정기결제 관리', description: '넷플릭스, 보험료, 공과금 결제일에 놓치지 않고 알려줘요', highlight: '놓치지 않고', iconBg: 'bg-leaf-100', iconColor: 'text-leaf-700', highlightBg: 'bg-leaf-100 text-leaf-700' },
  { id: 'payment' as const, title: '결제수단 현황', description: '카드 실적, 현금, 이체까지 한번에 모아서 봐요', highlight: '카드 실적', iconBg: 'bg-orange-50', iconColor: 'text-orange-700', highlightBg: 'bg-orange-50 text-orange-700' },
  { id: 'search' as const, title: '가계부 검색', description: '지난주 병원비 얼마였지? 금액, 카테고리, 기간으로 바로 찾아요', highlight: '바로 찾아요', iconBg: 'bg-yellow-50', iconColor: 'text-yellow-700', highlightBg: 'bg-yellow-50 text-yellow-700' },
  { id: 'category' as const, title: '맞춤 카테고리', description: '나만의 분류로 자유롭게 정리해요', highlight: '자유롭게', iconBg: 'bg-green-50', iconColor: 'text-green-700', highlightBg: 'bg-green-50 text-green-700' },
]

// --- 소셜 프루프 ---
export const socialStats = [
  { value: 5, suffix: '초', label: '만에 입력', description: '길게 적을 필요 없이, 한 줄이면 돼요' },
  { value: 100, suffix: '%', label: '자동 카테고리', description: '식비, 교통, 쇼핑 AI가 알아서 분류' },
  { value: 0, suffix: '원', label: '완전 무료', description: '모든 기능 무료, 숨은 결제 없어요' },
]

export const socialScenarios = [
  { persona: '맞벌이 부부', problem: '둘 다 쓰는데 월말에 뭐에 썼는지 모르겠어', solution: '공유 가계부로 실시간 확인' },
  { persona: '살림 초보', problem: '가계부 앱 깔아봤는데 입력 귀찮아서 삭제함', solution: '메신저로 한 줄이면 끝' },
  { persona: '알뜰 살림러', problem: '구독료가 매달 얼마 빠지는지 파악이 안 돼', solution: '정기결제 알림 + 예산 관리' },
]
```

- [ ] **Step 2: TypeScript 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: 에러 없음 (새 파일은 아직 import하는 곳 없으므로)

- [ ] **Step 3: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/src/data/landingData.ts
git commit -m "feat: 랜딩페이지 데이터 중앙 관리 파일 생성"
```

---

### Task 2: ScreenshotImage 공유 컴포넌트 생성

**Files:**
- Create: `frontend/src/components/landing/ScreenshotImage.tsx`

- [ ] **Step 1: 컴포넌트 생성**

```typescript
// frontend/src/components/landing/ScreenshotImage.tsx
import { useState } from 'react'

type ScreenshotImageProps = {
  src: string
  alt: string
  caption?: string
  className?: string
}

export function ScreenshotImage({ src, alt, caption, className = '' }: ScreenshotImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-grape-200 to-grape-400 dark:from-grape-700 dark:to-grape-900 ${className}`}
        role="img"
        aria-label={alt}
      >
        {caption && (
          <span className="text-sm font-medium text-white drop-shadow-sm">
            {caption}
          </span>
        )}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`rounded-2xl ${className}`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}
```

- [ ] **Step 2: TypeScript 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/src/components/landing/ScreenshotImage.tsx
git commit -m "feat: ScreenshotImage 공유 컴포넌트 (fallback 플레이스홀더)"
```

---

### Task 3: screenshots 디렉토리 생성

**Files:**
- Create: `frontend/public/screenshots/.gitkeep`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/seungyong/projects/podo-budget-landing/frontend/public/screenshots
touch /Users/seungyong/projects/podo-budget-landing/frontend/public/screenshots/.gitkeep
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/public/screenshots/.gitkeep
git commit -m "chore: 랜딩 스크린샷 디렉토리 생성"
```

---

### Task 4: HeroSection 카피 + 채팅 예시 수정

**Files:**
- Modify: `frontend/src/components/landing/HeroSection.tsx`

**주의사항:** ChatPhone 내부의 애니메이션 타이밍 상수(`TO_AFTER`, `SHOW_CARD`, `RESET`, `LOOP`)는 변경하지 않는다. 텍스트 콘텐츠만 교체.

- [ ] **Step 1: 메인/서브 카피 교체**

HeroSection.tsx에서 텍스트 변경:
- 메인 헤드라인 (3줄 → 2줄): `"포도알처럼" / "하나씩, 알찬" / "가계부"` → `"말하듯 기록하면," / "AI가 알아서 정리해요"`
- 서브 카피: `"말로 기록하면 / AI가 알아서 분류하는 / 우리 집 가계부"` → `"메신저에 '남편이랑 저녁 파스타 32000원' 보내면 끝.\n카테고리, 날짜, 결제수단까지 자동으로."`

- [ ] **Step 2: ChatPhone 채팅 예시 교체**

ChatPhone 내부 채팅 데이터:
- 유저 메시지: `"점심 김치찌개 8000원"` → `"남편이랑 저녁 파스타 32000원"`
- AI 응답 카테고리: `식비` (유지)
- AI 응답 금액: `8,000원` → `32,000원`
- AI 응답 날짜: `오늘` (유지)
- 스크린샷 `/screenshot-after.jpg` 참조 유지 (추후 교체)

- [ ] **Step 3: 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: 에러 없음

- [ ] **Step 4: 개발 서버에서 시각 확인**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npm run dev`
브라우저에서 `http://localhost:5173` 접속 → Hero 섹션 카피 + 채팅 애니메이션 확인

- [ ] **Step 5: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/src/components/landing/HeroSection.tsx
git commit -m "feat: Hero 섹션 카피 개선 — 가치 전달 우선 + 파스타 예시"
```

---

### Task 5: MessengerSection → 쉽고 빠른 입력 리뉴얼

**Files:**
- Modify: `frontend/src/components/landing/MessengerSection.tsx`

**현재 구조 (167줄):** 카카오톡/텔레그램 로고 + 채팅 목업 1개 (김치찌개/택시 예시)

**변경 방향:**
- 뱃지: "핵심 기능" → "쉽고 빠른 입력"
- 헤드라인: "메신저로 기록하세요" → "한 줄이면 끝, 나머지는 AI가"
- 설명 교체
- 카카오톡/텔레그램 개별 로고 제거 → 일반 메신저 아이콘 (채팅 말풍선 SVG)
- 채팅 예시: 파스타 32000원
- 오른쪽에 앱 입력 스크린샷 추가 (ScreenshotImage 사용)
- 2컬럼 레이아웃: 왼쪽 메신저 목업 / 오른쪽 앱 입력 스크린샷

- [ ] **Step 1: 텍스트 콘텐츠 교체**

뱃지, 헤드라인, 설명, 메신저 아이콘 영역 수정:
- 뱃지 텍스트: `"핵심 기능"` → `"쉽고 빠른 입력"`
- 헤드라인: `"메신저로"` / `"기록하세요"` → `"한 줄이면 끝,"` / `"나머지는 AI가"`
- 설명: `"카카오톡, 텔레그램 등..."` → `"사용하던 메신저로 보내도 되고, 앱에서 바로 입력해도 돼요. 카테고리, 날짜, 결제수단은 AI가 알아서 분류해줘요."`
- 메신저 아이콘: 카카오톡(#FEE500)/텔레그램(#0088cc) 개별 로고 → 일반 채팅 말풍선 SVG 아이콘 1개 + 스마트폰 SVG 아이콘 1개 ("메신저" / "앱")

- [ ] **Step 2: 채팅 예시 교체**

채팅 대화 데이터:
- 첫 번째 유저: `"점심 김치찌개 8000원"` → `"남편이랑 저녁 파스타 32000원"`
- 첫 번째 봇 응답: 카테고리 `식비`, 금액 `32,000원`, 날짜 `오늘`
- 두 번째 대화 세트: 제거 (1세트만 유지하여 간결하게)

- [ ] **Step 3: 앱 입력 스크린샷 영역 추가**

현재 채팅 목업 옆에 앱 내 직접 입력 스크린샷 영역 추가:
- `landingScreenshots.input.app` import하여 사용
- `ScreenshotImage` 컴포넌트 사용
- 레이아웃: `md:flex-row`에서 채팅 목업과 앱 스크린샷을 나란히
- 각각 아래에 라벨: "메신저로 보내기" / "앱에서 바로 입력"

- [ ] **Step 4: 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/src/components/landing/MessengerSection.tsx
git commit -m "feat: MessengerSection → 쉽고 빠른 입력 리뉴얼 (메신저 + 앱)"
```

---

### Task 6: SharedSection 거래 예시 + 설명 수정

**Files:**
- Modify: `frontend/src/components/landing/SharedSection.tsx`

**현재 구조 (113줄):** members 배열(엄마/아빠/나) + transactions 배열(김치찌개/지하철/문구류)

- [ ] **Step 1: 설명 + 거래 예시 교체**

변경할 텍스트:
- 설명 (line 36-38): `"가족을 초대하고 함께 써요.\n누가 어떻게 썼는지 한눈에 볼 수 있어요."` → `"초대 한 번이면 같이 써요.\n누가, 언제, 얼마 썼는지 한눈에."`
- `transactions` 배열 (lines 9-13) — `text` 필드가 "이름 금액" 합쳐진 형태:
  - `text: "김치찌개 8,000원"` → `text: "저녁 파스타 32,000원"`
  - `text: "지하철 50,000원"` → `text: "아이 학원비 150,000원"`
  - `text: "문구류 12,000원"` → `text: "주말 장보기 48,000원"`

- [ ] **Step 2: 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/src/components/landing/SharedSection.tsx
git commit -m "feat: SharedSection 거래 예시 생활감 있게 교체"
```

---

### Task 7: InsightsSection → 한눈에 보기 리뉴얼

**Files:**
- Modify: `frontend/src/components/landing/InsightsSection.tsx`

**현재 구조 (115줄):** 폰 목업 프레임 + 캐러셀 3슬라이드 (3초 자동 전환) + 인디케이터 점

**변경 방향:** 폰 목업/캐러셀 제거 → 카드 이미지 4개 격자 배치

- [ ] **Step 1: 텍스트 콘텐츠 교체**

- 뱃지: `"돌아보기"` → `"모아보기"`
- 헤드라인: `"이달의 소비,"` / `"한눈에 돌아보기"` → `"이번 달,"` / `"어디에 얼마 썼지?"`
- 설명: 기존 → `"앱 열면 바로 보여요. 예산 현황, 정기결제 일정, 카테고리별 지출, AI 분석까지."`

- [ ] **Step 2: 캐러셀 → 카드 격자로 교체**

캐러셀 로직(useState, useEffect, setInterval) 제거. 대신:
- `landingScreenshots.overview` import
- `ScreenshotImage` 컴포넌트 import
- 2x2 격자: `grid grid-cols-2 gap-4 md:gap-6`
- 각 카드: `ScreenshotImage` + 캡션
- 카드 스타일: `rounded-2xl shadow-sm border border-warm-200` (기존 디자인 톤)
- 애니메이션: `animate-fade-in-up` + stagger (`animationDelay: ${0.1 * i}s`)

레이아웃 변경:
- 현재: 텍스트(왼) + 폰 목업(오) `md:flex-row`
- 변경: 텍스트(위) + 카드 격자(아래) 수직 배치

- [ ] **Step 3: 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 4: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/src/components/landing/InsightsSection.tsx
git commit -m "feat: InsightsSection → 한눈에 보기 카드 격자 리뉴얼"
```

---

### Task 8: FeaturesSection 카드 교체 + 데이터 파일 연동

**Files:**
- Modify: `frontend/src/components/landing/FeaturesSection.tsx`

**현재 구조 (128줄):** `features` 배열(5개, 컴포넌트 내부 정의) + SVG icon JSX

**변경 방향:**
- 데이터를 `landingData.ts`의 `featureCards`에서 import
- SVG 아이콘은 id 기반 매핑 함수로 컴포넌트 내부에 유지
- 자산 트래킹(#4) → 가계부 검색으로 교체 (데이터 파일에서 이미 반영)

- [ ] **Step 1: 내부 features 배열을 landingData import로 교체**

```typescript
import { featureCards } from '../../data/landingData'
```

기존 `const features = [...]` (lines 3-70) 삭제.

id 기반 아이콘 매핑 함수 추가:
```typescript
function getFeatureIcon(id: string) {
  const icons: Record<string, JSX.Element> = {
    budget: (/* 기존 예산 관리 SVG */),
    recurring: (/* 기존 정기결제 SVG */),
    payment: (/* 기존 결제수단 SVG */),
    search: (/* 검색 돋보기 SVG — 새로 추가 */),
    category: (/* 기존 맞춤 카테고리 SVG */),
  }
  return icons[id] ?? null
}
```

검색 아이콘 SVG (Heroicons magnifying-glass):
```html
<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
</svg>
```

- [ ] **Step 2: 렌더링 부분에서 featureCards 사용**

`features.map(...)` → `featureCards.map(...)` 으로 변경.
각 카드에서 `getFeatureIcon(card.id)` 호출.

- [ ] **Step 3: 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 4: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/src/components/landing/FeaturesSection.tsx
git commit -m "feat: FeaturesSection 데이터 파일 연동 + 자산→검색 교체"
```

---

### Task 9: SocialProofSection → 시나리오 전환

**Files:**
- Modify: `frontend/src/components/landing/SocialProofSection.tsx`

**현재 구조 (235줄):** useCountUp 훅 + stats 배열 + StarIcon + scenarios (별점 + 인용문)

**변경 방향:**
- 상단 숫자 3개 유지 (useCountUp 훅 유지)
- `stats`/`scenarios` 데이터를 `landingData.ts`에서 import
- 헤드라인 교체
- 별점(StarIcon) 제거
- 시나리오 카드: 인용문 → 문제/해결 구조

- [ ] **Step 1: 데이터 import + 헤드라인 교체**

```typescript
import { socialStats, socialScenarios } from '../../data/landingData'
```

기존 내부 `stats`, `scenarios` 배열 삭제.
- 섹션 라벨: `"이런 분들이 쓰고 있어요"` → `"이런 분께 딱 맞아요"`
- 헤드라인: `"기록이 습관이 되는 가장 쉬운 방법"` → `"이런 분께 딱 맞아요"`

- [ ] **Step 2: 숫자 통계 영역 — socialStats 연동**

기존 `stats` 참조를 `socialStats`로 교체. useCountUp 훅 로직은 유지.
SVG 아이콘은 컴포넌트 내부에 유지 (id 기반 매핑 또는 인라인).

**필드명 매핑 주의:**
- 기존 코드: `stat.unit` / `stat.suffix` / `stat.desc` / `stat.icon`
- 새 데이터: `stat.suffix` / `stat.label` / `stat.description` (icon 없음)
- JSX에서 필드명 참조를 모두 업데이트할 것:
  - `stat.unit` → `stat.suffix`
  - `stat.suffix` → `stat.label`
  - `stat.desc` → `stat.description`
  - `stat.icon` → 컴포넌트 내부 인라인 SVG로 유지

- [ ] **Step 3: 시나리오 카드 — 별점 제거 + 문제/해결 구조**

기존 시나리오 카드 구조:
```
[별점 5개] + [페르소나] + [인용문]
```

새 구조:
```
[페르소나 뱃지] + [문제 텍스트 (이탤릭, warm-600)] + [→ 해결 텍스트 (grape-700, bold)]
```

StarIcon 컴포넌트 삭제.

- [ ] **Step 4: 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/src/components/landing/SocialProofSection.tsx
git commit -m "feat: SocialProofSection 시나리오 전환 (별점 제거 + 문제→해결)"
```

---

### Task 10: CTAFooter 카피 수정

**Files:**
- Modify: `frontend/src/components/landing/CTAFooter.tsx`

- [ ] **Step 1: 카피 교체**

- 헤드라인: `"포도알처럼 하나씩,"` / `"오늘부터 시작해볼까요?"` → `"오늘부터"` / `"편하게 기록해볼까요?"`
- 설명: `"복잡한 가입 절차 없이, 메신저 하나면 시작할 수 있어요"` → `"복잡한 가입 없이, 구글 계정으로 바로 시작하세요"`

나머지(CTA 버튼, 사용법 보기, 푸터 링크, 소셜 아이콘)는 변경하지 않음.

- [ ] **Step 2: 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: 커밋**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add frontend/src/components/landing/CTAFooter.tsx
git commit -m "feat: CTAFooter 카피 개선 — 행동 유도 중심"
```

---

### Task 11: 전체 빌드 + 린트 검증

**Files:** 전체

- [ ] **Step 1: ESLint 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npm run lint`
Expected: 에러 없음

- [ ] **Step 2: TypeScript 빌드 체크**

Run: `cd /Users/seungyong/projects/podo-budget-landing/frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 개발 서버에서 전체 플로우 확인**

`npm run dev` → `http://localhost:5173` 접속:
1. Hero: 새 카피 + 파스타 채팅 애니메이션
2. 쉽고 빠른 입력: 메신저 + 앱 입력 나란히
3. 공유 가계부: 새 거래 예시
4. 한눈에 보기: 카드 격자 (플레이스홀더)
5. 편의 기능: 검색 카드 포함 5개
6. 소셜 프루프: 숫자 카운트업 + 시나리오 3개
7. CTA: 새 카피

- [ ] **Step 4: 린트/빌드 에러 수정 (있다면)**

- [ ] **Step 5: 최종 커밋 (수정 있을 경우)**

```bash
cd /Users/seungyong/projects/podo-budget-landing
git add -A
git commit -m "fix: 랜딩페이지 리뉴얼 린트/빌드 수정"
```

# 포도가계부 랜딩페이지 리뉴얼

## 개요

현재 랜딩페이지의 내용을 최신 기능과 싱크하고, 디자인 품질을 업그레이드한다.
기존 Grape 디자인 시스템 톤(v0.dev 생성)을 유지하면서 콘텐츠를 현행화한다.

## 목적

- 비활성화된 자산 트래킹 제거, 가계부 핵심 기능에 집중
- IT 비친숙 30대+ 타겟에 맞게 기술 용어 제거 (자연어 → "말하듯 입력")
- 스크린샷을 데이터 파일로 중앙 관리하여 교체 용이성 확보
- 가짜 리뷰 → 진정성 있는 시나리오로 전환

## 디자인 방향

- **톤앤매너**: 기존 유지 — Grape 그라디언트 + Cream 배경, 따뜻하고 친근
- **애니메이션**: 기존 유지 — Intersection Observer 기반 fade-in-up, 순수 CSS 키프레임
- **레이아웃**: 기존 섹션 구조 유지, 내용과 비주얼 교체
- **타겟 언어**: 기술 용어 배제, 생활 언어 사용, 행동 중심 표현

## 데이터 중앙 관리 구조

`frontend/src/data/landingData.ts`에서 스크린샷, 기능 카드, 시나리오 데이터를 중앙 관리:

```typescript
// 스크린샷
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

// 편의 기능 카드 — icon은 SVG JSX로 컴포넌트에서 정의 (데이터 파일에는 텍스트만)
// 스타일 속성은 기존 FeaturesSection 패턴 유지 (iconBg, iconColor, highlightBg)
export const featureCards = [
  { id: 'budget', title: '예산 관리', description: '우리 집 예산, 얼마나 썼는지 한눈에 봐요. 넘으면 알려줘요', highlight: '한눈에', iconBg: 'bg-grape-100', iconColor: 'text-grape-700', highlightBg: 'bg-grape-100 text-grape-700' },
  { id: 'recurring', title: '정기결제 관리', description: '넷플릭스, 보험료, 공과금 결제일에 놓치지 않고 알려줘요', highlight: '놓치지 않고', iconBg: 'bg-leaf-100', iconColor: 'text-leaf-700', highlightBg: 'bg-leaf-100 text-leaf-700' },
  { id: 'payment', title: '결제수단 현황', description: '카드 실적, 현금, 이체까지 한번에 모아서 봐요', highlight: '카드 실적', iconBg: 'bg-orange-50', iconColor: 'text-orange-700', highlightBg: 'bg-orange-50 text-orange-700' },
  { id: 'search', title: '가계부 검색', description: '지난주 병원비 얼마였지? 금액, 카테고리, 기간으로 바로 찾아요', highlight: '바로 찾아요', iconBg: 'bg-yellow-50', iconColor: 'text-yellow-700', highlightBg: 'bg-yellow-50 text-yellow-700' },
  { id: 'category', title: '맞춤 카테고리', description: '나만의 분류로 자유롭게 정리해요', highlight: '자유롭게', iconBg: 'bg-green-50', iconColor: 'text-green-700', highlightBg: 'bg-green-50 text-green-700' },
]
// icon SVG는 FeaturesSection.tsx 내에서 id 기반 매핑 (JSX는 데이터 파일에 넣지 않음)

// 소셜 프루프 — 숫자 통계
export const socialStats = [
  { value: 5, suffix: '초', label: '만에 입력', description: '길게 적을 필요 없이, 한 줄이면 돼요' },
  { value: 100, suffix: '%', label: '자동 카테고리', description: '식비, 교통, 쇼핑 AI가 알아서 분류' },
  { value: 0, suffix: '원', label: '완전 무료', description: '모든 기능 무료, 숨은 결제 없어요' },
]

// 소셜 프루프 시나리오
export const socialScenarios = [
  { persona: '맞벌이 부부', problem: '둘 다 쓰는데 월말에 뭐에 썼는지 모르겠어', solution: '공유 가계부로 실시간 확인' },
  { persona: '살림 초보', problem: '가계부 앱 깔아봤는데 입력 귀찮아서 삭제함', solution: '메신저로 한 줄이면 끝' },
  { persona: '알뜰 살림러', problem: '구독료가 매달 얼마 빠지는지 파악이 안 돼', solution: '정기결제 알림 + 예산 관리' },
]
```

이미지 파일은 `frontend/public/screenshots/` 디렉토리에 저장.

### 스크린샷 플레이스홀더

실제 스크린샷이 준비되기 전까지 grape 그라디언트 배경 + 캡션 텍스트로 플레이스홀더 표시.

공유 컴포넌트: `src/components/landing/ScreenshotImage.tsx`
```typescript
// props: { src, alt, caption?, className? }
// 정상: <img> 렌더링
// 로드 실패: grape 그라디언트 배경 + caption 텍스트 fallback
// 내부적으로 useState + onError 핸들러로 구현
```

모든 랜딩 섹션에서 `<img>` 대신 `<ScreenshotImage>` 사용.

---

## 섹션별 상세 설계

### 섹션 1: Hero (개선)

**변경 내용**: 카피 개선 — 브랜드 메타포보다 가치 전달 우선

| 항목 | 현재 | 변경 |
|------|------|------|
| 뱃지 | "드디어 꾸준히 쓰게 되는 가계부" | 유지 |
| 메인 카피 | "포도알처럼 하나씩, 알찬 가계부" | **"말하듯 기록하면, AI가 알아서 정리해요"** |
| 서브 카피 | "말로 기록하면 / AI가 알아서 분류하는 / 우리 집 가계부" | **"메신저에 '남편이랑 저녁 파스타 32000원' 보내면 끝. 카테고리, 날짜, 결제수단까지 자동으로."** |
| CTA | "지금 무료로 시작하기 →" | 유지 |
| 채팅 폰 애니메이션 | 김치찌개 8000원 예시 | **파스타 32000원 예시로 교체** |

### 섹션 2: 쉽고 빠른 입력 (기존 MessengerSection 리뉴얼)

**변경 내용**: 메신저 전용 → 메신저 + 앱 입력 2가지 방식

| 항목 | 현재 | 변경 |
|------|------|------|
| 뱃지 | "핵심 기능" | **"쉽고 빠른 입력"** |
| 헤드라인 | "메신저로 기록하세요" | **"한 줄이면 끝, 나머지는 AI가"** |
| 설명 | 카카오톡/텔레그램 명시 | **"사용하던 메신저로 보내도 되고, 앱에서 바로 입력해도 돼요. 카테고리, 날짜, 결제수단은 AI가 알아서 분류해줘요."** |
| 비주얼 | 메신저 채팅 목업 1개 | **메신저 목업 + 앱 입력 스크린샷 나란히** |
| 채팅 예시 | 김치찌개/택시 | **파스타 32000원** |

- 카카오톡/텔레그램 개별 로고 제거, 일반 메신저 아이콘 사용
- 앱 입력은 `landingScreenshots.input.app` 스크린샷 사용

### 섹션 3: 공유 가계부 (유지 + 소폭 개선)

**변경 내용**: 구조 유지, 거래 예시만 생활감 있게

| 항목 | 현재 | 변경 |
|------|------|------|
| 헤드라인 | "가족이 함께 쓰는 하나의 가계부" | 유지 |
| 설명 | 초대/공유 설명 | **"초대 한 번이면 같이 써요. 누가, 언제, 얼마 썼는지 한눈에."** |
| 거래 예시 | 김치찌개/지하철/문구류 | **저녁 파스타 32,000원 / 아이 학원비 150,000원 / 주말 장보기 48,000원** |
| 태그 4개 | 실시간 동기화 등 | 유지 |

### 섹션 4: 한눈에 보기 (기존 InsightsSection 리뉴얼)

**변경 내용**: 캐러셀(폰 목업) → 카드 이미지 격자 배치

| 항목 | 현재 | 변경 |
|------|------|------|
| 뱃지 | "돌아보기" | **"모아보기"** |
| 헤드라인 | "이달의 소비, 한눈에 돌아보기" | **"이번 달, 어디에 얼마 썼지?"** |
| 설명 | 소비 분석 | **"앱 열면 바로 보여요. 예산 현황, 정기결제 일정, 카테고리별 지출, AI 분석까지."** |
| 비주얼 | 폰 목업 캐러셀 3장 | **카드 이미지 4개 격자/스택 배치** |

카드 이미지 (`landingScreenshots.overview`):
1. 예산 히어로 카드 — 홈 첫화면 프로그레스바 (전체 예산 현황)
2. 카테고리 TOP 카드 — 이번 달 카테고리별 지출
3. 정기결제 알림 카드 — 오늘 결제 예정 알림
4. AI 인사이트 카드 — AI 분석 코멘트

폰 목업 프레임 제거 → 카드가 크게 보여서 30대+ 타겟에 읽기 편함.

### 섹션 5: 편의 기능 (카드 교체)

**변경 내용**: 자산 트래킹 제거, 가계부 검색 추가, 카피 전체 수정

| # | 현재 | 변경 |
|---|------|------|
| 1 | 예산 관리 — 한도 설정, 초과 알림 | **예산 관리** — "우리 집 예산, 얼마나 썼는지 한눈에 봐요. 넘으면 알려줘요" |
| 2 | 정기결제 관리 — 자동 기록 | **정기결제 관리** — "넷플릭스, 보험료, 공과금 결제일에 놓치지 않고 알려줘요" |
| 3 | 결제수단별 현황 — 카드/현금/이체 | **결제수단 현황** — "카드 실적, 현금, 이체까지 한번에 모아서 봐요" |
| 4 | ~~자산 트래킹~~ | **가계부 검색** — "지난주 병원비 얼마였지? 금액, 카테고리, 기간으로 바로 찾아요" |
| 5 | 맞춤 카테고리 | **맞춤 카테고리** — "나만의 분류로 자유롭게 정리해요" (유지) |

### 섹션 6: 소셜 프루프 (가짜 후기 → 시나리오 전환)

**변경 내용**: 별점 + 인용문 제거, "이런 분께 딱" 시나리오로 전환

| 항목 | 현재 | 변경 |
|------|------|------|
| 헤드라인 | "기록이 습관이 되는 가장 쉬운 방법" | **"이런 분께 딱 맞아요"** |
| 콘텐츠 | 별점 5개 + 가짜 후기 3개 | **문제 → 해결 시나리오 3개** |

상단 숫자 3개 유지:
- "5초면 입력"
- "100% 자동 카테고리"
- "0원 완전 무료"

시나리오 카드 3개:

| 페르소나 | 문제 | 포도가계부로 해결 |
|----------|------|-------------------|
| 맞벌이 부부 | "둘 다 쓰는데 월말에 뭐에 썼는지 모르겠어" | 공유 가계부로 실시간 확인 |
| 살림 초보 | "가계부 앱 깔아봤는데 입력 귀찮아서 삭제함" | 메신저로 한 줄이면 끝 |
| 알뜰 살림러 | "구독료가 매달 얼마 빠지는지 파악이 안 돼" | 정기결제 알림 + 예산 관리 |

### 섹션 7: CTA 푸터 (소폭 개선)

| 항목 | 현재 | 변경 |
|------|------|------|
| 헤드라인 | "포도알처럼 하나씩, 오늘부터 시작해볼까요?" | **"오늘부터 편하게 기록해볼까요?"** |
| 설명 | "복잡한 가입 없이, 메신저로 시작" | **"복잡한 가입 없이, 구글 계정으로 바로 시작하세요"** |
| "사용법 보기" 버튼 | 토스트 메시지 출력 | 유지 (변경 없음) |
| 푸터 링크 | 개인정보처리방침, 이용약관, FAQ, 문의, 사용법 | 유지 (변경 없음) |
| 소셜 아이콘 | X, Instagram | 유지 (변경 없음) |

---

## 변경하지 않는 것

- Header 컴포넌트 (로고 + 로그인 버튼, 스크롤 시 frosted glass 효과)
- LandingPage.tsx (섹션 import + 인증 리다이렉트 로직)
- 전체 디자인 톤 (Grape 디자인 시스템, Cream 배경)
- 애니메이션 패턴 (Intersection Observer, CSS 키프레임, stagger 효과)
- useInView 훅, useCountUp 로직
- 반응형 구조 (모바일 퍼스트)
- 다크모드 지원
- CTAFooter의 "사용법 보기" 버튼, 푸터 링크, 소셜 아이콘

## 파일 변경 범위

| 파일 | 작업 |
|------|------|
| `src/data/landingData.ts` | 새로 생성 — 스크린샷 + 기능 카드 + 시나리오 데이터 |
| `src/components/landing/ScreenshotImage.tsx` | 새로 생성 — 이미지 + fallback 플레이스홀더 |
| `src/components/landing/HeroSection.tsx` | 카피 + 채팅 예시 수정 |
| `src/components/landing/MessengerSection.tsx` | 리뉴얼 → 쉽고 빠른 입력 |
| `src/components/landing/SharedSection.tsx` | 거래 예시 + 설명 수정 |
| `src/components/landing/InsightsSection.tsx` | 리뉴얼 → 한눈에 보기 (카드 격자) |
| `src/components/landing/FeaturesSection.tsx` | 카드 교체 + 카피 수정 |
| `src/components/landing/SocialProofSection.tsx` | 리뉴얼 → 시나리오 전환 |
| `src/components/landing/CTAFooter.tsx` | 카피 수정 |
| `public/screenshots/` | 새 스크린샷 디렉토리 (이미지는 추후 교체) |

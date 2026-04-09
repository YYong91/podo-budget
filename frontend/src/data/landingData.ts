// --- 스크린샷 ---
// hero, input.messenger는 현재 인라인 목업으로 대체 중. 추후 스크린샷 교체 시 사용.
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

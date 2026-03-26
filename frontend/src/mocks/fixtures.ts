/**
 * @file fixtures.ts
 * @description 테스트용 더미 데이터
 * API 응답을 모킹하기 위한 샘플 데이터를 정의한다.
 */

import type { Expense, Income, Category, MonthlyStats, InsightsResponse, StatsResponse, ComparisonResponse, RecurringTransaction, AssetSummary, AssetSnapshot, StructuredInsights, StockSearchResult } from '../types'

/**
 * 테스트용 카테고리 목록
 */
export const mockCategories: Category[] = [
  {
    id: 1,
    name: '식비',
    type: 'expense',
    description: '음식 및 식사',
    sort_order: 3,
    is_savings: false,
    is_system: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: '교통',
    type: 'expense',
    description: '대중교통 및 택시',
    sort_order: 2,
    is_savings: false,
    is_system: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    name: '쇼핑',
    type: 'both',
    description: null,
    sort_order: 1,
    is_savings: false,
    is_system: false,
    created_at: '2024-01-01T00:00:00Z',
  },
]

/**
 * 테스트용 지출 목록
 */
export const mockExpenses: Expense[] = [
  {
    id: 1,
    amount: 8000,
    description: '김치찌개',
    category_id: 1,
    raw_input: '오늘 점심에 김치찌개 8000원 먹었어',
    memo: null,
    household_id: 1,
    user_id: null,
    exclude_from_stats: false,
    recurring_transaction_id: null,
    date: '2024-01-15T12:00:00Z',
    created_at: '2024-01-15T12:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
  },
  {
    id: 2,
    amount: 3500,
    description: '버스',
    category_id: 2,
    raw_input: '버스 3500원',
    memo: null,
    household_id: 1,
    user_id: null,
    exclude_from_stats: false,
    recurring_transaction_id: null,
    date: '2024-01-15T08:00:00Z',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z',
  },
  {
    id: 3,
    amount: 50000,
    description: '옷',
    category_id: 3,
    raw_input: null,
    memo: null,
    household_id: 1,
    user_id: null,
    exclude_from_stats: false,
    recurring_transaction_id: null,
    date: '2024-01-14T15:00:00Z',
    created_at: '2024-01-14T15:00:00Z',
    updated_at: '2024-01-14T15:00:00Z',
  },
]

/**
 * 테스트용 월별 통계
 */
export const mockMonthlyStats: MonthlyStats = {
  month: '2024-01',
  total: 61500,
  by_category: [
    { category: '식비', amount: 8000 },
    { category: '교통', amount: 3500 },
    { category: '쇼핑', amount: 50000 },
  ],
  daily_trend: [
    { date: '2024-01-14', amount: 50000 },
    { date: '2024-01-15', amount: 11500 },
  ],
}

/**
 * 테스트용 기간별 통계
 */
export const mockStats: StatsResponse = {
  period: 'monthly',
  label: '2024년 1월',
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  total: 61500,
  count: 3,
  by_category: [
    { category: '쇼핑', amount: 50000, count: 1, percentage: 81.3 },
    { category: '식비', amount: 8000, count: 1, percentage: 13.0 },
    { category: '교통', amount: 3500, count: 1, percentage: 5.7 },
  ],
  trend: [
    { label: '01/14', amount: 50000 },
    { label: '01/15', amount: 11500 },
  ],
}

/**
 * 테스트용 기간 비교
 */
export const mockComparison: ComparisonResponse = {
  current: { label: '2024년 1월', total: 61500 },
  previous: { label: '2023년 12월', total: 55000 },
  change: { amount: 6500, percentage: 11.8 },
  trend: [
    { label: '2023년 11월', total: 48000 },
    { label: '2023년 12월', total: 55000 },
    { label: '2024년 1월', total: 61500 },
  ],
  by_category_comparison: [
    { category: '식비', current: 8000, previous: 12000, change_amount: -4000, change_percentage: -33.3 },
    { category: '교통', current: 3500, previous: 3000, change_amount: 500, change_percentage: 16.7 },
    { category: '쇼핑', current: 50000, previous: 40000, change_amount: 10000, change_percentage: 25.0 },
  ],
}

/**
 * 테스트용 수입 기간 비교
 */
export const mockIncomeComparison: ComparisonResponse = {
  current: { label: '2024년 1월', total: 4000000 },
  previous: { label: '2023년 12월', total: 3500000 },
  change: { amount: 500000, percentage: 14.3 },
  trend: [
    { label: '2023년 11월', total: 3200000 },
    { label: '2023년 12월', total: 3500000 },
    { label: '2024년 1월', total: 4000000 },
  ],
  by_category_comparison: [
    { category: '급여', current: 3500000, previous: 3000000, change_amount: 500000, change_percentage: 16.7 },
    { category: '부수입', current: 500000, previous: 500000, change_amount: 0, change_percentage: 0 },
  ],
}

/**
 * 테스트용 수입 카테고리 (type=income 또는 type=both인 카테고리 포함)
 */
export const mockIncomeCategoriesAll: Category[] = [
  ...mockCategories,
  {
    id: 4,
    name: '급여',
    type: 'income',
    description: '월급 및 급여',
    sort_order: 0,
    is_savings: false,
    is_system: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 5,
    name: '부수입',
    type: 'income',
    description: '프리랜스 등 부수입',
    sort_order: 0,
    is_savings: false,
    is_system: false,
    created_at: '2024-01-01T00:00:00Z',
  },
]

/**
 * 테스트용 수입 목록
 */
export const mockIncomes: Income[] = [
  {
    id: 1,
    amount: 3500000,
    description: '2월 월급',
    category_id: null,
    raw_input: '월급 350만원',
    memo: null,
    household_id: 1,
    user_id: 1,
    exclude_from_stats: false,
    recurring_transaction_id: null,
    date: '2026-02-01T09:00:00Z',
    created_at: '2026-02-01T09:00:00Z',
    updated_at: '2026-02-01T09:00:00Z',
  },
  {
    id: 2,
    amount: 500000,
    description: '프리랜스 수입',
    category_id: null,
    raw_input: null,
    memo: null,
    household_id: 1,
    user_id: 1,
    exclude_from_stats: false,
    recurring_transaction_id: null,
    date: '2026-02-10T10:00:00Z',
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
  },
]

/**
 * 테스트용 수입 통계
 */
export const mockIncomeStats: StatsResponse = {
  period: 'monthly',
  label: '2026년 2월',
  start_date: '2026-02-01',
  end_date: '2026-02-28',
  total: 4000000,
  count: 2,
  by_category: [
    { category: '급여', amount: 3500000, count: 1, percentage: 87.5 },
    { category: '부수입', amount: 500000, count: 1, percentage: 12.5 },
  ],
  trend: [
    { label: '02/01', amount: 3500000 },
    { label: '02/10', amount: 500000 },
  ],
}

/**
 * 테스트용 정기 거래
 */
export const mockRecurringTransactions: RecurringTransaction[] = [
  {
    id: 1,
    user_id: 1,
    household_id: 1,
    type: 'expense',
    amount: 17000,
    description: '넷플릭스',
    category_id: null,
    frequency: 'monthly',
    interval: null,
    day_of_month: 25,
    day_of_week: null,
    month_of_year: null,
    start_date: '2026-01-25',
    end_date: null,
    next_due_date: '2026-02-25',
    is_active: true,
    created_at: '2026-01-25T00:00:00Z',
    updated_at: '2026-01-25T00:00:00Z',
  },
  {
    id: 2,
    user_id: 1,
    household_id: 1,
    type: 'income',
    amount: 3500000,
    description: '급여',
    category_id: null,
    frequency: 'monthly',
    interval: null,
    day_of_month: 25,
    day_of_week: null,
    month_of_year: null,
    start_date: '2026-01-25',
    end_date: null,
    next_due_date: '2026-02-25',
    is_active: true,
    created_at: '2026-01-25T00:00:00Z',
    updated_at: '2026-01-25T00:00:00Z',
  },
]

/**
 * 테스트용 인사이트 응답
 */
export const mockInsights: InsightsResponse = {
  month: '2024-01',
  total: 61500,
  by_category: {
    '식비': 8000,
    '교통': 3500,
    '쇼핑': 50000,
  },
  insights: `## 지출 분석

이번 달 총 지출은 **61,500원**입니다.

- **쇼핑** 카테고리가 전체 지출의 81.3%를 차지합니다.
- 식비와 교통비는 합리적인 수준입니다.
- 쇼핑 지출을 줄이면 더 많은 저축이 가능합니다.

## 개선 제안

다음 달에는 쇼핑 예산을 30,000원 이하로 설정해보세요.`,
}

/**
 * 테스트용 자산 요약
 */
export const mockAssetSummary: AssetSummary = {
  total_assets: 100000000,
  total_liabilities: 15000000,
  net_worth: 85000000,
  breakdown: {
    stock_kr: 30000000,
    deposit: 50000000,
    real_estate: 20000000,
  },
  total_profit_loss: 2000000,
  total_profit_loss_pct: 2.4,
}

/**
 * 테스트용 자산 스냅샷
 */
export const mockAssetSnapshots: AssetSnapshot[] = [
  {
    snapshot_date: '2026-02-28',
    total_assets: 97000000,
    total_liabilities: 14000000,
    net_worth: 83000000,
    breakdown: { stock_kr: 28000000, deposit: 49000000, real_estate: 20000000 },
  },
  {
    snapshot_date: '2026-03-31',
    total_assets: 100000000,
    total_liabilities: 15000000,
    net_worth: 85000000,
    breakdown: { stock_kr: 30000000, deposit: 50000000, real_estate: 20000000 },
  },
]

/**
 * 테스트용 구조화된 인사이트
 */
/**
 * 테스트용 자산 목록
 */
export const mockAssets = [
  {
    id: 1,
    name: '삼성전자',
    type: 'stock_kr',
    is_liability: false,
    ticker: '005930.KS',
    quantity: 10,
    purchase_price: 70000,
    current_price: 72000,
    currency: 'KRW',
    memo: null,
    household_id: 1,
    user_id: 1,
    account_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 2,
    name: '비상금 통장',
    type: 'deposit',
    is_liability: false,
    ticker: null,
    quantity: null,
    purchase_price: 5000000,
    current_price: 5000000,
    currency: 'KRW',
    memo: null,
    household_id: 1,
    user_id: 1,
    account_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
]

/**
 * 테스트용 자산 목표
 */
export const mockAssetGoal = {
  id: 1,
  target_net_worth: 100000000,
  target_date: '2027-12-31',
  household_id: null,
  user_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  pace_analysis: {
    current_net_worth: 85000000,
    monthly_required: 1250000,
    months_remaining: 12,
    on_track: true,
  },
}

/**
 * 테스트용 월별 저축 추이
 */
export const mockMonthlySavings = [
  { month: '2026-01', total_income: 4000000, total_expense: 2500000, net_savings: 1500000 },
  { month: '2026-02', total_income: 4000000, total_expense: 2800000, net_savings: 1200000 },
]

/**
 * 테스트용 자연어 채팅 응답
 */
export const mockChatResponse = {
  message: '김치찌개 8,000원을 식비로 저장했습니다.',
  expenses_created: [
    {
      id: 10,
      amount: 8000,
      description: '김치찌개',
      category_id: 1,
      raw_input: '오늘 점심에 김치찌개 8000원 먹었어',
      memo: null,
      household_id: 1,
      user_id: 1,
      exclude_from_stats: false,
      recurring_transaction_id: null,
      date: '2026-03-14T12:00:00Z',
      created_at: '2026-03-14T12:00:00Z',
      updated_at: '2026-03-14T12:00:00Z',
    },
  ],
  incomes_created: null,
  parsed_items: null,
  parsed_expenses: null,
}

/**
 * 테스트용 피드백 목록
 */
export const mockFeedbacks = [
  {
    id: 1,
    user_id: 1,
    type: 'feature' as const,
    title: '다크모드 추가',
    content: '다크모드를 추가해주세요',
    status: 'new' as const,
    source: 'web' as const,
    username: 'testuser',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 2,
    user_id: 1,
    type: 'bug' as const,
    title: '카테고리 안 보임',
    content: '카테고리가 표시되지 않습니다',
    status: 'read' as const,
    source: 'telegram' as const,
    username: 'testuser',
    created_at: '2026-03-02T00:00:00Z',
    updated_at: '2026-03-02T00:00:00Z',
  },
]

/**
 * 테스트용 관리자 대시보드 통계
 */
export const mockDashboardStats = {
  total_users: 150,
  active_users: 80,
  telegram_linked_count: 30,
  total_households: 20,
  today_active_users: 15,
  total_expenses_count: 5000,
  total_income_count: 1500,
}

/**
 * 테스트용 종목 검색 결과 (BE stocks 테이블)
 */
export const mockStocks: StockSearchResult[] = [
  { id: 1, ticker: '005930', name: '삼성전자', market: 'KOSPI' },
  { id: 2, ticker: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { id: 3, ticker: '247540', name: '에코프로비엠', market: 'KOSDAQ' },
]

export const mockStructuredInsights: StructuredInsights = {
  findings: [
    {
      what: '식비가 전체 지출의 37.5%를 차지합니다',
      so_what: '전국 평균(30%) 대비 높은 수준입니다',
      now_what: '주 2회 도시락을 준비하면 월 20만원 절약 가능합니다',
    },
    {
      what: '순자산이 전월 대비 200만원 증가했습니다',
      so_what: '꾸준한 저축과 투자 수익이 반영된 결과입니다',
      now_what: '현재 페이스를 유지하세요',
    },
  ],
  asset_analysis: {
    summary: '순자산 8,500만원으로 전월 대비 2.4% 증가',
    allocation_analysis: '예적금 비중이 59%로 안정적이나, 성장 자산 비중을 점진적으로 늘려볼 수 있습니다',
    diversification_tip: '일반적으로 연령과 위험 허용도에 따라 자산을 분산하는 것이 권장됩니다',
  },
  action_items: [
    { title: '식비 예산 100만원 설정', description: '이번 달 식비를 100만원 이내로 관리해보세요' },
    { title: '비상금 확인', description: '월 생활비 3~6개월치 비상금이 확보되어 있는지 점검하세요' },
  ],
  encouragement: '저축률 36%는 매우 우수합니다! 이 습관을 유지하세요',
}

/**
 * @file fixtures.ts
 * @description 테스트용 더미 데이터
 * API 응답을 모킹하기 위한 샘플 데이터를 정의한다.
 */

import type { Expense, Income, Category, MonthlyStats, InsightsResponse, StatsResponse, ComparisonResponse } from '../types'

/**
 * 테스트용 카테고리 목록
 */
export const mockCategories: Category[] = [
  {
    id: 1,
    name: '식비',
    type: 'expense',
    description: '음식 및 식사',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: '교통',
    type: 'expense',
    description: '대중교통 및 택시',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    name: '쇼핑',
    type: 'both',
    description: null,
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
    household_id: null,
    user_id: null,
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
    household_id: null,
    user_id: null,
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
    household_id: null,
    user_id: null,
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
 * 테스트용 수입 카테고리 (type=income 또는 type=both인 카테고리 포함)
 */
export const mockIncomeCategoriesAll: Category[] = [
  ...mockCategories,
  {
    id: 4,
    name: '급여',
    type: 'income',
    description: '월급 및 급여',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 5,
    name: '부수입',
    type: 'income',
    description: '프리랜스 등 부수입',
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
    household_id: null,
    user_id: 1,
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
    household_id: null,
    user_id: 1,
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

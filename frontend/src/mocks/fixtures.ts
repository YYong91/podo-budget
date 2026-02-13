/**
 * @file fixtures.ts
 * @description 테스트용 더미 데이터
 * API 응답을 모킹하기 위한 샘플 데이터를 정의한다.
 */

import type { Expense, Category, MonthlyStats, InsightsResponse } from '../types'

/**
 * 테스트용 카테고리 목록
 */
export const mockCategories: Category[] = [
  {
    id: 1,
    name: '식비',
    description: '음식 및 식사',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: '교통',
    description: '대중교통 및 택시',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    name: '쇼핑',
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

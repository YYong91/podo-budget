/* 결산 리포트 관련 타입 정의 */

import type { StructuredInsights } from './index'

/** 리포트 생성 상태 */
export type ReportStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * 리포트 생성 불가 원인
 * - profile_missing: 프로필(이름/성별/연령대) 미설정
 * - transactions_short: 거래 건수 부족
 * - categories_short: 카테고리 다양성 부족
 * - spend_short: 지출 총액 부족
 * - first_month: 첫 달 (비교 데이터 없음)
 * - null: 생성 가능 (eligible)
 */
export type ReportBlocker =
  | 'profile_missing'
  | 'transactions_short'
  | 'categories_short'
  | 'spend_short'
  | 'first_month'
  | null

/** 월간 결산 리포트 */
export interface MonthlyReport {
  id: number
  /** YYYY-MM 형식 */
  month: string
  status: ReportStatus
  insights: StructuredInsights | null
  completed_at: string | null
}

/** 리포트 생성 자격 요건 충족 여부 */
export interface ReportEligibility {
  has_profile: boolean
  transaction_count: number
  transactions_needed: number
  category_count: number
  total_spend: number
  is_eligible: boolean
  blocker: ReportBlocker
}

/**
 * GET /reports/monthly, GET /reports/latest 응답 타입
 * 리포트가 있으면 report + eligibility null,
 * 리포트가 없으면 report null + eligibility 포함
 */
export interface MonthlyReportOrEligibility {
  report: MonthlyReport | null
  eligibility: ReportEligibility | null
}

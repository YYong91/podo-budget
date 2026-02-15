/* 공통 타입 정의 */

export interface Expense {
  id: number
  amount: number
  description: string
  category_id: number | null
  raw_input: string | null
  household_id: number | null
  user_id: number | null
  date: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  description: string | null
  created_at: string
}

export interface MonthlyStats {
  month: string
  total: number
  by_category: CategoryAmount[]
  daily_trend: DailyAmount[]
}

export interface CategoryAmount {
  category: string
  amount: number
}

export interface DailyAmount {
  date: string
  amount: number
}

export interface ParsedExpenseItem {
  amount: number
  description: string
  category: string
  date: string
  memo: string
}

export interface ChatResponse {
  message: string
  expenses_created: Expense[] | null
  parsed_expenses: ParsedExpenseItem[] | null
  insights: string | null
}

export interface InsightsResponse {
  month: string
  total: number
  by_category: Record<string, number>
  insights: string
}

export interface User {
  id: number
  username: string
  email: string | null
  is_active: boolean
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface Budget {
  id: number
  category_id: number
  amount: number
  period: 'monthly' | 'weekly' | 'daily'
  start_date: string
  end_date: string | null
  alert_threshold: number | null
  created_at: string
  updated_at: string
}

export interface BudgetCreateRequest {
  category_id: number
  amount: number
  period: 'monthly' | 'weekly' | 'daily'
  start_date: string
  end_date?: string
  alert_threshold?: number
}

export interface BudgetUpdateRequest {
  amount?: number
  period?: 'monthly' | 'weekly' | 'daily'
  start_date?: string
  end_date?: string
  alert_threshold?: number
}

export interface BudgetAlert {
  budget_id: number
  category_id: number
  category_name: string
  budget_amount: number
  spent_amount: number
  remaining_amount: number
  usage_percentage: number
  is_exceeded: boolean
  is_warning: boolean
}

/* 통계 관련 타입 */

export interface CategoryStats {
  category: string
  amount: number
  count: number
  percentage: number
}

export interface TrendPoint {
  label: string
  amount: number
}

export interface StatsResponse {
  period: string
  label: string
  start_date: string
  end_date: string
  total: number
  count: number
  by_category: CategoryStats[]
  trend: TrendPoint[]
}

export interface PeriodTotal {
  label: string
  total: number
}

export interface CategoryChange {
  category: string
  current: number
  previous: number
  change_amount: number
  change_percentage: number | null
}

export interface ComparisonResponse {
  current: PeriodTotal
  previous: PeriodTotal
  change: {
    amount: number
    percentage: number | null
  }
  trend: PeriodTotal[]
  by_category_comparison: CategoryChange[]
}

/* Household 관련 타입 */
export type {
  Household,
  HouseholdDetail,
  HouseholdMember,
  HouseholdInvitation,
  CreateHouseholdDto,
  UpdateHouseholdDto,
  InviteMemberDto,
  MemberRole,
  AcceptInvitationResponse,
} from './household'

/* 공통 타입 정의 */

export type AssetType = 'stock_kr' | 'stock_us' | 'crypto' | 'deposit' | 'real_estate' | 'other' | 'loan'
export type AccountType = 'brokerage' | 'bank' | 'crypto_exchange' | 'other'

export interface Account {
  id: number
  household_id: number | null
  created_by: number
  name: string
  type: AccountType
  institution: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

export interface CreateAccountParams {
  name: string
  type: AccountType
  institution?: string | null
  memo?: string | null
  household_id?: number | null
}

export interface Asset {
  id: number
  household_id: number | null
  account_id: number | null
  created_by: number
  name: string
  type: AssetType
  is_liability: boolean
  ticker: string | null
  quantity: number | null
  avg_buy_price: number | null
  manual_value: number | null
  interest_rate: number | null
  maturity_date: string | null
  repayment_type: string | null
  monthly_payment: number | null
  memo: string | null
  created_at: string
  updated_at: string
  // 시세 정보
  current_price: number | null
  current_value: number | null
  profit_loss: number | null
  profit_loss_pct: number | null
}

export interface AssetSummary {
  total_assets: number
  total_liabilities: number
  net_worth: number
  breakdown: Record<string, number>
  total_profit_loss: number
  total_profit_loss_pct: number | null
}

export interface AssetSnapshot {
  snapshot_date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
  breakdown: Record<string, number> | null
}

export interface AssetSearchResult {
  ticker: string
  name: string
  market: string
}

export interface CreateAssetParams {
  name: string
  type: string
  is_liability?: boolean
  ticker?: string | null
  quantity?: number | null
  avg_buy_price?: number | null
  manual_value?: number | null
  interest_rate?: number | null
  maturity_date?: string | null
  repayment_type?: string | null
  monthly_payment?: number | null
  account_id?: number | null
  memo?: string | null
  household_id?: number | null
}

export interface Expense {
  id: number
  amount: number
  description: string
  category_id: number | null
  raw_input: string | null
  memo: string | null
  household_id: number | null
  user_id: number | null
  exclude_from_stats: boolean
  date: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  type: 'expense' | 'income' | 'both'
  description: string | null
  sort_order: number
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

export interface Income {
  id: number
  amount: number
  description: string
  category_id: number | null
  raw_input: string | null
  memo: string | null
  household_id: number | null
  user_id: number
  exclude_from_stats: boolean
  date: string
  created_at: string
  updated_at: string
}

export interface ParsedExpenseItem {
  amount: number
  description: string
  category: string
  date: string
  memo: string
  type: string
}

export interface ChatResponse {
  message: string
  expenses_created: Expense[] | null
  incomes_created: Income[] | null
  parsed_items: ParsedExpenseItem[] | null
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
  is_telegram_linked: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  email: string
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

export interface MonthlySpending {
  year: number
  month: number
  amount: number
}

export interface CategoryBudgetOverview {
  category_id: number
  category_name: string
  monthly_spending: MonthlySpending[]
  current_budget_id: number | null
  current_budget_amount: number | null
  alert_threshold: number | null
}

export interface TotalBudgetResponse {
  total_monthly_budget: number | null
}

export interface BudgetMonthlyCategoryStats {
  category_name: string
  budget_amount: number
  spent_amount: number
  remaining_amount: number
  usage_percentage: number
  is_exceeded: boolean
}

export interface BudgetMonthlyStatsResponse {
  month: string
  total_budget: number | null
  total_spent: number
  categories: BudgetMonthlyCategoryStats[]
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

/* 정기 거래 관련 타입 */

export interface RecurringTransaction {
  id: number
  user_id: number
  household_id: number | null
  type: 'expense' | 'income'
  amount: number
  description: string
  category_id: number | null
  frequency: 'monthly' | 'weekly' | 'yearly' | 'custom'
  interval: number | null
  day_of_month: number | null
  day_of_week: number | null
  month_of_year: number | null
  start_date: string
  end_date: string | null
  next_due_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RecurringTransactionCreate {
  type: 'expense' | 'income'
  amount: number
  description: string
  category_id?: number | null
  frequency: 'monthly' | 'weekly' | 'yearly' | 'custom'
  interval?: number | null
  day_of_month?: number | null
  day_of_week?: number | null
  month_of_year?: number | null
  start_date: string
  end_date?: string | null
  household_id?: number | null
}

export interface ExecuteResponse {
  message: string
  created_id: number
  type: string
  next_due_date: string
}

/* 피드백 관련 타입 */

export type FeedbackType = 'feature' | 'bug'
export type FeedbackStatus = 'new' | 'read' | 'done'

export interface Feedback {
  id: number
  user_id: number
  type: FeedbackType
  title: string
  content: string
  status: FeedbackStatus
  username: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackCreateRequest {
  type: FeedbackType
  title: string
  content: string
}

// ── 종합 재무 인사이트 ──

export interface HealthScore {
  savings: number
  spending: number
  debt: number
  overall: number
  grade: string
}

export interface Finding {
  what: string
  so_what: string
  now_what: string
}

export interface AssetAnalysisResult {
  summary: string
  allocation_analysis: string
  diversification_tip: string
}

export interface ActionItem {
  title: string
  description: string
}

export interface StructuredInsights {
  findings: Finding[]
  asset_analysis: AssetAnalysisResult | null
  action_items: ActionItem[]
  encouragement: string
}

export interface ComprehensiveInsightsResponse {
  month: string
  insights: StructuredInsights
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

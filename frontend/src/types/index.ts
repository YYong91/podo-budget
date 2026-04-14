/* 공통 타입 정의 */

export type AssetType = 'stock_kr' | 'stock_us' | 'crypto' | 'deposit' | 'real_estate' | 'other' | 'loan' | 'insurance' | 'vehicle'
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
  original_amount: number | null
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

/** BE stocks 테이블 검색 결과 (GET /api/stocks/search) */
export interface StockSearchResult {
  id: number
  ticker: string
  name: string
  market: string
}

export interface AssetGoal {
  id: number
  target_net_worth: number
  target_date: string
  household_id: number | null
  user_id: number
  progress_pct: number
  monthly_required: number | null
  estimated_date: string | null
  pace_status: 'ahead' | 'on_track' | 'behind'
  pace_message: string
  created_at: string
  updated_at: string
}

export interface MonthlySavings {
  month: string
  savings: number
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
  original_amount?: number | null
  memo?: string | null
  household_id?: number | null
}

export interface Expense {
  id: number
  amount: number
  description: string
  category_id: number | null
  payment_method_id: number | null
  raw_input: string | null
  memo: string | null
  household_id: number | null
  user_id: number | null
  exclude_from_stats: boolean
  recurring_transaction_id: number | null
  date: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  type: 'expense' | 'income' | 'both'
  description: string | null
  emoji: string | null
  sort_order: number
  is_savings: boolean
  is_system: boolean
  exclude_auto_payment: boolean
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
  recurring_transaction_id: number | null
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
  /** LLM이 추출한 결제수단 이름 */
  payment_method?: string | null
  /** 원본 통화 코드 (예: USD, JPY) — 해외 지출 지원 (#245) */
  currency?: string | null
  /** 원본 통화 금액 */
  original_amount?: number | null
  /** 환율 (원본 통화 → KRW) */
  exchange_rate?: number | null
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
  is_kakao_linked: boolean
  is_admin: boolean
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
  category_emoji: string | null
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
  source_id?: number | null
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

export type FeedbackSource = 'web' | 'telegram' | 'kakao'

export interface Feedback {
  id: number
  user_id: number
  type: FeedbackType
  title: string
  content: string
  status: FeedbackStatus
  source: FeedbackSource
  username: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackCreateRequest {
  type: FeedbackType
  title: string
  content: string
  source?: FeedbackSource
}

// ── 종합 재무 인사이트 ──

// 가계부 점수 (4개 지표 기반)
export interface IndicatorBreakdown {
  score: number | null
  summary: string
  detail?: string
}

export interface FinancialScoreBreakdown {
  savingsRate: IndicatorBreakdown
  budgetAdherence: IndicatorBreakdown
  fixedExpenseRatio: IndicatorBreakdown
  spendingStability: IndicatorBreakdown
}

export interface FinancialScore {
  savingsRate: number | null
  budgetAdherence: number | null
  fixedExpenseRatio: number | null
  spendingStability: number | null
  overall: number
  grade: string
  activeIndicators: number
  breakdown: FinancialScoreBreakdown
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

/* Admin 관련 타입 */

export interface RecentActivityItem {
  type: 'expense' | 'income' | 'signup' | 'feedback'
  username: string
  description: string
  amount: number | null
  created_at: string
}

export interface InactiveUserItem {
  id: number
  username: string
  last_activity_at: string | null
  days_inactive: number
}

export interface DashboardStats {
  total_users: number
  active_users: number
  telegram_linked_count: number
  total_households: number
  today_active_users: number
  today_transaction_count: number
  pending_feedback_count: number
  recent_activity: RecentActivityItem[]
  inactive_users: InactiveUserItem[]
}

export interface AdminUserItem {
  id: number
  username: string
  email: string | null
  is_active: boolean
  created_at: string
  expense_count: number
  income_count: number
  last_activity_at: string | null
  is_telegram_linked: boolean
}

export interface AdminUserListResponse {
  users: AdminUserItem[]
  total: number
  page: number
  page_size: number
}

export interface AdminUserDetail {
  id: number
  username: string
  email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  expense_count: number
  income_count: number
  total_spent: number
  total_earned: number
  household_count: number
  is_telegram_linked: boolean
  last_activity_at: string | null
}

/* 결제수단 관련 타입 */

export type PaymentMethodType = 'credit_card' | 'debit_card' | 'cash' | 'transfer'

export interface PaymentMethod {
  id: number
  household_id: number | null
  created_by: number | null
  name: string
  type: PaymentMethodType
  monthly_target: number | null
  is_default: boolean
  is_system: boolean
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface PaymentMethodUsage {
  id: number
  name: string
  type: string
  monthly_target: number | null
  spent_amount: number
  usage_percentage: number | null
  remaining: number | null
}

/* HouseholdProfile 타입 */
export interface HouseholdProfile {
  id: number
  householdId: number
  householdType: 'single' | 'dual_income' | 'single_income' | 'retired'
  housingType: 'own_no_loan' | 'own_with_loan' | 'jeonse' | 'monthly_rent' | 'with_parents'
  incomeTypes: ('salary' | 'freelance' | 'business' | 'pension' | 'investment' | 'side_job')[]
  ageRange: '20s' | '30s' | '40s' | '50s_plus'
  financialGoal?: 'emergency_fund' | 'debt_payoff' | 'home_purchase' | 'investment' | 'retirement' | 'travel' | 'none' | null
  goalAmount?: number | null
  goalDeadline?: string | null
  primaryConcern?: 'overspending' | 'no_savings' | 'too_much_debt' | 'irregular_income' | 'none' | null
  createdAt: string
  updatedAt: string
}

export interface HouseholdProfileInput {
  householdType: HouseholdProfile['householdType']
  housingType: HouseholdProfile['housingType']
  incomeTypes: HouseholdProfile['incomeTypes']
  ageRange: HouseholdProfile['ageRange']
  financialGoal?: HouseholdProfile['financialGoal']
  goalAmount?: number | null
  goalDeadline?: string | null
  primaryConcern?: HouseholdProfile['primaryConcern']
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

/* 공통 타입 정의 */

export interface Expense {
  id: number
  amount: number
  description: string
  category_id: number | null
  raw_input: string | null
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

export interface ChatResponse {
  message: string
  expenses_created: Expense[] | null
  insights: string | null
}

export interface InsightsResponse {
  month: string
  total: number
  by_category: Record<string, number>
  insights: string
}

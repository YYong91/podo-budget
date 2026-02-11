/* 대시보드 페이지 - 월별 지출 요약, 차트, 최근 지출 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { expenseApi } from '../api/expenses'
import type { Expense, MonthlyStats } from '../types'

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280']

/* 금액 포맷 */
function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

/* 현재 월 (YYYY-MM) */
function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function Dashboard() {
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, expensesRes] = await Promise.all([
          expenseApi.getMonthlyStats(getCurrentMonth()),
          expenseApi.getAll({ limit: 5 }),
        ])
        setStats(statsRes.data)
        setRecentExpenses(expensesRes.data)
      } catch {
        // API 미연결 시 빈 상태
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const total = stats?.total ?? 0
  const byCategory = stats?.by_category ?? []
  const dailyTrend = stats?.daily_trend ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      {/* 상단 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">이번 달 총 지출</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatAmount(total)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">카테고리 수</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{byCategory.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">기록된 일수</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{dailyTrend.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">일 평균 지출</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {dailyTrend.length > 0 ? formatAmount(Math.round(total / dailyTrend.length)) : '₩0'}
          </p>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리별 파이 차트 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">카테고리별 지출</h2>
          {byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatAmount(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-16">데이터가 없습니다</p>
          )}
        </div>

        {/* 일별 트렌드 라인 차트 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">일별 지출 추이</h2>
          {dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatAmount(Number(value))} />
                <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-16">데이터가 없습니다</p>
          )}
        </div>
      </div>

      {/* 최근 지출 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">최근 지출</h2>
          <Link to="/expenses" className="text-sm text-primary-600 hover:text-primary-700">
            전체 보기 →
          </Link>
        </div>
        {recentExpenses.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {recentExpenses.map((expense) => (
              <Link
                key={expense.id}
                to={`/expenses/${expense.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded"
              >
                <div>
                  <p className="font-medium text-gray-900">{expense.description}</p>
                  <p className="text-sm text-gray-500">{expense.date.slice(0, 10)}</p>
                </div>
                <p className="font-semibold text-gray-900">{formatAmount(expense.amount)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">
            아직 기록된 지출이 없습니다.<br />
            Telegram 봇으로 지출을 입력해보세요!
          </p>
        )}
      </div>
    </div>
  )
}

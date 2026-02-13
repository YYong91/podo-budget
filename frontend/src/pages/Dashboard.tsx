/**
 * @file Dashboard.tsx
 * @description 대시보드 페이지 - 월별 지출 요약, 차트, 최근 지출
 * 이번 달 지출 통계, 카테고리별 파이 차트, 일별 트렌드, 최근 지출 목록을 표시한다.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { expenseApi } from '../api/expenses'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
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
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  /**
   * 대시보드 데이터 로드 (통계 + 최근 지출)
   */
  async function fetchData() {
    setLoading(true)
    setError(false)
    try {
      const [statsRes, expensesRes] = await Promise.all([
        expenseApi.getMonthlyStats(getCurrentMonth(), activeHouseholdId ?? undefined),
        expenseApi.getAll({ limit: 5, household_id: activeHouseholdId ?? undefined }),
      ])
      setStats(statsRes.data)
      setRecentExpenses(expensesRes.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeHouseholdId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  /* 에러 발생 시 에러 상태 UI */
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <ErrorState onRetry={fetchData} />
        </div>
      </div>
    )
  }

  const total = stats?.total ?? 0
  const byCategory = stats?.by_category ?? []
  const dailyTrend = stats?.daily_trend ?? []
  const hasNoData = total === 0 && recentExpenses.length === 0

  /* 데이터가 전혀 없을 때 전체 빈 상태 UI */
  if (hasNoData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <EmptyState
            icon="💸"
            title="아직 이번 달 지출 기록이 없어요"
            description="웹에서 직접 지출을 기록하거나, 텔레그램 봇을 연동하여 채팅으로 입력해보세요."
            action={{
              label: '➕ 지출 추가하기',
              onClick: () => navigate('/expenses/new'),
            }}
            secondaryAction={{
              label: '📝 지출 목록 보기',
              onClick: () => navigate('/expenses'),
            }}
          />
        </div>
      </div>
    )
  }

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">카테고리별 지출</h2>
          {byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="min-h-[250px]">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
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
            <div className="h-[250px] flex items-center justify-center">
              <p className="text-sm text-gray-400">아직 카테고리별 데이터가 없습니다</p>
            </div>
          )}
        </div>

        {/* 일별 트렌드 라인 차트 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">일별 지출 추이</h2>
          {dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="min-h-[250px]">
              <LineChart data={dailyTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatAmount(Number(value))} />
                <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center">
              <p className="text-sm text-gray-400">아직 일별 데이터가 없습니다</p>
            </div>
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
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{expense.description}</p>
                  <p className="text-sm text-gray-500">{expense.date.slice(0, 10).replace(/-/g, '.')}</p>
                </div>
                <p className="font-semibold text-gray-900 ml-4 whitespace-nowrap">{formatAmount(expense.amount)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📝"
            title="아직 기록된 지출이 없습니다"
            description="Telegram 봇으로 지출을 입력하거나 웹에서 직접 추가해보세요."
          />
        )}
      </div>
    </div>
  )
}

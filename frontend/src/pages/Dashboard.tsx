/**
 * @file Dashboard.tsx
 * @description 대시보드 페이지 - 월별 지출 요약, 차트, 최근 지출
 * 가구가 선택된 경우 공유 지출을 먼저 보여주고, 개인 지출은 접기 가능한 섹션으로 표시한다.
 */

import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Chart as ChartJS, ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip as ChartTooltip, Legend } from 'chart.js'
import { Pie, Line } from 'react-chartjs-2'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { Expense, Income, MonthlyStats, StatsResponse } from '../types'

ChartJS.register(ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, ChartTooltip, Legend)

const COLORS = ['#D97706', '#0EA5E9', '#10B981', '#F43F5E', '#8B5CF6', '#EC4899', '#06B6D4', '#78716C']

/* 금액 포맷 */
function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

/* 현재 월 (YYYY-MM) */
function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/* 통계 카드 섹션 */
function StatsCards({ stats, incomeTotal }: { stats: MonthlyStats; incomeTotal?: number }) {
  const total = stats.total ?? 0
  const byCategory = stats.by_category ?? []
  const dailyTrend = stats.daily_trend ?? []
  const income = incomeTotal ?? 0
  const netIncome = income - total

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 shadow-sm p-5 hover:shadow-md transition-shadow duration-200">
          <p className="text-sm text-amber-700/70">이번 달 총 지출</p>
          <p className="text-2xl font-bold tracking-tight text-stone-900 mt-1">{formatAmount(total)}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-200/60 shadow-sm p-5 hover:shadow-md transition-shadow duration-200">
          <p className="text-sm text-emerald-700/70">이번 달 총 수입</p>
          <p className="text-2xl font-bold tracking-tight text-emerald-700 mt-1">+{formatAmount(income)}</p>
        </div>
        <div className={`bg-gradient-to-br ${netIncome >= 0 ? 'from-blue-50 to-sky-50 border-blue-200/60' : 'from-rose-50 to-red-50 border-rose-200/60'} rounded-2xl border shadow-sm p-5 hover:shadow-md transition-shadow duration-200`}>
          <p className={`text-sm ${netIncome >= 0 ? 'text-blue-700/70' : 'text-rose-700/70'}`}>순수익</p>
          <p className={`text-2xl font-bold tracking-tight mt-1 ${netIncome >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
            {netIncome >= 0 ? '+' : ''}{formatAmount(netIncome)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
          <p className="text-sm text-stone-500">일 평균 지출</p>
          <p className="text-3xl font-bold text-stone-900 mt-1">
            {dailyTrend.length > 0 ? formatAmount(Math.round(total / dailyTrend.length)) : '₩0'}
          </p>
        </div>
      </div>
    </div>
  )
}

/* 차트 섹션 */
function ChartSection({ stats }: { stats: MonthlyStats }) {
  const byCategory = stats.by_category ?? []
  const dailyTrend = stats.daily_trend ?? []
  const pieRef = useRef<ChartJS<'pie'>>(null)
  const lineRef = useRef<ChartJS<'line'>>(null)

  const pieData = {
    labels: byCategory.map((c) => c.category),
    datasets: [
      {
        data: byCategory.map((c) => c.amount),
        backgroundColor: byCategory.map((_, i) => COLORS[i % COLORS.length]),
        borderWidth: 0,
      },
    ],
  }

  const lineData = {
    labels: dailyTrend.map((d) => d.date.slice(5)),
    datasets: [
      {
        data: dailyTrend.map((d) => d.amount),
        borderColor: '#D97706',
        backgroundColor: 'rgba(217, 119, 6, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#D97706',
        tension: 0.3,
        fill: true,
      },
    ],
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 카테고리별 파이 차트 */}
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <h2 className="text-base font-semibold text-stone-700 mb-4">카테고리별 지출</h2>
        {byCategory.length > 0 ? (
          <div className="h-[250px] flex items-center justify-center">
            <Pie
              ref={pieRef}
              data={pieData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `${ctx.label} ${formatAmount(ctx.parsed)}`,
                    },
                  },
                },
              }}
            />
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center">
            <p className="text-sm text-stone-400">아직 카테고리별 데이터가 없습니다</p>
          </div>
        )}
      </div>

      {/* 일별 트렌드 라인 차트 */}
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
        <h2 className="text-base font-semibold text-stone-700 mb-4">일별 지출 추이</h2>
        {dailyTrend.length > 0 ? (
          <div className="h-[250px]">
            <Line
              ref={lineRef}
              data={lineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => formatAmount(ctx.parsed.y ?? 0),
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: { font: { size: 11 } },
                    grid: { display: false },
                  },
                  y: {
                    ticks: {
                      font: { size: 11 },
                      callback: (v) => `${(Number(v) / 1000).toFixed(0)}k`,
                    },
                  },
                },
              }}
            />
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center">
            <p className="text-sm text-stone-400">아직 일별 데이터가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* 최근 지출 섹션 */
function RecentExpenses({ expenses }: { expenses: Expense[] }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-stone-700">최근 지출</h2>
        <Link to="/expenses" className="text-sm text-amber-600 hover:text-amber-700">
          전체 보기 →
        </Link>
      </div>
      {expenses.length > 0 ? (
        <div className="divide-y divide-stone-100">
          {expenses.map((expense) => (
            <Link
              key={expense.id}
              to={`/expenses/${expense.id}`}
              className="flex items-center justify-between py-3 hover:bg-amber-50/50 -mx-2 px-2 rounded transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-900 truncate">{expense.description}</p>
                <p className="text-sm text-stone-500">{expense.date.slice(0, 10).replace(/-/g, '.')}</p>
              </div>
              <p className="font-semibold text-stone-900 ml-4 whitespace-nowrap">{formatAmount(expense.amount)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="아직 기록된 지출이 없습니다"
          description="Telegram 봇으로 지출을 입력하거나 웹에서 직접 추가해보세요."
        />
      )}
    </div>
  )
}

/* 최근 수입 섹션 */
function RecentIncomes({ incomes }: { incomes: Income[] }) {
  if (incomes.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-stone-700">최근 수입</h2>
        <Link to="/income" className="text-sm text-emerald-600 hover:text-emerald-700">
          전체 보기 →
        </Link>
      </div>
      <div className="divide-y divide-stone-100">
        {incomes.map((income) => (
          <Link
            key={income.id}
            to={`/income/${income.id}`}
            className="flex items-center justify-between py-3 hover:bg-emerald-50/50 -mx-2 px-2 rounded transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-stone-900 truncate">{income.description}</p>
              <p className="text-sm text-stone-500">{income.date.slice(0, 10).replace(/-/g, '.')}</p>
            </div>
            <p className="font-semibold text-emerald-700 ml-4 whitespace-nowrap">+{formatAmount(income.amount)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 공유(가구) 데이터
  const [stats, setStats] = useState<MonthlyStats | null>(null)
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [incomeStats, setIncomeStats] = useState<StatsResponse | null>(null)
  const [recentIncomes, setRecentIncomes] = useState<Income[]>([])

  // 개인 데이터 (가구 선택 시에만 별도 로드)
  const [personalStats, setPersonalStats] = useState<MonthlyStats | null>(null)
  const [personalExpenses, setPersonalExpenses] = useState<Expense[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // 개인 지출 섹션 접기/펼치기 (localStorage 영속)
  const [personalExpanded, setPersonalExpanded] = useState(() => {
    return localStorage.getItem('dashboard_personal_expanded') !== 'false'
  })

  const togglePersonal = () => {
    setPersonalExpanded((prev) => {
      const next = !prev
      localStorage.setItem('dashboard_personal_expanded', String(next))
      return next
    })
  }

  async function fetchData() {
    setLoading(true)
    setError(false)
    try {
      const month = getCurrentMonth()

      // 수입 통계 + 최근 수입 (에러 무시 - 수입이 없어도 대시보드 동작)
      const incomePromises = [
        incomeApi.getStats('monthly', undefined, activeHouseholdId ?? undefined).catch(() => null),
        incomeApi.getAll({ limit: 5, household_id: activeHouseholdId ?? undefined }).catch(() => ({ data: [] as Income[] })),
      ] as const

      if (activeHouseholdId) {
        // 가구가 선택된 경우: 가구 데이터 + 개인 데이터 병렬 로드
        const [householdStatsRes, householdExpensesRes, personalStatsRes, personalExpensesRes, incStatsRes, incListRes] = await Promise.all([
          expenseApi.getMonthlyStats(month, activeHouseholdId),
          expenseApi.getAll({ limit: 5, household_id: activeHouseholdId }),
          expenseApi.getMonthlyStats(month),
          expenseApi.getAll({ limit: 5 }),
          ...incomePromises,
        ])
        setStats(householdStatsRes.data)
        setRecentExpenses(householdExpensesRes.data)
        setPersonalStats(personalStatsRes.data)
        setPersonalExpenses(personalExpensesRes.data)
        setIncomeStats(incStatsRes?.data ?? null)
        setRecentIncomes(incListRes?.data ?? [])
      } else {
        // 가구 미선택: 개인 데이터만
        const [statsRes, expensesRes, incStatsRes, incListRes] = await Promise.all([
          expenseApi.getMonthlyStats(month),
          expenseApi.getAll({ limit: 5 }),
          ...incomePromises,
        ])
        setStats(statsRes.data)
        setRecentExpenses(expensesRes.data)
        setPersonalStats(null)
        setPersonalExpenses([])
        setIncomeStats(incStatsRes?.data ?? null)
        setRecentIncomes(incListRes?.data ?? [])
      }
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
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-stone-800">대시보드</h1>
        <div className="bg-white rounded-xl shadow-sm border border-stone-200/60">
          <ErrorState onRetry={fetchData} />
        </div>
      </div>
    )
  }

  const total = stats?.total ?? 0
  const hasNoData = total === 0 && recentExpenses.length === 0

  if (hasNoData && (!personalStats || personalStats.total === 0)) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-stone-800">대시보드</h1>
        <div className="bg-white rounded-xl shadow-sm border border-stone-200/60">
          <EmptyState
            title="아직 이번 달 지출 기록이 없어요"
            description="웹에서 직접 지출을 기록하거나, 텔레그램 봇을 연동하여 채팅으로 입력해보세요."
            action={{
              label: '지출 추가하기',
              onClick: () => navigate('/expenses/new'),
            }}
            secondaryAction={{
              label: '지출 목록 보기',
              onClick: () => navigate('/expenses'),
            }}
          />
        </div>
      </div>
    )
  }

  const showPersonalSection = activeHouseholdId && personalStats

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">
        {activeHouseholdId ? '공유 가계부' : '대시보드'}
      </h1>

      {/* 메인 데이터 (가구 선택 시 가구, 미선택 시 개인) */}
      {stats && <StatsCards stats={stats} incomeTotal={incomeStats?.total} />}
      {stats && <ChartSection stats={stats} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentExpenses expenses={recentExpenses} />
        <RecentIncomes incomes={recentIncomes} />
      </div>

      {/* 개인 지출 섹션 (가구 선택 시에만 표시) */}
      {showPersonalSection && (
        <div className="space-y-4">
          <button
            onClick={togglePersonal}
            className="flex items-center gap-2 text-stone-700 hover:text-stone-900 transition-colors"
          >
            {personalExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
            <span className="text-lg font-semibold">내 개인 지출</span>
            <span className="text-sm text-stone-500">
              {formatAmount(personalStats.total ?? 0)}
            </span>
          </button>

          {personalExpanded && (
            <div className="space-y-6">
              <StatsCards stats={personalStats} />
              <RecentExpenses expenses={personalExpenses} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * @file InsightsPage.tsx
 * @description 종합 재무 리포트 페이지
 * 기간 선택 → 핵심 지표 → 복합 추이 차트 → 예산 현황 → 자동 하이라이트 → AI 심층 분석
 */

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { insightsApi, statsApi } from '../api/insights'
import { incomeApi } from '../api/income'
import { getMonthlyStats } from '../api/budgets'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import PeriodNavigator from '../components/stats/PeriodNavigator'
import UnifiedSummaryCards from '../components/stats/UnifiedSummaryCards'
import CombinedTrendChart from '../components/stats/CombinedTrendChart'
import BudgetVsActual from '../components/stats/BudgetVsActual'
import MonthlyHighlights from '../components/stats/MonthlyHighlights'
import type { BudgetMonthlyStatsResponse, ComparisonResponse, InsightsResponse, StatsResponse } from '../types'
import { formatAmount } from '../utils/format'

type PeriodType = 'weekly' | 'monthly' | 'yearly'

// ── 날짜 유틸 ──

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDate(dateStr: string, period: PeriodType, direction: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (period === 'weekly') d.setDate(d.getDate() + direction * 7)
  else if (period === 'monthly') d.setMonth(d.getMonth() + direction)
  else d.setFullYear(d.getFullYear() + direction)
  return toDateStr(d)
}

function getNavLabel(dateStr: string, period: PeriodType): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (period === 'weekly') {
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
    const weekNum = Math.ceil((d.getDate() + firstDay.getDay()) / 7)
    return `${d.getMonth() + 1}월 ${weekNum}주차`
  }
  if (period === 'monthly') return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
  return `${d.getFullYear()}년`
}

function getMonthStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ── 마크다운 렌더링 ──

function renderBoldText(text: string): React.ReactNode[] {
  return text.split(/(\*\*.*?\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
      : part
  )
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h4 key={i} className="text-base font-semibold text-warm-900 mt-3 mb-1">{renderBoldText(line.slice(4))}</h4>
    if (line.startsWith('## ')) return <h3 key={i} className="text-lg font-semibold text-warm-900 mt-4 mb-2">{renderBoldText(line.slice(3))}</h3>
    if (line.startsWith('# ')) return <h2 key={i} className="text-xl font-bold text-warm-900 mt-4 mb-2">{renderBoldText(line.slice(2))}</h2>
    if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-warm-700">{renderBoldText(line.slice(2))}</li>
    if (/^\d+\. /.test(line)) return <li key={i} className="ml-4 text-warm-700 list-decimal">{renderBoldText(line.replace(/^\d+\. /, ''))}</li>
    if (line.trim() === '') return <div key={i} className="h-2" />
    return <p key={i} className="text-warm-700 leading-relaxed">{renderBoldText(line)}</p>
  })
}



// ── 메인 페이지 ──

export default function InsightsPage() {
  const [period, setPeriod] = useState<PeriodType>('monthly')
  const [dateStr, setDateStr] = useState(toDateStr(new Date()))
  const [expenseStats, setExpenseStats] = useState<StatsResponse | null>(null)
  const [incomeStats, setIncomeStats] = useState<StatsResponse | null>(null)
  const [budgetStats, setBudgetStats] = useState<BudgetMonthlyStatsResponse | null>(null)
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 통계 병렬 로딩
  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      setLoading(true)
      try {
        const [expRes, incRes] = await Promise.all([
          statsApi.getStats(period, dateStr, activeHouseholdId ?? undefined),
          incomeApi.getStats(period, dateStr, activeHouseholdId ?? undefined),
        ])
        if (cancelled) return
        setExpenseStats(expRes.data)
        setIncomeStats(incRes.data)

        // 월간 전용: 비교 + 예산
        if (period === 'monthly') {
          const monthStr = getMonthStr(dateStr)
          const [compRes, budgetRes] = await Promise.allSettled([
            statsApi.getComparison(period, dateStr, 3, activeHouseholdId ?? undefined),
            getMonthlyStats(monthStr),
          ])
          if (cancelled) return
          setComparison(compRes.status === 'fulfilled' ? compRes.value.data : null)
          setBudgetStats(budgetRes.status === 'fulfilled' ? budgetRes.value.data : null)
        } else {
          setComparison(null)
          setBudgetStats(null)
        }
      } catch {
        if (!cancelled) toast.error('통계를 불러오는데 실패했습니다')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [period, dateStr, activeHouseholdId])

  const handlePrev = useCallback(() => setDateStr(d => shiftDate(d, period, -1)), [period])
  const handleNext = useCallback(() => setDateStr(d => shiftDate(d, period, 1)), [period])

  const handlePeriodChange = (p: PeriodType) => {
    setPeriod(p)
    setDateStr(toDateStr(new Date()))
  }

  // AI 인사이트 생성
  const handleGenerate = async () => {
    if (!selectedMonth) { toast.error('월을 선택해주세요'); return }
    setAiLoading(true)
    try {
      const res = await insightsApi.generate(selectedMonth)
      setInsights(res.data)
      toast.success('인사이트가 생성되었습니다')
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '인사이트 생성에 실패했습니다'
      toast.error(message)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-grape-600" />
        <h1 className="text-xl font-bold text-grape-700">리포트</h1>
      </div>

      {/* 기간 선택 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-warm-100 p-1 rounded-lg">
          {(['weekly', 'monthly', 'yearly'] as PeriodType[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p ? 'bg-white text-grape-700 shadow-sm' : 'text-warm-500 hover:text-warm-700'
              }`}
            >
              {p === 'weekly' ? '주간' : p === 'monthly' ? '월간' : '연간'}
            </button>
          ))}
        </div>
        <PeriodNavigator label={getNavLabel(dateStr, period)} onPrev={handlePrev} onNext={handleNext} />
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-grape-600" />
        </div>
      )}

      {/* 핵심 지표 */}
      {!loading && expenseStats && incomeStats && (
        <UnifiedSummaryCards
          incomeTotal={incomeStats.total}
          expenseTotal={expenseStats.total}
        />
      )}

      {/* 복합 추이 차트 */}
      {!loading && expenseStats && incomeStats && (
        <CombinedTrendChart
          expenseTrend={expenseStats.trend}
          incomeTrend={incomeStats.trend}
        />
      )}

      {/* 월간 전용: 예산 현황 */}
      {!loading && period === 'monthly' && (
        <BudgetVsActual budgetStats={budgetStats} />
      )}

      {/* 월간 전용: 자동 하이라이트 */}
      {!loading && period === 'monthly' && expenseStats && incomeStats && (
        <MonthlyHighlights
          incomeTotal={incomeStats.total}
          expenseTotal={expenseStats.total}
          budgetStats={budgetStats}
          comparison={comparison}
        />
      )}

      {/* AI 심층 분석 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-grape-600" />
          <h2 className="text-base font-semibold text-warm-900">AI 심층 분석</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-4">
          <div className="flex-1 w-full">
            <label htmlFor="month-select" className="block text-sm font-medium text-warm-700 mb-2">분석할 월 선택</label>
            <input
              id="month-select"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 border border-warm-300 rounded-lg focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={aiLoading}
            className="w-full sm:w-auto px-6 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:bg-warm-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {aiLoading ? '분석 중...' : 'AI 심층 분석 생성하기'}
          </button>
        </div>
        <p className="text-sm text-warm-500">Claude API를 통해 해당 월의 지출 패턴을 분석하고 인사이트를 제공합니다. (최대 30초 소요)</p>

        {aiLoading && (
          <div className="mt-6 flex flex-col items-center gap-4 py-8">
            <Loader2 className="animate-spin h-10 w-10 text-grape-600" />
            <p className="text-warm-600">AI가 당신의 지출을 분석하고 있습니다...</p>
          </div>
        )}

        {!aiLoading && insights && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-grape-50 rounded-lg p-4">
                <p className="text-sm text-warm-600 mb-1">총 지출</p>
                <p className="text-2xl font-bold text-grape-700">{formatAmount(insights.total)}</p>
              </div>
              <div className="bg-warm-50 rounded-lg p-4">
                <p className="text-sm text-warm-600 mb-1">카테고리 수</p>
                <p className="text-2xl font-bold text-warm-700">{Object.keys(insights.by_category).length}개</p>
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-warm-700 space-y-2">
              {renderMarkdown(insights.insights)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * @file InsightsPage.tsx
 * @description 종합 재무 리포트 페이지 (월간)
 * 종합 요약 → 지출 카테고리 TOP → 예산 현황 → 자산 변동 → 이달의 인사이트 → AI 심층 분석
 */

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

// API
import { statsApi, insightsApi } from '../api/insights'
import { incomeApi } from '../api/income'
import { getMonthlyStats } from '../api/budgets'
import { assetApi } from '../api/assets'
import { useHouseholdStore } from '../stores/useHouseholdStore'

// 컴포넌트
import PeriodNavigator from '../components/stats/PeriodNavigator'
import UnifiedSummaryCards from '../components/stats/UnifiedSummaryCards'
import CategoryTopList from '../components/stats/CategoryTopList'
import BudgetVsActual from '../components/stats/BudgetVsActual'
import AssetChangeSummary from '../components/stats/AssetChangeSummary'
import MonthlyHighlights from '../components/stats/MonthlyHighlights'
import FinancialHealthScore from '../components/stats/FinancialHealthScore'
import StructuredInsightsView from '../components/stats/StructuredInsightsView'

// 유틸
import { calculateHealthScore } from '../utils/healthScore'

// 타입
import type {
  StatsResponse, ComparisonResponse, BudgetMonthlyStatsResponse,
  AssetSummary, AssetSnapshot, StructuredInsights, HealthScore,
} from '../types'

// ── 날짜 유틸 ──

function toMonthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return toMonthStr(d)
}

function getNavLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  return `${y}년 ${m}월`
}

// ── 메인 페이지 ──

export default function InsightsPage() {
  const [monthStr, setMonthStr] = useState(toMonthStr(new Date()))
  const [loading, setLoading] = useState(true)
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 데이터 상태
  const [expenseStats, setExpenseStats] = useState<StatsResponse | null>(null)
  const [incomeStats, setIncomeStats] = useState<StatsResponse | null>(null)
  const [budgetStats, setBudgetStats] = useState<BudgetMonthlyStatsResponse | null>(null)
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [assetSummary, setAssetSummary] = useState<AssetSummary | null>(null)
  const [prevSnapshot, setPrevSnapshot] = useState<AssetSnapshot | null>(null)

  // AI 분석 상태
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null)
  const [structuredInsights, setStructuredInsights] = useState<StructuredInsights | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // 데이터 로딩
  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      setLoading(true)
      setStructuredInsights(null)
      try {
        const dateStr = `${monthStr}-15`
        const hhId = activeHouseholdId!

        // 1차 병렬: 지출/수입 통계 + 비교 + 예산 + 자산
        const [expRes, incRes, compRes, budgetRes, assetRes, snapRes] = await Promise.allSettled([
          statsApi.getStats('monthly', dateStr, hhId),
          incomeApi.getStats('monthly', dateStr, hhId),
          statsApi.getComparison('monthly', dateStr, 3, hhId),
          getMonthlyStats(monthStr),
          assetApi.getSummary(hhId),
          assetApi.getSnapshots(hhId, 2),
        ])

        if (cancelled) return

        const exp = expRes.status === 'fulfilled' ? expRes.value.data : null
        const inc = incRes.status === 'fulfilled' ? incRes.value.data : null
        const comp = compRes.status === 'fulfilled' ? compRes.value.data : null
        const budget = budgetRes.status === 'fulfilled' ? budgetRes.value.data : null
        const asset = assetRes.status === 'fulfilled' ? assetRes.value.data : null
        const snaps = snapRes.status === 'fulfilled' ? snapRes.value.data : []

        setExpenseStats(exp)
        setIncomeStats(inc)
        setComparison(comp)
        setBudgetStats(budget)
        setAssetSummary(asset)

        // 이전 스냅샷 (가장 오래된 것)
        const sortedSnaps = (snaps ?? []).sort((a: AssetSnapshot, b: AssetSnapshot) =>
          a.snapshot_date.localeCompare(b.snapshot_date)
        )
        setPrevSnapshot(sortedSnaps.length >= 2 ? sortedSnaps[0] : null)

        // 건강 점수 계산
        if (exp || inc) {
          const score = calculateHealthScore({
            incomeTotal: inc?.total ?? 0,
            expenseTotal: exp?.total ?? 0,
            budgetTotal: budget?.total_budget ?? undefined,
            budgetSpent: budget?.total_spent ?? undefined,
            totalLiabilities: asset?.total_liabilities ?? 0,
            totalAssets: asset?.total_assets ?? 0,
            avgLoanRate: 0,
          })
          setHealthScore(score)
        }
      } catch {
        toast.error('데이터를 불러오는데 실패했습니다')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [monthStr, activeHouseholdId])

  // AI 분석 생성
  const handleGenerateAI = useCallback(async () => {
    if (!expenseStats && !incomeStats) {
      toast.error('분석할 데이터가 없습니다')
      return
    }

    setAiLoading(true)
    try {
      const requestData: Record<string, unknown> = {
        month: monthStr,
        income_total: incomeStats?.total ?? 0,
        expense_total: expenseStats?.total ?? 0,
        top_expense_categories: (expenseStats?.by_category ?? []).slice(0, 5).map(c => ({
          name: c.category,
          amount: c.amount,
          percentage: c.percentage,
        })),
        savings_rate: incomeStats && incomeStats.total > 0
          ? ((incomeStats.total - (expenseStats?.total ?? 0)) / incomeStats.total) * 100
          : 0,
        health_score: healthScore,
        previous_month_expense: comparison?.previous?.total ?? null,
        previous_month_income: null,
      }

      // 예산 데이터
      if (budgetStats?.total_budget) {
        requestData.budget = {
          total_budget: budgetStats.total_budget,
          total_spent: budgetStats.total_spent,
          over_categories: budgetStats.categories
            .filter(c => c.is_exceeded)
            .map(c => c.category_name),
        }
      }

      // 자산 데이터
      if (assetSummary) {
        requestData.assets = {
          total_assets: assetSummary.total_assets,
          total_liabilities: assetSummary.total_liabilities,
          net_worth: assetSummary.net_worth,
          breakdown: assetSummary.breakdown,
          monthly_change_amount: prevSnapshot
            ? assetSummary.net_worth - prevSnapshot.net_worth
            : 0,
          monthly_change_rate: prevSnapshot && prevSnapshot.net_worth !== 0
            ? ((assetSummary.net_worth - prevSnapshot.net_worth) / Math.abs(prevSnapshot.net_worth)) * 100
            : 0,
        }
      }

      const result = await insightsApi.generateComprehensive(requestData)
      setStructuredInsights(result.insights)
      toast.success('AI 분석이 완료되었습니다')
    } catch {
      toast.error('AI 분석 생성에 실패했습니다')
    } finally {
      setAiLoading(false)
    }
  }, [monthStr, expenseStats, incomeStats, budgetStats, assetSummary, prevSnapshot, healthScore, comparison])

  const handlePrev = useCallback(() => setMonthStr(m => shiftMonth(m, -1)), [])
  const handleNext = useCallback(() => setMonthStr(m => shiftMonth(m, 1)), [])

  return (
    <div className="space-y-4">
      {/* 월 네비게이션 */}
      <PeriodNavigator label={getNavLabel(monthStr)} onPrev={handlePrev} onNext={handleNext} />

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-grape-600" />
        </div>
      )}

      {!loading && (
        <>
          {/* 1. 종합 요약 */}
          {(expenseStats || incomeStats) && (
            <UnifiedSummaryCards
              incomeTotal={incomeStats?.total ?? 0}
              expenseTotal={expenseStats?.total ?? 0}
              netWorth={assetSummary?.net_worth ?? null}
              prevNetWorth={prevSnapshot?.net_worth ?? null}
              prevIncome={comparison?.previous?.total ? null : null}
              prevExpense={comparison?.previous?.total ?? null}
            />
          )}

          {/* 2. 지출 카테고리 TOP */}
          <CategoryTopList categories={expenseStats?.by_category ?? []} />

          {/* 3. 예산 현황 */}
          <BudgetVsActual budgetStats={budgetStats} />

          {/* 4. 자산 변동 */}
          <AssetChangeSummary summary={assetSummary} previousSnapshot={prevSnapshot} />

          {/* 5. 이달의 인사이트 */}
          {expenseStats && incomeStats && (
            <MonthlyHighlights
              incomeTotal={incomeStats.total}
              expenseTotal={expenseStats.total}
              budgetStats={budgetStats}
              comparison={comparison}
            />
          )}

          {/* 6. AI 심층 분석 */}
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-grape-600" />
                <h2 className="text-base font-semibold text-warm-900">AI 심층 분석</h2>
              </div>
              {!structuredInsights && (
                <button
                  onClick={handleGenerateAI}
                  disabled={aiLoading}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:bg-warm-400 disabled:cursor-not-allowed transition-colors"
                >
                  {aiLoading ? '분석 중...' : '분석하기'}
                </button>
              )}
            </div>

            {/* 건강 점수 (항상 표시) */}
            <FinancialHealthScore score={healthScore} />

            {/* AI 로딩 */}
            {aiLoading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="animate-spin h-8 w-8 text-grape-600" />
                <p className="text-sm text-warm-600">AI가 재무 데이터를 분석하고 있습니다...</p>
              </div>
            )}

            {/* 구조화된 AI 인사이트 */}
            {!aiLoading && structuredInsights && (
              <div className="mt-4">
                <StructuredInsightsView insights={structuredInsights} />
              </div>
            )}

            {/* 분석 전 안내 */}
            {!aiLoading && !structuredInsights && (
              <p className="text-sm text-warm-500 mt-3">
                AI가 수입, 지출, 예산, 자산을 종합 분석하여 맞춤 인사이트를 제공합니다.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

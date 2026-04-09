/**
 * @file InsightsPage.tsx
 * @description 이달의 리포트 페이지 (월간)
 * 종합 요약 → 지출 카테고리 TOP → 예산 상황 → 자산 변화 → 이달의 인사이트 → AI 상세 분석
 *
 * React Query로 9개 API를 그룹별 독립 쿼리로 전환 — 핵심 데이터부터 섹션별 점진적 렌더링
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Settings } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ErrorState from '../components/ErrorState'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import EmptyState from '../components/EmptyState'

// API
import { statsApi, insightsApi } from '../api/insights'
import { incomeApi } from '../api/income'
import { getMonthlyStats } from '../api/budgets'
import { assetApi } from '../api/assets'
import { categoryApi } from '../api/categories'
import { paymentMethodApi } from '../api/paymentMethods'
import { recurringApi } from '../api/recurring'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { FEATURES } from '../config/features'

// 컴포넌트
import PeriodNavigator from '../components/stats/PeriodNavigator'
import HeroSummary from '../components/stats/HeroSummary'
import UnifiedSummaryCards from '../components/stats/UnifiedSummaryCards'
// CategoryPieChart는 CategoryTopList에 탭으로 통합됨
import CategoryTopList from '../components/stats/CategoryTopList'
import BudgetVsActual from '../components/stats/BudgetVsActual'
import RecurringManageSection from '../components/stats/RecurringManageSection'
import CardUsageSummary from '../components/stats/CardUsageSummary'
import AssetChangeSummary from '../components/stats/AssetChangeSummary'
import MonthlyHighlights from '../components/stats/MonthlyHighlights'
import FinancialHealthScore from '../components/stats/FinancialHealthScore'
import StructuredInsightsView from '../components/stats/StructuredInsightsView'
import SectionToggleModal, {
  loadSectionSettings,
  saveSectionSettings,
  type SectionVisibility,
} from '../components/stats/SectionToggleModal'
import { Skeleton } from '../components/skeleton/Skeleton'

// 유틸
import { calculateHealthScore } from '../utils/healthScore'
import { trackEvent } from '../utils/analytics'
import { formatAmount } from '../utils/format'

// 타입
import type {
  AssetSummary, StructuredInsights, HealthScore,
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
  const [, m] = monthStr.split('-').map(Number)
  return `${m}월`
}

// ── 로딩 스켈레톤 ──

function InsightsPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* 히어로 골격 */}
      <div className="card-surface p-6 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-3 w-36" />
      </div>
      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card-surface p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      {/* 차트 영역 */}
      <div className="card-surface p-4">
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      {/* 카테고리 리스트 */}
      <div className="card-surface p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 메인 페이지 ──

export default function InsightsPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [monthStr, setMonthStr] = useState(toMonthStr(new Date()))
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 섹션 표시 설정
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>(loadSectionSettings)
  const [showSectionModal, setShowSectionModal] = useState(false)

  const handleSectionChange = useCallback((updated: SectionVisibility) => {
    setSectionVisibility(updated)
    saveSectionSettings(updated)
  }, [])

  // AI 분석 상태 (사용자 트리거 — 캐시 불필요)
  const [structuredInsights, setStructuredInsights] = useState<StructuredInsights | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const dateStr = `${monthStr}-15`

  // ── Group 1: 핵심 데이터 — 지출/수입 통계 (렌더 게이팅 기준) ──

  const { data: expenseStats, isLoading: expLoading } = useQuery({
    queryKey: ['insights-expense', monthStr, activeHouseholdId],
    queryFn: () => statsApi.getStats('monthly', dateStr, activeHouseholdId!).then(r => r.data),
    enabled: !!activeHouseholdId,
  })

  const { data: incomeStats, isLoading: incLoading } = useQuery({
    queryKey: ['insights-income', monthStr, activeHouseholdId],
    queryFn: () => incomeApi.getStats('monthly', dateStr, activeHouseholdId!).then(r => r.data),
    enabled: !!activeHouseholdId,
  })

  // ── Group 2: 비교 데이터 — 전월 대비 트렌드 ──

  const { data: comparison } = useQuery({
    queryKey: ['insights-expense-comparison', monthStr, activeHouseholdId],
    queryFn: () => statsApi.getComparison('monthly', dateStr, 3, activeHouseholdId!).then(r => r.data),
    enabled: !!activeHouseholdId,
  })

  const { data: incomeComparison } = useQuery({
    queryKey: ['insights-income-comparison', monthStr, activeHouseholdId],
    queryFn: () => incomeApi.getComparison('monthly', dateStr, 3, activeHouseholdId!).then(r => r.data),
    enabled: !!activeHouseholdId,
  })

  // ── Group 3: 예산 ──

  const { data: budgetStats } = useQuery({
    queryKey: ['insights-budget', monthStr, activeHouseholdId],
    queryFn: () => getMonthlyStats(monthStr).then(r => r.data),
    enabled: !!activeHouseholdId,
  })

  // ── Group 4: 자산 — 스냅샷만 사용 (getSummary는 Yahoo Finance 호출로 30초+ 걸림) ──
  // FEATURES.assets가 false면 쿼리 자체를 실행하지 않아 불필요한 API 호출을 방지한다

  const { data: snapshots = [] } = useQuery({
    queryKey: ['insights-snapshots', activeHouseholdId],
    queryFn: () => assetApi.getSnapshots(activeHouseholdId!, 2).then(r => r.data),
    enabled: !!activeHouseholdId && FEATURES.assets,
  })

  // ── Group 5: 카테고리 — is_savings 계산용 (staleTime 연장으로 중복 요청 방지) ──

  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['categories-expense', activeHouseholdId],
    queryFn: () => categoryApi.getAll({ type: 'expense' }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeHouseholdId,
  })

  // ── Group 6: 카드 실적 ──

  const { data: cardUsage = [] } = useQuery({
    queryKey: ['insights-card-usage', monthStr, activeHouseholdId],
    queryFn: () => paymentMethodApi.getMonthlyUsage(monthStr, activeHouseholdId!).then(r => r.data),
    enabled: !!activeHouseholdId,
  })

  // ── Group 7: 정기거래 — 활성 건수 + 이번 달 지출 합계 (staleTime 연장으로 중복 요청 방지) ──

  const { data: recurringData = [] } = useQuery({
    queryKey: ['insights-recurring', activeHouseholdId],
    queryFn: () => recurringApi.getAll({ household_id: activeHouseholdId! }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeHouseholdId,
  })

  // ── 파생 상태 (useMemo — 쿼리 결과 변경 시 재계산) ──

  // 스냅샷에서 자산 데이터 파생 — getSummary 대체 (Yahoo Finance 실시간 호출 제거)
  // FEATURES.assets가 false면 빈 값 반환 (쿼리도 비활성화되어 snapshots는 항상 [])
  const { prevSnapshot, assetSummary } = useMemo(() => {
    if (!FEATURES.assets) return { prevSnapshot: null, assetSummary: null }
    const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null
    const prev = sorted.length >= 2 ? sorted[0] : null
    const summary: AssetSummary | null = latest ? {
      net_worth: latest.net_worth,
      total_assets: latest.total_assets,
      total_liabilities: latest.total_liabilities,
      breakdown: latest.breakdown ?? {},
      total_profit_loss: 0,       // 스냅샷에는 수익률 없음 — 돌아보기에서 미사용
      total_profit_loss_pct: null,
    } : null
    return { prevSnapshot: prev, assetSummary: summary }
  }, [snapshots])

  // 저축성 지출 합계 (is_savings=true 카테고리만 집계)
  const savingsTotal = useMemo(() => {
    const savingsCatNames = new Set(
      expenseCategories.filter(c => c.is_savings).map(c => c.name)
    )
    // 저축성 카테고리가 정의되지 않았으면 undefined (기존 계산 방식 유지)
    if (savingsCatNames.size === 0) return undefined
    if (!expenseStats?.by_category) return 0
    return expenseStats.by_category
      .filter(c => savingsCatNames.has(c.category))
      .reduce((sum, c) => sum + c.amount, 0)
  }, [expenseCategories, expenseStats])

  // 정기거래 — 활성 건수 + 이번 달 지출 합계 계산
  const { recurringActiveCount, recurringMonthlyTotal } = useMemo(() => {
    const activeItems = recurringData.filter(r => r.is_active)
    const expenseTotal = activeItems
      .filter(r => r.type === 'expense')
      .reduce((sum, r) => sum + r.amount, 0)
    return {
      recurringActiveCount: activeItems.length,
      recurringMonthlyTotal: expenseTotal,
    }
  }, [recurringData])

  const healthScore = useMemo((): HealthScore | null => {
    if (!expenseStats && !incomeStats) return null
    return calculateHealthScore({
      incomeTotal: incomeStats?.total ?? 0,
      expenseTotal: expenseStats?.total ?? 0,
      savingsTotal,
      budgetTotal: budgetStats?.total_budget ?? undefined,
      budgetSpent: budgetStats?.total_spent ?? undefined,
      totalLiabilities: assetSummary?.total_liabilities ?? 0,
      totalAssets: assetSummary?.total_assets ?? 0,
      avgLoanRate: 0,
    })
  }, [expenseStats, incomeStats, savingsTotal, budgetStats, assetSummary])

  // ── 로딩 / 에러 판단 ──

  // 핵심 데이터(지출+수입) 중 하나라도 오면 렌더 시작
  const loading = !activeHouseholdId || (expLoading && incLoading)

  // 핵심 데이터가 모두 undefined이고 로딩도 끝났으면 에러 (네트워크/서버 오류)
  const error = !expenseStats && !incomeStats && !expLoading && !incLoading && !!activeHouseholdId

  // AI 분석 생성 (사용자 트리거 — React Query 불필요)
  const handleGenerateAI = useCallback(async () => {
    if (!expenseStats && !incomeStats) {
      addToast('error', TOAST.AI_NO_DATA)
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
          ? (savingsTotal !== undefined
              ? (savingsTotal / incomeStats.total) * 100
              : ((incomeStats.total - (expenseStats?.total ?? 0)) / incomeStats.total) * 100)
          : 0,
        health_score: healthScore,
        previous_month_expense: comparison?.previous?.total ?? null,
        previous_month_income: incomeComparison?.previous?.total ?? null,
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

      // 자산 데이터 (플래그 비활성 시 AI 분석 요청에서 제외)
      if (FEATURES.assets && assetSummary) {
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
      trackEvent('ai_analysis_requested')
      addToast('success', TOAST.AI_ANALYSIS_COMPLETE)
    } catch {
      addToast('error', TOAST.AI_ANALYSIS_FAILED)
    } finally {
      setAiLoading(false)
    }
  }, [monthStr, expenseStats, incomeStats, budgetStats, assetSummary, prevSnapshot, healthScore, comparison, incomeComparison, savingsTotal, addToast])

  // monthStr에서 파생된 연/월 (PeriodNavigator + HeroSummary에서 공유)
  const { currentYear, currentMonth } = useMemo(() => {
    const [y, m] = monthStr.split('-').map(Number)
    return { currentYear: y, currentMonth: m - 1 } // currentMonth: 0-indexed
  }, [monthStr])

  const handlePrev = useCallback(() => {
    setMonthStr(m => shiftMonth(m, -1))
    setStructuredInsights(null) // 월 이동 시 AI 분석 초기화
  }, [])
  const handleNext = useCallback(() => {
    setMonthStr(m => shiftMonth(m, 1))
    setStructuredInsights(null) // 월 이동 시 AI 분석 초기화
  }, [])
  const handleMonthSelect = useCallback((year: number, month: number) => {
    setMonthStr(toMonthStr(new Date(year, month, 1)))
    setStructuredInsights(null) // 월 이동 시 AI 분석 초기화
  }, [])

  return (
    <div className="space-y-4 animate-page-in animate-stagger">
      {/* 월 네비게이션 + 설정 아이콘 */}
      <div className="flex items-center justify-between">
        <div className="flex-1" />
        <PeriodNavigator
          label={getNavLabel(monthStr)}
          onPrev={handlePrev}
          onNext={handleNext}
          currentYear={currentYear}
          currentMonth={currentMonth}
          onMonthSelect={handleMonthSelect}
        />
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => setShowSectionModal(true)}
            aria-label="섹션 설정"
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Settings className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>

      {/* 섹션 토글 모달 */}
      {showSectionModal && (
        <SectionToggleModal
          sections={sectionVisibility}
          onChange={handleSectionChange}
          onClose={() => setShowSectionModal(false)}
        />
      )}

      {/* 로딩 — Skeleton 프리미티브 기반 스켈레톤 UI */}
      {loading && <InsightsPageSkeleton />}

      {/* 에러 상태 — 핵심 데이터(지출+수입) 모두 실패 시 */}
      {!loading && error && (
        <ErrorState
          onRetry={() => {
            queryClient.invalidateQueries({ queryKey: ['insights-expense', monthStr, activeHouseholdId] })
            queryClient.invalidateQueries({ queryKey: ['insights-income', monthStr, activeHouseholdId] })
          }}
        />
      )}

      {/* 빈 상태 */}
      {!loading && !error && !!(expenseStats !== undefined || incomeStats !== undefined) && !expenseStats?.total && !incomeStats?.total && (
        <EmptyState
          variant="primary"
          title="이번 달 거래 내역이 없습니다"
          description="가계부에 수입이나 지출을 기록하면 리포트가 생성됩니다"
          action={{ label: '가계부로 이동', onClick: () => navigate('/home') }}
        />
      )}

      {!loading && !error && !!(expenseStats?.total || incomeStats?.total) && (
        <>
          {/* 0. 히어로 — 이달 지출 총액 강조 */}
          <HeroSummary
            label={`${currentMonth + 1}월 지출`}
            amount={expenseStats?.total ?? 0}
            sublabel={`수입 ${formatAmount(incomeStats?.total ?? 0)}`}
          />

          {/* 1. 종합 요약 */}
          {(expenseStats || incomeStats) && (
            <UnifiedSummaryCards
              incomeTotal={incomeStats?.total ?? 0}
              expenseTotal={expenseStats?.total ?? 0}
              savingsTotal={savingsTotal}
              netWorth={assetSummary?.net_worth ?? null}
              prevNetWorth={prevSnapshot?.net_worth ?? null}
              prevIncome={incomeComparison?.previous?.total ?? null}
              prevExpense={comparison?.previous?.total ?? null}
              monthStr={monthStr}
            />
          )}

          {/* 2. 이달의 주목할 점 */}
          {sectionVisibility.highlights && expenseStats && incomeStats && (
            <MonthlyHighlights
              incomeTotal={incomeStats.total}
              expenseTotal={expenseStats.total}
              budgetStats={budgetStats ?? null}
              comparison={comparison ?? null}
            />
          )}

          {/* 3. 지출 카테고리 (리스트/그래프 탭 통합) */}
          {sectionVisibility.categoryTop && (
            <CategoryTopList categories={expenseStats?.by_category ?? []} monthStr={monthStr} />
          )}

          {/* 5. 예산 상황 */}
          {sectionVisibility.budget && (
            <BudgetVsActual budgetStats={budgetStats ?? null} monthStr={monthStr} />
          )}

          {/* 6. 정기거래 관리 */}
          {sectionVisibility.recurring && (
            <RecurringManageSection
              activeCount={recurringActiveCount}
              monthlyExpenseTotal={recurringMonthlyTotal}
            />
          )}

          {/* 7. 카드 실적 */}
          {sectionVisibility.cardUsage && cardUsage.length > 0 && (
            <CardUsageSummary usage={cardUsage} />
          )}

          {/* 8. 자산 변화 — 플래그 비활성 시 섹션 전체 미표시 */}
          {FEATURES.assets && sectionVisibility.assets && (
            <AssetChangeSummary summary={assetSummary ?? null} previousSnapshot={prevSnapshot} />
          )}

          {/* 9. AI 상세 분석 */}
          {sectionVisibility.ai && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-grape-600" />
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">AI 상세 분석</h2>
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
                  <div className="animate-spin rounded-full border-b-2 border-grape-600 h-8 w-8" />
                  <p className="text-sm text-[var(--text-secondary)]">AI가 가계 데이터를 분석하고 있습니다...</p>
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
                <p className="text-sm text-[var(--text-tertiary)] mt-3">
                  AI가 수입, 지출, 예산, 자산을 분석하여 맞춤 인사이트를 제공합니다.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

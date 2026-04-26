/**
 * @file InsightsPage.tsx
 * @description 이달의 리포트 페이지 (월간) — 3-Layer 구조
 *
 * Layer 0: 히어로 — 이달 지출 총액 + 예산 프로그레스바 + 건강점수 배지
 * Layer 1: 한눈에 — MonthlyHighlights(주목할 점) → UnifiedSummaryCards
 * Layer 2: 들여다보기 — 카테고리/예산/정기거래/카드/저축
 * Layer 3: 돌아보기 — MonthlyComparison + AI 분석
 *
 * 온보딩 모드: 거래 5건 미만이면 InsightsOnboarding 표시 (풀 리포트 대신)
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'

// API
import { statsApi } from '../api/insights'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { getMonthlyStats } from '../api/budgets'
import { categoryApi } from '../api/categories'
import { paymentMethodApi } from '../api/paymentMethods'
import { recurringApi } from '../api/recurring'
import { useHouseholdStore } from '../stores/useHouseholdStore'

// 컴포넌트
import PeriodNavigator from '../components/stats/PeriodNavigator'
import HeroSummary from '../components/stats/HeroSummary'
import UnifiedSummaryCards from '../components/stats/UnifiedSummaryCards'
import CategoryTopList from '../components/stats/CategoryTopList'
import BudgetVsActual from '../components/stats/BudgetVsActual'
import RecurringManageSection from '../components/stats/RecurringManageSection'
import CardUsageSummary from '../components/stats/CardUsageSummary'
import MonthlyHighlights from '../components/stats/MonthlyHighlights'
import SectionToggleModal, {
  loadSectionSettings,
  saveSectionSettings,
  type SectionVisibility,
} from '../components/stats/SectionToggleModal'
import { Skeleton } from '../components/skeleton/Skeleton'
import LayerDivider from '../components/stats/LayerDivider'
import InsightsOnboarding from '../components/stats/InsightsOnboarding'
import SavingsSection from '../components/stats/SavingsSection'
import MonthlyComparison from '../components/stats/MonthlyComparison'
import MonthlyReportCard from '../components/reports/MonthlyReportCard'

// 유틸
import { calculateFinancialScore } from '../utils/financialScore'
import { getHeroLabel } from '../utils/heroLabel'


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

// selectedMonth 기준 직전 3개월 목록 반환 (오름차순)
function getPrev3Months(selectedMonth: string): string[] {
  const [year, month] = selectedMonth.split('-').map(Number)
  return [-3, -2, -1].map((offset) => {
    const d = new Date(year, month - 1 + offset, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
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

// ── 상수 ──

/** 풀 리포트 생성을 위한 최소 거래 건수 */
const FULL_REPORT_THRESHOLD = 5

// ── 메인 페이지 ──

export default function InsightsPage() {
  const navigate = useNavigate()
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

  // ── Group 4: 카테고리 — is_savings 계산용 (staleTime 연장으로 중복 요청 방지) ──

  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['categories-expense', activeHouseholdId],
    queryFn: () => categoryApi.getAll({ type: 'expense' }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeHouseholdId,
  })

  // ── Group 5: 카드 실적 ──

  const { data: cardUsage = [] } = useQuery({
    queryKey: ['insights-card-usage', monthStr, activeHouseholdId],
    queryFn: () => paymentMethodApi.getMonthlyUsage(monthStr, activeHouseholdId!).then(r => r.data),
    enabled: !!activeHouseholdId,
  })

  // ── Group 6: 정기거래 — 활성 목록 + 당월 실행/건너뜀 구분 ──

  const { data: recurringData = [] } = useQuery({
    queryKey: ['insights-recurring', activeHouseholdId],
    queryFn: () => recurringApi.getAll({ household_id: activeHouseholdId! }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeHouseholdId,
  })

  // 당월 지출/수입 중 recurring_transaction_id가 있는 것 조회 → 실제 실행 금액 매핑
  const [recurringYear, recurringMonth] = monthStr.split('-').map(Number)
  const recurringMonthStart = `${monthStr}-01`
  const recurringMonthEnd = new Date(recurringYear, recurringMonth, 0).toISOString().slice(0, 10)

  const { data: monthlyExpenseList = [] } = useQuery({
    queryKey: ['insights-expense-list', monthStr, activeHouseholdId],
    queryFn: () => expenseApi.getAll({
      start_date: recurringMonthStart,
      end_date: recurringMonthEnd,
      household_id: activeHouseholdId!,
      limit: 500,
    }).then(r => r.data),
    enabled: !!activeHouseholdId && sectionVisibility.recurring,
  })

  const { data: monthlyIncomeList = [] } = useQuery({
    queryKey: ['insights-income-list', monthStr, activeHouseholdId],
    queryFn: () => incomeApi.getAll({
      start_date: recurringMonthStart,
      end_date: recurringMonthEnd,
      household_id: activeHouseholdId!,
      limit: 500,
    }).then(r => r.data),
    enabled: !!activeHouseholdId && sectionVisibility.recurring,
  })

  // ── Group 7: 직전 3개월 지출 통계 — 지출 안정성(spendingStability) 지표용 ──

  const prev3Months = useMemo(() => getPrev3Months(monthStr), [monthStr])

  const prev3MonthsStats = useQueries({
    queries: prev3Months.map((m) => ({
      queryKey: ['expenseStats', m, activeHouseholdId],
      queryFn: () => expenseApi.getMonthlyStats(m, activeHouseholdId!).then(r => r.data),
      enabled: !!activeHouseholdId,
      staleTime: 5 * 60 * 1000,
    })),
  })

  // ── 파생 상태 (useMemo — 쿼리 결과 변경 시 재계산) ──

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

  // 정기거래 — 활성 항목만 필터링
  const activeRecurringItems = useMemo(
    () => recurringData.filter(r => r.is_active),
    [recurringData],
  )

  // recurring_transaction_id → 실제 실행 금액 맵 (없으면 건너뜀)
  const executedAmountMap = useMemo(() => {
    const map = new Map<number, number>()
    monthlyExpenseList
      .filter(e => e.recurring_transaction_id != null)
      .forEach(e => map.set(e.recurring_transaction_id!, e.amount))
    monthlyIncomeList
      .filter(i => i.recurring_transaction_id != null)
      .forEach(i => map.set(i.recurring_transaction_id!, i.amount))
    return map
  }, [monthlyExpenseList, monthlyIncomeList])

  // 비저축성 활성 정기지출 합계 (고정비 비율 지표용)
  // category_id 기반으로 필터링 — description(거래명)은 카테고리명과 다름
  const recurringNonSavingsTotal = useMemo(() => {
    const savingsCategoryIds = new Set(
      expenseCategories.filter(c => c.is_savings).map(c => c.id)
    )
    // 저축 카테고리 미설정 시 측정 불가
    if (savingsCategoryIds.size === 0) return undefined
    const nonSavingsExpenses = activeRecurringItems
      .filter(r => r.type === 'expense' && !savingsCategoryIds.has(r.category_id!))
    if (nonSavingsExpenses.length === 0) return undefined
    return nonSavingsExpenses.reduce((sum, r) => sum + r.amount, 0)
  }, [expenseCategories, activeRecurringItems])

  // 직전 3개월 변동지출 배열 — spendingStability 지표 계산용
  // 변동지출 = 해당월 총지출 - 비저축 정기지출 - 저축성 지출
  const monthlyVariableExpenses = useMemo(() => {
    const allLoaded = prev3MonthsStats.every((q) => q.isSuccess)
    if (!allLoaded) return []

    const savingsCatNames = new Set(
      expenseCategories.filter(c => c.is_savings).map(c => c.name)
    )

    return prev3MonthsStats.map((q) => {
      const stats = q.data
      if (!stats) return 0
      const totalExpense = stats.total ?? 0
      const savingsExpense = stats.by_category
        .filter(cb => savingsCatNames.has(cb.category))
        .reduce((sum, cb) => sum + cb.amount, 0)
      return Math.max(0, totalExpense - (recurringNonSavingsTotal ?? 0) - savingsExpense)
    })
  }, [prev3MonthsStats, expenseCategories, recurringNonSavingsTotal])

  const financialScore = useMemo(() => {
    if (!expenseStats && !incomeStats) return null

    const [year, month] = monthStr.split('-').map(Number)

    return calculateFinancialScore({
      incomeTotal: incomeStats?.total ?? 0,
      savingsTotal,
      budgetTotal: budgetStats?.total_budget ?? undefined,
      budgetSpent: budgetStats?.total_spent ?? undefined,
      budgetCategories: budgetStats?.categories?.length ?? 0,
      expenseCategories: expenseStats?.by_category?.length ?? 0,
      recurringNonSavings: recurringNonSavingsTotal,
      monthlyVariableExpenses,
      targetYear: year,
      targetMonth: month,
      today: new Date(),
    })
  }, [expenseStats, incomeStats, savingsTotal, budgetStats, recurringNonSavingsTotal, monthlyVariableExpenses, monthStr])

  // 거래 건수 (온보딩 분기용) — count 필드는 StatsResponse에 있음
  const transactionCount = (expenseStats?.count ?? 0) + (incomeStats?.count ?? 0)

  // 미실행 정기지출 합계 (HeroSummary 예산 프로그레스바용)
  const pendingRecurringExpense = useMemo(() => {
    return activeRecurringItems
      .filter(r => r.type === 'expense')
      .filter(r => r.next_due_date.slice(0, 7) === monthStr && !executedAmountMap.has(r.id))
      .reduce((sum, r) => sum + r.amount, 0)
  }, [activeRecurringItems, monthStr, executedAmountMap])

  // 전월 대비 비교 문장 (HeroSummary 서브텍스트용)
  const comparisonText = useMemo(() => {
    if (!comparison?.change?.amount || comparison.change.percentage === null) return undefined
    const pct = Math.abs(comparison.change.percentage)
    if (pct < 1) return '지난달과 비슷한 수준이에요'
    const amt = Math.abs(comparison.change.amount).toLocaleString('ko-KR')
    return comparison.change.amount < 0
      ? `지난달 이맘때보다 ${amt}원 줄었어요 ↓`
      : `지난달 이맘때보다 ${amt}원 늘었어요 ↑`
  }, [comparison])

  const comparisonColor = useMemo(() => {
    if (!comparison?.change?.amount) return undefined
    return comparison.change.amount < 0 ? 'text-leaf-600' : 'text-red-600'
  }, [comparison])

  // 저축 카테고리 필터링 (SavingsSection용)
  const savingsCategories = useMemo(() => {
    const savingsCatNames = new Set(
      expenseCategories.filter(c => c.is_savings).map(c => c.name)
    )
    if (savingsCatNames.size === 0) return []
    return (expenseStats?.by_category ?? []).filter(c => savingsCatNames.has(c.category))
  }, [expenseCategories, expenseStats])

  // 고정비 총액 (MonthlyHighlights 규칙 #5 — 고정비 비율 40% 이상 경고용)
  // activeRecurringItems는 이미 is_active === true 필터 적용됨 → r.is_active 중복 체크 불필요
  const recurringTotal = useMemo(() => {
    return activeRecurringItems
      .filter(r => r.type === 'expense')
      .reduce((sum, r) => sum + r.amount, 0)
  }, [activeRecurringItems])

  // 전월 저축 합계 (MonthlyHighlights 규칙 #6 — 저축 감소 감지용)
  const prevSavingsTotal = useMemo(() => {
    const savingsCatNames = new Set(
      expenseCategories.filter(c => c.is_savings).map(c => c.name)
    )
    if (savingsCatNames.size === 0) return undefined
    return comparison?.by_category_comparison
      .filter(c => savingsCatNames.has(c.category))
      .reduce((sum, c) => sum + c.previous, 0)
  }, [expenseCategories, comparison])

  // 전월 저축률 (MonthlyComparison 저축률 행용)
  const savingsRatePrevious = useMemo(() => {
    if (savingsTotal === undefined) return undefined
    if (!incomeComparison?.previous?.total) return undefined
    const savingsCatNames = new Set(
      expenseCategories.filter(c => c.is_savings).map(c => c.name)
    )
    const prevSavings = comparison?.by_category_comparison
      .filter(c => savingsCatNames.has(c.category))
      .reduce((sum, c) => sum + c.previous, 0) ?? 0
    const prevIncome = incomeComparison.previous.total
    return prevIncome > 0 ? (prevSavings / prevIncome) * 100 : undefined
  }, [savingsTotal, incomeComparison, comparison, expenseCategories])

  // 딥링크 핸들러 — MonthlyHighlights 항목 클릭 시 해당 섹션으로 스크롤
  const handleDeepLink = useCallback((sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // ── 로딩 / 에러 판단 ──

  // 핵심 데이터(지출+수입) 중 하나라도 오면 렌더 시작
  const loading = !activeHouseholdId || (expLoading && incLoading)

  // 핵심 데이터가 모두 undefined이고 로딩도 끝났으면 에러 (네트워크/서버 오류)
  const error = !expenseStats && !incomeStats && !expLoading && !incLoading && !!activeHouseholdId

  // monthStr에서 파생된 연/월 (PeriodNavigator + HeroSummary에서 공유)
  const { currentYear, currentMonth } = useMemo(() => {
    const [y, m] = monthStr.split('-').map(Number)
    return { currentYear: y, currentMonth: m - 1 } // currentMonth: 0-indexed
  }, [monthStr])

  // 현재 달 여부 (히어로 라벨 컨텍스트 분기용)
  const isCurrentMonth = useMemo(() => {
    const today = new Date()
    return currentYear === today.getFullYear() && currentMonth === today.getMonth()
  }, [currentYear, currentMonth])

  const handlePrev = useCallback(() => {
    setMonthStr(m => shiftMonth(m, -1))
  }, [])
  const handleNext = useCallback(() => {
    setMonthStr(m => shiftMonth(m, 1))
  }, [])
  const handleMonthSelect = useCallback((year: number, month: number) => {
    setMonthStr(toMonthStr(new Date(year, month, 1)))
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

      {/* 빈 상태 — 데이터 로드됐지만 거래 0건 */}
      {!loading && !error && transactionCount === 0 && expenseStats !== undefined && (
        <EmptyState
          variant="primary"
          title="이번 달 거래 내역이 없습니다"
          description="가계부에 수입이나 지출을 기록하면 리포트가 생성됩니다"
          action={{ label: '가계부로 이동', onClick: () => navigate('/home') }}
        />
      )}

      {/* 온보딩 모드 — 거래 1~4건: 풀 리포트 대신 셋업 가이드 표시 */}
      {!loading && !error && transactionCount > 0 && transactionCount < FULL_REPORT_THRESHOLD && (
        <InsightsOnboarding
          hasTransactions={false}
          hasBudget={!!budgetStats?.total_budget}
          hasRecurring={activeRecurringItems.length > 0}
          hasSavingsCategory={expenseCategories.some(c => c.is_savings)}
        />
      )}

      {/* 풀 리포트 — 거래 5건 이상 */}
      {!loading && !error && transactionCount >= FULL_REPORT_THRESHOLD && (
        <>
          {/* Layer 0: 히어로 — 이달 지출 총액 + 예산 프로그레스바 */}
          <HeroSummary
            label={getHeroLabel(
              expenseStats?.total ?? 0,
              budgetStats?.total_budget ?? null,
              pendingRecurringExpense,
              currentMonth + 1,
              isCurrentMonth,
            )}
            totalExpense={expenseStats?.total ?? 0}
            totalBudget={budgetStats?.total_budget ?? null}
            pendingRecurringExpense={pendingRecurringExpense}
            totalIncome={incomeStats?.total}
            comparisonText={comparisonText}
            comparisonColor={comparisonColor}
            healthScore={financialScore}
          />

          {/* Layer 1: 한눈에 — 주목할 점 → 요약 카드 */}
          {sectionVisibility.highlights && (
            <MonthlyHighlights
              incomeTotal={incomeStats?.total ?? 0}
              expenseTotal={expenseStats?.total ?? 0}
              savingsTotal={savingsTotal}
              recurringTotal={recurringTotal}
              prevSavingsTotal={prevSavingsTotal}
              budgetStats={budgetStats ?? null}
              comparison={comparison ?? null}
              onHighlightClick={handleDeepLink}
            />
          )}

          <UnifiedSummaryCards
            incomeTotal={incomeStats?.total ?? 0}
            expenseTotal={expenseStats?.total ?? 0}
            savingsTotal={savingsTotal}
          />

          {/* Layer 2: 들여다보기 */}
          <LayerDivider label="들여다보기" />

          {sectionVisibility.categoryTop && (
            <div id="section-category">
              <CategoryTopList categories={expenseStats?.by_category ?? []} />
            </div>
          )}

          {sectionVisibility.budget && (
            <div id="section-budget">
              <BudgetVsActual budgetStats={budgetStats ?? null} monthStr={monthStr} />
            </div>
          )}

          {sectionVisibility.recurring && (
            <RecurringManageSection
              items={activeRecurringItems}
              monthStr={monthStr}
              executedAmountMap={executedAmountMap}
            />
          )}

          {sectionVisibility.cardUsage && cardUsage.length > 0 && (
            <CardUsageSummary usage={cardUsage} />
          )}

          {sectionVisibility.savings && (
            <SavingsSection
              savingsTotal={savingsTotal}
              incomeTotal={incomeStats?.total ?? 0}
              savingsCategories={savingsCategories}
              recurringTotal={recurringTotal}
              expenseTotal={expenseStats?.total ?? 0}
            />
          )}

          {/* Layer 3: 돌아보기 */}
          <LayerDivider label="돌아보기" />

          {sectionVisibility.comparison && (
            <div id="section-comparison">
              <MonthlyComparison
                expenseComparison={comparison ?? null}
                incomeComparison={incomeComparison ?? null}
                savingsRateCurrent={
                  savingsTotal !== undefined && incomeStats?.total
                    ? (savingsTotal / incomeStats.total) * 100
                    : undefined
                }
                savingsRatePrevious={savingsRatePrevious}
              />
            </div>
          )}

          {/* 결산 리포트 */}
          {sectionVisibility.ai && (
            <section>
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-3">결산 리포트</h2>
              <MonthlyReportCard />
            </section>
          )}
        </>
      )}
    </div>
  )
}

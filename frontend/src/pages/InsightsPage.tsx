/**
 * @file InsightsPage.tsx
 * @description 인사이트/통계 페이지
 * 주간/월간/연간 통계 탭 + AI 인사이트 탭
 */

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, BarChart3, Calendar, CalendarDays, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { insightsApi, statsApi } from '../api/insights'
import { incomeApi } from '../api/income'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import PeriodNavigator from '../components/stats/PeriodNavigator'
import StatsSummaryCards from '../components/stats/StatsSummaryCards'
import TrendChart from '../components/stats/TrendChart'
import ComparisonChart from '../components/stats/ComparisonChart'
import CategoryBreakdown from '../components/stats/CategoryBreakdown'
import type { InsightsResponse, StatsResponse, ComparisonResponse } from '../types'

type TabType = 'weekly' | 'monthly' | 'yearly' | 'ai'
type DataType = 'expense' | 'income'

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'weekly', label: '주간', icon: <Calendar className="w-4 h-4" /> },
  { id: 'monthly', label: '월간', icon: <CalendarDays className="w-4 h-4" /> },
  { id: 'yearly', label: '연간', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'ai', label: 'AI 인사이트', icon: <Sparkles className="w-4 h-4" /> },
]

// ── 날짜 유틸 ──

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDate(dateStr: string, tab: TabType, direction: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (tab === 'weekly') d.setDate(d.getDate() + direction * 7)
  else if (tab === 'monthly') d.setMonth(d.getMonth() + direction)
  else d.setFullYear(d.getFullYear() + direction)
  return toDateStr(d)
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ── 마크다운 렌더링 (기존 유지) ──

function renderBoldText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={j} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h3 key={i} className="text-lg font-semibold text-stone-900 mt-4 mb-2">
          {line.replace('## ', '')}
        </h3>
      )
    }
    if (line.startsWith('- ')) {
      return (
        <li key={i} className="ml-4 text-stone-700">
          {renderBoldText(line.replace('- ', ''))}
        </li>
      )
    }
    if (line.trim() === '') {
      return <div key={i} className="h-2" />
    }
    return (
      <p key={i} className="text-stone-700 leading-relaxed">
        {renderBoldText(line)}
      </p>
    )
  })
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

// ── 통계 탭 컴포넌트 ──

function StatsTab({ period, dateStr, householdId, dataType }: { period: string; dateStr: string; householdId: number | undefined; dataType: DataType }) {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const isIncome = dataType === 'income'

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      try {
        const statsRes = isIncome
          ? await incomeApi.getStats(period, dateStr, householdId)
          : await statsApi.getStats(period, dateStr, householdId)
        if (cancelled) return
        setStats(statsRes.data)

        // 수입은 비교 데이터 없음, 주간도 비교 데이터 없음
        if (!isIncome && period !== 'weekly') {
          const compRes = await statsApi.getComparison(period, dateStr, 3, householdId)
          if (cancelled) return
          setComparison(compRes.data)
        } else {
          setComparison(null)
        }
      } catch {
        if (!cancelled) toast.error('통계를 불러오는데 실패했습니다')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [period, dateStr, householdId, isIncome])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className={`w-8 h-8 animate-spin ${isIncome ? 'text-leaf-600' : 'text-grape-600'}`} />
      </div>
    )
  }

  const emptyLabel = isIncome ? '수입' : '지출'
  if (!stats || stats.total === 0) {
    return <EmptyState title={`이 기간에 기록된 ${emptyLabel}이 없습니다`} description="다른 기간을 선택해보세요." />
  }

  return (
    <div className="space-y-6">
      <StatsSummaryCards
        total={stats.total}
        count={stats.count}
        trend={stats.trend}
        changePercentage={comparison?.change.percentage ?? null}
        totalLabel={isIncome ? '총 수입' : '총 지출'}
        accentColor={isIncome ? 'leaf' : 'grape'}
      />
      <TrendChart data={stats.trend} />
      {comparison && comparison.trend.length > 0 && (
        <ComparisonChart data={comparison.trend} />
      )}
      <CategoryBreakdown
        categories={stats.by_category}
        comparisons={comparison?.by_category_comparison}
      />
    </div>
  )
}

// ── 메인 페이지 ──

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('monthly')
  const [dataType, setDataType] = useState<DataType>('expense')
  const [dateStr, setDateStr] = useState(toDateStr(new Date()))
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // AI 인사이트 상태 (기존)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const handlePrev = useCallback(() => {
    setDateStr((d) => shiftDate(d, activeTab, -1))
  }, [activeTab])

  const handleNext = useCallback(() => {
    setDateStr((d) => shiftDate(d, activeTab, 1))
  }, [activeTab])

  // 탭 변경 시 날짜 리셋
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    if (tab !== 'ai') setDateStr(toDateStr(new Date()))
  }

  // AI 인사이트 생성
  const handleGenerate = async () => {
    if (!selectedMonth) {
      toast.error('월을 선택해주세요')
      return
    }

    setAiLoading(true)
    try {
      const res = await insightsApi.generate(selectedMonth)
      setInsights(res.data)
      toast.success('인사이트가 생성되었습니다')
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '인사이트 생성에 실패했습니다'
      toast.error(message)
    } finally {
      setAiLoading(false)
    }
  }

  // 현재 탭의 네비게이션 라벨
  const getNavLabel = () => {
    const d = new Date(dateStr + 'T00:00:00')
    if (activeTab === 'weekly') {
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
      const weekNum = Math.ceil((d.getDate() + firstDay.getDay()) / 7)
      return `${d.getMonth() + 1}월 ${weekNum}주차`
    }
    if (activeTab === 'monthly') return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    return `${d.getFullYear()}년`
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-grape-600" />
        <h1 className="text-2xl font-bold text-stone-900">리포트</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-grape-700 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 기간 네비게이션 + 지출/수입 토글 (AI 탭 제외) */}
      {activeTab !== 'ai' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <PeriodNavigator label={getNavLabel()} onPrev={handlePrev} onNext={handleNext} />
          <div className="flex gap-1 bg-stone-100 p-1 rounded-lg">
            <button
              onClick={() => setDataType('expense')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                dataType === 'expense'
                  ? 'bg-white text-grape-700 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              지출
            </button>
            <button
              onClick={() => setDataType('income')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                dataType === 'income'
                  ? 'bg-white text-leaf-700 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              수입
            </button>
          </div>
        </div>
      )}

      {/* 통계 탭 콘텐츠 */}
      {activeTab !== 'ai' && (
        <StatsTab
          period={activeTab}
          dateStr={dateStr}
          householdId={activeHouseholdId ?? undefined}
          dataType={dataType}
        />
      )}

      {/* AI 인사이트 탭 콘텐츠 */}
      {activeTab === 'ai' && (
        <>
          {/* 월 선택 및 생성 버튼 */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1 w-full">
                <label
                  htmlFor="month-select"
                  className="block text-sm font-medium text-stone-700 mb-2"
                >
                  분석할 월 선택
                </label>
                <input
                  id="month-select"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={aiLoading}
                className="w-full sm:w-auto px-6 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:bg-stone-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {aiLoading ? '생성 중...' : '인사이트 생성'}
              </button>
            </div>

            <p className="text-sm text-stone-500 mt-3">
              Claude API를 통해 해당 월의 지출 패턴을 분석하고 인사이트를
              제공합니다. (최대 30초 소요)
            </p>
          </div>

          {/* 로딩 스피너 */}
          {aiLoading && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin h-12 w-12 text-grape-600" />
                <p className="text-stone-600">
                  AI가 당신의 지출을 분석하고 있습니다...
                </p>
              </div>
            </div>
          )}

          {/* 인사이트 결과 */}
          {!aiLoading && insights && (
            <div className="space-y-6">
              {/* 월별 요약 */}
              <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-stone-900 mb-4">
                  {insights.month} 요약
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-grape-50 rounded-lg p-4">
                    <p className="text-sm text-stone-600 mb-1">총 지출</p>
                    <p className="text-2xl font-bold text-grape-700">
                      {formatAmount(insights.total)}
                    </p>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-4">
                    <p className="text-sm text-stone-600 mb-1">카테고리 수</p>
                    <p className="text-2xl font-bold text-stone-700">
                      {Object.keys(insights.by_category).length}개
                    </p>
                  </div>
                </div>
              </div>

              {/* 카테고리별 금액 */}
              <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-stone-900 mb-4">
                  카테고리별 지출
                </h2>
                <div className="space-y-3">
                  {Object.entries(insights.by_category)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => {
                      const percentage =
                        insights.total > 0
                          ? ((amount / insights.total) * 100).toFixed(1)
                          : 0
                      return (
                        <div key={category} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-stone-700">
                                {category}
                              </span>
                              <span className="text-sm font-semibold text-stone-900">
                                {formatAmount(amount)}
                              </span>
                            </div>
                            <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-grape-600 h-2 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-stone-500 w-12 text-right">
                            {percentage}%
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* AI 인사이트 */}
              <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-grape-600" />
                  <h2 className="text-lg font-semibold text-stone-900">
                    AI 분석
                  </h2>
                </div>
                <div className="prose prose-sm max-w-none text-stone-700 space-y-2">
                  {renderMarkdown(insights.insights)}
                </div>
              </div>
            </div>
          )}

          {/* 초기 상태 (아직 인사이트 생성 안 함) */}
          {!aiLoading && !insights && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200">
              <EmptyState
                title="월을 선택하고 인사이트를 생성하세요"
                description="AI가 당신의 지출 패턴을 분석하고 개인화된 조언을 제공합니다."
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

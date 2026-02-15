/**
 * @file InsightsPage.tsx
 * @description AI 인사이트 페이지
 * 월별 지출 분석 및 Claude API를 통한 AI 인사이트 생성 기능을 제공한다.
 */

import { useState } from 'react'
import { TrendingUp, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { insightsApi } from '../api/insights'
import EmptyState from '../components/EmptyState'
import type { InsightsResponse } from '../types'

/**
 * 금액을 한국 원화 형식으로 포맷
 */
function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

/**
 * 현재 월 (YYYY-MM)
 */
function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 볼드(**text**) 마크다운을 React 엘리먼트로 안전하게 변환
 * dangerouslySetInnerHTML 없이 XSS 방지
 */
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

/**
 * Markdown 스타일 텍스트를 안전한 React 엘리먼트로 렌더링
 */
function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    // 헤딩 (## 제목)
    if (line.startsWith('## ')) {
      return (
        <h3 key={i} className="text-lg font-semibold text-stone-900 mt-4 mb-2">
          {line.replace('## ', '')}
        </h3>
      )
    }
    // 리스트 (- 항목)
    if (line.startsWith('- ')) {
      return (
        <li key={i} className="ml-4 text-stone-700">
          {renderBoldText(line.replace('- ', ''))}
        </li>
      )
    }
    // 빈 줄
    if (line.trim() === '') {
      return <div key={i} className="h-2" />
    }
    // 일반 텍스트 (볼드 안전 렌더링)
    return (
      <p key={i} className="text-stone-700 leading-relaxed">
        {renderBoldText(line)}
      </p>
    )
  })
}

export default function InsightsPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  /**
   * 인사이트 생성 요청
   */
  const handleGenerate = async () => {
    if (!selectedMonth) {
      toast.error('월을 선택해주세요')
      return
    }

    setLoading(true)
    try {
      const res = await insightsApi.generate(selectedMonth)
      setInsights(res.data)
      toast.success('인사이트가 생성되었습니다')
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '인사이트 생성에 실패했습니다'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-amber-600" />
        <h1 className="text-2xl font-bold text-stone-900">AI 인사이트</h1>
      </div>

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
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {loading ? '생성 중...' : '인사이트 생성'}
          </button>
        </div>

        <p className="text-sm text-stone-500 mt-3">
          Claude API를 통해 해당 월의 지출 패턴을 분석하고 인사이트를
          제공합니다. (최대 30초 소요)
        </p>
      </div>

      {/* 로딩 스피너 */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin h-12 w-12 text-amber-600" />
            <p className="text-stone-600">
              AI가 당신의 지출을 분석하고 있습니다...
            </p>
          </div>
        </div>
      )}

      {/* 인사이트 결과 */}
      {!loading && insights && (
        <div className="space-y-6">
          {/* 월별 요약 */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">
              {insights.month} 요약
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-sm text-stone-600 mb-1">총 지출</p>
                <p className="text-2xl font-bold text-amber-700">
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
                            className="bg-amber-600 h-2 rounded-full transition-all"
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
              <TrendingUp className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-stone-900">
                AI 인사이트
              </h2>
            </div>
            <div className="prose prose-sm max-w-none text-stone-700 space-y-2">
              {renderMarkdown(insights.insights)}
            </div>
          </div>
        </div>
      )}

      {/* 초기 상태 (아직 인사이트 생성 안 함) */}
      {!loading && !insights && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200">
          <EmptyState
            title="월을 선택하고 인사이트를 생성하세요"
            description="AI가 당신의 지출 패턴을 분석하고 개인화된 조언을 제공합니다."
          />
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { CategoryStats } from '../../types'
import { formatAmount } from '../../utils/format'

// 카테고리가 이 수 이하이면 분석이 의미없어 추가 유도 메시지를 표시한다
const MIN_CATEGORIES_FOR_ANALYSIS = 2

interface CategoryTopListProps {
  categories: CategoryStats[]
  maxItems?: number
}

type ViewMode = 'list' | 'chart'

// Grape 팔레트 기반 카테고리 색상
const CATEGORY_COLORS = [
  '#7c3aed', '#a78bfa', '#c4b5fd', '#22c55e', '#86efac',
  '#f59e0b', '#fcd34d', '#fb923c', '#f87171', '#60a5fa',
]

function formatCompactAmount(amount: number): string {
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}억원`
  if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString()}만원`
  return `${Math.round(amount).toLocaleString('ko-KR')}원`
}


export default function CategoryTopList({ categories, maxItems = 5 }: CategoryTopListProps) {
  const [expanded, setExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('chart')
  // 파이 차트에서 선택된 카테고리 (null = 선택 없음, 도넛 중앙에 총액 표시)
  const [selectedCategory, setSelectedCategory] = useState<{ name: string; amount: number; percentage: number } | null>(null)

  if (categories.length === 0) return null

  const hasMore = categories.length > maxItems
  const visible = expanded ? categories : categories.slice(0, maxItems)
  const totalAmount = categories.reduce((sum, c) => sum + c.amount, 0)

  // 차트용: 5개까지만 조각, 나머지 "기타"로 통합
  const chartData = (() => {
    if (categories.length <= 5) return categories
    const top5 = categories.slice(0, 5)
    const others = categories.slice(5)
    const otherAmount = others.reduce((sum, c) => sum + c.amount, 0)
    const otherPct = others.reduce((sum, c) => sum + c.percentage, 0)
    return [...top5, { category: '기타', amount: otherAmount, count: 0, percentage: otherPct }]
  })()

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      {/* 헤더: 제목 + 탭 전환 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">📋 지출 카테고리</h2>
        <div className="flex items-center gap-1 bg-[var(--surface-elevated)] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[var(--surface-card)] shadow-sm text-grape-600' : 'text-[var(--text-muted)]'}`}
            aria-label="리스트 보기"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'chart' ? 'bg-[var(--surface-card)] shadow-sm text-grape-600' : 'text-[var(--text-muted)]'}`}
            aria-label="그래프 보기"
          >
            <PieChartIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 리스트 뷰 */}
      {viewMode === 'list' && (
        <>
          <div className="space-y-2.5">
            {visible.map((cat, i) => {
              return (
                <div key={cat.category} className="-mx-2 px-2 py-1 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--text-muted)] w-4">{i + 1}</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{cat.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-secondary)]">{formatAmount(cat.amount)}</span>
                      <span className="text-xs text-[var(--text-tertiary)] w-12 text-right">{cat.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden ml-6">
                    <div className="h-full rounded-full bg-grape-500" style={{ width: `${cat.percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center gap-1 w-full mt-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {expanded ? (
                <>접기 <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>더보기 ({categories.length - maxItems}) <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          )}
        </>
      )}

      {/* 카테고리가 1개 이하이면 분석이 의미없어 추가 유도 메시지 표시 */}
      {categories.length < MIN_CATEGORIES_FOR_ANALYSIS && (
        <p className="text-xs text-[var(--text-tertiary)] mt-2">
          카테고리를 더 추가하면 지출 패턴을 파악하기 쉬워요.{' '}
          <Link to="/categories" className="text-grape-600 hover:text-grape-700">
            카테고리 설정
          </Link>
        </p>
      )}

      {/* 그래프 뷰 */}
      {viewMode === 'chart' && (
        <>
          <div className="relative" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                  onClick={(_data, index) => {
                    const cat = chartData[index]
                    if (!cat) return
                    const isSame = selectedCategory?.name === cat.category
                    setSelectedCategory(isSame ? null : { name: cat.category, amount: cat.amount, percentage: cat.percentage })
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {chartData.map((cat, index) => (
                    <Cell
                      key={index}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      opacity={selectedCategory && selectedCategory.name !== cat.category ? 0.4 : 1}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* 도넛 중앙: 선택 카테고리 or 총 지출 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                {selectedCategory ? (
                  <>
                    <p className="text-xs text-[var(--text-tertiary)] truncate max-w-[80px]">{selectedCategory.name}</p>
                    <p className="text-base font-bold text-[var(--text-primary)]">{formatCompactAmount(selectedCategory.amount)}</p>
                    <p className="text-xs text-[var(--text-muted)]">{selectedCategory.percentage.toFixed(1)}%</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[var(--text-tertiary)]">총 지출</p>
                    <p className="text-base font-bold text-[var(--text-primary)]">{formatCompactAmount(totalAmount)}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 범례 */}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {chartData.map((cat, index) => (
              <div key={cat.category} className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                />
                <span className="text-xs text-[var(--text-primary)] truncate">{cat.category}</span>
                <span className="text-xs text-[var(--text-tertiary)] ml-auto flex-shrink-0">{cat.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

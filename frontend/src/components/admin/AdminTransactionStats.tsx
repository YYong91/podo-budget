/* Admin 거래 통계 — 일별 추이 차트 + 카테고리 분포 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import type { TransactionStats } from '../../types'

interface Props {
  data: TransactionStats
}

const COLORS = [
  '#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe',
  '#10b981', '#6ee7b7', '#a7f3d0', '#d1fae5',
]

function formatAmount(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function renderPieLabel(props: PieLabelRenderProps) {
  const { category, percentage } = props as PieLabelRenderProps & { category: string; percentage: number }
  return `${category} ${percentage}%`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTooltip(v: any) {
  return `${Number(v).toLocaleString()}원`
}

export default function AdminTransactionStats({ data }: Props) {
  const chartData = data.daily_counts.map(d => ({
    date: d.date.slice(5), // MM-DD
    지출: d.expense_amount,
    수입: d.income_amount,
  }))

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <div className="text-xs text-warm-500 mb-1">총 지출</div>
          <div className="text-lg font-bold text-red-600">{formatAmount(data.total_expense_amount)}원</div>
          <div className="text-xs text-warm-400">{data.total_expense_count}건 · 평균 {formatAmount(data.avg_expense_amount)}원</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <div className="text-xs text-warm-500 mb-1">총 수입</div>
          <div className="text-lg font-bold text-blue-600">{formatAmount(data.total_income_amount)}원</div>
          <div className="text-xs text-warm-400">{data.total_income_count}건 · 평균 {formatAmount(data.avg_income_amount)}원</div>
        </div>
      </div>

      {/* 일별 추이 */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <h3 className="text-sm font-semibold text-warm-700 mb-3">일별 추이</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatAmount} tick={{ fontSize: 11 }} />
              <Tooltip formatter={formatTooltip} />
              <Line type="monotone" dataKey="지출" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="수입" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 카테고리 분포 */}
      <div className="grid md:grid-cols-2 gap-4">
        {data.expense_by_category.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-warm-200">
            <h3 className="text-sm font-semibold text-warm-700 mb-3">지출 카테고리</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.expense_by_category} dataKey="amount" nameKey="category"
                  cx="50%" cy="50%" outerRadius={80} label={renderPieLabel}>
                  {data.expense_by_category.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.income_by_category.length > 0 && (
          <div className="bg-white rounded-xl p-4 border border-warm-200">
            <h3 className="text-sm font-semibold text-warm-700 mb-3">수입 카테고리</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.income_by_category} dataKey="amount" nameKey="category"
                  cx="50%" cy="50%" outerRadius={80} label={renderPieLabel}>
                  {data.income_by_category.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

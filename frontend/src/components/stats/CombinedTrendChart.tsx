/**
 * @file CombinedTrendChart.tsx
 * @description 수입/지출 복합 라인 차트 — 두 데이터셋을 하나의 차트에 표시
 */

import { useRef, useState } from 'react'
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { TrendPoint } from '../../types'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend)

interface CombinedTrendChartProps {
  expenseTrend: TrendPoint[]
  incomeTrend: TrendPoint[]
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

function formatAxisAmount(v: number): string {
  const n = Number(v)
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(0)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만원`
  if (n >= 1_000) return `${Math.round(n / 1_000)}천원`
  return `${n}원`
}

export default function CombinedTrendChart({ expenseTrend, incomeTrend }: CombinedTrendChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null)
  const [hiddenExpense, setHiddenExpense] = useState(false)
  const [hiddenIncome, setHiddenIncome] = useState(false)

  const labels = expenseTrend.length > 0
    ? expenseTrend.map((d) => d.label)
    : incomeTrend.map((d) => d.label)

  if (labels.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-4 sm:p-5">
        <h3 className="text-base font-semibold text-warm-700 mb-4">수입 / 지출 흐름</h3>
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-sm text-warm-400">데이터가 없습니다</p>
        </div>
      </div>
    )
  }

  const toggleDataset = (index: number, setHidden: (v: boolean) => void, current: boolean) => {
    const chart = chartRef.current
    if (!chart) return
    const next = !current
    chart.setDatasetVisibility(index, !next)
    chart.update()
    setHidden(next)
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: '지출',
        data: expenseTrend.map((d) => d.amount),
        borderColor: '#9333EA',
        backgroundColor: 'rgba(147, 51, 234, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#9333EA',
        tension: 0.3,
        fill: false,
      },
      {
        label: '수입',
        data: incomeTrend.map((d) => d.amount),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#22c55e',
        tension: 0.3,
        fill: false,
      },
    ],
  }

  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-warm-700 mb-3">수입 / 지출 흐름</h3>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => toggleDataset(0, setHiddenExpense, hiddenExpense)}
          className={`flex items-center gap-1.5 text-sm rounded-lg px-2 py-1 transition-all hover:bg-warm-50 ${hiddenExpense ? 'opacity-35' : 'opacity-100'}`}
        >
          <span className="w-8 h-0.5 bg-grape-500 rounded-full inline-block" />
          <span className="text-warm-600">지출</span>
        </button>
        <button
          onClick={() => toggleDataset(1, setHiddenIncome, hiddenIncome)}
          className={`flex items-center gap-1.5 text-sm rounded-lg px-2 py-1 transition-all hover:bg-warm-50 ${hiddenIncome ? 'opacity-35' : 'opacity-100'}`}
        >
          <span className="w-8 h-0.5 bg-leaf-500 rounded-full inline-block" />
          <span className="text-warm-600">수입</span>
        </button>
      </div>
      <div className="h-[230px]">
        <Line
          ref={chartRef}
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${formatAmount(ctx.parsed.y ?? 0)}`,
                },
              },
            },
            scales: {
              x: { ticks: { font: { size: 11 } }, grid: { display: false } },
              y: { ticks: { font: { size: 11 }, callback: (v) => formatAxisAmount(Number(v)) } },
            },
          }}
        />
      </div>
    </div>
  )
}

/**
 * @file CombinedTrendChart.tsx
 * @description 수입/지출 막대 + 순수익 라인 복합 차트
 */

import { useRef, useState } from 'react'
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'
import type { TrendPoint } from '../../types'

ChartJS.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

interface CombinedTrendChartProps {
  expenseTrend: TrendPoint[]
  incomeTrend: TrendPoint[]
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

function formatAxisAmount(v: number): string {
  const n = Math.abs(Number(v))
  if (n >= 100_000_000) return `${(Number(v) / 100_000_000).toFixed(0)}억`
  if (n >= 10_000) return `${Math.round(Number(v) / 10_000)}만원`
  if (n >= 1_000) return `${Math.round(Number(v) / 1_000)}천원`
  return `${Number(v)}원`
}

export default function CombinedTrendChart({ expenseTrend, incomeTrend }: CombinedTrendChartProps) {
  const chartRef = useRef<ChartJS>(null)
  const [hiddenSets, setHiddenSets] = useState<Record<number, boolean>>({})

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

  const expenseData = expenseTrend.map((d) => d.amount)
  const incomeData = incomeTrend.map((d) => d.amount)
  const netData = incomeData.map((inc, i) => inc - (expenseData[i] ?? 0))

  const toggleDataset = (index: number) => {
    const chart = chartRef.current
    if (!chart) return
    const next = !hiddenSets[index]
    chart.setDatasetVisibility(index, !next)
    chart.update()
    setHiddenSets((prev) => ({ ...prev, [index]: next }))
  }

  const legendItems = [
    { index: 0, label: '수입', colorClass: 'bg-leaf-500', shape: 'bar' },
    { index: 1, label: '지출', colorClass: 'bg-grape-500', shape: 'bar' },
    { index: 2, label: '순수익', colorClass: 'bg-warm-500', shape: 'line' },
  ]

  const chartData = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: '수입',
        data: incomeData,
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
        order: 2,
      },
      {
        type: 'bar' as const,
        label: '지출',
        data: expenseData,
        backgroundColor: 'rgba(147, 51, 234, 0.7)',
        borderColor: '#9333EA',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
        order: 2,
      },
      {
        type: 'line' as const,
        label: '순수익',
        data: netData,
        borderColor: '#78716c',
        backgroundColor: 'rgba(120, 113, 108, 0.1)',
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#78716c',
        pointBorderWidth: 2,
        tension: 0.3,
        fill: false,
        order: 1,
      },
    ],
  }

  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-warm-700 mb-3">수입 / 지출 흐름</h3>
      <div className="flex items-center gap-3 mb-3">
        {legendItems.map(({ index, label, colorClass, shape }) => (
          <button
            key={index}
            onClick={() => toggleDataset(index)}
            className={`flex items-center gap-1.5 text-sm rounded-lg px-2 py-1 transition-all hover:bg-warm-50 ${hiddenSets[index] ? 'opacity-35' : 'opacity-100'}`}
          >
            {shape === 'bar'
              ? <span className={`w-3 h-3 ${colorClass} rounded-sm inline-block`} />
              : <span className={`w-6 h-0.5 ${colorClass} rounded-full inline-block border-dashed`} style={{ borderTop: '2px dashed #78716c', height: 0, backgroundColor: 'transparent' }} />
            }
            <span className="text-warm-600">{label}</span>
          </button>
        ))}
      </div>
      <div className="h-[260px]">
        <Chart
          ref={chartRef}
          type="bar"
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'index',
              intersect: false,
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${formatAmount(ctx.parsed.y ?? 0)}`,
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
                  callback: (v) => formatAxisAmount(Number(v)),
                },
                grid: { color: 'rgba(0,0,0,0.04)' },
              },
            },
          }}
        />
      </div>
    </div>
  )
}

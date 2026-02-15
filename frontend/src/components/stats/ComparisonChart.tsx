/**
 * @file ComparisonChart.tsx
 * @description 기간 비교 막대 차트
 */

import { useRef } from 'react'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { PeriodTotal } from '../../types'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

interface ComparisonChartProps {
  data: PeriodTotal[]
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function ComparisonChart({ data }: ComparisonChartProps) {
  const chartRef = useRef<ChartJS<'bar'>>(null)

  if (data.length === 0) return null

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [{
      data: data.map((d) => d.total),
      backgroundColor: data.map((_, i) =>
        i === data.length - 1 ? '#D97706' : '#E7E5E4'
      ),
      borderRadius: 8,
      barThickness: 40,
    }],
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-stone-700 mb-4">기간 비교</h3>
      <div className="h-[200px]">
        <Bar
          ref={chartRef}
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (ctx) => formatAmount(ctx.parsed.x ?? 0) } },
            },
            scales: {
              x: { ticks: { callback: (v) => `${(Number(v) / 10000).toFixed(0)}만` } },
              y: { ticks: { font: { size: 12 } } },
            },
          }}
        />
      </div>
    </div>
  )
}

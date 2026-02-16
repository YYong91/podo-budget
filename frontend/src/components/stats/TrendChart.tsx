/**
 * @file TrendChart.tsx
 * @description 추이 라인차트 (일별/월별)
 */

import { useRef } from 'react'
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { TrendPoint } from '../../types'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend)

interface TrendChartProps {
  data: TrendPoint[]
  title?: string
}

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function TrendChart({ data, title = '지출 추이' }: TrendChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null)

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-4 sm:p-5">
        <h3 className="text-base font-semibold text-warm-700 mb-4">{title}</h3>
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-sm text-warm-400">데이터가 없습니다</p>
        </div>
      </div>
    )
  }

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [{
      data: data.map((d) => d.amount),
      borderColor: '#9333EA',
      backgroundColor: 'rgba(147, 51, 234, 0.1)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#9333EA',
      tension: 0.3,
      fill: true,
    }],
  }

  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-semibold text-warm-700 mb-4">{title}</h3>
      <div className="h-[250px]">
        <Line
          ref={chartRef}
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (ctx) => formatAmount(ctx.parsed.y ?? 0) } },
            },
            scales: {
              x: { ticks: { font: { size: 11 } }, grid: { display: false } },
              y: { ticks: { font: { size: 11 }, callback: (v) => `${(Number(v) / 1000).toFixed(0)}k` } },
            },
          }}
        />
      </div>
    </div>
  )
}

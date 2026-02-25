/**
 * @file TrendChart.tsx
 * @description 추이 라인차트 (일별/월별) — 범례 토글 + 한국어 금액 단위
 */

import { useRef, useState } from 'react'
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

/** Y축 눈금 한국어 표기 */
function formatAxisAmount(v: number): string {
  const n = Number(v)
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(0)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000)}만원`
  if (n >= 1_000) return `${Math.round(n / 1_000)}천원`
  return `${n}원`
}

export default function TrendChart({ data, title = '지출 추이' }: TrendChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null)
  const [isHidden, setIsHidden] = useState(false)

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

  const handleLegendClick = () => {
    const chart = chartRef.current
    if (!chart) return
    const next = !isHidden
    chart.setDatasetVisibility(0, !next)
    chart.update()
    setIsHidden(next)
  }

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [{
      label: '지출',
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
      <h3 className="text-base font-semibold text-warm-700 mb-3">{title}</h3>
      {/* 범례 */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={handleLegendClick}
          className={`flex items-center gap-1.5 text-sm rounded-lg px-2 py-1 transition-all hover:bg-warm-50 ${
            isHidden ? 'opacity-35' : 'opacity-100'
          }`}
        >
          <span className="w-8 h-0.5 bg-grape-500 rounded-full inline-block" />
          <span className="text-warm-600">지출</span>
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
              tooltip: { callbacks: { label: (ctx) => formatAmount(ctx.parsed.y ?? 0) } },
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

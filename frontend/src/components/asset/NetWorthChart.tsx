/**
 * @file NetWorthChart.tsx
 * @description 순자산 추이 차트 — Recharts AreaChart + 기간 탭
 */

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { AssetSnapshot } from '../../types'
import { formatKoreanAmount } from '../../utils/format'

interface NetWorthChartProps {
  snapshots: AssetSnapshot[]
}

type Period = '3M' | '6M' | '12M'

const PERIOD_DAYS: Record<Period, number> = {
  '3M': 90,
  '6M': 180,
  '12M': 365,
}

function filterByPeriod(snapshots: AssetSnapshot[], days: number): AssetSnapshot[] {
  const cutoff = Date.now() - days * 86400000
  return snapshots.filter(s => new Date(s.recorded_at).getTime() >= cutoff)
}

export default function NetWorthChart({ snapshots }: NetWorthChartProps) {
  const [period, setPeriod] = useState<Period>('3M')

  const data = useMemo(() => {
    const filtered = filterByPeriod(snapshots, PERIOD_DAYS[period])
    return filtered
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map(s => ({
        date: new Date(s.recorded_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        netWorth: s.net_worth,
      }))
  }, [snapshots, period])

  if (snapshots.length === 0) {
    return (
      <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-5 flex items-center justify-center h-40">
        <p className="text-sm text-[var(--text-muted)]">아직 기록이 없어요</p>
      </div>
    )
  }

  // Y축 범위: 데이터 최소-최대값 기준 ±10% 마진
  const values = data.map(d => d.netWorth)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const margin = (maxVal - minVal) * 0.1 || Math.abs(maxVal) * 0.1 || 1000000
  const yMin = Math.floor((minVal - margin) / 1000000) * 1000000
  const yMax = Math.ceil((maxVal + margin) / 1000000) * 1000000

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-5">
      {/* 기간 탭 */}
      <div className="flex gap-2 mb-4 justify-end">
        {(['3M', '6M', '12M'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              period === p
                ? 'bg-grape-100 text-grape-600 font-medium'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-[var(--text-muted)]">선택한 기간의 기록이 없어요</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-grape-400)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-grape-400)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickFormatter={(v) => formatKoreanAmount(v)}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              formatter={(value: number) => [formatKoreanAmount(value), '순자산']}
              contentStyle={{
                fontSize: 12,
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                backgroundColor: 'var(--surface-card)',
              }}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="var(--color-grape-400)"
              strokeWidth={2}
              fill="url(#netWorthGradient)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

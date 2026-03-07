/* 자산/부채 현황 대시보드 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, TrendingUp, TrendingDown, Landmark } from 'lucide-react'
import { Chart as ChartJS, ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip as ChartTooltip, Legend } from 'chart.js'
import { Pie, Line } from 'react-chartjs-2'
import { assetApi } from '../api/assets'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import type { Asset, AssetSummary, AssetSnapshot } from '../types'

ChartJS.register(ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, ChartTooltip, Legend)

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

function formatPct(pct: number | null): string {
  if (pct == null) return ''
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

const TYPE_LABELS: Record<string, string> = {
  stock_kr: '한국주식',
  stock_us: '미국주식',
  crypto: '코인',
  deposit: '예적금',
  real_estate: '부동산',
  other: '기타',
  loan: '대출',
}

const PIE_COLORS = ['#9333EA', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#78716C']

export default function AssetDashboard() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [summary, setSummary] = useState<AssetSummary | null>(null)
  const [snapshots, setSnapshots] = useState<AssetSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { activeHouseholdId } = useHouseholdStore()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    const hid = activeHouseholdId ?? undefined
    Promise.all([
      assetApi.getAll(hid),
      assetApi.getSummary(hid),
      assetApi.getSnapshots(hid, 12),
    ])
      .then(([assetsRes, summaryRes, snapshotsRes]) => {
        setAssets(assetsRes.data)
        setSummary(summaryRes.data)
        setSnapshots(snapshotsRes.data.slice().reverse())
      })
      .catch(() => setError('자산 정보를 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [activeHouseholdId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-grape-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16 text-warm-500">{error}</div>
    )
  }

  const netWorth = summary?.net_worth ?? 0
  const totalAssets = summary?.total_assets ?? 0
  const totalLiabilities = summary?.total_liabilities ?? 0
  const breakdown = summary?.breakdown ?? {}

  const nonLiabilities = assets.filter(a => !a.is_liability)
  const liabilities = assets.filter(a => a.is_liability)

  // 파이차트 데이터 (자산 유형별)
  const pieLabels = Object.keys(breakdown).map(k => TYPE_LABELS[k] ?? k)
  const pieValues = Object.values(breakdown)
  const pieData = {
    labels: pieLabels,
    datasets: [{
      data: pieValues,
      backgroundColor: PIE_COLORS.slice(0, pieLabels.length),
      borderWidth: 1,
      borderColor: '#fff',
    }],
  }

  // 순자산 추이 라인차트
  const lineLabels = snapshots.map(s => s.snapshot_date.slice(0, 7))
  const lineData = {
    labels: lineLabels,
    datasets: [{
      label: '순자산',
      data: snapshots.map(s => s.net_worth),
      borderColor: '#9333EA',
      backgroundColor: 'rgba(147,51,234,0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 4,
    }],
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="w-6 h-6 text-grape-600" />
          <h1 className="text-2xl font-bold text-warm-900">자산 관리</h1>
        </div>
        <Link
          to="/assets/new"
          className="flex items-center gap-2 px-4 py-2 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          자산 등록
        </Link>
      </div>

      {/* 순자산 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-2xl border shadow-sm p-5 col-span-1 ${netWorth >= 0 ? 'bg-gradient-to-br from-grape-50 to-grape-100 border-grape-200/60' : 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-200/60'}`}>
          <p className="text-sm text-warm-600">순자산</p>
          <p className={`text-3xl font-bold tracking-tight mt-1 ${netWorth >= 0 ? 'text-grape-700' : 'text-rose-700'}`}>
            {formatAmount(netWorth)}
          </p>
          {summary?.total_profit_loss != null && summary.total_profit_loss !== 0 && (
            <p className={`text-xs mt-1 ${summary.total_profit_loss >= 0 ? 'text-leaf-600' : 'text-rose-600'}`}>
              투자손익 {formatAmount(summary.total_profit_loss)}
              {summary.total_profit_loss_pct != null && ` (${formatPct(summary.total_profit_loss_pct)})`}
            </p>
          )}
        </div>
        <div className="bg-gradient-to-br from-leaf-50 to-leaf-100 border border-leaf-200/60 rounded-2xl shadow-sm p-5">
          <p className="text-sm text-leaf-700/70">총 자산</p>
          <p className="text-2xl font-bold tracking-tight text-leaf-700 mt-1">{formatAmount(totalAssets)}</p>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200/60 rounded-2xl shadow-sm p-5">
          <p className="text-sm text-rose-700/70">총 부채</p>
          <p className="text-2xl font-bold tracking-tight text-rose-700 mt-1">{formatAmount(totalLiabilities)}</p>
        </div>
      </div>

      {/* 차트 영역 */}
      {(pieLabels.length > 0 || snapshots.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 자산 유형별 파이차트 */}
          {pieLabels.length > 0 && (
            <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-warm-700 mb-4">자산 유형별 비중</h2>
              <div className="h-48 flex items-center justify-center">
                <Pie data={pieData} options={{ plugins: { legend: { position: 'right' } } }} />
              </div>
            </div>
          )}
          {/* 순자산 추이 */}
          {snapshots.length > 1 && (
            <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-warm-700 mb-4">순자산 추이</h2>
              <div className="h-48">
                <Line
                  data={lineData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { ticks: { callback: (v) => `₩${Number(v).toLocaleString()}` } },
                    },
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 자산 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 자산 */}
        <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-warm-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-leaf-600" />
            자산 ({nonLiabilities.length})
          </h2>
          {nonLiabilities.length === 0 ? (
            <p className="text-sm text-warm-400 text-center py-4">등록된 자산이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {nonLiabilities.map(asset => (
                <div key={asset.id} className="flex items-center justify-between py-2 border-b border-warm-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-warm-800">{asset.name}</p>
                    <p className="text-xs text-warm-400">{TYPE_LABELS[asset.type] ?? asset.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-warm-900">
                      {asset.current_value != null ? formatAmount(asset.current_value) : '-'}
                    </p>
                    {asset.profit_loss_pct != null && (
                      <p className={`text-xs ${asset.profit_loss_pct >= 0 ? 'text-leaf-600' : 'text-rose-600'}`}>
                        {formatPct(asset.profit_loss_pct)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 부채 */}
        <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-warm-700 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            부채 ({liabilities.length})
          </h2>
          {liabilities.length === 0 ? (
            <p className="text-sm text-warm-400 text-center py-4">등록된 부채가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {liabilities.map(asset => (
                <div key={asset.id} className="flex items-center justify-between py-2 border-b border-warm-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-warm-800">{asset.name}</p>
                    <p className="text-xs text-warm-400">
                      {TYPE_LABELS[asset.type] ?? asset.type}
                      {asset.interest_rate != null && ` · 연 ${asset.interest_rate}%`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-rose-700">
                    {asset.current_value != null ? formatAmount(asset.current_value) : '-'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 빈 상태 */}
      {assets.length === 0 && (
        <div className="text-center py-16">
          <Landmark className="w-12 h-12 text-warm-300 mx-auto mb-3" />
          <p className="text-warm-500 mb-4">아직 등록된 자산이 없습니다</p>
          <Link
            to="/assets/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            첫 자산 등록하기
          </Link>
        </div>
      )}
    </div>
  )
}

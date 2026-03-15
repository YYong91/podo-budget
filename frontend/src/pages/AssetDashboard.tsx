/* 자산/부채 현황 대시보드 — 순자산 중심 + 목표 기반 UI */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Loader2, Plus, TrendingUp, TrendingDown, Landmark, Wallet,
  ChevronRight, ChevronDown, ChevronUp, Target, Bell, Building2, X,
} from 'lucide-react'
import {
  Chart as ChartJS, LineElement, PointElement, CategoryScale,
  LinearScale, Filler, Tooltip as ChartTooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { assetApi } from '../api/assets'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import type { Asset, AssetSummary, AssetSnapshot, AssetGoal, MonthlySavings } from '../types'
import { formatAmount } from '../utils/format'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Filler, ChartTooltip, Legend)

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

/* 유형 그룹 정의 */
interface TypeGroup {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  types: string[]
  isLiability?: boolean
  colorClass: string
  iconColorClass: string
}

const TYPE_GROUPS: TypeGroup[] = [
  { key: 'investment', label: '투자', icon: TrendingUp, types: ['stock_kr', 'stock_us', 'crypto'], colorClass: 'text-warm-700', iconColorClass: 'text-grape-500' },
  { key: 'deposit', label: '예적금', icon: Landmark, types: ['deposit'], colorClass: 'text-warm-700', iconColorClass: 'text-leaf-600' },
  { key: 'real_estate', label: '부동산/기타', icon: Building2, types: ['real_estate', 'other'], colorClass: 'text-warm-700', iconColorClass: 'text-warm-500' },
  { key: 'liability', label: '부채', icon: TrendingDown, types: ['loan'], isLiability: true, colorClass: 'text-rose-700', iconColorClass: 'text-rose-500' },
]

function AssetRow({ asset }: { asset: Asset }) {
  return (
    <Link
      to={`/assets/${asset.id}`}
      className="flex items-center justify-between py-2 border-b border-warm-100 last:border-0 hover:bg-warm-50 -mx-1 px-1 rounded transition-colors"
    >
      <div>
        <p className="text-sm font-medium text-warm-800">{asset.name}</p>
        <p className="text-xs text-warm-400">{TYPE_LABELS[asset.type] ?? asset.type}</p>
      </div>
      <div className="flex items-center gap-1">
        <div className="text-right">
          <p className={`text-sm font-semibold ${asset.is_liability ? 'text-rose-700' : 'text-warm-900'}`}>
            {asset.current_value != null ? formatAmount(asset.current_value) : '-'}
          </p>
          {asset.profit_loss_pct != null && (
            <p className={`text-xs ${asset.profit_loss_pct >= 0 ? 'text-leaf-600' : 'text-rose-600'}`}>
              {formatPct(asset.profit_loss_pct)}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-warm-300 shrink-0" />
      </div>
    </Link>
  )
}

export default function AssetDashboard() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [summary, setSummary] = useState<AssetSummary | null>(null)
  const [snapshots, setSnapshots] = useState<AssetSnapshot[]>([])
  const [goal, setGoal] = useState<AssetGoal | null>(null)
  const [monthlySavings, setMonthlySavings] = useState<MonthlySavings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalAmount, setGoalAmount] = useState('')
  const [goalDate, setGoalDate] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const { activeHouseholdId } = useHouseholdStore()

  const fetchData = () => {
    setLoading(true)
    setError(null)
    const hid = activeHouseholdId!
    Promise.all([
      assetApi.getAll(hid),
      assetApi.getSummary(hid),
      assetApi.getSnapshots(hid, 12),
      assetApi.getGoal(hid).catch(() => ({ data: null })),
      assetApi.getMonthlySavings(hid).catch(() => ({ data: null })),
    ])
      .then(([assetsRes, summaryRes, snapshotsRes, goalRes, savingsRes]) => {
        setAssets(assetsRes.data)
        setSummary(summaryRes.data)
        setSnapshots(snapshotsRes.data.slice().reverse())
        setGoal(goalRes.data)
        // 월별 저축: 배열이면 최신 1건, 단일 객체면 그대로
        const savingsData = savingsRes.data
        if (Array.isArray(savingsData)) {
          setMonthlySavings(savingsData.length > 0 ? savingsData[savingsData.length - 1] : null)
        } else {
          setMonthlySavings(savingsData)
        }
      })
      .catch(() => setError('자산 정보를 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHouseholdId])

  /* 목표 저장 */
  const handleSaveGoal = async () => {
    const amount = Number(goalAmount)
    if (!amount || !goalDate) return
    setGoalSaving(true)
    try {
      const res = await assetApi.setGoal({
        target_net_worth: amount,
        target_date: goalDate,
        household_id: activeHouseholdId!,
      })
      setGoal(res.data)
      setShowGoalModal(false)
    } catch {
      // 실패 시 모달 유지
    } finally {
      setGoalSaving(false)
    }
  }

  /* 목표 삭제 */
  const handleDeleteGoal = async () => {
    setGoalSaving(true)
    try {
      await assetApi.deleteGoal(activeHouseholdId!)
      setGoal(null)
      setShowGoalModal(false)
    } catch {
      // 무시
    } finally {
      setGoalSaving(false)
    }
  }

  /* 목표 모달 열기 */
  const openGoalModal = () => {
    if (goal) {
      setGoalAmount(String(goal.target_net_worth))
      setGoalDate(goal.target_date)
    } else {
      setGoalAmount('')
      setGoalDate('')
    }
    setShowGoalModal(true)
  }

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

  /* 전월 대비 변동 */
  const prevMonthNW = snapshots.length >= 2 ? snapshots[snapshots.length - 2].net_worth : null
  const prevMonthDiff = prevMonthNW != null ? netWorth - prevMonthNW : null

  /* 순자산 추이 라인차트 */
  const lineLabels = snapshots.map(s => s.snapshot_date.slice(0, 7))
  const lineDatasets = [
    {
      label: '순자산',
      data: snapshots.map(s => s.net_worth),
      borderColor: '#9333EA',
      backgroundColor: 'rgba(147,51,234,0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 4,
    },
    // 목표 기준선
    ...(goal ? [{
      label: '목표',
      data: snapshots.map(() => goal.target_net_worth),
      borderColor: '#D1D5DB',
      borderDash: [5, 5],
      fill: false,
      tension: 0,
      pointRadius: 0,
    }] : []),
  ]
  const lineData = { labels: lineLabels, datasets: lineDatasets }

  /* 유형별 그룹 구성 */
  const groupedAssets = TYPE_GROUPS.map(group => {
    const items = group.isLiability
      ? assets.filter(a => a.is_liability)
      : assets.filter(a => !a.is_liability && group.types.includes(a.type))
    const total = items.reduce((sum, a) => sum + (a.current_value ?? 0), 0)
    return { ...group, items, total }
  }).filter(g => g.items.length > 0)

  /* 업데이트 촉구: 가장 최근 자산의 updated_at 확인 */
  const latestUpdatedAt = assets.length > 0
    ? assets.reduce((latest, a) => (a.updated_at > latest ? a.updated_at : latest), assets[0].updated_at)
    : null
  const daysSinceUpdate = latestUpdatedAt
    ? Math.floor((Date.now() - new Date(latestUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const showNudge = daysSinceUpdate != null && daysSinceUpdate > 30

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      {/* 액션 버튼 */}
      <div className="flex items-center justify-end gap-2">
        <Link
          to="/accounts"
          className="flex items-center gap-1.5 px-3 py-2 border border-warm-200 text-warm-600 rounded-lg text-sm font-medium hover:bg-warm-50 transition-colors"
        >
          <Wallet className="w-4 h-4" />
          계좌 관리
        </Link>
        <Link
          to="/assets/new"
          className="flex items-center gap-2 px-4 py-2 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          자산 등록
        </Link>
      </div>

      {/* 1. 순자산 히어로 섹션 */}
      <div className={`rounded-2xl border shadow-sm p-6 ${netWorth >= 0 ? 'bg-gradient-to-br from-grape-50 to-grape-100 border-grape-200/60' : 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-200/60'}`}>
        <p className="text-sm text-warm-500 mb-1">순자산</p>
        <p className={`text-3xl font-bold tracking-tight ${netWorth >= 0 ? 'text-grape-700' : 'text-rose-700'}`}>
          {formatAmount(netWorth)}
        </p>
        {/* 전월 대비 변동 */}
        {prevMonthDiff != null && (
          <p className={`text-sm mt-1 font-medium ${prevMonthDiff >= 0 ? 'text-leaf-600' : 'text-rose-600'}`}>
            전월 대비 {prevMonthDiff >= 0 ? '+' : ''}{formatAmount(prevMonthDiff)}
          </p>
        )}
        {/* 자산/부채 요약 */}
        <div className="flex gap-4 mt-3 text-xs text-warm-500">
          <span>자산 {formatAmount(totalAssets)}</span>
          <span>부채 {formatAmount(totalLiabilities)}</span>
        </div>
        {/* 월 저축 요약 */}
        {monthlySavings && (
          <p className="text-xs text-warm-400 mt-2">
            {monthlySavings.month} 저축 {formatAmount(monthlySavings.net_savings)}
            {monthlySavings.net_savings > 0 ? ' 👍' : ''}
          </p>
        )}
      </div>

      {/* 2. 목표 진행률 */}
      {goal ? (
        <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-warm-700 flex items-center gap-2">
              <Target className="w-4 h-4 text-grape-500" />
              순자산 목표
            </h2>
            <button
              onClick={openGoalModal}
              className="text-xs text-grape-600 hover:text-grape-700 font-medium"
            >
              수정
            </button>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-warm-500">목표 {formatAmount(goal.target_net_worth)}</span>
            <span className="font-semibold text-grape-700">{goal.progress_pct.toFixed(1)}%</span>
          </div>
          {/* 진행 바 */}
          <div className="w-full h-2.5 bg-warm-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-grape-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(goal.progress_pct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-warm-400">
            <span>{goal.pace_message}</span>
            {goal.monthly_required != null && (
              <span>월 {formatAmount(goal.monthly_required)} 필요</span>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={openGoalModal}
          className="w-full bg-white rounded-2xl border-2 border-dashed border-warm-200 p-5 flex items-center justify-center gap-2 text-warm-400 hover:border-grape-300 hover:text-grape-500 transition-colors"
        >
          <Target className="w-5 h-5" />
          <span className="text-sm font-medium">순자산 목표를 설정해보세요</span>
        </button>
      )}

      {/* 3. 순자산 추이 차트 */}
      {snapshots.length > 1 && (
        <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-warm-700 mb-4">순자산 추이</h2>
          <div className="h-48">
            <Line
              data={lineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: !!goal } },
                scales: {
                  y: { ticks: { callback: (v) => `₩${Number(v).toLocaleString()}` } },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* 4. 유형별 자산 목록 */}
      {groupedAssets.length > 0 && (
        <div className="space-y-3">
          {groupedAssets.map(group => {
            const Icon = group.icon
            const isCollapsed = collapsed[group.key] ?? false
            return (
              <div key={group.key} className="bg-white rounded-2xl border border-warm-200/60 shadow-sm overflow-hidden">
                {/* 그룹 헤더 */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-warm-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${group.iconColorClass}`} />
                    <span className={`text-sm font-semibold ${group.colorClass}`}>
                      {group.label} ({group.items.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${group.isLiability ? 'text-rose-700' : 'text-warm-900'}`}>
                      {formatAmount(group.total)}
                    </span>
                    {isCollapsed
                      ? <ChevronDown className="w-4 h-4 text-warm-400" />
                      : <ChevronUp className="w-4 h-4 text-warm-400" />
                    }
                  </div>
                </button>
                {/* 자산 항목 */}
                {!isCollapsed && (
                  <div className="px-4 pb-3">
                    {group.items.map(asset => (
                      <AssetRow key={asset.id} asset={asset} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 5. 업데이트 촉구 카드 */}
      {showNudge && (
        <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex items-start gap-3">
          <Bell className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">자산 현황을 업데이트해보세요</p>
            <p className="text-xs text-amber-600 mt-0.5">
              마지막 업데이트: {daysSinceUpdate}일 전
            </p>
          </div>
        </div>
      )}

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

      {/* 6. 목표 설정 모달 */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowGoalModal(false)}
          />
          {/* 모달 본체 */}
          <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-5 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-warm-800">순자산 목표 설정</h2>
              <button onClick={() => setShowGoalModal(false)} className="text-warm-400 hover:text-warm-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">목표 금액</label>
                <input
                  type="number"
                  value={goalAmount}
                  onChange={e => setGoalAmount(e.target.value)}
                  placeholder="예: 100000000"
                  className="w-full px-3 py-2.5 border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/40 focus:border-grape-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">목표 날짜</label>
                <input
                  type="date"
                  value={goalDate}
                  onChange={e => setGoalDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/40 focus:border-grape-400"
                />
              </div>
            </div>

            <div className="flex gap-3">
              {goal && (
                <button
                  onClick={handleDeleteGoal}
                  disabled={goalSaving}
                  className="px-4 py-2.5 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  삭제
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setShowGoalModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-warm-500 border border-warm-200 rounded-lg hover:bg-warm-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveGoal}
                disabled={goalSaving || !goalAmount || !goalDate}
                className="px-4 py-2.5 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors disabled:opacity-50"
              >
                {goalSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

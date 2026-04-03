/**
 * @file AssetDashboard.tsx
 * @description 자산 대시보드 — React Query 기반 섹션별 독립 로딩
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { assetApi } from '../api/assets'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import ErrorState from '../components/ErrorState'
import { Skeleton } from '../components/skeleton/Skeleton'
import NetWorthHero from '../components/asset/NetWorthHero'
import MonthlyPerformanceCard, { computeBreakdownDiff, computeStreak, findPositiveMessage } from '../components/asset/MonthlyPerformanceCard'
import MilestoneProgress from '../components/asset/MilestoneProgress'
import NetWorthChart from '../components/asset/NetWorthChart'
import AssetGroupList from '../components/asset/AssetGroupList'
import AssetOnboarding from '../components/asset/AssetOnboarding'
import UpdateNudge from '../components/asset/UpdateNudge'
import { useToast } from '../hooks/useToast'
import type { AssetSummary, AssetType } from '../types'

/** 자산 대시보드 로딩 스켈레톤 */
function AssetDashboardSkeleton() {
  return (
    <div className="space-y-4 py-6">
      {/* 순자산 히어로 골격 */}
      <div className="card-surface p-6 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-3 w-32" />
      </div>
      {/* 자산 카드 2개 */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map(i => (
          <div key={i} className="card-surface p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      {/* 자산 리스트 */}
      <div className="card-surface p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AssetDashboard() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // UI 상태 (데이터와 무관한 모달/폼 상태)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalAmount, setGoalAmount] = useState('')
  const [goalDate, setGoalDate] = useState('')

  // 자산 목록 — 핵심 데이터, 이것의 로딩 상태로 전체 스켈레톤 제어
  const {
    data: assets = [],
    isLoading: assetsLoading,
    isError: assetsError,
  } = useQuery({
    queryKey: ['assets', activeHouseholdId],
    queryFn: () => assetApi.getAll(activeHouseholdId!).then(r => r.data),
    enabled: !!activeHouseholdId,
  })

  // 스냅샷 — 과거→최신 순으로 저장 (차트 + placeholder용)
  const { data: snapshots = [] } = useQuery({
    queryKey: ['asset-snapshots', activeHouseholdId],
    queryFn: () =>
      assetApi.getSnapshots(activeHouseholdId!, 12).then(r => [...r.data].reverse()),
    enabled: !!activeHouseholdId,
  })

  // 최신 스냅샷으로 placeholder 생성 — 실시간 시세 도착 전까지 즉시 표시
  const snapshotPlaceholder = useMemo(() => {
    if (snapshots.length === 0) return undefined
    const latest = snapshots[snapshots.length - 1]
    return {
      net_worth: latest.net_worth,
      total_assets: latest.total_assets,
      total_liabilities: latest.total_liabilities,
      breakdown: latest.breakdown ?? {},
    } as AssetSummary
  }, [snapshots])

  // 자산 요약 (실시간 시세) — 스냅샷 placeholder를 먼저 보여주고 백그라운드에서 갱신
  const { data: summary } = useQuery({
    queryKey: ['asset-summary', activeHouseholdId],
    queryFn: () => assetApi.getSummary(activeHouseholdId!).then(r => r.data),
    enabled: !!activeHouseholdId,
    placeholderData: snapshotPlaceholder,
    staleTime: 5 * 60 * 1000, // 실시간 시세는 5분 캐시
  })

  // 순자산 목표 — 미설정이면 null (404 → null 처리)
  const { data: goal = null } = useQuery({
    queryKey: ['asset-goal', activeHouseholdId],
    queryFn: async () => {
      try {
        const res = await assetApi.getGoal(activeHouseholdId!)
        return res.data
      } catch (err: unknown) {
        // 404(목표 미설정)만 null — 서버 에러는 throw
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosErr = err as { response?: { status?: number } }
          if (axiosErr.response?.status === 404) return null
        }
        throw err
      }
    },
    enabled: !!activeHouseholdId,
  })

  // 월 저축액
  const { data: savings = null } = useQuery({
    queryKey: ['asset-savings', activeHouseholdId],
    queryFn: () =>
      assetApi.getMonthlySavings(activeHouseholdId!).then(r => r.data).catch(() => null),
    enabled: !!activeHouseholdId,
  })

  // 목표 저장 뮤테이션
  const setGoalMutation = useMutation({
    mutationFn: (data: { target_net_worth: number; target_date: string }) =>
      assetApi.setGoal({ ...data, household_id: activeHouseholdId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-goal', activeHouseholdId] })
      setShowGoalModal(false)
    },
    onError: () => {
      addToast('error', '목표 저장에 실패했습니다')
    },
  })

  // 목표 삭제 뮤테이션
  const deleteGoalMutation = useMutation({
    mutationFn: () => assetApi.deleteGoal(activeHouseholdId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-goal', activeHouseholdId] })
      setShowGoalModal(false)
    },
    onError: () => {
      addToast('error', '목표 삭제에 실패했습니다')
    },
  })

  const goalSaving = setGoalMutation.isPending || deleteGoalMutation.isPending

  const handleSaveGoal = () => {
    const amount = Number(goalAmount)
    if (!amount || !goalDate) return
    setGoalMutation.mutate({ target_net_worth: amount, target_date: goalDate })
  }

  const handleDeleteGoal = () => {
    deleteGoalMutation.mutate()
  }

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

  const handleAddAsset = useCallback((type?: AssetType) => {
    const params = type ? `?type=${type}` : ''
    navigate(`/assets/new${params}`)
  }, [navigate])

  if (assetsLoading) return <AssetDashboardSkeleton />
  if (assetsError) return <ErrorState message="자산 정보를 불러오지 못했습니다" onRetry={() => queryClient.invalidateQueries({ queryKey: ['assets', activeHouseholdId] })} />

  // 빈 상태 — 온보딩
  if (assets.length === 0) {
    return (
      <div className="py-6">
        <AssetOnboarding onAdd={handleAddAsset} />
      </div>
    )
  }

  const netWorth = summary?.net_worth ?? 0
  const totalAssets = summary?.total_assets ?? 0
  const totalLiabilities = summary?.total_liabilities ?? 0

  // 성과 카드: live vs 마지막 스냅샷
  const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const netWorthChange = lastSnapshot ? netWorth - lastSnapshot.net_worth : null

  const breakdownDiff = lastSnapshot && summary
    ? computeBreakdownDiff(
        { breakdown: summary.breakdown, totalLiabilities },
        { breakdown: lastSnapshot.breakdown, totalLiabilities: lastSnapshot.total_liabilities },
      )
    : []

  // live 순자산 prepend → 이번 달도 스트릭에 포함
  const streak = computeStreak(
    [{ net_worth: netWorth }, ...[...snapshots].reverse().map(s => ({ net_worth: s.net_worth }))],
  )

  const savingsAmount = savings?.savings ?? 0
  const positiveMessage = netWorthChange != null && netWorthChange < 0
    ? findPositiveMessage(breakdownDiff, savingsAmount)
    : null

  return (
    <div className="space-y-4 py-6 animate-page-in animate-stagger">
      <NetWorthHero
        netWorth={netWorth}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
      />

      {netWorthChange != null && (
        <MonthlyPerformanceCard
          netWorthChange={netWorthChange}
          breakdownDiff={breakdownDiff}
          streak={streak}
          savings={savingsAmount}
          positiveMessage={positiveMessage}
        />
      )}

      <MilestoneProgress
        netWorth={netWorth}
        goal={goal}
        onGoalEdit={openGoalModal}
      />

      <NetWorthChart snapshots={snapshots} />

      <UpdateNudge
        assets={assets}
        onNavigate={(assetId) => navigate(`/assets/${assetId}`)}
      />

      <AssetGroupList assets={assets} onAdd={handleAddAsset} />

      {/* 목표 설정 모달 */}
      {showGoalModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="goal-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="모달 닫기"
            onClick={() => setShowGoalModal(false)}
            onKeyDown={e => e.key === 'Escape' && setShowGoalModal(false)}
          />
          <div className="relative bg-[var(--surface-card)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 id="goal-modal-title" className="text-lg font-bold text-[var(--text-primary)]">순자산 목표 설정</h2>
              <button
                onClick={() => setShowGoalModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="goal-amount" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  목표 금액
                </label>
                <input
                  id="goal-amount"
                  type="number"
                  inputMode="numeric"
                  value={goalAmount}
                  onChange={e => setGoalAmount(e.target.value)}
                  placeholder="예: 100000000"
                  className="w-full px-3 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/40 focus:border-grape-400"
                />
              </div>
              <div>
                <label htmlFor="goal-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  목표 날짜
                </label>
                <input
                  id="goal-date"
                  type="date"
                  value={goalDate}
                  onChange={e => setGoalDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/40 focus:border-grape-400"
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
                className="px-4 py-2.5 text-sm font-medium text-[var(--text-tertiary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
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

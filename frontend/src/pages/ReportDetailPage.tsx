/* 결산 리포트 상세 페이지 — /insights/reports/:month 경로 */

import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { reportsApi } from '../api/reports'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import ReportContent from '../components/reports/ReportContent'
import ReportEmptyState from '../components/reports/ReportEmptyState'
import ReportPendingState from '../components/reports/ReportPendingState'

export default function ReportDetailPage() {
  const { month } = useParams<{ month: string }>()
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  const { data, isLoading } = useQuery({
    queryKey: ['report', activeHouseholdId, month],
    queryFn: async () => {
      const res = await reportsApi.getMonthly(month!, activeHouseholdId ?? undefined)
      return res.data
    },
    enabled: !!month,
    staleTime: 5 * 60 * 1000,
    // pending/processing 상태이면 30초마다 폴링 (completed 되면 중단)
    refetchInterval: (query) => {
      const status = query.state.data?.report?.status
      return status === 'pending' || status === 'processing' ? 30_000 : false
    },
  })

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* 네비게이션 헤더 */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => navigate('/insights')}
          className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          모아보기로
        </button>
      </div>

      {/* 콘텐츠 — 상태별 분기 */}
      {isLoading ? (
        <div className="max-w-[640px] mx-auto px-4 pt-8 space-y-4 animate-pulse">
          <div className="h-4 bg-[var(--surface-elevated)] rounded w-24" />
          <div className="h-8 bg-[var(--surface-elevated)] rounded w-3/4" />
          <div className="h-4 bg-[var(--surface-elevated)] rounded w-1/2" />
        </div>
      ) : !data?.report ? (
        <div className="max-w-[640px] mx-auto">
          <ReportEmptyState eligibility={data?.eligibility ?? null} />
        </div>
      ) : data.report.status !== 'completed' ? (
        <div className="max-w-[640px] mx-auto">
          <ReportPendingState />
        </div>
      ) : (
        <ReportContent
          insights={data.report.insights!}
          month={data.report.month}
          completedAt={data.report.completed_at}
        />
      )}
    </div>
  )
}

/**
 * @file MonthlyReportCard.tsx
 * @description 홈 화면 상단에 표시되는 최신 월간 결산 리포트 카드
 *
 * 상태별 렌더링:
 * - 로딩 중: 스켈레톤
 * - 리포트 없음(미자격): ReportEmptyState
 * - pending/processing: ReportPendingState (30초마다 재폴링)
 * - completed: 첫 번째 insight headline + 리포트 상세 링크
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { reportsApi } from '../../api/reports'
import { useHouseholdStore } from '../../stores/useHouseholdStore'
import ReportEmptyState from './ReportEmptyState'
import ReportPendingState from './ReportPendingState'

export default function MonthlyReportCard() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  const { data, isLoading } = useQuery({
    queryKey: ['report-latest', activeHouseholdId],
    queryFn: async () => {
      const res = await reportsApi.getLatest(activeHouseholdId ?? undefined)
      return res.data
    },
    staleTime: 5 * 60 * 1000,
    // pending/processing 상태면 30초마다 재폴링하여 완료 시 자동 갱신
    refetchInterval: (query) => {
      const status = query.state.data?.report?.status
      return status === 'pending' || status === 'processing' ? 30_000 : false
    },
  })

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[var(--surface-elevated)] p-4 animate-pulse h-24" />
    )
  }

  if (!data?.report) {
    return <ReportEmptyState eligibility={data?.eligibility ?? null} />
  }

  const { report } = data

  if (report.status !== 'completed') {
    return <ReportPendingState />
  }

  const headline = report.insights?.findings?.[0]?.what ?? ''
  const monthLabel = formatMonthLabel(report.month)

  return (
    <Link
      to={`/insights/reports/${report.month}`}
      className="block rounded-2xl shadow-sm bg-gradient-to-br from-grape-50 to-grape-100 border border-grape-200 p-4 sm:p-6 hover:opacity-90 transition-opacity"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-grape-500">📬 {monthLabel} 결산 리포트</span>
        <ChevronRight className="w-4 h-4 text-grape-400" />
      </div>
      <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 mt-2">{headline}</p>
      {report.completed_at && (
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          {formatRelative(report.completed_at)}에 도착
        </p>
      )}
    </Link>
  )
}

/** "2026-03" → "2026년 3월호" */
function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  return `${year}년 ${parseInt(m)}월호`
}

/** ISO 날짜 문자열 → "오늘" | "어제" | "N일 전" */
function formatRelative(dateStr: string): string {
  const diffDays = Math.floor(
    (new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  return `${diffDays}일 전`
}

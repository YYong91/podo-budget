/* 결산 리포트 상세 페이지 — /insights/reports/:month 경로 */

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { reportsApi } from '../api/reports'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import ReportContent from '../components/reports/ReportContent'
import ReportEmptyState from '../components/reports/ReportEmptyState'
import ReportPendingState from '../components/reports/ReportPendingState'
import { prevMonth, nextMonth, currentMonthKst } from '../utils/monthUtils'

export default function ReportDetailPage() {
  const { month } = useParams<{ month: string }>()
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 이전/다음 월 문자열 계산
  const prevMonthStr = month ? prevMonth(month) : ''
  const nextMonthStr = month ? nextMonth(month) : ''

  // 현재 리포트 쿼리
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

  // 현재 리포트가 완성된 경우에만 nav 쿼리 실행
  const isCompleted = data?.report?.status === 'completed' && !!data.report.insights

  // 이전 달 리포트 존재 여부 확인
  const { data: prevData } = useQuery({
    queryKey: ['report', activeHouseholdId, prevMonthStr],
    queryFn: async () => {
      const res = await reportsApi.getMonthly(prevMonthStr, activeHouseholdId ?? undefined)
      return res.data
    },
    enabled: isCompleted && !!prevMonthStr,
    staleTime: 5 * 60 * 1000,
  })

  // 다음 달 리포트 존재 여부 확인 — 미래 월은 쿼리 자체를 막음
  const { data: nextData } = useQuery({
    queryKey: ['report', activeHouseholdId, nextMonthStr],
    queryFn: async () => {
      const res = await reportsApi.getMonthly(nextMonthStr, activeHouseholdId ?? undefined)
      return res.data
    },
    enabled: isCompleted && !!nextMonthStr && nextMonthStr <= currentMonthKst(),
    staleTime: 5 * 60 * 1000,
  })

  // nav 버튼 노출 여부: 해당 달 리포트가 completed일 때만 표시
  const hasPrevReport = prevData?.report?.status === 'completed'
  const hasNextReport = nextData?.report?.status === 'completed'

  // 월 레이블 포맷: "YYYY년 M월" (앞 0 제거)
  const formatMonthLabel = (monthStr: string): string => {
    const [yearStr, monthNum] = monthStr.split('-')
    return `${yearStr}년 ${parseInt(monthNum, 10)}월`
  }
  const prevMonthLabel = prevMonthStr ? formatMonthLabel(prevMonthStr) : ''
  const nextMonthLabel = nextMonthStr ? formatMonthLabel(nextMonthStr) : ''

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
      ) : data.report.status !== 'completed' || !data.report.insights ? (
        <div className="max-w-[640px] mx-auto">
          <ReportPendingState />
        </div>
      ) : (
        <>
          <ReportContent
            insights={data.report.insights}
            month={data.report.month}
            completedAt={data.report.completed_at}
          />

          {/* 이전/다음 달 네비게이션 — prev/next 중 하나라도 있을 때만 표시 */}
          {(hasPrevReport || hasNextReport) && (
            <div className="max-w-[640px] mx-auto px-4 py-8 flex border-t border-[var(--border-subtle)]">
              {hasPrevReport && (
                <Link
                  to={`/insights/reports/${prevMonthStr}`}
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  ← {prevMonthLabel} 리포트
                </Link>
              )}
              {hasNextReport && (
                <Link
                  to={`/insights/reports/${nextMonthStr}`}
                  className="ml-auto text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {nextMonthLabel} 리포트 →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

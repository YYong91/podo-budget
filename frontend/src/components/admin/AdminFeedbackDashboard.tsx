/* Admin 피드백 관리 — 피드백 목록 + 상태 필터 + 상태 변경 */

import { useEffect, useState } from 'react'
import { MessageSquare, Bug, Lightbulb } from 'lucide-react'
import { feedbackApi } from '../../api/feedback'
import { useToast } from '../../hooks/useToast'
import type { Feedback, FeedbackStatus, FeedbackType } from '../../types'

const STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: '신규', color: 'bg-red-100 text-red-600' },
  read: { label: '확인', color: 'bg-yellow-100 text-yellow-600' },
  done: { label: '완료', color: 'bg-green-100 text-green-600' },
}

const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  feature: { label: '기능 요청', icon: Lightbulb },
  bug: { label: '버그', icon: Bug },
}

export default function AdminFeedbackDashboard() {
  const { addToast } = useToast()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'all'>('all')

  const loadFeedbacks = async () => {
    try {
      const res = await feedbackApi.getAll()
      setFeedbacks(res.data)
    } catch {
      addToast('error', '피드백 로딩에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFeedbacks() }, [])

  const handleStatusChange = async (id: number, newStatus: FeedbackStatus) => {
    try {
      const res = await feedbackApi.updateStatus(id, newStatus)
      setFeedbacks(prev => prev.map(f => f.id === id ? res.data : f))
      addToast('success', '상태가 변경되었습니다')
    } catch {
      addToast('error', '상태 변경에 실패했습니다')
    }
  }

  // 필터 적용
  const filtered = feedbacks.filter(f => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false
    if (typeFilter !== 'all' && f.type !== typeFilter) return false
    return true
  })

  // 상태별 건수
  const statusCounts = feedbacks.reduce<Record<string, number>>((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full border-b-2 border-grape-600 w-6 h-6" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 상태 필터 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all' as const, label: '전체', count: feedbacks.length },
          { key: 'new' as const, label: '신규', count: statusCounts['new'] || 0 },
          { key: 'read' as const, label: '확인', count: statusCounts['read'] || 0 },
          { key: 'done' as const, label: '완료', count: statusCounts['done'] || 0 },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === key
                ? 'bg-grape-600 text-white'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* 유형 필터 */}
      <div className="flex gap-2">
        {[
          { key: 'all' as const, label: '전체' },
          { key: 'feature' as const, label: '기능 요청' },
          { key: 'bug' as const, label: '버그' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === key
                ? 'bg-warm-700 text-white'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 피드백 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-default)] px-4 py-12 text-center text-[var(--text-muted)] text-sm">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          피드백이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => {
            const typeMeta = TYPE_META[fb.type]
            const statusMeta = STATUS_META[fb.status] ?? { label: fb.status, color: 'bg-[var(--surface-hover)] text-[var(--text-secondary)]' }
            const TypeIcon = typeMeta?.icon ?? MessageSquare

            return (
              <div key={fb.id} className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-default)] p-4">
                {/* 헤더: 유형 뱃지 + 상태 드롭다운 + 시간 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                    <TypeIcon className="w-3 h-3" />
                    {typeMeta?.label ?? fb.type}
                  </span>

                  {/* 상태 변경 드롭다운 */}
                  <select
                    value={fb.status}
                    onChange={(e) => handleStatusChange(fb.id, e.target.value as FeedbackStatus)}
                    className={`${statusMeta.color} text-[11px] font-medium px-2 py-0.5 rounded-md border-0 cursor-pointer`}
                  >
                    <option value="new">신규</option>
                    <option value="read">확인</option>
                    <option value="done">완료</option>
                  </select>

                  <span className="text-[11px] text-[var(--text-muted)] ml-auto">
                    {fb.username && <>{fb.username} · </>}
                    {new Date(fb.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                {/* 제목 + 내용 */}
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{fb.title}</h4>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{fb.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

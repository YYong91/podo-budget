/**
 * @file FeedbackPage.tsx
 * @description 피드백 페이지 - 기능 요청/버그 신고 제출 및 조회
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Bug, Lightbulb, Send } from 'lucide-react'
import { feedbackApi } from '../api/feedback'
import type { Feedback, FeedbackStatus, FeedbackType } from '../types'

const STATUS_LABELS: Record<FeedbackStatus, { text: string; className: string }> = {
  new: { text: '접수', className: 'bg-[var(--surface-hover)] text-[var(--text-secondary)]' },
  read: { text: '확인', className: 'bg-grape-100 text-grape-600' },
  done: { text: '완료', className: 'bg-leaf-100 text-leaf-600' },
}

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>('feature')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [myFeedbacks, setMyFeedbacks] = useState<Feedback[]>([])
  const [adminFeedbacks, setAdminFeedbacks] = useState<Feedback[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const loadData = async () => {
    try {
      const mine = await feedbackApi.getMine()
      setMyFeedbacks(mine.data)
    } catch {
      /* 무시 */
    }

    try {
      const all = await feedbackApi.getAll()
      setAdminFeedbacks(all.data)
      setIsAdmin(true)
    } catch {
      // 403이면 관리자가 아님 — 정상
      setIsAdmin(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해주세요')
      return
    }
    setSubmitting(true)
    try {
      await feedbackApi.create({ type, title: title.trim(), content: content.trim() })
      toast.success('피드백이 제출되었습니다!')
      setTitle('')
      setContent('')
      await loadData()
    } catch {
      toast.error('제출에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (id: number, status: FeedbackStatus) => {
    try {
      await feedbackApi.updateStatus(id, status)
      await loadData()
    } catch {
      toast.error('상태 변경에 실패했습니다')
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/settings" aria-label="뒤로가기" className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] inline-block">
        <ArrowLeft className="w-5 h-5" />
      </Link>

      {/* 제출 폼 */}
      <form onSubmit={handleSubmit} className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">피드백 보내기</h2>

        {/* 유형 토글 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('feature')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              type === 'feature'
                ? 'bg-grape-600 text-white'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            기능 요청
          </button>
          <button
            type="button"
            onClick={() => setType('bug')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              type === 'bug'
                ? 'bg-red-600 text-white'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Bug className="w-4 h-4" />
            버그 신고
          </button>
        </div>

        {/* 제목 */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          maxLength={200}
          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300"
        />

        {/* 내용 */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="자세한 내용을 적어주세요"
          rows={4}
          maxLength={5000}
          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300 resize-none"
        />

        <button
          type="submit"
          disabled={submitting || !title.trim() || !content.trim()}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-grape-600 text-white text-sm font-medium hover:bg-grape-700 disabled:opacity-50 transition-colors"
        >
          <Send className="w-4 h-4" />
          {submitting ? '제출 중...' : '보내기'}
        </button>
      </form>

      {/* 내 피드백 목록 */}
      {myFeedbacks.length > 0 && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">내 피드백</h2>
          <div className="space-y-3">
            {myFeedbacks.map((fb) => (
              <FeedbackCard key={fb.id} feedback={fb} />
            ))}
          </div>
        </div>
      )}

      {/* 관리자 영역 */}
      {isAdmin && adminFeedbacks && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">전체 피드백 (관리자)</h2>
          {adminFeedbacks.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">아직 피드백이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {adminFeedbacks.map((fb) => (
                <FeedbackCard key={fb.id} feedback={fb} showUser onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FeedbackCard({
  feedback,
  showUser,
  onStatusChange,
}: {
  feedback: Feedback
  showUser?: boolean
  onStatusChange?: (id: number, status: FeedbackStatus) => void
}) {
  const statusInfo = STATUS_LABELS[feedback.status]
  const isFeature = feedback.type === 'feature'
  const date = new Date(feedback.created_at).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="border border-[var(--border-subtle)] rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
            isFeature ? 'bg-grape-50 text-grape-600' : 'bg-red-100 text-red-600'
          }`}>
            {isFeature ? '기능' : '버그'}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">{feedback.title}</span>
        </div>
        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.className}`}>
          {statusInfo.text}
        </span>
      </div>
      <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{feedback.content}</p>
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{showUser && feedback.username ? `${feedback.username} · ` : ''}{date}</span>
        {onStatusChange && (
          <div className="flex gap-1">
            {(['new', 'read', 'done'] as FeedbackStatus[])
              .filter((s) => s !== feedback.status)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(feedback.id, s)}
                  className="px-2 py-0.5 rounded text-xs border border-[var(--border-default)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  {STATUS_LABELS[s].text}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

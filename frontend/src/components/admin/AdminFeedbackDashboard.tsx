/* Admin 피드백 대시보드 — 상태별/유형별 분포 */

import { MessageSquare, Bug, Lightbulb, CheckCircle } from 'lucide-react'
import type { FeedbackStats } from '../../types'

interface Props {
  data: FeedbackStats
}

export default function AdminFeedbackDashboard({ data }: Props) {
  const statusLabels: Record<string, { label: string; color: string }> = {
    new: { label: '신규', color: 'bg-red-100 text-red-700' },
    read: { label: '확인', color: 'bg-yellow-100 text-yellow-700' },
    done: { label: '완료', color: 'bg-green-100 text-green-700' },
  }

  return (
    <div className="space-y-6">
      {/* 전체 수 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <div className="flex items-center gap-2 text-warm-500 mb-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-medium">전체</span>
          </div>
          <div className="text-2xl font-bold text-warm-900">{data.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <div className="flex items-center gap-2 text-warm-500 mb-1">
            <Lightbulb className="w-4 h-4" />
            <span className="text-xs font-medium">기능 요청</span>
          </div>
          <div className="text-2xl font-bold text-grape-600">{data.by_type.feature ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <div className="flex items-center gap-2 text-warm-500 mb-1">
            <Bug className="w-4 h-4" />
            <span className="text-xs font-medium">버그 리포트</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{data.by_type.bug ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <div className="flex items-center gap-2 text-warm-500 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">처리 완료</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{data.by_status.done ?? 0}</div>
        </div>
      </div>

      {/* 상태별 분포 */}
      <div className="bg-white rounded-xl p-4 border border-warm-200">
        <h3 className="text-sm font-semibold text-warm-700 mb-3">상태별 분포</h3>
        <div className="flex gap-3">
          {Object.entries(data.by_status).map(([status, count]) => {
            const meta = statusLabels[status] ?? { label: status, color: 'bg-warm-100 text-warm-700' }
            return (
              <div key={status} className={`${meta.color} rounded-lg px-4 py-2 text-center flex-1`}>
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs">{meta.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * @file InvitationsTab.tsx
 * @description 가구 초대 관리 탭 컴포넌트
 * 초대 목록 표시, 초대 링크 복사, 초대 취소 기능을 제공한다.
 */

import { Link2 } from 'lucide-react'
import type { HouseholdInvitation } from '../../types'

interface InvitationsTabProps {
  /** 초대 목록 */
  invitations: HouseholdInvitation[]
  /** 초대 모달 열기 핸들러 */
  onOpenInviteModal: () => void
  /** 초대 취소 핸들러 */
  onCancelInvitation: (invitationId: number) => Promise<void>
  /** 초대 링크 복사 핸들러 */
  onCopyInviteLink: (token: string) => Promise<void>
}

/** 상태 텍스트 매핑 */
const STATUS_TEXT: Record<string, string> = {
  pending: '대기 중',
  accepted: '수락됨',
  rejected: '거절됨',
  expired: '만료됨',
}

/** 상태별 배지 색상 */
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-600',
  accepted: 'bg-green-100 text-green-600',
  rejected: 'bg-warm-100 text-warm-600',
  expired: 'bg-warm-100 text-[var(--text-muted)]',
}

export default function InvitationsTab({
  invitations,
  onOpenInviteModal,
  onCancelInvitation,
  onCopyInviteLink,
}: InvitationsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={onOpenInviteModal}
          className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
        >
          + 멤버 초대
        </button>
      </div>

      {invitations.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">
          보낸 초대가 없습니다
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
          <div className="divide-y divide-[var(--border-default)]">
            {invitations.map((inv) => {
              const isPending = inv.status === 'pending'

              return (
                <div key={inv.id} className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {inv.invitee_email}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[inv.status] || ''}`}>
                        {STATUS_TEXT[inv.status] || inv.status}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {inv.role === 'admin' ? '관리자' : '멤버'}
                      </span>
                    </div>
                  </div>
                  {isPending && (
                    <div className="flex items-center gap-2 ml-3">
                      {inv.token && (
                        <button
                          onClick={() => onCopyInviteLink(inv.token!)}
                          className="text-xs text-grape-600 hover:text-grape-700 font-medium flex items-center gap-1"
                          title="초대 링크 복사"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          링크 복사
                        </button>
                      )}
                      <button
                        onClick={() => onCancelInvitation(inv.id)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

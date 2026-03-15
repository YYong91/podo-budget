/**
 * @file OnboardingPage.tsx
 * @description 온보딩 페이지 — 가계부가 없는 사용자가 첫 가계부를 생성하거나 초대를 수락하는 페이지
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2, Mail } from 'lucide-react'
import { onboardingApi } from '../api/onboarding'
import { useHouseholdStore } from '../stores/useHouseholdStore'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { myInvitations, fetchHouseholds, fetchMyInvitations, acceptInvitation } = useHouseholdStore()

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null)

  const pendingInvitations = myInvitations.filter((inv) => inv.status === 'pending')

  // 새 가계부 만들기
  const handleCreate = async () => {
    setLoading(true)
    try {
      await onboardingApi.createHousehold(name.trim() || undefined)
      await fetchHouseholds()
      toast.success('가계부가 생성되었습니다!')
      navigate('/', { replace: true })
    } catch {
      toast.error('가계부 생성에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  // 초대 수락
  const handleAccept = async (token: string, householdName?: string) => {
    setAcceptingToken(token)
    try {
      await acceptInvitation(token)
      toast.success(`${householdName || '가계부'}에 참여했습니다!`)
      navigate('/', { replace: true })
    } catch {
      toast.error('초대 수락에 실패했습니다')
      // 실패 시 초대 목록 새로고침 (만료 등)
      await fetchMyInvitations().catch(() => {})
    } finally {
      setAcceptingToken(null)
    }
  }

  const isDisabled = loading || !!acceptingToken

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* 아이콘 + 제목 */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🍇</div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">포도가계부 시작하기</h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            {pendingInvitations.length > 0
              ? '초대받은 가계부에 참여하거나 새로 만들어보세요'
              : '나만의 가계부를 만들어보세요'}
          </p>
        </div>

        {/* 받은 초대 섹션 */}
        {pendingInvitations.length > 0 && (
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
              <Mail className="w-4 h-4" />
              <span>받은 초대 ({pendingInvitations.length}건)</span>
            </div>

            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 bg-grape-50 dark:bg-grape-900/20 rounded-xl"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {inv.household_name || '가계부'}
                  </p>
                  {inv.inviter_username && (
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {inv.inviter_username}님이 초대
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleAccept(inv.token!, inv.household_name)}
                  disabled={isDisabled}
                  className="ml-3 shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  {acceptingToken === inv.token && <Loader2 className="w-3 h-3 animate-spin" />}
                  참여
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 구분선 (초대가 있을 때만) */}
        {pendingInvitations.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border-default)]" />
            <span className="text-xs text-[var(--text-muted)]">또는</span>
            <div className="flex-1 h-px bg-[var(--border-default)]" />
          </div>
        )}

        {/* 새 가계부 만들기 */}
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              가계부 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="가계부 이름 (비워두면 기본 이름)"
              className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-grape-500/40 focus:border-grape-400"
              disabled={isDisabled}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={isDisabled}
            className="w-full py-3 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            새 가계부 만들기
          </button>
        </div>
      </div>
    </div>
  )
}

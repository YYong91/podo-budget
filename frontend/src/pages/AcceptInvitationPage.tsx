/**
 * @file AcceptInvitationPage.tsx
 * @description 토큰 기반 초대 수락 페이지
 * URL 쿼리 파라미터의 token을 사용하여 초대를 수락하거나 거절한다.
 * Layout 밖에서 렌더링되므로 독립 레이아웃을 가진다.
 */

import type { } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'

export default function AcceptInvitationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()

  const { acceptInvitation, rejectInvitation, clearError } = useHouseholdStore()

  const [isProcessing, setIsProcessing] = useState(false)
  const [action, setAction] = useState<'accept' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const token = searchParams.get('token')

  useEffect(() => {
    return () => { clearError() }
  }, [clearError])

  const handleAccept = async () => {
    if (!token) {
      setError('유효하지 않은 초대 링크입니다')
      return
    }

    setIsProcessing(true)
    setAction('accept')
    setError(null)

    try {
      const result = await acceptInvitation(token)
      addToast('success', TOAST.HOUSEHOLD_JOINED(result.household_name))
      navigate('/home', { replace: true })
    } catch (err) {
      console.error('초대 수락 실패:', err)
      setError('초대 수락에 실패했습니다. 초대가 만료되었거나 이미 처리되었을 수 있습니다.')
      addToast('error', TOAST.INVITE_ACCEPT_FAILED)
    } finally {
      setIsProcessing(false)
      setAction(null)
    }
  }

  const handleReject = async () => {
    if (!token) {
      setError('유효하지 않은 초대 링크입니다')
      return
    }

    if (!confirm('정말 이 초대를 거절하시겠습니까?')) return

    setIsProcessing(true)
    setAction('reject')
    setError(null)

    try {
      await rejectInvitation(token)
      addToast('success', TOAST.INVITE_REJECTED)
      navigate('/home', { replace: true })
    } catch (err) {
      console.error('초대 거절 실패:', err)
      setError('초대 거절에 실패했습니다')
      addToast('error', TOAST.INVITE_REJECT_FAILED)
    } finally {
      setIsProcessing(false)
      setAction(null)
    }
  }

  // 토큰 없음
  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-6xl">📨</div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">유효하지 않은 초대 링크입니다</h1>
          <p className="text-sm text-[var(--text-tertiary)]">초대 링크가 올바르지 않습니다. 초대를 보낸 사람에게 다시 요청해주세요.</p>
          <button
            onClick={() => navigate('/home')}
            className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700"
          >
            홈으로
          </button>
        </div>
      </div>
    )
  }

  // 에러 발생
  if (error) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-6xl">📨</div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">초대 처리에 실패했습니다</h1>
          <p className="text-sm text-[var(--text-tertiary)]">{error}</p>
          <button
            onClick={() => navigate('/home')}
            className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700"
          >
            홈으로
          </button>
        </div>
      </div>
    )
  }

  // 정상 렌더링
  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📨</div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            가구 초대를 받으셨습니다
          </h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            아래 버튼을 눌러 초대를 수락하거나 거절하세요
          </p>
        </div>

        {/* 버튼 */}
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6 space-y-3">
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing && action === 'accept' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>처리 중...</span>
              </div>
            ) : (
              '초대 수락'
            )}
          </button>

          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="w-full px-4 py-3 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--input-border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing && action === 'reject' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-warm-700" />
                <span>처리 중...</span>
              </div>
            ) : (
              '초대 거절'
            )}
          </button>

          <button
            onClick={() => navigate('/home')}
            disabled={isProcessing}
            className="w-full px-4 py-3 text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            나중에 결정
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-[var(--text-tertiary)]">
            이미 로그인한 상태에서만 초대를 수락할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  )
}

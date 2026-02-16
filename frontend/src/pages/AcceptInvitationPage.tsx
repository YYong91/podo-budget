/**
 * @file AcceptInvitationPage.tsx
 * @description 토큰 기반 초대 수락 페이지
 * URL 쿼리 파라미터의 token을 사용하여 초대를 수락하거나 거절한다.
 * 주로 이메일 링크를 통해 접근한다.
 */

import type { } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import EmptyState from '../components/EmptyState'

export default function AcceptInvitationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()

  // Zustand 스토어
  const { acceptInvitation, rejectInvitation, clearError } = useHouseholdStore()

  // 로컬 상태
  const [isProcessing, setIsProcessing] = useState(false)
  const [action, setAction] = useState<'accept' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // URL에서 token 추출
  const token = searchParams.get('token')

  /**
   * 에러 초기화
   */
  useEffect(() => {
    return () => {
      clearError()
    }
  }, [clearError])

  /**
   * 초대 수락 핸들러
   */
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
      addToast('success', `${result.household_name} 가구에 가입했습니다`)
      // 가구 상세 페이지로 이동
      navigate(`/households/${result.household_id}`)
    } catch (err) {
      console.error('초대 수락 실패:', err)
      setError('초대 수락에 실패했습니다. 초대가 만료되었거나 이미 처리되었을 수 있습니다.')
      addToast('error', '초대 수락에 실패했습니다')
    } finally {
      setIsProcessing(false)
      setAction(null)
    }
  }

  /**
   * 초대 거절 핸들러
   */
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
      addToast('success', '초대를 거절했습니다')
      // 가구 목록 페이지로 이동
      navigate('/households')
    } catch (err) {
      console.error('초대 거절 실패:', err)
      setError('초대 거절에 실패했습니다')
      addToast('error', '초대 거절에 실패했습니다')
    } finally {
      setIsProcessing(false)
      setAction(null)
    }
  }

  /**
   * 토큰이 없는 경우
   */
  if (!token) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="유효하지 않은 초대 링크입니다"
          description="초대 링크가 올바르지 않습니다. 초대를 보낸 사람에게 다시 요청해주세요."
          action={{
            label: '가구 목록으로',
            onClick: () => navigate('/households'),
          }}
        />
      </div>
    )
  }

  /**
   * 에러 발생 시
   */
  if (error) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="초대 처리에 실패했습니다"
          description={error}
          action={{
            label: '가구 목록으로',
            onClick: () => navigate('/households'),
          }}
          secondaryAction={{
            label: '받은 초대 확인',
            onClick: () => navigate('/invitations'),
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="max-w-md mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📨</div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            가구 초대를 받으셨습니다
          </h1>
          <p className="text-sm text-stone-500">
            아래 버튼을 눌러 초대를 수락하거나 거절하세요
          </p>
        </div>

        {/* 버튼 */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-3">
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
            className="w-full px-4 py-3 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing && action === 'reject' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-stone-700" />
                <span>처리 중...</span>
              </div>
            ) : (
              '초대 거절'
            )}
          </button>

          <button
            onClick={() => navigate('/households')}
            disabled={isProcessing}
            className="w-full px-4 py-3 text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            나중에 결정
          </button>
        </div>

        {/* 추가 안내 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-stone-500">
            이미 로그인한 상태에서만 초대를 수락할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * @file InvitationListPage.tsx
 * @description 내가 받은 초대 목록 페이지
 * 받은 초대를 수락하거나 거절할 수 있다.
 */

import type { } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'

/**
 * 날짜 포맷팅 함수 (YYYY.MM.DD HH:mm)
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  const dateOnly = date.toISOString().slice(0, 10).replace(/-/g, '.')
  const time = date.toTimeString().slice(0, 5)
  return `${dateOnly} ${time}`
}

/**
 * 역할 한글 변환 함수
 */
function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    admin: '관리자',
    member: '멤버',
  }
  return roleMap[role] || role
}

/**
 * 만료일까지 남은 시간 계산
 */
function getExpiryStatus(expiresAt: string): {
  isExpired: boolean
  message: string
  color: string
} {
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffMs < 0) {
    return {
      isExpired: true,
      message: '만료됨',
      color: 'text-rose-600',
    }
  }

  if (diffDays > 0) {
    return {
      isExpired: false,
      message: `${diffDays}일 후 만료`,
      color: 'text-green-600',
    }
  }

  if (diffHours > 0) {
    return {
      isExpired: false,
      message: `${diffHours}시간 후 만료`,
      color: 'text-yellow-600',
    }
  }

  return {
    isExpired: false,
    message: '곧 만료',
    color: 'text-rose-600',
  }
}

export default function InvitationListPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()

  // Zustand 스토어
  const {
    myInvitations,
    isLoading,
    error,
    fetchMyInvitations,
    acceptInvitation,
    rejectInvitation,
    clearError,
  } = useHouseholdStore()

  // 로컬 상태
  const [processingToken, setProcessingToken] = useState<string | null>(null)

  /**
   * 컴포넌트 마운트 시 초대 목록 조회
   */
  useEffect(() => {
    fetchMyInvitations().catch((err) => {
      console.error('초대 목록 조회 실패:', err)
      addToast('error', '초대 목록을 불러오는데 실패했습니다')
    })
  }, [fetchMyInvitations, addToast])

  /**
   * 에러 발생 시 자동으로 토스트 표시
   */
  useEffect(() => {
    if (error) {
      addToast('error', error)
      clearError()
    }
  }, [error, addToast, clearError])

  /**
   * 초대 수락 핸들러
   */
  const handleAccept = async (token: string) => {
    setProcessingToken(token)
    try {
      const result = await acceptInvitation(token)
      addToast('success', `${result.household_name} 가구에 가입했습니다`)
      // 가구 상세 페이지로 이동
      navigate(`/households/${result.household_id}`)
    } catch (err) {
      console.error('초대 수락 실패:', err)
      addToast('error', '초대 수락에 실패했습니다')
    } finally {
      setProcessingToken(null)
    }
  }

  /**
   * 초대 거절 핸들러
   */
  const handleReject = async (token: string) => {
    if (!confirm('정말 이 초대를 거절하시겠습니까?')) return

    setProcessingToken(token)
    try {
      await rejectInvitation(token)
      addToast('success', '초대를 거절했습니다')
    } catch (err) {
      console.error('초대 거절 실패:', err)
      addToast('error', '초대 거절에 실패했습니다')
    } finally {
      setProcessingToken(null)
    }
  }

  /**
   * 로딩 상태
   */
  if (isLoading && myInvitations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    )
  }

  /**
   * 에러 상태
   */
  if (error && myInvitations.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-stone-900">받은 초대</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200">
          <ErrorState onRetry={fetchMyInvitations} />
        </div>
      </div>
    )
  }

  // pending 상태인 초대만 필터링
  const pendingInvitations = myInvitations.filter((inv) => inv.status === 'pending')

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/households')}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-stone-900">받은 초대</h1>
        </div>
        <p className="text-sm text-stone-500 mt-1">
          다른 사람이 보낸 가구 초대를 확인하고 수락하세요
        </p>
      </div>

      {/* 초대 목록 */}
      {pendingInvitations.length === 0 ? (
        <EmptyState
          title="받은 초대가 없습니다"
          description="다른 사람으로부터 초대를 받으면 여기에 표시됩니다"
          action={{
            label: '가구 목록으로',
            onClick: () => navigate('/households'),
          }}
        />
      ) : (
        <div className="space-y-4">
          {pendingInvitations.map((invitation) => {
            const expiryStatus = getExpiryStatus(invitation.expires_at)
            const isProcessing = processingToken === invitation.token

            return (
              <div
                key={invitation.id}
                className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-stone-900 mb-1">
                      {invitation.household_name || '가구 이름 없음'}
                    </h3>
                    <div className="space-y-1 text-sm text-stone-600">
                      {invitation.inviter_username && (
                        <p>
                          <span className="font-medium">초대자:</span>{' '}
                          {invitation.inviter_username}
                        </p>
                      )}
                      <p>
                        <span className="font-medium">역할:</span>{' '}
                        {formatRole(invitation.role)}
                      </p>
                      <p>
                        <span className="font-medium">초대일:</span>{' '}
                        {formatDateTime(invitation.created_at)}
                      </p>
                      <p className={`font-medium ${expiryStatus.color}`}>
                        {expiryStatus.message}
                      </p>
                    </div>
                  </div>

                  {/* 상태 배지 */}
                  {expiryStatus.isExpired && (
                    <span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-600">
                      만료됨
                    </span>
                  )}
                </div>

                {/* 버튼 */}
                {!expiryStatus.isExpired && invitation.token && (
                  <div className="flex gap-3 pt-3 border-t border-stone-100">
                    <button
                      onClick={() => handleReject(invitation.token!)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? '처리 중...' : '거절'}
                    </button>
                    <button
                      onClick={() => handleAccept(invitation.token!)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? '처리 중...' : '수락'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

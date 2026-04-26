/**
 * @file HouseholdDetailPage.tsx
 * @description 공유 가계부 상세 페이지
 * 탭 라우터 역할만 수행하며, 각 탭은 별도 컴포넌트로 분리되어 있다.
 */

import type { } from 'react'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import { useAuth } from '../contexts/AuthContext'
import { useHouseholdRole } from '../hooks/useHouseholdRole'
import InviteMemberModal from '../components/InviteMemberModal'
import EmptyState from '../components/EmptyState'
import { Skeleton } from '../components/skeleton/Skeleton'
import ErrorState from '../components/ErrorState'
import MembersTab from '../components/household/MembersTab'
import InvitationsTab from '../components/household/InvitationsTab'
import SettingsTab from '../components/household/SettingsTab'
import type { InviteMemberDto, MemberRole } from '../types'
import { formatRole, getRoleBadgeColor } from '../utils/household'
import { trackEvent } from '../utils/analytics'

type TabType = 'members' | 'invitations' | 'settings'

function HouseholdDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card-surface p-4 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HouseholdDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user } = useAuth()

  // Zustand 스토어
  const {
    currentHousehold,
    isLoading,
    error,
    householdInvitations,
    fetchHouseholdDetail,
    fetchHouseholdInvitations,
    updateHousehold,
    deleteHousehold,
    inviteMember,
    cancelInvitation,
    updateMemberRole,
    removeMember,
    leaveHousehold,
    clearError,
    clearCurrentHousehold,
  } = useHouseholdStore()

  // 역할 기반 권한
  const { isOwner, isAdmin, canManageMember } = useHouseholdRole(currentHousehold)

  // 로컬 상태
  const [activeTab, setActiveTab] = useState<TabType>('members')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<{
    message: string
    confirmLabel?: string
    onConfirm: () => Promise<void>
  } | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  /**
   * 컴포넌트 마운트 시 상세 정보 조회
   */
  useEffect(() => {
    if (id) {
      fetchHouseholdDetail(Number(id)).catch((err) => {
        console.error('가구 상세 조회 실패:', err)
        addToast('error', TOAST.LOAD_FAILED)
      })
    }

    // 컴포넌트 언마운트 시 초기화
    return () => {
      clearCurrentHousehold()
    }
  }, [id, fetchHouseholdDetail, addToast, clearCurrentHousehold])

  /**
   * admin인 경우 초대 목록도 조회
   */
  useEffect(() => {
    if (id && currentHousehold && (currentHousehold.my_role === 'owner' || currentHousehold.my_role === 'admin')) {
      fetchHouseholdInvitations(Number(id)).catch(() => {})
    }
  }, [id, currentHousehold?.my_role, fetchHouseholdInvitations])

  /**
   * 에러 발생 시 자동으로 토스트 표시
   */
  useEffect(() => {
    if (error) {
      addToast('error', TOAST.PROCESS_FAILED)
      clearError()
    }
  }, [error, addToast, clearError])

  /**
   * 멤버 초대 핸들러
   */
  const handleInvite = async (data: InviteMemberDto) => {
    if (!id) return

    setIsInviting(true)
    try {
      const result = await inviteMember(Number(id), data)
      if (result.email_sent === false && result.token) {
        // 이메일 미발송 — 링크 복사 안내
        const link = `${window.location.origin}/invitations/accept?token=${result.token}`
        await navigator.clipboard.writeText(link)
        addToast('warning', TOAST.INVITE_LINK_COPIED)
      } else {
        addToast('success', TOAST.INVITE_SENT)
      }
      trackEvent('member_invited')
      setShowInviteModal(false)
      // 초대 목록 새로고침
      await fetchHouseholdInvitations(Number(id)).catch(() => {})
    } catch (err) {
      console.error('멤버 초대 실패:', err)
      addToast('error', TOAST.PROCESS_FAILED)
    } finally {
      setIsInviting(false)
    }
  }

  /**
   * 역할 변경 핸들러
   */
  const handleRoleChange = async (userId: number, newRole: MemberRole) => {
    if (!id) return

    try {
      await updateMemberRole(Number(id), userId, newRole)
      addToast('success', TOAST.ROLE_CHANGED)
    } catch (err) {
      console.error('역할 변경 실패:', err)
      addToast('error', TOAST.PROCESS_FAILED)
    }
  }

  /**
   * 멤버 내보내기 핸들러
   */
  const handleRemoveMember = (userId: number, username: string) => {
    if (!id) return
    setPendingConfirm({
      message: `${username}님을 가구에서 내보내시겠습니까?`,
      confirmLabel: '내보내기',
      onConfirm: async () => {
        try {
          await removeMember(Number(id), userId)
          addToast('success', TOAST.MEMBER_REMOVED)
        } catch (err) {
          console.error('멤버 내보내기 실패:', err)
          addToast('error', TOAST.PROCESS_FAILED)
        }
      },
    })
  }

  /**
   * 가구 탈퇴 핸들러
   */
  const handleLeave = () => {
    if (!id) return
    setPendingConfirm({
      message: '이 가구에서 탈퇴하시겠습니까?',
      confirmLabel: '탈퇴',
      onConfirm: async () => {
        try {
          await leaveHousehold(Number(id))
          addToast('success', TOAST.HOUSEHOLD_LEFT)
          navigate('/households')
        } catch (err) {
          console.error('가구 탈퇴 실패:', err)
          addToast('error', TOAST.PROCESS_FAILED)
        }
      },
    })
  }

  /**
   * 가구 정보 수정 핸들러
   */
  const handleUpdateHousehold = async (formData: { name?: string; description?: string }) => {
    if (!id) return

    try {
      await updateHousehold(Number(id), formData)
      addToast('success', TOAST.HOUSEHOLD_UPDATED)
    } catch (err) {
      console.error('가구 수정 실패:', err)
      addToast('error', TOAST.SAVE_FAILED)
    }
  }

  /**
   * 가구 삭제 핸들러 (owner만 가능)
   */
  const handleDelete = () => {
    if (!id) return
    setPendingConfirm({
      message: '가구를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await deleteHousehold(Number(id))
          addToast('success', TOAST.HOUSEHOLD_DELETED)
          navigate('/households')
        } catch (err) {
          console.error('가구 삭제 실패:', err)
          addToast('error', TOAST.DELETE_FAILED)
        }
      },
    })
  }

  /**
   * 초대 취소 핸들러
   */
  const handleCancelInvitation = (invitationId: number) => {
    if (!id) return
    const inv = householdInvitations.find(i => i.id === invitationId)
    if (!inv) return
    setPendingConfirm({
      message: `${inv.invitee_email}의 초대를 취소하시겠습니까?`,
      confirmLabel: '초대 취소',
      onConfirm: async () => {
        try {
          await cancelInvitation(Number(id), invitationId)
          addToast('success', TOAST.INVITE_CANCELLED)
        } catch {
          addToast('error', TOAST.PROCESS_FAILED)
        }
      },
    })
  }

  /**
   * 초대 링크 복사 핸들러
   */
  const handleCopyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/invitations/accept?token=${token}`
    await navigator.clipboard.writeText(link)
    addToast('success', TOAST.INVITE_LINK_COPIED)
  }

  /**
   * 로딩 상태
   */
  if (isLoading && !currentHousehold) {
    return <HouseholdDetailSkeleton />
  }

  /**
   * 에러 상태
   */
  if (error && !currentHousehold) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/households')} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]">
          <ErrorState onRetry={() => id && fetchHouseholdDetail(Number(id))} />
        </div>
      </div>
    )
  }

  /**
   * 가구 정보 없음
   */
  if (!currentHousehold) {
    return (
      <EmptyState
        title="가구를 찾을 수 없습니다"
        description="존재하지 않거나 접근 권한이 없는 가구입니다"
        action={{
          label: '가구 목록으로',
          onClick: () => navigate('/households'),
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/households')}
              aria-label="뒤로가기"
              className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <span
              className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(
                currentHousehold.my_role
              )}`}
            >
              {formatRole(currentHousehold.my_role)}
            </span>
          </div>
          {currentHousehold.description && (
            <p className="text-sm text-[var(--text-tertiary)] mt-1">
              {currentHousehold.description}
            </p>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-[var(--border-default)]">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-grape-600 text-grape-600'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            멤버
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('invitations')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'invitations'
                  ? 'border-grape-600 text-grape-600'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              초대
              {householdInvitations.filter(i => i.status === 'pending').length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-grape-500 rounded-full">
                  {householdInvitations.filter(i => i.status === 'pending').length}
                </span>
              )}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-grape-600 text-grape-600'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              설정
            </button>
          )}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'members' && (
        <MembersTab
          household={currentHousehold}
          currentUserId={user?.id ?? 0}
          canManageMember={canManageMember}
          onRoleChange={handleRoleChange}
          onRemoveMember={handleRemoveMember}
          onLeave={handleLeave}
        />
      )}

      {activeTab === 'invitations' && isAdmin && (
        <InvitationsTab
          invitations={householdInvitations}
          onOpenInviteModal={() => setShowInviteModal(true)}
          onCancelInvitation={handleCancelInvitation}
          onCopyInviteLink={handleCopyInviteLink}
        />
      )}

      {activeTab === 'settings' && isAdmin && (
        <SettingsTab
          household={currentHousehold}
          isOwner={isOwner}
          onUpdate={handleUpdateHousehold}
          onDelete={handleDelete}
        />
      )}

      {/* 멤버 초대 모달 */}
      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={handleInvite}
        isLoading={isInviting}
      />

      {/* ConfirmSheet — window.confirm() 대체. isConfirming 중에는 배경 탭으로 닫히지 않음 */}
      {pendingConfirm && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget && !isConfirming) setPendingConfirm(null) }}
          onKeyDown={(e) => { if (e.key === 'Escape' && !isConfirming) setPendingConfirm(null) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full bg-[var(--surface-card)] rounded-t-2xl shadow-lg border-t border-[var(--border-default)] p-5 space-y-4"
          >
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {pendingConfirm.message}
            </p>
            <div className="flex gap-2">
              <button
                disabled={isConfirming}
                onClick={() => setPendingConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                disabled={isConfirming}
                onClick={async () => {
                  setIsConfirming(true)
                  try {
                    await pendingConfirm.onConfirm()
                  } finally {
                    setIsConfirming(false)
                    setPendingConfirm(null)
                  }
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {isConfirming ? '처리 중...' : (pendingConfirm.confirmLabel ?? '확인')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

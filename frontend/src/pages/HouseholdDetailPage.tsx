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
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorState from '../components/ErrorState'
import MembersTab from '../components/household/MembersTab'
import InvitationsTab from '../components/household/InvitationsTab'
import SettingsTab from '../components/household/SettingsTab'
import type { InviteMemberDto, MemberRole } from '../types'
import { formatRole, getRoleBadgeColor } from '../utils/household'
import { trackEvent } from '../utils/analytics'

type TabType = 'members' | 'invitations' | 'settings'

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
  const handleRemoveMember = async (userId: number, username: string) => {
    if (!id) return
    if (!confirm(`정말 ${username}님을 내보내시겠습니까?`)) return

    try {
      await removeMember(Number(id), userId)
      addToast('success', TOAST.MEMBER_REMOVED)
    } catch (err) {
      console.error('멤버 내보내기 실패:', err)
      addToast('error', TOAST.PROCESS_FAILED)
    }
  }

  /**
   * 가구 탈퇴 핸들러
   */
  const handleLeave = async () => {
    if (!id) return
    if (!confirm('정말 이 가구에서 탈퇴하시겠습니까?')) return

    try {
      await leaveHousehold(Number(id))
      addToast('success', TOAST.HOUSEHOLD_LEFT)
      navigate('/households')
    } catch (err) {
      console.error('가구 탈퇴 실패:', err)
      addToast('error', TOAST.PROCESS_FAILED)
    }
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
  const handleDelete = async () => {
    if (!id) return
    if (!confirm('정말 이 가구를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return

    try {
      await deleteHousehold(Number(id))
      addToast('success', TOAST.HOUSEHOLD_DELETED)
      navigate('/households')
    } catch (err) {
      console.error('가구 삭제 실패:', err)
      addToast('error', TOAST.DELETE_FAILED)
    }
  }

  /**
   * 초대 취소 핸들러
   */
  const handleCancelInvitation = async (invitationId: number) => {
    if (!id) return
    const inv = householdInvitations.find(i => i.id === invitationId)
    if (inv && !confirm(`${inv.invitee_email}의 초대를 취소하시겠습니까?`)) return

    try {
      await cancelInvitation(Number(id), invitationId)
      addToast('success', TOAST.INVITE_CANCELLED)
    } catch {
      addToast('error', TOAST.PROCESS_FAILED)
    }
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
    return <LoadingSpinner />
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
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
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
    </div>
  )
}

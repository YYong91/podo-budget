/**
 * @file HouseholdDetailPage.tsx
 * @description 공유 가계부 상세 페이지
 * 멤버 목록, 초대, 역할 변경, 가구 설정 등을 관리한다.
 */

import type { } from 'react'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../contexts/AuthContext'
import InviteMemberModal from '../components/InviteMemberModal'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { InviteMemberDto, UpdateHouseholdDto, MemberRole } from '../types'

/**
 * 날짜 포맷팅 함수 (YYYY.MM.DD)
 */
function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, '.')
}

/**
 * 역할 한글 변환 함수
 */
function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    owner: '소유자',
    admin: '관리자',
    member: '멤버',
  }
  return roleMap[role] || role
}

/**
 * 역할별 배지 색상
 */
function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-100 text-purple-800'
    case 'admin':
      return 'bg-blue-100 text-blue-800'
    case 'member':
      return 'bg-warm-100 text-warm-800'
    default:
      return 'bg-warm-100 text-warm-800'
  }
}

type TabType = 'members' | 'settings'

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
    fetchHouseholdDetail,
    updateHousehold,
    deleteHousehold,
    inviteMember,
    updateMemberRole,
    removeMember,
    leaveHousehold,
    clearError,
    clearCurrentHousehold,
  } = useHouseholdStore()

  // 로컬 상태
  const [activeTab, setActiveTab] = useState<TabType>('members')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isInviting, setIsInviting] = useState(false)

  // 설정 탭 상태
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState<UpdateHouseholdDto>({
    name: '',
    description: '',
  })

  /**
   * 컴포넌트 마운트 시 상세 정보 조회
   */
  useEffect(() => {
    if (id) {
      fetchHouseholdDetail(Number(id)).catch((err) => {
        console.error('가구 상세 조회 실패:', err)
        addToast('error', '가구 정보를 불러오는데 실패했습니다')
      })
    }

    // 컴포넌트 언마운트 시 초기화
    return () => {
      clearCurrentHousehold()
    }
  }, [id, fetchHouseholdDetail, addToast, clearCurrentHousehold])

  /**
   * 가구 정보가 로드되면 폼 데이터 초기화
   */
  useEffect(() => {
    if (currentHousehold) {
      setFormData({
        name: currentHousehold.name,
        description: currentHousehold.description || '',
      })
    }
  }, [currentHousehold])

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
   * 멤버 초대 핸들러
   */
  const handleInvite = async (data: InviteMemberDto) => {
    if (!id) return

    setIsInviting(true)
    try {
      await inviteMember(Number(id), data)
      addToast('success', '초대를 전송했습니다')
      setShowInviteModal(false)
    } catch (err) {
      console.error('멤버 초대 실패:', err)
      addToast('error', '멤버 초대에 실패했습니다')
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
      addToast('success', '역할이 변경되었습니다')
    } catch (err) {
      console.error('역할 변경 실패:', err)
      addToast('error', '역할 변경에 실패했습니다')
    }
  }

  /**
   * 멤버 추방 핸들러
   */
  const handleRemoveMember = async (userId: number, username: string) => {
    if (!id) return
    if (!confirm(`정말 ${username}님을 추방하시겠습니까?`)) return

    try {
      await removeMember(Number(id), userId)
      addToast('success', '멤버를 추방했습니다')
    } catch (err) {
      console.error('멤버 추방 실패:', err)
      addToast('error', '멤버 추방에 실패했습니다')
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
      addToast('success', '가구에서 탈퇴했습니다')
      navigate('/households')
    } catch (err) {
      console.error('가구 탈퇴 실패:', err)
      addToast('error', '가구 탈퇴에 실패했습니다')
    }
  }

  /**
   * 가구 정보 수정 핸들러
   */
  const handleUpdateHousehold = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    try {
      await updateHousehold(Number(id), formData)
      addToast('success', '가구 정보가 수정되었습니다')
      setEditMode(false)
    } catch (err) {
      console.error('가구 수정 실패:', err)
      addToast('error', '가구 수정에 실패했습니다')
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
      addToast('success', '가구가 삭제되었습니다')
      navigate('/households')
    } catch (err) {
      console.error('가구 삭제 실패:', err)
      addToast('error', '가구 삭제에 실패했습니다')
    }
  }

  /**
   * 로딩 상태
   */
  if (isLoading && !currentHousehold) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grape-600" />
      </div>
    )
  }

  /**
   * 에러 상태
   */
  if (error && !currentHousehold) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-grape-700">가구 정보</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200">
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

  const isOwner = currentHousehold.my_role === 'owner'
  const isAdmin = currentHousehold.my_role === 'admin' || isOwner

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/households')}
              className="text-warm-400 hover:text-warm-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-grape-700">
              {currentHousehold.name}
            </h1>
            <span
              className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(
                currentHousehold.my_role
              )}`}
            >
              {formatRole(currentHousehold.my_role)}
            </span>
          </div>
          {currentHousehold.description && (
            <p className="text-sm text-warm-500 mt-1">
              {currentHousehold.description}
            </p>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-warm-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-grape-600 text-grape-600'
                : 'border-transparent text-warm-500 hover:text-warm-700'
            }`}
          >
            멤버
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-grape-600 text-grape-600'
                  : 'border-transparent text-warm-500 hover:text-warm-700'
              }`}
            >
              설정
            </button>
          )}
        </div>
      </div>

      {/* 멤버 탭 */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* 초대 버튼 (admin 이상) */}
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
              >
                + 멤버 초대
              </button>
            </div>
          )}

          {/* 멤버 목록 */}
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-warm-50 border-b border-warm-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-warm-500 uppercase tracking-wider">
                      이름
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-warm-500 uppercase tracking-wider">
                      이메일
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-warm-500 uppercase tracking-wider">
                      역할
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-warm-500 uppercase tracking-wider">
                      가입일
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-warm-500 uppercase tracking-wider">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-200">
                  {currentHousehold.members.map((member) => {
                    const isMe = member.user_id === user?.id
                    const canManage = isOwner && !isMe && member.role !== 'owner'

                    return (
                      <tr key={member.user_id} className="hover:bg-warm-50">
                        <td className="px-4 py-3 text-sm font-medium text-warm-900">
                          {member.username}
                          {isMe && (
                            <span className="ml-2 text-xs text-warm-500">(나)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-warm-600">
                          {member.email || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {canManage ? (
                            <select
                              value={member.role}
                              onChange={(e) =>
                                handleRoleChange(
                                  member.user_id,
                                  e.target.value as MemberRole
                                )
                              }
                              className="text-sm px-2 py-1 border border-warm-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                            >
                              <option value="member">멤버</option>
                              <option value="admin">관리자</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-block text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(
                                member.role
                              )}`}
                            >
                              {formatRole(member.role)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-warm-600">
                          {formatDate(member.joined_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {canManage ? (
                            <button
                              onClick={() =>
                                handleRemoveMember(member.user_id, member.username)
                              }
                              className="text-rose-600 hover:text-rose-700 font-medium"
                            >
                              추방
                            </button>
                          ) : isMe && member.role !== 'owner' ? (
                            <button
                              onClick={handleLeave}
                              className="text-rose-600 hover:text-rose-700 font-medium"
                            >
                              탈퇴
                            </button>
                          ) : (
                            <span className="text-warm-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 설정 탭 */}
      {activeTab === 'settings' && isAdmin && (
        <div className="space-y-6">
          {/* 가구 정보 수정 */}
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
            <h2 className="text-lg font-semibold text-warm-900 mb-4">
              가구 정보
            </h2>

            <form onSubmit={handleUpdateHousehold} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-warm-700 mb-1"
                >
                  가구 이름
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-warm-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  disabled={!editMode}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-warm-700 mb-1"
                >
                  설명
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-warm-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500 resize-none"
                  rows={3}
                  disabled={!editMode}
                />
              </div>

              <div className="flex gap-3">
                {editMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false)
                        setFormData({
                          name: currentHousehold.name,
                          description: currentHousehold.description || '',
                        })
                      }}
                      className="px-4 py-2 text-sm font-medium text-warm-700 bg-white border border-warm-300 rounded-lg hover:bg-warm-50 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
                    >
                      저장
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
                  >
                    수정
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* 가구 삭제 (owner만) */}
          {isOwner && (
            <div className="bg-white rounded-2xl shadow-sm border border-rose-200 p-6">
              <h2 className="text-lg font-semibold text-rose-900 mb-2">
                위험 영역
              </h2>
              <p className="text-sm text-warm-600 mb-4">
                가구를 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
              >
                가구 삭제
              </button>
            </div>
          )}
        </div>
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

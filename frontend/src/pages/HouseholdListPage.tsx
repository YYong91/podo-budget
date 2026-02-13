/**
 * @file HouseholdListPage.tsx
 * @description 공유 가계부 목록 페이지
 * 내가 속한 가구 목록을 카드 형태로 표시하고, 새 가구를 생성할 수 있다.
 */

import type { } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import CreateHouseholdModal from '../components/CreateHouseholdModal'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { CreateHouseholdDto } from '../types'

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
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'admin':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'member':
      return 'bg-gray-50 text-gray-700 border-gray-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export default function HouseholdListPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()

  // Zustand 스토어
  const { households, isLoading, error, fetchHouseholds, createHousehold, clearError } =
    useHouseholdStore()

  // 로컬 상태
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  /**
   * 컴포넌트 마운트 시 목록 조회
   */
  useEffect(() => {
    fetchHouseholds().catch((err) => {
      console.error('가구 목록 조회 실패:', err)
      addToast('error', '가구 목록을 불러오는데 실패했습니다')
    })
  }, [fetchHouseholds, addToast])

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
   * 가구 생성 핸들러
   */
  const handleCreate = async (data: CreateHouseholdDto) => {
    setIsCreating(true)
    try {
      const newHousehold = await createHousehold(data)
      addToast('success', '가구가 생성되었습니다')
      setShowCreateModal(false)
      // 생성 후 상세 페이지로 이동
      navigate(`/households/${newHousehold.id}`)
    } catch (err) {
      console.error('가구 생성 실패:', err)
      addToast('error', '가구 생성에 실패했습니다')
    } finally {
      setIsCreating(false)
    }
  }

  /**
   * 가구 카드 클릭 핸들러
   */
  const handleCardClick = (householdId: number) => {
    navigate(`/households/${householdId}`)
  }

  /**
   * 로딩 상태
   */
  if (isLoading && households.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  /**
   * 에러 상태
   */
  if (error && households.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">공유 가계부</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <ErrorState onRetry={fetchHouseholds} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공유 가계부</h1>
          <p className="text-sm text-gray-500 mt-1">
            가족이나 친구들과 함께 지출을 관리하세요
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          + 가구 만들기
        </button>
      </div>

      {/* 가구 목록 */}
      {households.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="아직 속한 가구가 없습니다"
          description="새로운 가구를 만들거나 다른 사람의 초대를 받아보세요"
          action={{
            label: '가구 만들기',
            onClick: () => setShowCreateModal(true),
          }}
          secondaryAction={{
            label: '받은 초대 확인',
            onClick: () => navigate('/invitations'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {households.map((household) => (
            <div
              key={household.id}
              onClick={() => handleCardClick(household.id)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-primary-300 transition-all cursor-pointer"
            >
              {/* 가구 이름 및 역할 */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {household.name}
                </h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${getRoleBadgeColor(
                    household.my_role
                  )}`}
                >
                  {formatRole(household.my_role)}
                </span>
              </div>

              {/* 설명 */}
              {household.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {household.description}
                </p>
              )}

              {/* 정보 */}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <span>👥</span>
                  <span>{household.member_count}명</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>📅</span>
                  <span>{formatDate(household.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 가구 생성 모달 */}
      <CreateHouseholdModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
        isLoading={isCreating}
      />
    </div>
  )
}

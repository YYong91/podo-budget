/**
 * @file CreateHouseholdModal.tsx
 * @description 새로운 공유 가계부(Household) 생성 모달 컴포넌트
 * 이름과 설명을 입력받아 새로운 가구를 생성한다.
 */

import type { } from 'react'
import { useState } from 'react'
import type { CreateHouseholdDto } from '../types'

interface CreateHouseholdModalProps {
  /** 모달 표시 여부 */
  isOpen: boolean
  /** 모달 닫기 핸들러 */
  onClose: () => void
  /** 생성 완료 핸들러 */
  onSubmit: (data: CreateHouseholdDto) => Promise<void>
  /** 로딩 상태 */
  isLoading?: boolean
}

/**
 * 가구 생성 모달
 * @param isOpen - 모달 표시 여부
 * @param onClose - 모달 닫기 핸들러
 * @param onSubmit - 폼 제출 핸들러
 * @param isLoading - 로딩 상태
 */
export default function CreateHouseholdModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateHouseholdModalProps) {
  const [formData, setFormData] = useState<CreateHouseholdDto>({
    name: '',
    description: '',
  })
  const [error, setError] = useState<string | null>(null)

  /**
   * 폼 제출 핸들러
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // 유효성 검증
    if (!formData.name.trim()) {
      setError('가구 이름을 입력해주세요')
      return
    }

    try {
      await onSubmit(formData)
      // 성공 시 폼 초기화
      setFormData({ name: '', description: '' })
    } catch (err) {
      console.error('가구 생성 실패:', err)
      setError('가구 생성에 실패했습니다')
    }
  }

  /**
   * 모달 닫기 핸들러
   */
  const handleClose = () => {
    if (isLoading) return
    setFormData({ name: '', description: '' })
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          새 가구 만들기
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 가구 이름 */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              가구 이름 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="우리 가족"
              disabled={isLoading}
              required
            />
          </div>

          {/* 설명 (선택) */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              설명 (선택)
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="가구에 대한 간단한 설명"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

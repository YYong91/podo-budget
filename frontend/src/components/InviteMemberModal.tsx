/**
 * @file InviteMemberModal.tsx
 * @description 공유 가계부 멤버 초대 모달 컴포넌트
 * 이메일과 역할을 입력받아 멤버를 초대한다.
 */

import type { } from 'react'
import { useState } from 'react'
import type { InviteMemberDto } from '../types'

interface InviteMemberModalProps {
  /** 모달 표시 여부 */
  isOpen: boolean
  /** 모달 닫기 핸들러 */
  onClose: () => void
  /** 초대 완료 핸들러 */
  onSubmit: (data: InviteMemberDto) => Promise<void>
  /** 로딩 상태 */
  isLoading?: boolean
}

/**
 * 멤버 초대 모달
 * @param isOpen - 모달 표시 여부
 * @param onClose - 모달 닫기 핸들러
 * @param onSubmit - 폼 제출 핸들러
 * @param isLoading - 로딩 상태
 */
export default function InviteMemberModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: InviteMemberModalProps) {
  const [formData, setFormData] = useState<InviteMemberDto>({
    email: '',
    role: 'member',
  })
  const [error, setError] = useState<string | null>(null)

  /**
   * 이메일 유효성 검증
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * 폼 제출 핸들러
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // 유효성 검증
    if (!formData.email.trim()) {
      setError('이메일을 입력해주세요')
      return
    }

    if (!isValidEmail(formData.email)) {
      setError('올바른 이메일 형식을 입력해주세요')
      return
    }

    try {
      await onSubmit(formData)
      // 성공 시 폼 초기화
      setFormData({ email: '', role: 'member' })
    } catch (err) {
      console.error('멤버 초대 실패:', err)
      setError('멤버 초대에 실패했습니다')
    }
  }

  /**
   * 모달 닫기 핸들러
   */
  const handleClose = () => {
    if (isLoading) return
    setFormData({ email: '', role: 'member' })
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-stone-900 mb-4">
          멤버 초대
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이메일 */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              이메일 <span className="text-rose-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              placeholder="example@email.com"
              disabled={isLoading}
              required
            />
          </div>

          {/* 역할 */}
          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              역할
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  role: e.target.value as 'member' | 'admin',
                })
              }
              className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={isLoading}
            >
              <option value="member">멤버</option>
              <option value="admin">관리자</option>
            </select>
            <p className="text-xs text-stone-500 mt-1">
              관리자는 멤버 초대 및 가구 설정을 수정할 수 있습니다
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '초대 중...' : '초대'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

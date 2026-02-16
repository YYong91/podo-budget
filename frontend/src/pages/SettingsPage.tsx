/**
 * @file SettingsPage.tsx
 * @description 설정 페이지 - 사용자 정보 표시 및 계정 삭제 기능
 * 사용자의 계정 정보를 표시하고, 계정을 영구 삭제할 수 있는 기능을 제공한다.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../hooks/useToast'
import authApi from '../api/auth'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { addToast } = useToast()

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmUsername, setConfirmUsername] = useState('')
  const [deleting, setDeleting] = useState(false)

  /**
   * 계정 삭제 처리
   */
  const handleDeleteAccount = async () => {
    // 사용자명 확인
    if (confirmUsername !== user?.username) {
      addToast('error', '사용자명이 일치하지 않습니다')
      return
    }

    setDeleting(true)
    try {
      await authApi.deleteAccount()
      addToast('success', '계정이 삭제되었습니다')
      logout()
      navigate('/login')
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail || '계정 삭제에 실패했습니다'
      addToast('error', message)
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  /**
   * 날짜 포맷 (YYYY.MM.DD)
   */
  const formatDate = (dateStr: string): string => {
    return dateStr.slice(0, 10).replace(/-/g, '.')
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-warm-900">설정</h1>

      {/* 사용자 정보 카드 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <h2 className="text-lg font-semibold text-warm-900 mb-4">계정 정보</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-warm-100">
            <span className="text-sm font-medium text-warm-600">사용자명</span>
            <span className="text-sm text-warm-900">{user.username}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-warm-100">
            <span className="text-sm font-medium text-warm-600">이메일</span>
            <span className="text-sm text-warm-900">{user.email || '미등록'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-warm-600">가입일</span>
            <span className="text-sm text-warm-900">{formatDate(user.created_at)}</span>
          </div>
        </div>
      </div>

      {/* 계정 삭제 섹션 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <h2 className="text-lg font-semibold text-warm-900 mb-2">계정 삭제</h2>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-rose-800 font-medium mb-2">⚠️ 주의사항</p>
          <p className="text-sm text-rose-700">
            계정을 삭제하면 모든 데이터(지출, 예산, 카테고리, 공유 가계부)가 영구 삭제됩니다.
            <br />
            이 작업은 되돌릴 수 없습니다.
          </p>
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
        >
          계정 삭제
        </button>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-warm-900 mb-4">
              정말 계정을 삭제하시겠습니까?
            </h3>
            <p className="text-sm text-warm-600 mb-4">
              계속하려면 사용자명 <strong>{user.username}</strong>을(를) 입력해주세요.
            </p>
            <input
              type="text"
              value={confirmUsername}
              onChange={(e) => setConfirmUsername(e.target.value)}
              placeholder="사용자명 입력"
              className="w-full px-3 py-2 border border-warm-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
              disabled={deleting}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setConfirmUsername('')
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-warm-700 bg-white border border-warm-300 rounded-lg hover:bg-warm-50 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || confirmUsername !== user.username}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:bg-warm-300 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    삭제 중...
                  </span>
                ) : (
                  '삭제'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

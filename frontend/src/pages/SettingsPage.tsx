/**
 * @file SettingsPage.tsx
 * @description 설정 페이지 - 사용자 정보 표시 및 계정 삭제 기능
 * 사용자의 계정 정보를 표시하고, 계정을 영구 삭제할 수 있는 기능을 제공한다.
 */

import { useAuth } from '../contexts/AuthContext'

export default function SettingsPage() {
  const { user } = useAuth()

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

      {/* 계정 관리 안내 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <h2 className="text-lg font-semibold text-warm-900 mb-2">계정 관리</h2>
        <p className="text-sm text-warm-600">
          계정 삭제 등 계정 관련 설정은 포도 통합 계정(podo-auth)에서 관리합니다.
        </p>
      </div>
    </div>
  )
}

/**
 * @file AuthCallbackPage.tsx
 * @description Supabase OAuth/Recovery 콜백 페이지 (#337)
 *
 * 두 가지 플로우를 처리:
 * 1. 소셜 로그인 콜백 → 세션 설정 후 홈으로
 * 2. 비밀번호 재설정 콜백 (type=recovery) → 비밀번호 변경 폼 표시
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import { supabase } from '../utils/supabase'
import { trackEvent } from '../utils/analytics'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const [isRecovery, setIsRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Supabase onAuthStateChange에서 PASSWORD_RECOVERY 이벤트 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
    })

    // URL hash에서 type=recovery 감지 (이메일 링크 직접 접근 시)
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setIsRecovery(true)
    }

    return () => subscription.unsubscribe()
  }, [])

  // 일반 로그인 콜백 → 홈으로 이동
  useEffect(() => {
    if (isAuthenticated && !isRecovery) {
      trackEvent('login')
      const intendedPath = sessionStorage.getItem('intended_path') || '/home'
      sessionStorage.removeItem('intended_path')
      navigate(intendedPath, { replace: true })
    }
  }, [isAuthenticated, isRecovery, navigate])

  const handlePasswordUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      addToast('success', TOAST.PASSWORD_CHANGED)
      navigate('/home', { replace: true })
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('should be at least')) {
        setError('비밀번호는 6자 이상이어야 합니다')
      } else {
        setError(message || '비밀번호 변경에 실패했습니다')
      }
    } finally {
      setLoading(false)
    }
  }, [password, confirmPassword, navigate])

  // 비밀번호 재설정 폼
  if (isRecovery) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <img src="/logo-transparent-192.png" alt="포도가계부" className="w-16 h-16 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">새 비밀번호 설정</h1>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">
              새로운 비밀번호를 입력해주세요
            </p>
          </div>

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                새 비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-[var(--input-border)] rounded-xl bg-[var(--surface-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="한 번 더 입력"
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-[var(--input-border)] rounded-xl bg-[var(--surface-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300"
              />
            </div>

            {error && <p className="text-sm text-rose-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold text-white bg-grape-600 rounded-xl hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? '처리 중...' : '비밀번호 변경'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full border-b-2 border-grape-600 w-10 h-10" />
        <p className="text-sm text-[var(--text-tertiary)]">로그인 처리 중...</p>
      </div>
    </div>
  )
}

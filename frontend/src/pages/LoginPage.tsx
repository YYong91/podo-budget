/**
 * @file LoginPage.tsx
 * @description 로그인 및 회원가입 통합 페이지
 * 탭으로 로그인/회원가입을 전환하며, 폼 validation과 에러 처리를 제공한다.
 */

import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { Home, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../hooks/useToast'

type TabType = 'login' | 'register'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, login, register } = useAuth()
  const { addToast } = useToast()

  const [activeTab, setActiveTab] = useState<TabType>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ username?: string; password?: string; email?: string }>({})

  // 이미 로그인된 사용자는 메인 페이지로 리다이렉트
  if (user) {
    return <Navigate to="/" replace />
  }

  /**
   * 이메일 형식 검증
   * @param email - 검증할 이메일
   * @returns 유효하면 true
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * 폼 validation
   * @returns 유효하면 true, 아니면 false
   */
  const validateForm = (): boolean => {
    const newErrors: { username?: string; password?: string; email?: string } = {}

    if (username.length < 3) {
      newErrors.username = '사용자명은 3자 이상이어야 합니다'
    }

    if (password.length < 8) {
      newErrors.password = '비밀번호는 8자 이상이어야 합니다'
    }

    // 회원가입 시 이메일 검증 (선택이지만 입력한 경우)
    if (activeTab === 'register' && email.trim() && !isValidEmail(email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * 폼 제출 핸들러
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setErrors({})

    try {
      if (activeTab === 'login') {
        await login({ username, password })
        addToast('success', '로그인되었습니다')
      } else {
        // 회원가입 시 이메일 포함
        const registerData = email.trim()
          ? { username, password, email: email.trim() }
          : { username, password }
        await register(registerData)
        addToast('success', '회원가입이 완료되었습니다')
      }
      navigate('/')
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ||
        (activeTab === 'login' ? '로그인에 실패했습니다' : '회원가입에 실패했습니다')
      addToast('error', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 w-full max-w-md p-8">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Home className="w-6 h-6 text-grape-600" />
            <h1 className="text-2xl font-bold text-grape-700">🍇 포도가계부</h1>
          </div>
          <p className="text-sm text-warm-500 mt-1">부부가 함께 쓰는 AI 가계부</p>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-warm-200 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login')
              setErrors({})
              setEmail('')
              setTermsAgreed(false)
              setPrivacyAgreed(false)
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'login'
                ? 'text-grape-600 border-b-2 border-grape-600'
                : 'text-warm-500 hover:text-warm-700'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register')
              setErrors({})
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'register'
                ? 'text-grape-600 border-b-2 border-grape-600'
                : 'text-warm-500 hover:text-warm-700'
            }`}
          >
            회원가입
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 사용자명 입력 */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-warm-700 mb-1">
              사용자명
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500 ${
                errors.username ? 'border-red-500' : 'border-warm-300'
              }`}
              placeholder="사용자명 입력"
              disabled={loading}
            />
            {errors.username && (
              <p className="text-sm text-red-500 mt-1">{errors.username}</p>
            )}
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-warm-700 mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500 ${
                errors.password ? 'border-red-500' : 'border-warm-300'
              }`}
              placeholder="비밀번호 입력"
              disabled={loading}
            />
            {errors.password && (
              <p className="text-sm text-red-500 mt-1">{errors.password}</p>
            )}
          </div>

          {/* 이메일 입력 (회원가입 시에만) */}
          {activeTab === 'register' && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-warm-700 mb-1">
                이메일 <span className="text-warm-400">(선택)</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500 ${
                  errors.email ? 'border-red-500' : 'border-warm-300'
                }`}
                placeholder="초대 받기에 사용됩니다"
                disabled={loading}
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )}
            </div>
          )}

          {/* 약관 동의 (회원가입 시에만) */}
          {activeTab === 'register' && (
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2">
                <input
                  id="terms"
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-grape-600 border-warm-300 rounded focus:ring-grape-500"
                  disabled={loading}
                />
                <label htmlFor="terms" className="text-sm text-warm-700 flex-1">
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-grape-600 hover:text-grape-700 underline"
                  >
                    이용약관
                  </Link>
                  에 동의합니다 <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="flex items-start gap-2">
                <input
                  id="privacy"
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-grape-600 border-warm-300 rounded focus:ring-grape-500"
                  disabled={loading}
                />
                <label htmlFor="privacy" className="text-sm text-warm-700 flex-1">
                  <Link
                    to="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-grape-600 hover:text-grape-700 underline"
                  >
                    개인정보처리방침
                  </Link>
                  에 동의합니다 <span className="text-red-500">*</span>
                </label>
              </div>
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading || (activeTab === 'register' && (!termsAgreed || !privacyAgreed))}
            className="w-full py-2.5 bg-grape-600 text-white font-medium rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] transition-all disabled:bg-warm-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                처리 중...
              </span>
            ) : (
              activeTab === 'login' ? '로그인' : '회원가입'
            )}
          </button>
        </form>

        {/* 안내 메시지 */}
        <div className="mt-6 text-center text-sm text-warm-500">
          {activeTab === 'login' ? (
            <>
              <p className="mb-2">
                <Link to="/forgot-password" className="text-warm-500 hover:text-warm-700 text-xs">
                  비밀번호를 잊으셨나요?
                </Link>
              </p>
              <p>
                계정이 없으신가요?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className="text-grape-600 hover:text-grape-700 font-medium"
                >
                  회원가입
                </button>
              </p>
            </>
          ) : (
            <p>
              이미 계정이 있으신가요?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="text-grape-600 hover:text-grape-700 font-medium"
              >
                로그인
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

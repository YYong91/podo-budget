/**
 * @file LoginPage.tsx
 * @description 로그인 및 회원가입 통합 페이지
 * 탭으로 로그인/회원가입을 전환하며, 폼 validation과 에러 처리를 제공한다.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../hooks/useToast'

type TabType = 'login' | 'register'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const { addToast } = useToast()

  const [activeTab, setActiveTab] = useState<TabType>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})

  /**
   * 폼 validation
   * @returns 유효하면 true, 아니면 false
   */
  const validateForm = (): boolean => {
    const newErrors: { username?: string; password?: string } = {}

    if (username.length < 3) {
      newErrors.username = '사용자명은 3자 이상이어야 합니다'
    }

    if (password.length < 8) {
      newErrors.password = '비밀번호는 8자 이상이어야 합니다'
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
        await register({ username, password })
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-600">HomeNRich</h1>
          <p className="text-sm text-gray-500 mt-1">AI 가계부</p>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login')
              setErrors({})
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'login'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
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
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            회원가입
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 사용자명 입력 */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              사용자명
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.username ? 'border-red-500' : 'border-gray-300'
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="비밀번호 입력"
              disabled={loading}
            />
            {errors.password && (
              <p className="text-sm text-red-500 mt-1">{errors.password}</p>
            )}
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                처리 중...
              </span>
            ) : (
              activeTab === 'login' ? '로그인' : '회원가입'
            )}
          </button>
        </form>

        {/* 안내 메시지 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          {activeTab === 'login' ? (
            <p>
              계정이 없으신가요?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                회원가입
              </button>
            </p>
          ) : (
            <p>
              이미 계정이 있으신가요?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="text-primary-600 hover:text-primary-700 font-medium"
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

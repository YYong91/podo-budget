import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Home, Loader2, CheckCircle, ArrowLeft } from 'lucide-react'
import { resetPassword } from '../api/auth'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }

    if (!token) {
      setError('유효하지 않은 링크입니다')
      return
    }

    setLoading(true)

    try {
      await resetPassword(token, newPassword)
      setSuccess(true)
    } catch {
      setError('토큰이 만료되었거나 유효하지 않습니다. 비밀번호 찾기를 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 w-full max-w-md p-8">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Home className="w-6 h-6 text-grape-600" />
            <h1 className="text-2xl font-bold text-grape-600">HomeNRich</h1>
          </div>
          <p className="text-sm text-stone-500 mt-1">비밀번호 재설정</p>
        </div>

        {success ? (
          /* 변경 완료 화면 */
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-stone-800 mb-2">비밀번호가 변경되었습니다</h2>
            <p className="text-sm text-stone-500 mb-6">
              새 비밀번호로 로그인해주세요.
            </p>
            <Link
              to="/login"
              className="inline-block w-full py-2.5 bg-grape-600 text-white font-medium rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] transition-all text-center"
            >
              로그인하기
            </Link>
          </div>
        ) : (
          /* 비밀번호 입력 폼 */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-stone-700 mb-1">
                새 비밀번호
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                placeholder="8자 이상"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-stone-700 mb-1">
                비밀번호 확인
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                placeholder="비밀번호를 다시 입력하세요"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-grape-600 text-white font-medium rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] transition-all disabled:bg-stone-300 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  변경 중...
                </span>
              ) : (
                '비밀번호 변경하기'
              )}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
              >
                <ArrowLeft className="w-4 h-4" />
                로그인으로 돌아가기
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

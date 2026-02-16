import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Home, Loader2, Mail, ArrowLeft } from 'lucide-react'
import { forgotPassword } from '../api/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('이메일을 입력해주세요')
      return
    }

    setLoading(true)
    setError('')

    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch {
      setError('요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
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
          <p className="text-sm text-warm-500 mt-1">비밀번호 찾기</p>
        </div>

        {sent ? (
          /* 발송 완료 화면 */
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-grape-50 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-grape-600" />
            </div>
            <h2 className="text-lg font-semibold text-warm-800 mb-2">이메일을 확인하세요</h2>
            <p className="text-sm text-warm-500 mb-6">
              등록된 이메일이라면 비밀번호 재설정 링크가 발송됩니다.
              메일함을 확인해주세요.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm text-grape-600 hover:text-grape-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          /* 이메일 입력 폼 */
          <>
            <p className="text-sm text-warm-500 mb-6 text-center">
              가입 시 등록한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-warm-700 mb-1">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-warm-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  placeholder="example@email.com"
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-500 mt-1">{error}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-grape-600 text-white font-medium rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] transition-all disabled:bg-warm-300 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    발송 중...
                  </span>
                ) : (
                  '재설정 링크 보내기'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm text-warm-500 hover:text-warm-700"
              >
                <ArrowLeft className="w-4 h-4" />
                로그인으로 돌아가기
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

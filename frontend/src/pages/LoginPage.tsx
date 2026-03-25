/**
 * @file LoginPage.tsx
 * @description 로그인 페이지 — Supabase Auth (#337)
 *
 * Grape 디자인 시스템 + 다크모드 지원.
 * 이메일+비밀번호 + Google 소셜 로그인 (카카오는 비즈앱 승인 후 #349).
 */

import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)

  const handleEmailAuth = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        })
        if (resetError) throw resetError
        setSuccess('비밀번호 재설정 메일을 발송했습니다. 이메일을 확인해주세요.')
        return
      }

      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        })
        if (signUpError) throw signUpError
        setError('') // 회원가입 성공 — Supabase onAuthStateChange가 처리
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      }

      // 로그인 성공 → intended path로 이동
      const intendedPath = sessionStorage.getItem('intended_path') || '/'
      sessionStorage.removeItem('intended_path')
      navigate(intendedPath, { replace: true })
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('Invalid login credentials')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다')
      } else if (message.includes('User already registered')) {
        setError('이미 가입된 이메일입니다')
      } else if (message.includes('Password should be at least')) {
        setError('비밀번호는 6자 이상이어야 합니다')
      } else if (message.includes('rate limit')) {
        setError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
      } else {
        setError(message || '처리에 실패했습니다')
      }
    } finally {
      setLoading(false)
    }
  }, [mode, email, password, name, navigate])

  const handleGoogleLogin = useCallback(async () => {
    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (oauthError) {
      setError(oauthError.message || 'Google 로그인에 실패했습니다')
    }
  }, [])

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* 로고 + 타이틀 */}
        <div className="text-center">
          <img
            src="/logo-transparent-192.png"
            alt="포도가계부"
            className="w-16 h-16 mx-auto mb-3"
          />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">포도가계부</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            AI가 알아서 정리해주는 똑똑한 가계부
          </p>
        </div>

        {/* 소셜 로그인 */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl hover:bg-gray-50 dark:hover:bg-[var(--surface-elevated)] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="text-sm font-medium text-[var(--text-primary)]">Google로 계속하기</span>
          </button>

          {/* 카카오 (비즈앱 승인 후 활성화 #349) */}
          {/* <button className="w-full ...">카카오로 계속하기</button> */}

          <p className="text-xs text-center text-[var(--text-muted)]">
            계속 진행 시{' '}
            <Link to="/terms" target="_blank" className="underline hover:text-[var(--text-secondary)]">이용약관</Link>
            {' '}및{' '}
            <Link to="/privacy" target="_blank" className="underline hover:text-[var(--text-secondary)]">개인정보처리방침</Link>
            에 동의합니다
          </p>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border-default)]" />
          <span className="text-xs text-[var(--text-muted)]">또는</span>
          <div className="flex-1 h-px bg-[var(--border-default)]" />
        </div>

        {/* 이메일 폼 */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                이름
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-4 py-2.5 border border-[var(--input-border)] rounded-xl bg-[var(--surface-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="w-full px-4 py-2.5 border border-[var(--input-border)] rounded-xl bg-[var(--surface-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                비밀번호
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
          )}

          {mode === 'signup' && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                aria-label="이용약관 및 개인정보처리방침에 동의"
                className="mt-0.5 w-4 h-4 rounded border-[var(--input-border)] text-grape-600 focus:ring-grape-300"
              />
              <span className="text-xs text-[var(--text-tertiary)]">
                <Link to="/terms" target="_blank" className="underline hover:text-[var(--text-secondary)]">이용약관</Link>
                {' '}및{' '}
                <Link to="/privacy" target="_blank" className="underline hover:text-[var(--text-secondary)]">개인정보처리방침</Link>
                에 동의합니다
              </span>
            </label>
          )}

          {error && (
            <p className="text-sm text-rose-500">{error}</p>
          )}

          {success && (
            <p className="text-sm text-emerald-600">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'signup' && !agreeTerms)}
            className="w-full py-3 text-sm font-semibold text-white bg-grape-600 rounded-xl hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '재설정 메일 보내기'}
          </button>
        </form>

        {/* 비밀번호 찾기 (로그인 모드에서만) */}
        {mode === 'login' && (
          <p className="text-center">
            <button
              onClick={() => { setMode('reset'); setError(''); setSuccess(''); setAgreeTerms(false) }}
              className="text-sm text-[var(--text-muted)] hover:underline"
            >
              비밀번호를 잊으셨나요?
            </button>
          </p>
        )}

        {/* 모드 전환 */}
        <p className="text-center text-sm text-[var(--text-tertiary)]">
          {mode === 'login' ? (
            <>
              계정이 없으신가요?{' '}
              <button
                onClick={() => { setMode('signup'); setError(''); setSuccess(''); setAgreeTerms(false) }}
                className="text-grape-600 font-medium hover:underline"
              >
                회원가입
              </button>
            </>
          ) : (
            <>
              이미 계정이 있으신가요?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); setAgreeTerms(false) }}
                className="text-grape-600 font-medium hover:underline"
              >
                로그인
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

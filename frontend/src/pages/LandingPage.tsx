/**
 * @file LandingPage.tsx
 * @description 퍼블릭 랜딩 페이지 — Google OAuth 심사 충족 (#495)
 *
 * 미인증 사용자에게 앱 소개를 보여주는 퍼블릭 페이지.
 * 이미 로그인된 상태면 /home으로 자동 리디렉션.
 * Grape 디자인 시스템 + 모바일 퍼스트 반응형.
 */

import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const FEATURES = [
  {
    icon: '\uD83D\uDDE3\uFE0F',
    title: '자연어 입력',
    description: '"점심 김치찌개 8000원" 한 줄이면 끝',
  },
  {
    icon: '\uD83E\uDD16',
    title: 'AI 자동 분류',
    description: '카테고리, 날짜를 자동으로 인식',
  },
  {
    icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67',
    title: '공유 가계부',
    description: '가족과 함께 기록하고 관리',
  },
  {
    icon: '\uD83D\uDCCA',
    title: '리포트',
    description: '월간 소비 패턴과 AI 인사이트',
  },
] as const

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  /* 이미 로그인 상태면 /home으로 리디렉션 */
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/home', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  /* 인증 체크 중에는 아무것도 렌더링하지 않음 (깜빡임 방지) */
  if (loading || isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-warm-900 flex flex-col">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 md:px-8 md:py-4">
        <div className="flex items-center gap-2">
          <img src="/favicon-book-192.png" alt="" className="w-8 h-8" />
          <span className="text-lg font-bold text-grape-600">포도가계부</span>
        </div>
        <Link
          to="/login"
          className="px-4 py-2 text-sm font-medium text-grape-600 border border-grape-300 rounded-lg hover:bg-grape-50 dark:hover:bg-grape-900/20 transition-colors"
        >
          로그인
        </Link>
      </header>

      {/* 히어로 섹션 */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 md:py-24">
        <img
          src="/logo-transparent-192.png"
          alt="포도가계부"
          className="w-20 h-20 md:w-24 md:h-24 mb-6"
        />
        <h1 className="text-2xl md:text-4xl font-bold text-[var(--text-primary)] mb-3 leading-snug">
          포도알처럼 하나씩,
          <br />
          알찬 가계부
        </h1>
        <p className="text-sm md:text-base text-[var(--text-tertiary)] mb-8 max-w-md">
          자연어로 말하면 AI가 알아서 분류하는 가계부
        </p>
        <Link
          to="/login"
          className="px-8 py-3 bg-grape-600 text-white text-sm md:text-base font-semibold rounded-xl hover:bg-grape-700 active:scale-[0.98] transition-all shadow-sm"
        >
          시작하기
        </Link>
      </section>

      {/* 기능 소개 섹션 */}
      <section className="px-4 pb-16 md:px-8 md:pb-24">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] p-5 md:p-6"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--text-tertiary)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-[var(--border-default)] px-4 py-6 md:px-8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <Link to="/privacy" className="hover:underline">개인정보처리방침</Link>
            <span>|</span>
            <Link to="/terms" className="hover:underline">이용약관</Link>
          </div>
          <span>&copy; 2026 포도가계부</span>
        </div>
      </footer>
    </div>
  )
}

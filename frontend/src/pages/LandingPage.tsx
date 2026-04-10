import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { Header } from '../components/landing/Header'
import { HeroSection } from '../components/landing/HeroSection'
import { MessengerSection } from '../components/landing/MessengerSection'
import { SharedSection } from '../components/landing/SharedSection'
import { InsightsSection } from '../components/landing/InsightsSection'
import { FeaturesSection } from '../components/landing/FeaturesSection'
import { SocialProofSection } from '../components/landing/SocialProofSection'
import { CTAFooter } from '../components/landing/CTAFooter'

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const { mode, setMode } = useTheme()
  const prevMode = useRef(mode)

  // 랜딩페이지는 항상 라이트 모드로 표시, 이탈 시 원래 테마 복원
  useEffect(() => {
    prevMode.current = mode
    setMode('light')
    return () => setMode(prevMode.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/home', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  if (loading || isAuthenticated) {
    return null
  }

  return (
    <main className="min-h-screen bg-cream">
      <Header />
      <HeroSection />
      <MessengerSection />
      <SharedSection />
      <InsightsSection />
      <FeaturesSection />
      <SocialProofSection />
      <CTAFooter />
    </main>
  )
}

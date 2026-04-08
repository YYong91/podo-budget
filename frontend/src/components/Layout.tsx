/* 메인 레이아웃 - 데스크톱 사이드바 + 모바일 하단 탭 바 (포도책방 통일 디자인) */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import FloatingTabBar from './FloatingTabBar'
import InstallBanner from './InstallBanner'
import QuickInput, { type QuickInputHandle } from './QuickInput'
import ActionToast from './ActionToast'
import type { ActionToastData } from './ActionToast'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { Mail, Home, ChevronDown } from 'lucide-react'
import { useChangelog } from '../hooks/useChangelog'
import { trackPageView } from '../utils/analytics'
import { NAV_ITEMS } from '../constants/navItems'

export default function Layout() {
  const [householdDropdownOpen, setHouseholdDropdownOpen] = useState(false)
  const [isInputMode, setIsInputMode] = useState(false)
  const [toastData, setToastData] = useState<ActionToastData | null>(null)
  // iOS Safari에서 키보드를 사용자 제스처 컨텍스트에서 띄우려면 동기적으로 focus() 호출 필요
  const quickInputRef = useRef<QuickInputHandle>(null)
  const location = useLocation()
  // selector로 필요한 값만 구독 — isLoading 등 미사용 필드 변경 시 불필요한 리렌더 방지 (#167)
  const households = useHouseholdStore((s) => s.households)
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const myInvitations = useHouseholdStore((s) => s.myInvitations)
  const setActiveHouseholdId = useHouseholdStore((s) => s.setActiveHouseholdId)

  // 에러 시 isInputMode를 닫지 않음 — 입력창 유지하여 바로 재입력 가능
  const handleSaveSuccess = useCallback((data: ActionToastData) => {
    setToastData(data)
  }, [])

  const handleSaveError = useCallback((data: ActionToastData) => {
    setToastData(data)
  }, [])

  // 초기 fetch는 ProtectedRoute의 initializeApp()에서 수행

  // 탭 전환 시 스크롤 위치 초기화 + 페이지뷰 트래킹
  useEffect(() => {
    window.scrollTo(0, 0)
    trackPageView(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    if (!householdDropdownOpen) return
    const handleClick = () => setHouseholdDropdownOpen(false)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [householdDropdownOpen])

  const { hasUnread: hasUnreadChangelog } = useChangelog()
  const pendingInvitationCount = myInvitations.filter(inv => inv.status === 'pending').length
  const activeHousehold = households.find(h => h.id === activeHouseholdId)

  const isActive = (path: string) =>
    path === '/home' ? location.pathname === '/home' : location.pathname.startsWith(path)

  const isDev = import.meta.env.VITE_SENTRY_ENVIRONMENT === 'development'

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      {/* 개발 환경 표시 배너 */}
      {isDev && (
        <div className="bg-amber-500 text-white text-center text-xs font-bold py-1 tracking-wide z-50 relative">
          DEV 환경
        </div>
      )}


      <div className="flex">
        {/* 데스크톱 사이드바 (md 이상에서만 표시) */}
        <aside className="hidden md:flex md:sticky md:top-0 md:h-screen w-60 bg-[var(--surface)] border-r border-[var(--border-default)] p-4 flex-col">
          {/* 앱 타이틀 */}
          <div className="mb-4">
            <Link to="/home" className="text-2xl font-bold text-grape-600 flex items-center gap-2"><img src="/favicon-book-192.png" alt="" className="w-8 h-8" />포도가계부</Link>
          </div>

          {/* 가구 선택 드롭다운 */}
          <div className="mb-4">
            {households.length <= 1 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-grape-50 text-grape-600">
                <Home className="w-4 h-4" />
                <span className="font-medium truncate">{activeHousehold?.name ?? '가구'}</span>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); setHouseholdDropdownOpen(!householdDropdownOpen) }}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm bg-grape-50 hover:bg-grape-100 text-grape-600 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Home className="w-4 h-4" />
                    <span className="font-medium truncate">{activeHousehold?.name ?? '가구 선택'}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] ml-1 flex-shrink-0" />
                </button>
                {householdDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 py-1">
                    {households.map(h => (
                      <button
                        key={h.id}
                        onClick={() => { setActiveHouseholdId(h.id); setHouseholdDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-hover)] transition-colors truncate ${
                          h.id === activeHouseholdId ? 'text-grape-600 font-medium bg-grape-50' : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {h.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 네비게이션 */}
          <nav aria-label="사이드바 메뉴" className="space-y-1 flex-1 overflow-y-auto">
            {NAV_ITEMS.map(item => {
              const active = isActive(item.path)
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors relative
                    ${active
                      ? 'bg-grape-50 text-grape-600 border-l-3 border-grape-500'
                      : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                    }
                  `}
                >
                  <span className="relative">
                    <Icon className="w-[18px] h-[18px]" />
                    {item.path === '/settings' && hasUnreadChangelog && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </span>
                  {item.label}
                </Link>
              )
            })}
            {pendingInvitationCount > 0 && (
              <Link
                to="/invitations"
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors relative
                  ${location.pathname === '/invitations'
                    ? 'bg-grape-50 text-grape-600 border-l-3 border-grape-500'
                    : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                  }
                `}
              >
                <Mail className="w-[18px] h-[18px]" />
                받은 초대
                <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {pendingInvitationCount}
                </span>
              </Link>
            )}
          </nav>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-24 max-w-6xl mx-auto w-full">
          <Outlet />
        </main>

        <InstallBanner />
      </div>

      {/* 플로팅 탭 바 — 모바일 전용 */}
      <FloatingTabBar
        onInputOpen={() => {
          if (activeHouseholdId) {
            setIsInputMode(true)
            // iOS Safari: 사용자 제스처 컨텍스트 내에서 동기적으로 focus() 호출해야 키보드가 뜸
            quickInputRef.current?.focus()
          }
        }}
        hasUnreadChangelog={hasUnreadChangelog}
        hasPendingInvitation={pendingInvitationCount > 0}
        isHidden={isInputMode}
      />
      <QuickInput
        ref={quickInputRef}
        isOpen={isInputMode}
        onClose={() => setIsInputMode(false)}
        onSaveSuccess={handleSaveSuccess}
        onSaveError={handleSaveError}
        householdId={activeHouseholdId!}
      />
      {toastData && (
        // FloatingTabBar 높이(~80px) + 여백 12px = 약 100px
        <div className="md:hidden fixed left-0 right-0 z-40 flex justify-center px-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
          <div className="w-full max-w-md">
            <ActionToast data={toastData} onClose={() => setToastData(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

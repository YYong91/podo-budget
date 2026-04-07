/* 메인 레이아웃 - 데스크톱 사이드바 + 모바일 하단 탭 바 (포도책방 통일 디자인) */

import { useState, useEffect, useCallback } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import FloatingTabBar from './FloatingTabBar'
import InstallBanner from './InstallBanner'
import QuickInput from './QuickInput'
import ActionToast from './ActionToast'
import type { ActionToastData } from './ActionToast'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import {
  Receipt, TrendingUp, Settings as SettingsIcon,
  Mail, Home, ChevronDown, Landmark,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useChangelog } from '../hooks/useChangelog'
import { trackPageView } from '../utils/analytics'
import { FEATURES } from '../config/features'


// FEATURES.assets 플래그에 따라 자산 탭을 조건부 포함
const navItems: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/home', label: '가계부', icon: Receipt },
  ...(FEATURES.assets ? [{ path: '/assets', label: '자산', icon: Landmark }] : []),
  { path: '/insights', label: '돌아보기', icon: TrendingUp },
  { path: '/settings', label: '더보기', icon: SettingsIcon },
]

export default function Layout() {
  const [householdDropdownOpen, setHouseholdDropdownOpen] = useState(false)
  const [isInputMode, setIsInputMode] = useState(false)
  const [toastData, setToastData] = useState<ActionToastData | null>(null)
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

      {/* 모바일 전용 미니 헤더 — 가구 전환/초대 배지가 있을 때만 표시 */}
      {(pendingInvitationCount > 0 || households.length > 1) && (
        <header className="md:hidden bg-[var(--surface-card)] border-b border-[var(--border-default)] sticky top-0 z-30 h-12 flex items-center justify-end px-4 gap-3">
          {households.length > 1 && (
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setHouseholdDropdownOpen(!householdDropdownOpen) }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-grape-50 hover:bg-grape-100 text-grape-600 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="font-medium truncate max-w-[100px]">{activeHousehold?.name ?? '가구'}</span>
                <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
              </button>
              {householdDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
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
          {pendingInvitationCount > 0 && (
            <Link to="/invitations" className="relative p-1.5">
              <Mail className="w-5 h-5 text-[var(--text-tertiary)]" />
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                {pendingInvitationCount}
              </span>
            </Link>
          )}
        </header>
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
            {navItems.map(item => {
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
        onInputOpen={() => { if (activeHouseholdId) setIsInputMode(true) }}
        hasUnreadChangelog={hasUnreadChangelog}
      />
      <QuickInput
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

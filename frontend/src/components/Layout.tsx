/* 메인 레이아웃 - 데스크톱 사이드바 + 모바일 하단 탭 바 (포도책방 통일 디자인) */

import type { } from 'react'
import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import FloatingActionButton from './FloatingActionButton'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import {
  Receipt, TrendingUp, Settings as SettingsIcon,
  Mail, Home, ChevronDown, Landmark,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useChangelog } from '../hooks/useChangelog'


const navItems: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/', label: '가계부', icon: Receipt },
  { path: '/insights', label: '리포트', icon: TrendingUp },
  { path: '/assets', label: '자산', icon: Landmark },
  { path: '/settings', label: '설정', icon: SettingsIcon },
]

export default function Layout() {
  const [householdDropdownOpen, setHouseholdDropdownOpen] = useState(false)
  const location = useLocation()
  const {
    households, activeHouseholdId, myInvitations,
    fetchHouseholds, fetchMyInvitations, setActiveHouseholdId,
  } = useHouseholdStore()

  useEffect(() => {
    fetchHouseholds().catch(() => {})
    fetchMyInvitations().catch(() => {})
  }, [fetchHouseholds, fetchMyInvitations])

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
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <div className="min-h-screen bg-cream">
      {/* 모바일 전용 미니 헤더 — 가구 전환/초대 배지가 있을 때만 표시 */}
      {(pendingInvitationCount > 0 || households.length > 1) && (
        <header className="md:hidden bg-white border-b border-warm-200 sticky top-0 z-30 h-12 flex items-center justify-end px-4 gap-3">
          {households.length > 1 && (
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setHouseholdDropdownOpen(!householdDropdownOpen) }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-grape-50 hover:bg-grape-100 text-grape-700 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="font-medium truncate max-w-[100px]">{activeHousehold?.name ?? '가구'}</span>
                <ChevronDown className="w-3 h-3 text-warm-400" />
              </button>
              {householdDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-warm-200 rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
                  {households.map(h => (
                    <button
                      key={h.id}
                      onClick={() => { setActiveHouseholdId(h.id); setHouseholdDropdownOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-warm-100 transition-colors truncate ${
                        h.id === activeHouseholdId ? 'text-grape-700 font-medium bg-grape-50' : 'text-warm-700'
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
              <Mail className="w-5 h-5 text-warm-600" />
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                {pendingInvitationCount}
              </span>
            </Link>
          )}
        </header>
      )}

      <div className="flex">
        {/* 데스크톱 사이드바 (md 이상에서만 표시) */}
        <aside className="hidden md:flex md:sticky md:top-0 md:h-screen w-60 bg-cream border-r border-warm-200 p-4 flex-col">
          {/* 앱 타이틀 */}
          <div className="mb-4">
            <Link to="/" className="text-2xl font-bold text-grape-700 flex items-center gap-2"><img src="/pwa-192x192.png" alt="" className="w-8 h-8 rounded" />포도가계부</Link>
          </div>

          {/* 가구 선택 드롭다운 */}
          <div className="mb-4">
            {households.length === 0 ? (
              <Link
                to="/households"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-grape-50 text-grape-700 hover:bg-grape-100 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>가계부를 만들어주세요</span>
              </Link>
            ) : households.length === 1 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-grape-50 text-grape-700">
                <Home className="w-4 h-4" />
                <span className="font-medium truncate">{activeHousehold?.name ?? '가구'}</span>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); setHouseholdDropdownOpen(!householdDropdownOpen) }}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm bg-grape-50 hover:bg-grape-100 text-grape-700 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Home className="w-4 h-4" />
                    <span className="font-medium truncate">{activeHousehold?.name ?? '가구 선택'}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-warm-400 ml-1 flex-shrink-0" />
                </button>
                {householdDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-warm-200 rounded-lg shadow-lg z-50 py-1">
                    {households.map(h => (
                      <button
                        key={h.id}
                        onClick={() => { setActiveHouseholdId(h.id); setHouseholdDropdownOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-warm-100 transition-colors truncate ${
                          h.id === activeHouseholdId ? 'text-grape-700 font-medium bg-grape-50' : 'text-warm-700'
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
          <nav className="space-y-1 flex-1 overflow-y-auto">
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
                      ? 'bg-grape-50 text-grape-700 border-l-3 border-grape-500'
                      : 'text-warm-600 hover:bg-warm-100 hover:text-warm-800'
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
                    ? 'bg-grape-50 text-grape-700 border-l-3 border-grape-500'
                    : 'text-warm-600 hover:bg-warm-100 hover:text-warm-800'
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
        <main className="flex-1 p-4 pb-40 md:p-6 md:pb-24 max-w-6xl mx-auto w-full">
          <Outlet />
        </main>

        {/* 플로팅 액션 버튼 */}
        <FloatingActionButton />
      </div>

      {/* 모바일 하단 탭 바 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-warm-200 safe-area-bottom">
        <div className="flex items-center justify-around h-14 pwa-nav-container">
          {navItems.map(item => {
            const active = isActive(item.path)
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={`
                  flex flex-col items-center justify-center gap-0.5 flex-1 h-full
                  transition-colors
                  ${active
                    ? 'text-grape-600'
                    : 'text-warm-400 active:text-warm-600'
                  }
                `}
              >
                <span className="relative">
                  <Icon className={`w-5 h-5 pwa-nav-icon ${active ? 'stroke-[2.5]' : ''}`} />
                  {item.path === '/settings' && hasUnreadChangelog && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </span>
                <span className={`text-[10px] leading-tight pwa-nav-label ${active ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

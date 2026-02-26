/* 메인 레이아웃 - 사이드바 전용 (포도책방 통일 디자인) */

import type { } from 'react'
import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import {
  LayoutDashboard, Receipt, Wallet, PlusCircle, Tags,
  PiggyBank, Repeat, TrendingUp, Users, Settings as SettingsIcon,
  Mail, Home, Menu, X, ChevronDown, LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const BOOKSHELF_URL = import.meta.env.VITE_BOOKSHELF_URL || 'http://localhost:5173'
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'

const navItems: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/', label: '대시보드', icon: LayoutDashboard },
  { path: '/expenses', label: '지출 목록', icon: Receipt },
  { path: '/expenses/new', label: '지출 입력', icon: PlusCircle },
  { path: '/income', label: '수입 목록', icon: Wallet },
  { path: '/income/new', label: '수입 입력', icon: PlusCircle },
  { path: '/categories', label: '카테고리', icon: Tags },
  { path: '/budgets', label: '예산 관리', icon: PiggyBank },
  { path: '/recurring', label: '정기 거래', icon: Repeat },
  { path: '/insights', label: '리포트', icon: TrendingUp },
  { path: '/households', label: '공유 가계부', icon: Users },
  { path: '/settings', label: '설정', icon: SettingsIcon },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [householdDropdownOpen, setHouseholdDropdownOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuth()
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

  // 라우트 변경 시 모바일 사이드바 닫기
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false)
  }, [location.pathname])

  const pendingInvitationCount = myInvitations.filter(inv => inv.status === 'pending').length
  const activeHousehold = households.find(h => h.id === activeHouseholdId)

  return (
    <div className="min-h-screen bg-cream">
      {/* 모바일 전용 미니 헤더 (48px) */}
      <header className="md:hidden bg-white border-b border-warm-200 sticky top-0 z-30 h-12 flex items-center px-4 gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-md hover:bg-warm-100"
          aria-label="메뉴 열기"
        >
          <Menu className="w-5 h-5 text-warm-600" />
        </button>
        <Link to="/" className="font-bold text-grape-700">🍇 포도가계부</Link>
      </header>

      <div className="flex">
        {/* 사이드바 */}
        <aside
          className={`
            fixed z-20 h-[calc(100vh-3rem)] md:h-screen
            top-12 md:top-0 md:sticky left-0
            w-60 bg-cream border-r border-warm-200 p-4 flex flex-col
            transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          {/* 데스크톱 앱 타이틀 */}
          <div className="hidden md:block mb-4">
            <Link to="/" className="text-2xl font-bold text-grape-700">🍇 포도가계부</Link>
          </div>

          {/* 모바일 닫기 버튼 */}
          <div className="md:hidden flex justify-end mb-2">
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-md hover:bg-warm-100">
              <X className="w-4 h-4 text-warm-500" />
            </button>
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
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-warm-100 text-warm-700">
                <Home className="w-4 h-4" />
                <span className="font-medium truncate">{activeHousehold?.name ?? '가구'}</span>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={e => { e.stopPropagation(); setHouseholdDropdownOpen(!householdDropdownOpen) }}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm bg-warm-100 hover:bg-warm-200 text-warm-700 transition-colors"
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
              const isActive = location.pathname === item.path
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-colors relative
                    ${isActive
                      ? 'bg-grape-50 text-grape-700 border-l-3 border-grape-500'
                      : 'text-warm-600 hover:bg-warm-100 hover:text-warm-800'
                    }
                  `}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  {item.label}
                  {item.path === '/households' && pendingInvitationCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {pendingInvitationCount}
                    </span>
                  )}
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

          {/* 사이드바 하단 — 유저 정보 + 서비스 링크 */}
          <div className="mt-4 pt-4 border-t border-warm-200 text-sm space-y-1">
            {user && (
              <div className="flex items-center gap-1 px-3 py-1.5">
                <a
                  href={AUTH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm font-medium text-warm-600 hover:text-grape-600 truncate"
                  title="계정 관리"
                >
                  {user.username}
                </a>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-md text-warm-400 hover:text-grape-600 hover:bg-grape-50 transition-colors"
                  title="로그아웃"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
            <a
              href={BOOKSHELF_URL}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-warm-500 hover:text-grape-600 hover:bg-grape-50 transition-colors"
            >
              <span>📚</span>
              <span>포도책장</span>
            </a>
          </div>
        </aside>

        {/* 모바일 오버레이 */}
        {sidebarOpen && (
          <div
            data-testid="sidebar-overlay"
            className="fixed inset-0 bg-black/30 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

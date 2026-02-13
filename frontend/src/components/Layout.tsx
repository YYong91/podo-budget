/* 메인 레이아웃 - 헤더 + 사이드바 + 콘텐츠 */

import type { } from 'react'
import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHouseholdStore } from '../stores/useHouseholdStore'

const navItems = [
  { path: '/', label: '대시보드', icon: '📊' },
  { path: '/expenses', label: '지출 목록', icon: '💰' },
  { path: '/expenses/new', label: '지출 입력', icon: '➕' },
  { path: '/categories', label: '카테고리', icon: '📁' },
  { path: '/budgets', label: '예산 관리', icon: '📋' },
  { path: '/insights', label: '인사이트', icon: '💡' },
  { path: '/households', label: '공유 가계부', icon: '🏠' },
  { path: '/settings', label: '설정', icon: '⚙️' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { myInvitations, fetchMyInvitations } = useHouseholdStore()

  // 컴포넌트 마운트 시 초대 목록 조회 (뱃지 표시용)
  useEffect(() => {
    fetchMyInvitations().catch(() => {
      // 에러는 무시 (뱃지 표시 실패해도 앱 동작에는 지장 없음)
    })
  }, [fetchMyInvitations])

  // pending 상태인 초대 개수
  const pendingInvitationCount = myInvitations.filter(
    (inv) => inv.status === 'pending'
  ).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-md hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <span className="text-xl">☰</span>
            </button>
            <Link to="/" className="text-lg font-bold text-primary-600">
              HomeNRich
            </Link>
            <span className="text-xs text-gray-400 hidden sm:inline">가계부</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <span className="text-sm text-gray-600 hidden sm:inline">{user.username}</span>
                <button
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 사이드바 (데스크톱: 항상 표시, 모바일: 토글) */}
        <aside
          className={`
            fixed md:sticky top-14 left-0 z-20 h-[calc(100vh-3.5rem)]
            w-56 bg-white border-r border-gray-200 p-4
            transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                    transition-colors relative
                    ${isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span>{item.icon}</span>
                  {item.label}
                  {/* 공유 가계부 메뉴에 초대 뱃지 표시 */}
                  {item.path === '/households' && pendingInvitationCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {pendingInvitationCount}
                    </span>
                  )}
                </Link>
              )
            })}

            {/* 받은 초대 링크 (초대가 있을 때만 표시) */}
            {pendingInvitationCount > 0 && (
              <Link
                to="/invitations"
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors relative
                  ${location.pathname === '/invitations'
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <span>📨</span>
                받은 초대
                <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {pendingInvitationCount}
                </span>
              </Link>
            )}
          </nav>
        </aside>

        {/* 모바일 오버레이 */}
        {sidebarOpen && (
          <div
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

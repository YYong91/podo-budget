/* 메인 레이아웃 - 헤더 + 사이드바 + 콘텐츠 */

import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', label: '대시보드', icon: '📊' },
  { path: '/expenses', label: '지출 목록', icon: '💰' },
  { path: '/categories', label: '카테고리', icon: '📁' },
  { path: '/insights', label: '인사이트', icon: '💡' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

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
                    transition-colors
                    ${isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
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

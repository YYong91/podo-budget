/**
 * @file FloatingTabBar.tsx
 * @description iOS 26 리퀴드 글래스 스타일 플로팅 아일랜드 탭바 (모바일 전용)
 */
import { Link, useLocation } from 'react-router-dom'
import { Receipt, TrendingUp, Settings as SettingsIcon, Pencil, Landmark } from 'lucide-react'
import { FEATURES } from '../config/features'

interface FloatingTabBarProps {
  /** 입력 버튼 클릭 시 호출 */
  onInputOpen: () => void
  /** 읽지 않은 changelog 있을 때 true */
  hasUnreadChangelog?: boolean
  /** QuickInput 활성 시 true — 탭바를 페이드아웃하여 입력창과 겹치지 않게 함 */
  isHidden?: boolean
}

const NAV_ITEMS = [
  { path: '/home', label: '가계부', icon: Receipt },
  ...(FEATURES.assets ? [{ path: '/assets', label: '자산', icon: Landmark }] : []),
  { path: '/insights', label: '돌아보기', icon: TrendingUp },
  { path: '/settings', label: '더보기', icon: SettingsIcon },
]

export default function FloatingTabBar({ onInputOpen, hasUnreadChangelog, isHidden }: FloatingTabBarProps) {
  const { pathname } = useLocation()

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  return (
    /* 모바일 전용 — md 이상은 숨김 */
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none transition-all duration-200 ${
        isHidden ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2px)' }}
    >
      {/* 플로팅 아일랜드 */}
      {/* Apple HIG: 터치 타겟 최소 44pt — py-1.5(6px)*2 + icon(20px) + gap(2px) + label(12px) ≈ 46px */}
      <nav
        aria-label="하단 탭 메뉴"
        className="pointer-events-auto flex items-center gap-1 px-5 py-1.5 rounded-full shadow-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl"
      >
        {/* 탭 목록 — w-16 고정 너비로 모든 탭의 pill 모양 일관성 확보 */}
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path)
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              // w-16 고정 → 텍스트 길이 무관하게 항상 동일한 pill 크기
              // bg-grape-100/80: 선택된 탭 pill 배경 (투명 전환 200ms)
              className={`w-16 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full transition-all duration-200 ${
                active
                  ? 'text-grape-600 bg-grape-100/80'
                  : 'text-[var(--text-muted)] active:text-[var(--text-tertiary)]'
              }`}
            >
              <span className="relative">
                <Icon className={`w-5 h-5 floating-island-icon ${active ? 'stroke-[2.5]' : ''}`} />
                {item.path === '/settings' && hasUnreadChangelog && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </span>
              <span className={`text-[10px] leading-tight floating-island-label ${active ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* 구분선 */}
        <div className="w-px h-7 bg-[var(--glass-border)] mx-1" aria-hidden="true" />

        {/* 입력 버튼 — Apple HIG 44pt 터치 타겟 충족 */}
        <button
          onClick={onInputOpen}
          aria-label="거래 입력"
          className="w-10 h-10 rounded-full bg-grape-600 hover:bg-grape-700 active:bg-grape-800 flex items-center justify-center transition-colors shadow-sm"
        >
          <Pencil className="w-[18px] h-[18px] text-white" />
        </button>
      </nav>
    </div>
  )
}

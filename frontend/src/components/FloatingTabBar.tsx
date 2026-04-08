/**
 * @file FloatingTabBar.tsx
 * @description iOS 26 리퀴드 글래스 스타일 플로팅 아일랜드 탭바 (모바일 전용)
 */
import { Link, useLocation } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { NAV_ITEMS } from '../constants/navItems'

// PWA standalone 모드 여부 — 브라우저에서 열면 false
// iOS Safari 하단 주소창(49px)을 피하기 위해 non-PWA 환경에서 추가 여백 적용
const isPWA =
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true

const tabBarPaddingBottom = isPWA
  ? 'env(safe-area-inset-bottom, 0px)'
  : 'calc(env(safe-area-inset-bottom, 0px) + 24px)'

interface FloatingTabBarProps {
  /** 입력 버튼 클릭 시 호출 */
  onInputOpen: () => void
  /** 읽지 않은 changelog 있을 때 true */
  hasUnreadChangelog?: boolean
  /** QuickInput 활성 시 true — 탭바를 페이드아웃하여 입력창과 겹치지 않게 함 */
  isHidden?: boolean
}


export default function FloatingTabBar({ onInputOpen, hasUnreadChangelog, isHidden }: FloatingTabBarProps) {
  const { pathname } = useLocation()

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  return (
    /* 모바일 전용 — md 이상은 숨김 */
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none transition-all duration-200 ${
        isHidden ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
      style={{ paddingBottom: tabBarPaddingBottom }}
    >
      {/* 플로팅 아일랜드 */}
      {/* py-1(4px): island 상하 여백 최소화 → pill이 island 경계에 바짝 붙는 네이티브 느낌 */}
      {/* 터치 타겟: py-1(4px) + py-1.5(6px) + icon(20px) + gap(2px) + label(12px) + py-1.5(6px) + py-1(4px) = 54px ≥ 44pt ✓ */}
      <nav
        aria-label="하단 탭 메뉴"
        className="pointer-events-auto flex items-center gap-1 px-3 py-1 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl"
      >
        {/* 탭 목록 — w-[72px] 고정 너비로 pill 일관성 확보, 탭 너비 확대로 여유있는 느낌 */}
        {NAV_ITEMS.map(item => {
          const active = isActive(item.path)
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              // w-[72px]: Apple Files 앱 수준의 넉넉한 탭 너비 → 일관된 pill 모양
              // py-1.5: 터치 타겟 확보 + island 경계와의 시각적 여백(py-1) 대비 강조
              className={`w-[72px] flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full transition-all duration-200 ${
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

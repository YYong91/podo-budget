/**
 * @file SettingsPage.tsx
 * @description 설정 페이지 — 메뉴 목록 + 섹션 라우터.
 * 각 섹션 UI는 components/settings/ 하위로 위임한다.
 */

import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  Tags, PiggyBank, Repeat, Users, BookOpen, MessageSquarePlus,
  Megaphone, ChevronRight, User, Sun, Moon,
  ShieldCheck, Download, CreditCard,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useChangelog } from '../hooks/useChangelog'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import IosInstallGuide from '../components/IosInstallGuide'
import { useTheme } from '../contexts/ThemeContext'
import AppearanceSection from '../components/settings/AppearanceSection'
import ChangelogSection from '../components/settings/ChangelogSection'
import MyAccountSection from '../components/settings/MyAccountSection'

type SettingsSection = 'changelog' | 'my-account' | 'appearance'

/* 이전 URL 호환용 리디렉션 맵 */
const SECTION_REDIRECTS: Record<string, SettingsSection | string> = {
  'account-info': 'my-account',
  'telegram': 'my-account',
  'account-manage': 'my-account',
  'management': '__redirect_settings__',
}

interface MenuItem {
  to: string
  label: string
  description: string
  icon: LucideIcon
  badge?: React.ReactNode
  section?: SettingsSection
  external?: boolean
}

/* ─── 메뉴 목록 (설정 메인) ─── */
function SettingsMenu({ menuItems }: { menuItems: MenuItem[] }) {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
        {menuItems.map((item, idx) => {
          const Icon = item.icon
          const className = `flex items-center gap-4 px-5 py-4 hover:bg-grape-50 transition-colors ${
            idx < menuItems.length - 1 ? 'border-b border-[var(--border-subtle)]' : ''
          }`
          const content = (
            <>
              <div className="relative flex-shrink-0">
                <Icon className="w-5 h-5 text-grape-500" />
                {item.badge}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">{item.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
            </>
          )
          return item.external ? (
            <a
              key={item.to}
              href={item.to}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {content}
            </a>
          ) : (
            <Link
              key={item.to}
              to={item.to}
              className={className}
            >
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/* ─── 메인 설정 페이지 ─── */
export default function SettingsPage() {
  const { user } = useAuth()
  const { hasUnread } = useChangelog()
  const { resolvedTheme } = useTheme()
  const { isInstalled, isIOS, promptInstall } = useInstallPrompt()
  const [showIosGuide, setShowIosGuide] = useState(false)
  const { section } = useParams<{ section: string }>()
  const navigate = useNavigate()

  const menuItems: MenuItem[] = [
    {
      to: '/categories',
      label: '카테고리',
      description: '지출/수입 분류 카테고리 관리',
      icon: Tags,
    },
    {
      to: '/budgets',
      label: '예산 관리',
      description: '카테고리별/월 총 예산 설정',
      icon: PiggyBank,
    },
    {
      to: '/payment-methods',
      label: '결제수단',
      description: '카드/현금 태깅 + 실적 추적',
      icon: CreditCard,
    },
    {
      to: '/recurring',
      label: '반복 거래',
      description: '정기 지출/수입 관리',
      icon: Repeat,
    },
    {
      to: '/households',
      label: '공유 가계부',
      description: '가구 생성, 초대, 멤버 관리',
      icon: Users,
    },
    {
      to: '/settings/appearance',
      label: '화면 모드',
      description: resolvedTheme === 'dark' ? '다크 모드' : '라이트 모드',
      icon: resolvedTheme === 'dark' ? Moon : Sun,
      section: 'appearance',
    },
    {
      to: '/settings/my-account',
      label: '내 계정',
      description: '프로필, 텔레그램/카카오톡 연동, 로그아웃',
      icon: User,
      section: 'my-account',
    },
    {
      to: '/settings/changelog',
      label: '새소식',
      description: '앱 업데이트 내역',
      icon: Megaphone,
      section: 'changelog',
      badge: hasUnread ? (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--surface-card)]" />
      ) : undefined,
    },
    {
      to: '/guide',
      label: '사용 가이드',
      description: '앱 기능별 상세 사용법',
      icon: BookOpen,
    },
    {
      to: '/feedback',
      label: '피드백',
      description: '기능 요청/버그 신고',
      icon: MessageSquarePlus,
    },
    ...(user?.is_admin ? [{
      to: '/admin',
      label: '관리자',
      description: '운영 현황, 피드백 관리, 사용자 관리',
      icon: ShieldCheck,
    }] : []),
  ]

  if (!user) return null

  // 이전 URL 호환: 삭제된 섹션은 새 섹션으로 리디렉션
  if (section && SECTION_REDIRECTS[section]) {
    const target = SECTION_REDIRECTS[section]
    navigate(target === '__redirect_settings__' ? '/settings' : `/settings/${target}`, { replace: true })
    return null
  }

  // 잘못된 섹션이면 설정 메인으로 리디렉션
  const validSections: SettingsSection[] = ['changelog', 'my-account', 'appearance']
  if (section && !validSections.includes(section as SettingsSection)) {
    navigate('/settings', { replace: true })
    return null
  }

  if (!section) {
    return (
      <div className="space-y-4">
        {/* PWA 설치 안내 (미설치 시에만) */}
        {!isInstalled && (
          <button
            onClick={() => isIOS ? setShowIosGuide(true) : promptInstall()}
            className="w-full bg-gradient-to-r from-grape-500 to-grape-600 rounded-2xl shadow-sm p-4 flex items-center gap-4 hover:from-grape-600 hover:to-grape-700 transition-all"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-white">앱으로 설치</p>
              <p className="text-xs text-white/70">
                {isIOS ? 'Safari에서 홈 화면에 추가' : '홈 화면에서 바로 실행하세요'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/50" />
          </button>
        )}
        <SettingsMenu menuItems={menuItems} />
        {showIosGuide && <IosInstallGuide onClose={() => setShowIosGuide(false)} />}
      </div>
    )
  }

  switch (section) {
    case 'appearance':
      return <AppearanceSection />
    case 'changelog':
      return <ChangelogSection />
    case 'my-account':
      return <MyAccountSection />
    default:
      return <SettingsMenu menuItems={menuItems} />
  }
}

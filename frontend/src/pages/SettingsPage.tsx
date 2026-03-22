/**
 * @file SettingsPage.tsx
 * @description 설정 페이지 - 메뉴 목록 → 서브 페이지 네스팅 구조
 */

import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  Tags, PiggyBank, Repeat, Users, LogOut, BookOpen, MessageSquarePlus,
  Megaphone, ChevronRight, ArrowLeft, User, Send, MessageCircle, ShieldCheck,
  Sun, Moon, Monitor, FileText, ScrollText, Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { generateTelegramLinkCode, unlinkTelegram } from '../api/telegram'
import { generateKakaoLinkCode, unlinkKakao } from '../api/kakao'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../hooks/useToast'
import { useChangelog } from '../hooks/useChangelog'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import IosInstallGuide from '../components/IosInstallGuide'
import { useTheme } from '../contexts/ThemeContext'
import type { ThemeMode } from '../contexts/ThemeContext'
import type { ChangelogItem } from '../data/changelogs'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'

const TAG_STYLES: Record<ChangelogItem['tag'], string> = {
  '신규': 'bg-grape-100 text-grape-600',
  '개선': 'bg-leaf-100 text-leaf-600',
  '수정': 'bg-[var(--surface-hover)] text-[var(--text-secondary)]',
}

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

/* ─── 서브 페이지 래퍼 ─── */
function SubPageWrapper({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/settings')}
        className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
      </button>
      {children}
    </div>
  )
}

/* ─── 화면 모드 섹션 ─── */
function AppearanceSection() {
  const { mode, setMode, resolvedTheme } = useTheme()

  const options: { value: ThemeMode; label: string; description: string; icon: LucideIcon }[] = [
    { value: 'system', label: '시스템 설정', description: '기기 설정에 따라 자동 전환', icon: Monitor },
    { value: 'light', label: '라이트 모드', description: '밝은 화면', icon: Sun },
    { value: 'dark', label: '다크 모드', description: '어두운 화면', icon: Moon },
  ]

  return (
    <SubPageWrapper>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-4">화면 모드</p>
        <div className="space-y-2">
          {options.map(opt => {
            const Icon = opt.icon
            const isSelected = mode === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors ${
                  isSelected
                    ? 'bg-grape-50 border-2 border-grape-500'
                    : 'bg-[var(--surface-elevated)] border-2 border-transparent hover:border-[var(--border-default)]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? 'text-grape-600' : 'text-[var(--text-muted)]'}`} />
                <div className="flex-1 text-left">
                  <p className={`text-sm font-medium ${isSelected ? 'text-grape-600' : 'text-[var(--text-primary)]'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">{opt.description}</p>
                </div>
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-grape-500 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
        {mode === 'system' && (
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">
            현재 적용: {resolvedTheme === 'dark' ? '다크 모드' : '라이트 모드'}
          </p>
        )}
      </div>
    </SubPageWrapper>
  )
}

/* ─── 새소식 섹션 ─── */
function ChangelogSection() {
  const { hasUnread, markAsRead, changelogs } = useChangelog()

  // 새소식 페이지 진입 시 즉시 읽음 처리
  useEffect(() => {
    if (hasUnread) markAsRead()
  }, [hasUnread, markAsRead])

  return (
    <SubPageWrapper>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
        <div className="space-y-4">
          {changelogs.map((log, idx) => (
            <div
              key={log.version}
              className={`relative pl-6 ${idx < changelogs.length - 1 ? 'pb-4 border-l-2 border-[var(--border-default)] ml-1' : 'ml-1'}`}
            >
              <div className={`absolute left-0 top-1 w-2.5 h-2.5 rounded-full -translate-x-[5px] ${
                idx === 0 ? 'bg-grape-500' : 'bg-warm-300'
              }`} />
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-sm font-bold text-[var(--text-primary)]">v{log.version}</span>
                <span className="text-xs text-[var(--text-muted)]">{log.date}</span>
              </div>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">{log.title}</p>
              <ul className="space-y-1">
                {log.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${TAG_STYLES[item.tag]}`}>
                      {item.tag}
                    </span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </SubPageWrapper>
  )
}

/* ─── 내 계정 섹션 (계정 정보 + 텔레그램 + 계정 관리 통합) ─── */
function MyAccountSection() {
  const { user, refreshUser, logout } = useAuth()
  const { addToast } = useToast()
  const [linkCode, setLinkCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [loadingCode, setLoadingCode] = useState(false)
  const [loadingUnlink, setLoadingUnlink] = useState(false)
  const [kakaoLinkCode, setKakaoLinkCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [loadingKakaoCode, setLoadingKakaoCode] = useState(false)
  const [loadingKakaoUnlink, setLoadingKakaoUnlink] = useState(false)

  const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'PodoBudgetBot'
  const KAKAO_CHANNEL_CHAT_URL = import.meta.env.VITE_KAKAO_CHANNEL_URL || 'http://pf.kakao.com/_xkxkAb/chat'

  const formatDate = (dateStr: string): string => dateStr.slice(0, 10).replace(/-/g, '.')

  const handleGenerateCode = async () => {
    setLoadingCode(true)
    try {
      const data = await generateTelegramLinkCode()
      setLinkCode(data)
    } catch {
      addToast('error', '코드 발급에 실패했습니다.')
    } finally {
      setLoadingCode(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm('텔레그램 연동을 해제할까요?')) return
    setLoadingUnlink(true)
    try {
      await unlinkTelegram()
      addToast('success', '텔레그램 연동이 해제되었습니다.')
      await refreshUser()
      setLinkCode(null)
    } catch {
      addToast('error', '연동 해제에 실패했습니다.')
    } finally {
      setLoadingUnlink(false)
    }
  }

  const handleCopyCode = async () => {
    if (!linkCode) return
    try {
      await navigator.clipboard.writeText(`/link ${linkCode.code}`)
      addToast('success', '복사되었습니다!')
    } catch {
      addToast('error', '자동 복사 실패 — 아래 명령어를 직접 복사해주세요')
    }
  }

  const handleGenerateKakaoCode = async () => {
    setLoadingKakaoCode(true)
    try {
      const data = await generateKakaoLinkCode()
      setKakaoLinkCode(data)
    } catch {
      addToast('error', '코드 발급에 실패했습니다.')
    } finally {
      setLoadingKakaoCode(false)
    }
  }

  const handleUnlinkKakao = async () => {
    if (!confirm('카카오톡 연동을 해제할까요?')) return
    setLoadingKakaoUnlink(true)
    try {
      await unlinkKakao()
      addToast('success', '카카오톡 연동이 해제되었습니다.')
      await refreshUser()
      setKakaoLinkCode(null)
    } catch {
      addToast('error', '연동 해제에 실패했습니다.')
    } finally {
      setLoadingKakaoUnlink(false)
    }
  }

  const handleCopyKakaoCode = async () => {
    if (!kakaoLinkCode) return
    try {
      // 카카오 봇은 "연동 {code}" 형식 사용 (한글 명령어 = /link 슬래시 명령어) (#200)
      await navigator.clipboard.writeText(`연동 ${kakaoLinkCode.code}`)
      addToast('success', '복사되었습니다!')
    } catch {
      addToast('error', '자동 복사 실패 — 아래 명령어를 직접 복사해주세요')
    }
  }

  if (!user) return null

  const expiresAt = linkCode
    ? new Date(linkCode.expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null

  const kakaoExpiresAt = kakaoLinkCode
    ? new Date(kakaoLinkCode.expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <SubPageWrapper>
      {/* 기본 정보 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">기본 정보</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
            <span className="text-sm font-medium text-[var(--text-secondary)]">사용자명</span>
            <span className="text-sm text-[var(--text-primary)]">{user.username}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
            <span className="text-sm font-medium text-[var(--text-secondary)]">이메일</span>
            <span className="text-sm text-[var(--text-primary)]">{user.email || '미등록'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">가입일</span>
            <span className="text-sm text-[var(--text-primary)]">{formatDate(user.created_at)}</span>
          </div>
        </div>
      </div>

      {/* 연동 서비스 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">연동 서비스</p>
        <div className="flex items-center gap-3 mb-3">
          <Send className="w-5 h-5 text-grape-500" />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">텔레그램</p>
            <p className="text-xs text-[var(--text-tertiary)]">봇으로 지출/수입을 바로 입력</p>
          </div>
        </div>

        {user.is_telegram_linked ? (
          <div className="flex items-center justify-between py-2 px-3 bg-leaf-50 rounded-xl">
            <span className="text-sm text-leaf-600 font-medium">✅ 연동됨</span>
            <button
              onClick={handleUnlink}
              disabled={loadingUnlink}
              className="text-sm text-[var(--text-tertiary)] hover:text-red-500 underline disabled:opacity-50"
            >
              {loadingUnlink ? '해제 중...' : '연동 해제'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[var(--surface-elevated)] rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">연동 방법</p>
              <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center">1</span>
                  <span>텔레그램 앱에서 <span className="font-mono bg-[var(--surface-hover)] px-1 rounded">@{TELEGRAM_BOT_USERNAME}</span>을 검색하거나 <a href={`https://t.me/${TELEGRAM_BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="text-grape-600 underline">t.me/{TELEGRAM_BOT_USERNAME}</a> 으로 접속하세요</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center">2</span>
                  <span>봇에서 <span className="font-mono bg-[var(--surface-hover)] px-1 rounded">/start</span>를 입력해 시작하세요</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center">3</span>
                  <span>아래 <strong>연동 코드 발급</strong> 버튼을 눌러 코드를 받으세요 (15분 유효)</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center">4</span>
                  <span>봇에 <span className="font-mono bg-[var(--surface-hover)] px-1 rounded">/link 발급된코드</span>를 입력하면 연동 완료!</span>
                </li>
              </ol>
              <div className="mt-3 bg-grape-50 rounded-lg p-3 text-xs text-[var(--text-secondary)] space-y-1">
                <p className="font-semibold text-[var(--text-secondary)]">연동 후 이런 게 가능해요</p>
                <p>• <span className="font-mono">"오늘 점심 8000원"</span> → AI가 자동으로 카테고리 분류</p>
                <p>• <span className="font-mono">"어제 교통비 3회 각 1500원"</span> → 여러 건 한 번에 입력</p>
                <p>• <span className="font-mono">"이번 달 얼마 썼어?"</span> → 지출 현황 조회</p>
              </div>
            </div>

            {linkCode ? (
              <div className="bg-grape-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">발급된 연동 코드</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-grape-600 tracking-widest">
                    {linkCode.code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="text-xs text-grape-600 border border-grape-300 rounded-lg px-3 py-1 hover:bg-grape-100"
                  >
                    /link {linkCode.code} 복사
                  </button>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">⏰ {expiresAt}까지 유효 (만료 전 입력하세요)</p>
                <div
                  role="button"
                  tabIndex={0}
                  className="bg-[var(--surface-card)] rounded-lg p-3 border border-grape-200 cursor-pointer active:bg-grape-50"
                  onClick={(e) => {
                    const el = e.currentTarget.querySelector('p.selectable')
                    if (el && window.getSelection) {
                      const range = document.createRange()
                      range.selectNodeContents(el)
                      const sel = window.getSelection()
                      sel?.removeAllRanges()
                      sel?.addRange(range)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      const el = e.currentTarget.querySelector('p.selectable')
                      if (el && window.getSelection) {
                        const range = document.createRange()
                        range.selectNodeContents(el)
                        const sel = window.getSelection()
                        sel?.removeAllRanges()
                        sel?.addRange(range)
                      }
                    }
                  }}
                >
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">텔레그램 봇에 아래 명령어를 입력하세요: (탭하면 선택됩니다)</p>
                  <p className="selectable font-mono text-sm text-grape-600 font-bold select-all">/link {linkCode.code}</p>
                </div>
                {/* 딥링크 버튼 */}
                <a
                  href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${linkCode.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-grape-600 text-white rounded-xl py-3 font-medium hover:bg-grape-700 transition-colors"
                >
                  텔레그램에서 바로 연동하기
                </a>
                <p className="text-xs text-center text-[var(--text-tertiary)]">
                  버튼을 누르면 텔레그램이 열리고 자동으로 연동돼요
                </p>
              </div>
            ) : (
              <button
                onClick={handleGenerateCode}
                disabled={loadingCode}
                className="w-full py-2.5 rounded-xl bg-grape-600 text-white text-sm font-medium hover:bg-grape-700 disabled:opacity-50"
              >
                {loadingCode ? '발급 중...' : '연동 코드 발급'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 카카오톡 연동 서비스 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">카카오톡 연동</p>
        <div className="flex items-center gap-3 mb-3">
          <MessageCircle className="w-5 h-5 text-grape-500" />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">카카오톡</p>
            <p className="text-xs text-[var(--text-tertiary)]">카카오톡 채널로 지출/수입을 바로 입력</p>
          </div>
        </div>

        {user.is_kakao_linked ? (
          <div className="flex items-center justify-between py-2 px-3 bg-leaf-50 rounded-xl">
            <span className="text-sm text-leaf-600 font-medium">✅ 연동됨</span>
            <button
              onClick={handleUnlinkKakao}
              disabled={loadingKakaoUnlink}
              className="text-sm text-[var(--text-tertiary)] hover:text-red-500 underline disabled:opacity-50"
            >
              {loadingKakaoUnlink ? '해제 중...' : '연동 해제'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[var(--surface-elevated)] rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">연동 방법</p>
              <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center">1</span>
                  <span>카카오톡에서 <span className="font-mono bg-[var(--surface-hover)] px-1 rounded">포도가계부</span> 채널을 검색하여 추가하세요</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center">2</span>
                  <span>채널 채팅에서 아무 메시지나 보내 시작하세요</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center">3</span>
                  <span>아래 <strong>연동 코드 발급</strong> 버튼을 눌러 코드를 받으세요 (15분 유효)</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center">4</span>
                  <span>채널 채팅에 <span className="font-mono bg-[var(--surface-hover)] px-1 rounded">/link 발급된코드</span>를 입력하면 연동 완료!</span>
                </li>
              </ol>
              <div className="mt-3 bg-grape-50 rounded-lg p-3 text-xs text-[var(--text-secondary)] space-y-1">
                <p className="font-semibold text-[var(--text-secondary)]">연동 후 이런 게 가능해요</p>
                <p>• <span className="font-mono">"오늘 점심 8000원"</span> → AI가 자동으로 카테고리 분류</p>
                <p>• <span className="font-mono">"어제 교통비 3회 각 1500원"</span> → 여러 건 한 번에 입력</p>
                <p>• <span className="font-mono">/report</span> → 이번 달 지출 요약 조회</p>
              </div>
            </div>

            {kakaoLinkCode ? (
              <div className="bg-grape-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">발급된 연동 코드</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-grape-600 tracking-widest">
                    {kakaoLinkCode.code}
                  </span>
                  <button
                    onClick={handleCopyKakaoCode}
                    className="text-xs text-grape-600 border border-grape-300 rounded-lg px-3 py-1 hover:bg-grape-100"
                  >
                    /link {kakaoLinkCode.code} 복사
                  </button>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">⏰ {kakaoExpiresAt}까지 유효 (만료 전 입력하세요)</p>
                <div
                  role="button"
                  tabIndex={0}
                  className="bg-[var(--surface-card)] rounded-lg p-3 border border-grape-200 cursor-pointer active:bg-grape-50"
                  onClick={(e) => {
                    const el = e.currentTarget.querySelector('p.selectable')
                    if (el && window.getSelection) {
                      const range = document.createRange()
                      range.selectNodeContents(el)
                      const sel = window.getSelection()
                      sel?.removeAllRanges()
                      sel?.addRange(range)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      const el = e.currentTarget.querySelector('p.selectable')
                      if (el && window.getSelection) {
                        const range = document.createRange()
                        range.selectNodeContents(el)
                        const sel = window.getSelection()
                        sel?.removeAllRanges()
                        sel?.addRange(range)
                      }
                    }
                  }}
                >
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">카카오톡 채널 채팅에 아래 명령어를 입력하세요: (탭하면 선택됩니다)</p>
                  <p className="selectable font-mono text-sm text-grape-600 font-bold select-all">연동 {kakaoLinkCode.code}</p>
                </div>
                {/* 간편 연동 버튼: 코드 복사 + 카카오 채팅 열기 */}
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`연동 ${kakaoLinkCode.code}`)
                      window.open(KAKAO_CHANNEL_CHAT_URL, '_blank')
                      addToast('success', '연동 코드가 복사되었어요. 카카오톡에서 붙여넣기 해주세요!')
                    } catch {
                      addToast('error', '클립보드 복사에 실패했어요')
                    }
                  }}
                  className="block w-full text-center bg-[#FEE500] text-[#191919] rounded-xl py-3 font-medium hover:bg-[#FDD835] transition-colors"
                >
                  💬 카카오톡에서 연동하기
                </button>
                <p className="text-xs text-center text-[var(--text-tertiary)]">
                  코드가 복사돼요. 카카오톡에서 붙여넣기만 하면 끝!
                </p>
              </div>
            ) : (
              <button
                onClick={handleGenerateKakaoCode}
                disabled={loadingKakaoCode}
                className="w-full py-2.5 rounded-xl bg-grape-600 text-white text-sm font-medium hover:bg-grape-700 disabled:opacity-50"
              >
                {loadingKakaoCode ? '발급 중...' : '연동 코드 발급'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 계정 액션 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
        <div className="flex flex-wrap gap-3">
          <a
            href={AUTH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-grape-300 text-grape-600 text-sm font-medium hover:bg-grape-50 transition-colors"
          >
            포도 통합 계정 관리 →
          </a>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-medium hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>
    </SubPageWrapper>
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
    {
      to: 'https://auth.podonest.com/privacy',
      label: '개인정보 처리방침',
      description: '개인정보 수집·이용 안내',
      icon: FileText,
      external: true,
    },
    {
      to: 'https://auth.podonest.com/terms',
      label: '서비스 이용약관',
      description: '서비스 이용 조건',
      icon: ScrollText,
      external: true,
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

/**
 * @file SettingsPage.tsx
 * @description 설정 페이지 - 메뉴 목록 → 서브 페이지 네스팅 구조
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useGoBack } from '../hooks/useGoBack'
import {
  Tags, PiggyBank, Repeat, Users, LogOut, BookOpen, MessageSquarePlus,
  Megaphone, ChevronRight, ArrowLeft, User, Send, MessageCircle, ShieldCheck,
  Sun, Moon, Monitor, FileText, ScrollText, Download, Key, Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../hooks/useToast'
import { useBotLinking } from '../hooks/useBotLinking'
import { useChangelog } from '../hooks/useChangelog'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import IosInstallGuide from '../components/IosInstallGuide'
import { useTheme } from '../contexts/ThemeContext'
import type { ThemeMode } from '../contexts/ThemeContext'
import type { ChangelogItem } from '../data/changelogs'
import { supabase } from '../utils/supabase'
import apiClient from '../api/client'

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
  const goBack = useGoBack('/settings')
  return (
    <div className="space-y-6">
      <button
        onClick={() => goBack()}
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
  const { user, logout } = useAuth()
  const { addToast } = useToast()

  /* 텔레그램/카카오 연동 — 공통 훅으로 중복 제거 */
  const telegram = useBotLinking('telegram')
  const kakao = useBotLinking('kakao')

  const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'PodoBudgetBot'
  const KAKAO_CHANNEL_CHAT_URL = import.meta.env.VITE_KAKAO_CHANNEL_URL || 'http://pf.kakao.com/_xkxkAb/chat'

  const formatDate = (dateStr: string): string => dateStr.slice(0, 10).replace(/-/g, '.')

  if (!user) return null

  const expiresAt = telegram.linkCode
    ? new Date(telegram.linkCode.expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null

  const kakaoExpiresAt = kakao.linkCode
    ? new Date(kakao.linkCode.expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
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
              onClick={telegram.unlink}
              disabled={telegram.loadingUnlink}
              className="text-sm text-[var(--text-tertiary)] hover:text-red-500 underline disabled:opacity-50"
            >
              {telegram.loadingUnlink ? '해제 중...' : '연동 해제'}
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

            {telegram.linkCode ? (
              <div className="bg-grape-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">발급된 연동 코드</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-grape-600 tracking-widest">
                    {telegram.linkCode.code}
                  </span>
                  <button
                    onClick={telegram.copyCode}
                    className="text-xs text-grape-600 border border-grape-300 rounded-lg px-3 py-1 hover:bg-grape-100"
                  >
                    /link {telegram.linkCode.code} 복사
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
                  <p className="selectable font-mono text-sm text-grape-600 font-bold select-all">/link {telegram.linkCode.code}</p>
                </div>
                {/* 딥링크 버튼 */}
                <a
                  href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${telegram.linkCode.code}`}
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
                onClick={telegram.generateCode}
                disabled={telegram.loadingCode}
                className="w-full py-2.5 rounded-xl bg-grape-600 text-white text-sm font-medium hover:bg-grape-700 disabled:opacity-50"
              >
                {telegram.loadingCode ? '발급 중...' : '연동 코드 발급'}
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
              onClick={kakao.unlink}
              disabled={kakao.loadingUnlink}
              className="text-sm text-[var(--text-tertiary)] hover:text-red-500 underline disabled:opacity-50"
            >
              {kakao.loadingUnlink ? '해제 중...' : '연동 해제'}
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

            {kakao.linkCode ? (
              <div className="bg-grape-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">발급된 연동 코드</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-grape-600 tracking-widest">
                    {kakao.linkCode.code}
                  </span>
                  <button
                    onClick={kakao.copyCode}
                    className="text-xs text-grape-600 border border-grape-300 rounded-lg px-3 py-1 hover:bg-grape-100"
                  >
                    /link {kakao.linkCode.code} 복사
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
                  <p className="selectable font-mono text-sm text-grape-600 font-bold select-all">연동 {kakao.linkCode.code}</p>
                </div>
                {/* 간편 연동 버튼: 코드 복사 + 카카오 채팅 열기 */}
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`연동 ${kakao.linkCode!.code}`)
                      window.open(KAKAO_CHANNEL_CHAT_URL, '_blank')
                      addToast('success', '연동 코드가 복사되었습니다')
                    } catch {
                      addToast('error', '복사에 실패했습니다')
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
                onClick={kakao.generateCode}
                disabled={kakao.loadingCode}
                className="w-full py-2.5 rounded-xl bg-grape-600 text-white text-sm font-medium hover:bg-grape-700 disabled:opacity-50"
              >
                {kakao.loadingCode ? '발급 중...' : '연동 코드 발급'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 비밀번호 변경 */}
      <PasswordChangeCard />

      {/* 계정 액션 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-medium hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>

      {/* 계정 삭제 */}
      <AccountDeleteCard />
    </SubPageWrapper>
  )
}

/** 비밀번호 변경 카드 */
function PasswordChangeCard() {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      addToast('success', '비밀번호가 변경되었습니다')
      setOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('should be at least')) {
        setError('비밀번호는 6자 이상이어야 합니다')
      } else if (message.includes('same password')) {
        setError('현재 비밀번호와 동일합니다')
      } else {
        setError(message || '비밀번호 변경에 실패했습니다')
      }
    } finally {
      setLoading(false)
    }
  }, [newPassword, confirmPassword, addToast])

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-grape-600 transition-colors"
        >
          <Key className="w-4 h-4" />
          비밀번호 변경
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">비밀번호 변경</h3>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            required
            minLength={6}
            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl bg-[var(--surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-grape-300"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
            required
            minLength={6}
            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl bg-[var(--surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-grape-300"
          />
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '변경 중...' : '변경'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError('') }}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-default)] rounded-xl hover:bg-[var(--surface-elevated)] transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/** 계정 삭제 카드 */
function AccountDeleteCard() {
  const { logout } = useAuth()
  const { addToast } = useToast()
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [confirmText, setConfirmText] = useState('')

  const handleDelete = useCallback(async () => {
    setStep('deleting')
    try {
      // 백엔드에 계정 삭제 요청 (소프트 삭제 + 익명화)
      await apiClient.delete('/api/auth/me')
    } catch {
      addToast('error', '계정 삭제에 실패했습니다. 다시 시도해주세요.')
      setStep('idle')
      return
    }
    // 백엔드 삭제 성공 후에는 무조건 로그아웃 (Supabase signOut 실패해도 진행)
    try { await supabase.auth.signOut() } catch { /* 무시 */ }
    addToast('success', '계정이 삭제되었습니다')
    logout()
  }, [logout, addToast])

  if (step === 'idle') {
    return (
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-red-200 dark:border-red-900/30 p-6">
        <button
          onClick={() => setStep('confirm')}
          className="inline-flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          계정 삭제
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-red-300 dark:border-red-900/50 p-6 space-y-3">
      <h3 className="text-sm font-semibold text-red-600">계정을 정말 삭제하시겠습니까?</h3>
      <p className="text-xs text-[var(--text-tertiary)]">
        모든 데이터(거래 내역, 예산, 카테고리 등)가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
      </p>
      <p className="text-xs text-[var(--text-secondary)]">
        확인하려면 아래에 <strong>삭제</strong>를 입력하세요.
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="삭제"
        className="w-full px-3 py-2 border border-red-300 rounded-xl bg-[var(--surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-red-300"
      />
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={confirmText !== '삭제' || step === 'deleting'}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {step === 'deleting' ? '삭제 중...' : '계정 영구 삭제'}
        </button>
        <button
          onClick={() => { setStep('idle'); setConfirmText('') }}
          className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-default)] rounded-xl hover:bg-[var(--surface-elevated)] transition-colors"
        >
          취소
        </button>
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

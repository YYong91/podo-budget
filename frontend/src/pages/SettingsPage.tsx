/**
 * @file SettingsPage.tsx
 * @description 설정 페이지 - 계정 정보 및 텔레그램 연동
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Tags, PiggyBank, Repeat, Users, LogOut, BookOpen, MessageSquarePlus, Megaphone } from 'lucide-react'
import { generateTelegramLinkCode, unlinkTelegram } from '../api/telegram'
import { useAuth } from '../contexts/AuthContext'
import { useChangelog } from '../hooks/useChangelog'
import type { ChangelogItem } from '../data/changelogs'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'

const TAG_STYLES: Record<ChangelogItem['tag'], string> = {
  '신규': 'bg-grape-100 text-grape-700',
  '개선': 'bg-leaf-100 text-leaf-700',
  '수정': 'bg-warm-100 text-warm-700',
}

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth()
  const { hasUnread, markAsRead, changelogs } = useChangelog()
  const changelogRef = useRef<HTMLDivElement>(null)
  const [linkCode, setLinkCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [loadingCode, setLoadingCode] = useState(false)
  const [loadingUnlink, setLoadingUnlink] = useState(false)

  // 새소식 섹션이 화면에 보이면 읽음 처리
  useEffect(() => {
    if (!hasUnread || !changelogRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) markAsRead() },
      { threshold: 0.3 },
    )
    observer.observe(changelogRef.current)
    return () => observer.disconnect()
  }, [hasUnread, markAsRead])

  const formatDate = (dateStr: string): string => dateStr.slice(0, 10).replace(/-/g, '.')

  const handleGenerateCode = async () => {
    setLoadingCode(true)
    try {
      const data = await generateTelegramLinkCode()
      setLinkCode(data)
    } catch {
      toast.error('코드 발급에 실패했습니다.')
    } finally {
      setLoadingCode(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm('텔레그램 연동을 해제할까요?')) return
    setLoadingUnlink(true)
    try {
      await unlinkTelegram()
      toast.success('텔레그램 연동이 해제되었습니다.')
      await refreshUser()
      setLinkCode(null)
    } catch {
      toast.error('연동 해제에 실패했습니다.')
    } finally {
      setLoadingUnlink(false)
    }
  }

  const handleCopyCode = async () => {
    if (!linkCode) return
    try {
      await navigator.clipboard.writeText(`/link ${linkCode.code}`)
      toast.success('복사되었습니다!')
    } catch {
      toast.error('자동 복사 실패 — 아래 명령어를 직접 복사해주세요')
    }
  }

  if (!user) return null

  const expiresAt = linkCode
    ? new Date(linkCode.expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-grape-700">설정</h1>

      {/* 새소식 */}
      <div ref={changelogRef} className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Megaphone className="w-5 h-5 text-grape-500" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </div>
          <h2 className="text-lg font-semibold text-warm-900">새소식</h2>
          {hasUnread && (
            <span className="text-xs bg-grape-100 text-grape-700 px-2 py-0.5 rounded-full font-medium">
              새 업데이트
            </span>
          )}
        </div>
        <div className="space-y-4">
          {changelogs.map((log, idx) => (
            <div
              key={log.version}
              className={`relative pl-6 ${idx < changelogs.length - 1 ? 'pb-4 border-l-2 border-warm-200 ml-1' : 'ml-1'}`}
            >
              {/* 타임라인 점 */}
              <div className={`absolute left-0 top-1 w-2.5 h-2.5 rounded-full -translate-x-[5px] ${
                idx === 0 ? 'bg-grape-500' : 'bg-warm-300'
              }`} />
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-sm font-bold text-warm-900">v{log.version}</span>
                <span className="text-xs text-warm-400">{log.date}</span>
              </div>
              <p className="text-sm font-medium text-warm-700 mb-2">{log.title}</p>
              <ul className="space-y-1">
                {log.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-warm-600">
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

      {/* 관리 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <h2 className="text-lg font-semibold text-warm-900 mb-4">관리</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/categories"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warm-200 hover:bg-grape-50 hover:border-grape-200 transition-colors"
          >
            <Tags className="w-5 h-5 text-grape-500" />
            <span className="text-sm font-medium text-warm-800">카테고리</span>
          </Link>
          <Link
            to="/budgets"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warm-200 hover:bg-grape-50 hover:border-grape-200 transition-colors"
          >
            <PiggyBank className="w-5 h-5 text-grape-500" />
            <span className="text-sm font-medium text-warm-800">예산 관리</span>
          </Link>
          <Link
            to="/recurring"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warm-200 hover:bg-grape-50 hover:border-grape-200 transition-colors"
          >
            <Repeat className="w-5 h-5 text-grape-500" />
            <span className="text-sm font-medium text-warm-800">반복 거래</span>
          </Link>
          <Link
            to="/households"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warm-200 hover:bg-grape-50 hover:border-grape-200 transition-colors"
          >
            <Users className="w-5 h-5 text-grape-500" />
            <span className="text-sm font-medium text-warm-800">공유 가계부</span>
          </Link>
          <Link
            to="/guide"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warm-200 hover:bg-grape-50 hover:border-grape-200 transition-colors"
          >
            <BookOpen className="w-5 h-5 text-grape-500" />
            <span className="text-sm font-medium text-warm-800">사용 가이드</span>
          </Link>
          <Link
            to="/feedback"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warm-200 hover:bg-grape-50 hover:border-grape-200 transition-colors"
          >
            <MessageSquarePlus className="w-5 h-5 text-grape-500" />
            <span className="text-sm font-medium text-warm-800">피드백</span>
          </Link>
        </div>
      </div>

      {/* 계정 정보 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <h2 className="text-lg font-semibold text-warm-900 mb-4">계정 정보</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-warm-100">
            <span className="text-sm font-medium text-warm-600">사용자명</span>
            <span className="text-sm text-warm-900">{user.username}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-warm-100">
            <span className="text-sm font-medium text-warm-600">이메일</span>
            <span className="text-sm text-warm-900">{user.email || '미등록'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-warm-600">가입일</span>
            <span className="text-sm text-warm-900">{formatDate(user.created_at)}</span>
          </div>
        </div>
      </div>

      {/* 텔레그램 연동 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <h2 className="text-lg font-semibold text-warm-900 mb-1">텔레그램 연동</h2>
        <p className="text-sm text-warm-500 mb-4">
          텔레그램 봇에서 말하듯이 지출/수입을 바로 입력할 수 있습니다.
          <br />
          예: <span className="font-mono text-warm-700">"오늘 점심 김치찌개 8000원"</span>
          <span className="font-mono text-warm-700">, "월급 320만원 받았어"</span>
        </p>

        {user.is_telegram_linked ? (
          /* 연동 상태 */
          <div className="flex items-center justify-between">
            <span className="text-sm text-leaf-600 font-medium">✅ 연동됨</span>
            <button
              onClick={handleUnlink}
              disabled={loadingUnlink}
              className="text-sm text-warm-500 hover:text-red-500 underline disabled:opacity-50"
            >
              {loadingUnlink ? '해제 중...' : '연동 해제'}
            </button>
          </div>
        ) : (
          /* 미연동 상태 */
          <div className="space-y-4">
            {/* 연동 방법 안내 */}
            <div className="bg-warm-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-warm-600 uppercase tracking-wide">연동 방법</p>
              <ol className="space-y-2 text-sm text-warm-700">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-700 text-xs font-bold flex items-center justify-center">1</span>
                  <span>텔레그램 앱에서 <span className="font-mono bg-warm-100 px-1 rounded">@homenrich_bot</span>을 검색하거나 <a href="https://t.me/homenrich_bot" target="_blank" rel="noopener noreferrer" className="text-grape-600 underline">t.me/homenrich_bot</a> 으로 접속하세요</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-700 text-xs font-bold flex items-center justify-center">2</span>
                  <span>봇에서 <span className="font-mono bg-warm-100 px-1 rounded">/start</span>를 입력해 시작하세요</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-700 text-xs font-bold flex items-center justify-center">3</span>
                  <span>아래 <strong>연동 코드 발급</strong> 버튼을 눌러 코드를 받으세요 (15분 유효)</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-700 text-xs font-bold flex items-center justify-center">4</span>
                  <span>봇에 <span className="font-mono bg-warm-100 px-1 rounded">/link 발급된코드</span>를 입력하면 연동 완료!</span>
                </li>
              </ol>
              <div className="mt-3 bg-grape-50 rounded-lg p-3 text-xs text-warm-600 space-y-1">
                <p className="font-semibold text-warm-700">연동 후 이런 게 가능해요</p>
                <p>• <span className="font-mono">"오늘 점심 8000원"</span> → AI가 자동으로 카테고리 분류</p>
                <p>• <span className="font-mono">"어제 교통비 3회 각 1500원"</span> → 여러 건 한 번에 입력</p>
                <p>• <span className="font-mono">"이번 달 얼마 썼어?"</span> → 지출 현황 조회</p>
              </div>
            </div>

            {linkCode ? (
              <div className="bg-grape-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-warm-600 uppercase tracking-wide">발급된 연동 코드</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-grape-700 tracking-widest">
                    {linkCode.code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="text-xs text-grape-600 border border-grape-300 rounded-lg px-3 py-1 hover:bg-grape-100"
                  >
                    /link {linkCode.code} 복사
                  </button>
                </div>
                <p className="text-xs text-warm-500">⏰ {expiresAt}까지 유효 (만료 전 입력하세요)</p>
                <div
                  className="bg-white rounded-lg p-3 border border-grape-200 cursor-pointer active:bg-grape-50"
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
                >
                  <p className="text-xs text-warm-500 mb-1">텔레그램 봇에 아래 명령어를 입력하세요: (탭하면 선택됩니다)</p>
                  <p className="selectable font-mono text-sm text-grape-700 font-bold select-all">/link {linkCode.code}</p>
                </div>
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

      {/* 계정 관리 안내 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <h2 className="text-lg font-semibold text-warm-900 mb-2">계정 관리</h2>
        <p className="text-sm text-warm-600 mb-4">
          비밀번호 변경, 계정 삭제 등은 포도 통합 계정에서 관리합니다.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={AUTH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-grape-300 text-grape-700 text-sm font-medium hover:bg-grape-50 transition-colors"
          >
            포도 통합 계정 관리 →
          </a>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-warm-300 text-warm-600 text-sm font-medium hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}

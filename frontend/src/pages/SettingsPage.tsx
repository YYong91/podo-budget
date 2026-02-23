/**
 * @file SettingsPage.tsx
 * @description 설정 페이지 - 계정 정보 및 텔레그램 연동
 */

import { useState } from 'react'
import toast from 'react-hot-toast'
import { generateTelegramLinkCode, unlinkTelegram } from '../api/telegram'
import { useAuth } from '../contexts/AuthContext'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const [linkCode, setLinkCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [loadingCode, setLoadingCode] = useState(false)
  const [loadingUnlink, setLoadingUnlink] = useState(false)

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
    await navigator.clipboard.writeText(`/link ${linkCode.code}`)
    toast.success('복사되었습니다!')
  }

  if (!user) return null

  const expiresAt = linkCode
    ? new Date(linkCode.expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-grape-700">설정</h1>

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
          텔레그램 봇에서 자연어로 지출/수입을 바로 입력할 수 있습니다.
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
                  <span>텔레그램 앱에서 <span className="font-mono bg-warm-100 px-1 rounded">@podo_budget_bot</span>을 검색하거나 <a href="https://t.me/podo_budget_bot" target="_blank" rel="noopener noreferrer" className="text-grape-600 underline">t.me/podo_budget_bot</a> 으로 접속하세요</span>
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
                <div className="bg-white rounded-lg p-3 border border-grape-200">
                  <p className="text-xs text-warm-500 mb-1">텔레그램 봇에 아래 명령어를 입력하세요:</p>
                  <p className="font-mono text-sm text-grape-700 font-bold">/link {linkCode.code}</p>
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
        <a
          href={AUTH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-grape-300 text-grape-700 text-sm font-medium hover:bg-grape-50 transition-colors"
        >
          포도 통합 계정 관리 →
        </a>
      </div>
    </div>
  )
}

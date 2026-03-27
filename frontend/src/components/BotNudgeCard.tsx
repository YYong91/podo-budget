/**
 * @file BotNudgeCard.tsx
 * @description 봇 연동 넛지 카드 — 첫 지출 저장 후 카카오톡/텔레그램 연동을 유도.
 *
 * 표시 조건:
 * - 봇 미연동 (is_telegram_linked=false && is_kakao_linked=false)
 * - 지출 1건 이상 존재
 * - localStorage 'podo-bot-nudge-dismissed' !== 'true'
 *
 * "나중에" 클릭 시 localStorage에 플래그 저장하여 재표시 방지.
 */

import { useNavigate } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'

interface BotNudgeCardProps {
  onDismiss: () => void
}

export default function BotNudgeCard({ onDismiss }: BotNudgeCardProps) {
  const navigate = useNavigate()

  return (
    <div className="bg-gradient-to-r from-grape-50 to-leaf-50/40 rounded-2xl shadow-sm border border-grape-200/60 overflow-hidden">
      <div className="px-4 py-4">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-grape-100 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-grape-600" />
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              카카오톡으로 더 빠르게 입력할 수 있어요
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 -mr-1 rounded-lg hover:bg-grape-100 text-[var(--text-muted)] transition-colors"
            aria-label="봇 연동 안내 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-tertiary)] mb-3 ml-10">
          봇을 연동하면 메신저에서 바로 가계부를 쓸 수 있어요
        </p>

        {/* 버튼 그룹 */}
        <div className="flex items-center gap-2 ml-10">
          <button
            onClick={() => navigate('/settings/my-account')}
            className="px-4 py-2 bg-grape-600 text-white text-sm font-medium rounded-xl hover:bg-grape-700 active:scale-[0.98] transition-all shadow-sm shadow-grape-200"
          >
            카카오톡 연동하기
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  )
}

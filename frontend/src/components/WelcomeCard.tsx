/**
 * @file WelcomeCard.tsx
 * @description 온보딩 시작 가이드 카드 — 홈화면 상단에 표시
 * 4개 체크리스트 항목의 완료 상태를 보여주고, 미완료 항목 클릭 시 해당 페이지로 이동한다.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Check, Circle, ChevronRight,
  PenLine, Target, MessageCircle, Smartphone,
} from 'lucide-react'

interface WelcomeCardProps {
  hasTransaction: boolean
  hasBudget: boolean
  isBotLinked: boolean
  isPwaInstalled: boolean
  canPromptPwa: boolean
  isIos: boolean
  onPromptPwa: () => void
  onIosGuide?: () => void
  onDismiss: () => void
}

interface ChecklistItem {
  key: string
  label: string
  done: boolean
  icon: React.ReactNode
  action: () => void
}

export default function WelcomeCard({
  hasTransaction,
  hasBudget,
  isBotLinked,
  isPwaInstalled,
  canPromptPwa,
  isIos,
  onPromptPwa,
  onIosGuide,
  onDismiss,
}: WelcomeCardProps) {
  const navigate = useNavigate()

  const items: ChecklistItem[] = [
    {
      key: 'transaction',
      label: '첫 거래 입력하기',
      done: hasTransaction,
      icon: <PenLine className="w-4 h-4" />,
      action: () => navigate('/expenses/new'),
    },
    {
      key: 'budget',
      label: '예산 설정하기',
      done: hasBudget,
      icon: <Target className="w-4 h-4" />,
      action: () => navigate('/budgets'),
    },
    {
      key: 'bot',
      label: '봇 연동하기',
      done: isBotLinked,
      icon: <MessageCircle className="w-4 h-4" />,
      action: () => navigate('/settings/my-account'),
    },
    {
      key: 'pwa',
      label: '홈화면에 추가하기',
      done: isPwaInstalled,
      icon: <Smartphone className="w-4 h-4" />,
      action: () => {
        if (canPromptPwa) {
          onPromptPwa()
        } else if (isIos) {
          onIosGuide?.()
        }
      },
    },
  ]

  const completedCount = items.filter((i) => i.done).length
  const allDone = completedCount === items.length

  // 전부 완료 시 3초 후 자동 닫기
  useEffect(() => {
    if (!allDone) return
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [allDone, onDismiss])

  if (allDone) {
    return (
      <div className="bg-gradient-to-r from-grape-50 to-leaf-50 rounded-2xl shadow-sm border border-grape-200 p-5 text-center">
        <p className="text-lg font-bold text-grape-700">모든 준비가 끝났어요!</p>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">이제 포도가계부를 마음껏 사용해보세요</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--text-primary)]">시작 가이드</span>
          <span className="text-xs text-grape-600 font-medium bg-grape-50 px-2 py-0.5 rounded-full">
            {completedCount}/{items.length}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
          aria-label="시작 가이드 닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 진행 바 */}
      <div className="mx-4 mb-3 h-1.5 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full bg-grape-500 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      {/* 체크리스트 */}
      <div className="px-2 pb-2">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={item.done ? undefined : item.action}
            disabled={item.done}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              item.done
                ? 'opacity-50 cursor-default'
                : 'hover:bg-[var(--surface-hover)] active:bg-[var(--surface-elevated)] cursor-pointer'
            }`}
          >
            {/* 체크 아이콘 */}
            {item.done ? (
              <div className="w-5 h-5 rounded-full bg-grape-500 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
            ) : (
              <Circle className="w-5 h-5 text-[var(--border-default)] flex-shrink-0" />
            )}

            {/* 아이콘 + 텍스트 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={item.done ? 'text-[var(--text-muted)]' : 'text-grape-600'}>
                {item.icon}
              </span>
              <span className={`text-sm ${
                item.done
                  ? 'line-through text-[var(--text-muted)]'
                  : 'text-[var(--text-primary)] font-medium'
              }`}>
                {item.label}
              </span>
            </div>

            {/* 화살표 */}
            {!item.done && (
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

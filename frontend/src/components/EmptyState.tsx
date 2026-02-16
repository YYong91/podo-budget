/**
 * @file EmptyState.tsx
 * @description 빈 상태를 표시하는 공통 컴포넌트
 * 데이터가 없을 때 사용자에게 안내 메시지와 CTA를 표시한다.
 */

import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

/**
 * 빈 상태 UI 컴포넌트
 * @param icon - 표시할 아이콘 (Lucide 아이콘 또는 커스텀 ReactNode, 선택)
 * @param title - 주요 메시지
 * @param description - 부가 설명 (선택)
 * @param action - 주요 액션 버튼 (선택)
 * @param secondaryAction - 보조 액션 버튼 (선택)
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  // 기본 아이콘: Lucide Inbox
  const defaultIcon = <Inbox className="w-8 h-8 text-grape-400" />

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-grape-50 flex items-center justify-center mb-4">
        {icon ?? defaultIcon}
      </div>
      <h3 className="text-lg font-semibold text-warm-900 mb-2 text-center">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-warm-500 mb-6 text-center max-w-md">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className="px-5 py-2.5 text-sm font-medium text-white bg-grape-600 hover:bg-grape-700 rounded-xl shadow-sm shadow-grape-200 active:scale-[0.98] transition-all"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-5 py-2.5 text-sm font-medium text-warm-700 bg-white border border-warm-300 hover:bg-warm-50 rounded-xl active:scale-[0.98] transition-all"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

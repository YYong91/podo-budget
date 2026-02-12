/**
 * @file EmptyState.tsx
 * @description 빈 상태를 표시하는 공통 컴포넌트
 * 데이터가 없을 때 사용자에게 안내 메시지와 CTA를 표시한다.
 */

interface EmptyStateProps {
  icon?: string
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
 * @param icon - 표시할 이모지 아이콘 (선택)
 * @param title - 주요 메시지
 * @param description - 부가 설명 (선택)
 * @param action - 주요 액션 버튼 (선택)
 * @param secondaryAction - 보조 액션 버튼 (선택)
 */
export default function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

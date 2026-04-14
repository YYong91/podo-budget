/**
 * @file EmptyState.tsx
 * @description 빈 상태를 표시하는 공통 컴포넌트
 * 데이터가 없을 때 사용자에게 안내 메시지와 CTA를 표시한다.
 *
 * variant 3티어:
 * - primary (기본): 전체 페이지 빈 상태 — 큰 아이콘 + 제목 + 설명 + 액션
 * - section: 섹션 내 빈 상태 — 작은 아이콘 + 작은 텍스트 + 액션
 * - inline: 인라인 빈 상태 — 텍스트만 (아이콘/버튼 없음)
 */

import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  variant?: 'primary' | 'section' | 'inline'
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
  /** 액션 버튼 아래에 렌더링할 추가 콘텐츠 (primary/section 전용) */
  children?: ReactNode
}

/**
 * 빈 상태 UI 컴포넌트
 * @param variant - 레이아웃 크기 (primary | section | inline, 기본값: primary)
 * @param icon - 표시할 아이콘 (Lucide 아이콘 또는 커스텀 ReactNode, 선택)
 * @param title - 주요 메시지
 * @param description - 부가 설명 (선택)
 * @param action - 주요 액션 버튼 (선택, inline에서는 무시)
 * @param secondaryAction - 보조 액션 버튼 (선택, inline에서는 무시)
 */
export default function EmptyState({
  variant = 'primary',
  icon,
  title,
  description,
  action,
  secondaryAction,
  children,
}: EmptyStateProps) {
  // inline: 아이콘/버튼 없이 텍스트만 표시하는 최소 레이아웃
  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center py-4 px-4">
        <p className="text-sm text-[var(--text-muted)] text-center">{title}</p>
      </div>
    )
  }

  // section: 작은 아이콘 + 작은 텍스트
  if (variant === 'section') {
    const sectionIcon = <Inbox className="w-6 h-6 text-grape-400" />

    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div
          data-testid="empty-state-icon"
          className="w-12 h-12 rounded-full bg-grape-50 flex items-center justify-center mb-3"
        >
          {icon ?? sectionIcon}
        </div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5 text-center">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-[var(--text-tertiary)] mb-4 text-center max-w-sm">
            {description}
          </p>
        )}
        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-2">
            {action && (
              <button
                onClick={action.onClick}
                className="px-4 py-2 text-xs font-medium text-white bg-grape-600 hover:bg-grape-700 rounded-lg shadow-sm shadow-grape-200 active:scale-[0.98] transition-all"
              >
                {action.label}
              </button>
            )}
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-default)] hover:bg-[var(--surface-hover)] rounded-lg active:scale-[0.98] transition-all"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // primary (기본): 전체 페이지용 큰 레이아웃
  const defaultIcon = <Inbox className="w-8 h-8 text-grape-400" />

  return (
    <div className={`flex flex-col items-center justify-center px-4 ${children ? 'pt-12 pb-4' : 'py-12'}`}>
      <div
        data-testid="empty-state-icon"
        className="w-16 h-16 rounded-full bg-grape-50 flex items-center justify-center mb-4"
      >
        {icon ?? defaultIcon}
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 text-center">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--text-tertiary)] mb-6 text-center max-w-md">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className={`flex flex-col sm:flex-row gap-3 ${children ? 'mb-6' : ''}`}>
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
              className="px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-default)] hover:bg-[var(--surface-hover)] rounded-xl active:scale-[0.98] transition-all"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

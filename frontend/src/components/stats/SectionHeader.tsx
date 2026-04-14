import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

type SectionHeaderProps = {
  icon: string
  title: string
  manageTo?: string
  expanded: boolean
  onToggle?: () => void
  collapsible?: boolean
  children?: ReactNode
}

export default function SectionHeader({
  icon,
  title,
  manageTo,
  expanded,
  onToggle,
  collapsible = true,
  children,
}: SectionHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        {collapsible ? (
          <button
            type="button"
            className="flex items-center gap-2 flex-1 text-left"
            onClick={() => onToggle?.()}
            aria-label={expanded ? '접기' : '펼치기'}
          >
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {icon} {title}
            </h2>
          </button>
        ) : (
          <h2 className="text-base font-semibold text-[var(--text-primary)] flex-1">
            {icon} {title}
          </h2>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {manageTo && (
            <Link
              to={manageTo}
              className="text-xs text-grape-600 hover:text-grape-700 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              관리
            </Link>
          )}
          {collapsible && (
            <span
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''} pointer-events-none`}
              aria-hidden
            >
              <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
            </span>
          )}
        </div>
      </div>
      {children}
    </>
  )
}

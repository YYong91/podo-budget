/**
 * @file AppearanceSection.tsx
 * @description 설정 > 화면 모드 섹션 — 라이트/다크/시스템 테마 선택
 */

import { Sun, Moon, Monitor } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import type { ThemeMode } from '../../contexts/ThemeContext'
import SubPageWrapper from './SubPageWrapper'

export default function AppearanceSection() {
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
                    ? 'bg-grape-500/10 border-2 border-grape-500'
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

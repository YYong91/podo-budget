/**
 * @file HouseholdBottomSheet.tsx
 * @description 가구 전환 바텀시트 — 복수 가구 소속 계정에서 활성 가구를 선택
 */

import { useEffect } from 'react'
import { X, Home, Check } from 'lucide-react'
import type { Household } from '../types'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

interface HouseholdBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  households: Household[]
  activeHouseholdId: number | null
  onSelect: (householdId: number) => void
}

export default function HouseholdBottomSheet({
  isOpen,
  onClose,
  households,
  activeHouseholdId,
  onSelect,
}: HouseholdBottomSheetProps) {
  useBodyScrollLock(isOpen)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center" role="dialog" aria-modal="true" aria-label="가계부 선택">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={onClose} />
      <div
        className="relative w-full md:max-w-sm bg-[var(--surface-card)] rounded-t-2xl md:rounded-2xl flex flex-col animate-sheet-up md:animate-none"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">가계부 선택</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-hover)]" aria-label="닫기">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* 가구 목록 */}
        <div className="overflow-y-auto overscroll-contain p-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {households.map(h => {
            const isActive = h.id === activeHouseholdId
            return (
              <button
                key={h.id}
                onClick={() => { onSelect(h.id); onClose() }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${
                  isActive
                    ? 'bg-grape-50 text-grape-600'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-grape-100' : 'bg-[var(--surface-hover)]'
                }`}>
                  <Home className="w-4 h-4" />
                </div>
                <span className="flex-1 text-left font-medium truncate">{h.name}</span>
                {isActive && <Check className="w-4 h-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

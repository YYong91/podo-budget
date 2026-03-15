/**
 * @file CategoryBottomSheet.tsx
 * @description 카테고리 선택 바텀시트 — 모바일에서는 하단 시트, PC에서는 중앙 모달
 */

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Category } from '../types'

interface CategoryBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (categoryId: number | null) => void
  categories: Category[]
  currentCategoryId: number | null
  transactionType: 'expense' | 'income'
  saving?: boolean
}

export default function CategoryBottomSheet({
  isOpen,
  onClose,
  onSelect,
  categories,
  currentCategoryId,
  transactionType,
  saving = false,
}: CategoryBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const filteredCategories = categories.filter(
    c => c.type === transactionType || c.type === 'both'
  )

  // Tailwind 동적 클래스 대신 조건부 전체 문자열 (빌드 시 감지 보장)
  const activeClass = transactionType === 'income'
    ? 'bg-leaf-50 text-leaf-600 font-medium'
    : 'bg-grape-50 text-grape-600 font-medium'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="relative w-full md:max-w-sm bg-[var(--surface-card)] rounded-t-2xl md:rounded-2xl max-h-[60vh] flex flex-col animate-slide-up md:animate-none"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">카테고리 변경</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-hover)]">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="overflow-y-auto p-2">
          {saving ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full border-b-2 border-warm-400 w-5 h-5" />
            </div>
          ) : (
            <>
              <button
                onClick={() => onSelect(null)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  currentCategoryId === null ? activeClass : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                미분류
              </button>
              {filteredCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => onSelect(cat.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    currentCategoryId === cat.id ? activeClass : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

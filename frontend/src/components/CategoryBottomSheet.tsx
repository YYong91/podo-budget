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
  /** 바텀시트 제목 (기본: '카테고리 변경') */
  title?: string
}

export default function CategoryBottomSheet({
  isOpen,
  onClose,
  onSelect,
  categories,
  currentCategoryId,
  transactionType,
  saving = false,
  title = '카테고리 변경',
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

  // 바텀시트 열릴 때 배경 스크롤 + PWA pull-to-refresh 차단
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'

    const sheet = sheetRef.current
    if (!sheet) return

    // 시트 내부 터치 이벤트가 body로 전파되지 않도록 차단
    const preventScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      const scrollable = sheet.querySelector('.overflow-y-auto') as HTMLElement | null
      // 스크롤 가능한 영역 내부이고, 실제로 스크롤이 있으면 허용
      if (scrollable && scrollable.contains(target) && scrollable.scrollHeight > scrollable.clientHeight) {
        return // 스크롤 가능 → 기본 동작 허용
      }
      e.preventDefault()
    }
    sheet.addEventListener('touchmove', preventScroll, { passive: false })

    return () => {
      document.body.style.overflow = ''
      sheet.removeEventListener('touchmove', preventScroll)
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center overscroll-contain touch-none" role="dialog" aria-modal="true" aria-label={title}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 모달 배경 오버레이: Escape 키로 닫기 지원됨 */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="relative w-full md:max-w-sm bg-[var(--surface-card)] rounded-t-2xl md:rounded-2xl max-h-[60vh] flex flex-col animate-sheet-up md:animate-none touch-auto"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-hover)]" aria-label="닫기">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-2">
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
                분류 안 됨
              </button>
              {filteredCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => onSelect(cat.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    currentCategoryId === cat.id ? activeClass : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {cat.emoji && <span className="text-base leading-none">{cat.emoji}</span>}
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

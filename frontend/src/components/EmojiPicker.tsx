import { useState, useRef, useEffect } from 'react'

const EMOJI_LIST = Array.from(new Set([
  // 음식/식비
  '🍔', '🍕', '🍜', '🍱', '☕', '🍺', '🍷', '🛒', '🥗', '🍣', '🥩', '🍦',
  // 교통
  '🚗', '🚌', '🚇', '⛽', '✈️', '🚲', '🛵', '🚕',
  // 쇼핑/패션
  '👕', '👗', '👟', '🛍️', '💄', '👜',
  // 건강/의료
  '💊', '🏥', '🏃', '💪', '🧴',
  // 집/주거
  '🏠', '🛋️', '🔧', '💡', '🧹',
  // 금융/저축
  '💰', '💳', '📈', '🏦', '💵', '💎',
  // 교육/여가
  '🎓', '📚', '🎬', '🎮', '🎵', '🎾',
  // 기타
  '📌', '🎁', '⭐', '🌿', '🔑', '💼', '🐶', '🐱', '🌏', '🏖️',
]))

type EmojiPickerProps = {
  value: string
  onChange: (emoji: string) => void
}

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="input-base text-center text-xl p-2 w-full cursor-pointer"
        aria-label="이모지 선택"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {value}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="이모지 목록"
          className="absolute top-full left-0 mt-1 z-50 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl shadow-lg p-2 w-56"
        >
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJI_LIST.map(emoji => (
              <button
                key={emoji}
                type="button"
                role="option"
                aria-selected={emoji === value}
                onClick={() => { onChange(emoji); setOpen(false) }}
                className="text-xl p-1 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-center leading-none"
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

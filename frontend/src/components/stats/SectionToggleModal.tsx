/**
 * @file SectionToggleModal.tsx
 * @description 돌아보기 섹션 표시/숨기기 설정 모달
 * 사용자가 보고 싶은 섹션만 선택할 수 있다.
 * 종합 요약 카드는 항상 표시 (토글 불가).
 */

import { X } from 'lucide-react'

const STORAGE_KEY = 'podo-insights-sections'

export type SectionVisibility = {
  highlights: boolean
  categoryTop: boolean
  budget: boolean
  assets: boolean
  ai: boolean
}

export const DEFAULT_SECTIONS: SectionVisibility = {
  highlights: true,
  categoryTop: true,
  budget: true,
  assets: true,
  ai: true,
}

/** localStorage에서 섹션 설정 로드 */
export function loadSectionSettings(): SectionVisibility {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { ...DEFAULT_SECTIONS }
    const parsed = JSON.parse(stored)
    return { ...DEFAULT_SECTIONS, ...parsed }
  } catch {
    return { ...DEFAULT_SECTIONS }
  }
}

/** localStorage에 섹션 설정 저장 */
export function saveSectionSettings(settings: SectionVisibility): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

// 토글 가능한 섹션 목록 (종합 요약은 제외 — 항상 ON)
const SECTION_LIST: { key: keyof SectionVisibility; label: string }[] = [
  { key: 'highlights', label: '이달의 주목할 점' },
  { key: 'categoryTop', label: '지출 카테고리 TOP' },
  { key: 'budget', label: '예산 상황' },
  { key: 'assets', label: '자산 변화' },
  { key: 'ai', label: 'AI 상세 분석' },
]

interface SectionToggleModalProps {
  sections: SectionVisibility
  onChange: (sections: SectionVisibility) => void
  onClose: () => void
}

export default function SectionToggleModal({ sections, onChange, onClose }: SectionToggleModalProps) {
  const handleToggle = (key: keyof SectionVisibility) => {
    const updated = { ...sections, [key]: !sections[key] }
    onChange(updated)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 오버레이 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="모달 닫기"
        className="absolute inset-0 bg-black/40 cursor-default"
      />

      {/* 모달 본체 */}
      <div className="relative bg-[var(--surface-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm mx-auto p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">섹션 표시 설정</h3>
          <button
            onClick={onClose}
            aria-label="설정 닫기"
            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="space-y-1">
          {/* 종합 요약 카드 — 항상 ON, 토글 비활성 */}
          <div className="flex items-center justify-between py-3 px-2 rounded-lg">
            <span className="text-sm text-[var(--text-tertiary)]">종합 요약 카드</span>
            <div className="relative">
              <input
                type="checkbox"
                checked
                disabled
                aria-label="종합 요약 카드"
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-grape-300 rounded-full opacity-50 cursor-not-allowed" />
              <div className="absolute top-0.5 left-[18px] w-5 h-5 bg-white rounded-full shadow opacity-50" />
            </div>
          </div>

          {/* 토글 가능 섹션 */}
          {SECTION_LIST.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
            >
              <span className="text-sm text-[var(--text-primary)]">{label}</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={sections[key]}
                  onChange={() => handleToggle(key)}
                  aria-label={label}
                  className="sr-only peer"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${
                  sections[key] ? 'bg-grape-500' : 'bg-warm-300'
                }`} />
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  sections[key] ? 'left-[18px]' : 'left-0.5'
                }`} />
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

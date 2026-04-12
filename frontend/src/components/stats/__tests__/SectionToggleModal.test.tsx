import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SectionToggleModal, {
  loadSectionSettings,
  DEFAULT_SECTIONS,
} from '../SectionToggleModal'

describe('SectionToggleModal', () => {
  it('comparison과 savings 항목이 목록에 포함된다', () => {
    render(
      <SectionToggleModal
        sections={{ ...DEFAULT_SECTIONS }}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('전월 대비 변화')).toBeInTheDocument()
    expect(screen.getByText('저축')).toBeInTheDocument()
  })

  it('Layer 2 그룹 제목이 표시된다', () => {
    render(
      <SectionToggleModal
        sections={{ ...DEFAULT_SECTIONS }}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('들여다보기')).toBeInTheDocument()
    expect(screen.getByText('돌아보기')).toBeInTheDocument()
  })

  it('DEFAULT_SECTIONS에 comparison과 savings가 true로 포함된다', () => {
    expect(DEFAULT_SECTIONS.comparison).toBe(true)
    expect(DEFAULT_SECTIONS.savings).toBe(true)
  })

  it('기존 localStorage에 없는 신규 키는 DEFAULT_SECTIONS 기본값으로 채워진다', () => {
    localStorage.setItem('podo-insights-sections', JSON.stringify({ highlights: false }))
    const loaded = loadSectionSettings()
    expect(loaded.comparison).toBe(true)
    expect(loaded.savings).toBe(true)
    expect(loaded.highlights).toBe(false)
    localStorage.removeItem('podo-insights-sections')
  })
})

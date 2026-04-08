import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonthPicker from '../MonthPicker'

function renderPicker(props: Partial<React.ComponentProps<typeof MonthPicker>> = {}) {
  const defaults = {
    currentYear: 2026,
    currentMonth: 3, // 4월 (0-indexed)
    onSelect: vi.fn(),
    onClose: vi.fn(),
  }
  return render(<MonthPicker {...defaults} {...props} />)
}

describe('MonthPicker', () => {
  it('현재 연도를 표시한다', () => {
    renderPicker()
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('1~12월 버튼을 모두 렌더링한다', () => {
    renderPicker()
    for (let m = 1; m <= 12; m++) {
      expect(screen.getByRole('button', { name: `${m}월` })).toBeInTheDocument()
    }
  })

  it('현재 선택된 월에 활성 스타일이 적용된다', () => {
    renderPicker({ currentYear: 2026, currentMonth: 3 })
    const activeBtn = screen.getByRole('button', { name: '4월' })
    expect(activeBtn.className).toMatch(/grape/)
  })

  it('월 버튼 클릭 시 onSelect를 호출한다', async () => {
    const onSelect = vi.fn()
    renderPicker({ onSelect })
    await userEvent.click(screen.getByRole('button', { name: '7월' }))
    expect(onSelect).toHaveBeenCalledWith(2026, 6) // 0-indexed
  })

  it('연도 이전 버튼 클릭 시 연도가 감소한다', async () => {
    renderPicker({ currentYear: 2026 })
    await userEvent.click(screen.getByRole('button', { name: '이전 연도' }))
    expect(screen.getByText('2025')).toBeInTheDocument()
  })

  it('연도 다음 버튼 클릭 시 연도가 증가한다', async () => {
    renderPicker({ currentYear: 2026 })
    await userEvent.click(screen.getByRole('button', { name: '다음 연도' }))
    expect(screen.getByText('2027')).toBeInTheDocument()
  })

  it('월 선택 후 onClose를 호출한다', async () => {
    const onClose = vi.fn()
    renderPicker({ onClose })
    await userEvent.click(screen.getByRole('button', { name: '3월' }))
    expect(onClose).toHaveBeenCalled()
  })
})

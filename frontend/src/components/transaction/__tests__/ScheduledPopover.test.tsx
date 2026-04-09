/**
 * @file ScheduledPopover.test.tsx
 * @description 예정 정기거래 팝오버 컴포넌트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScheduledPopover from '../ScheduledPopover'

const mockItems = [
  { id: 1, description: '넷플릭스', amount: 14900, type: 'expense' as const },
  { id: 2, description: '유튜브 프리미엄', amount: 14900, type: 'expense' as const },
  { id: 3, description: '월급', amount: 3500000, type: 'income' as const },
]

describe('ScheduledPopover', () => {
  it('날짜 제목과 항목들을 표시한다', () => {
    render(<ScheduledPopover date="2026-03-15" items={mockItems} onClose={vi.fn()} />)
    expect(screen.getByText('15일 예정')).toBeInTheDocument()
    expect(screen.getByText('넷플릭스')).toBeInTheDocument()
    expect(screen.getByText('유튜브 프리미엄')).toBeInTheDocument()
    expect(screen.getByText('월급')).toBeInTheDocument()
  })

  it('수입에는 + 접두사가 표시된다', () => {
    render(<ScheduledPopover date="2026-03-25" items={[mockItems[2]]} onClose={vi.fn()} />)
    expect(screen.getByText('+₩3,500,000')).toBeInTheDocument()
  })

  it('지출에는 + 접두사가 없다', () => {
    render(<ScheduledPopover date="2026-03-15" items={[mockItems[0]]} onClose={vi.fn()} />)
    expect(screen.getByText('₩14,900')).toBeInTheDocument()
  })

  it('항목이 없으면 렌더링하지 않는다', () => {
    const { container } = render(<ScheduledPopover date="2026-03-15" items={[]} onClose={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('ESC 키로 닫힌다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ScheduledPopover date="2026-03-15" items={mockItems} onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('바깥 클릭으로 닫힌다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <div>
        <div data-testid="outside">바깥 영역</div>
        <ScheduledPopover date="2026-03-15" items={mockItems} onClose={onClose} />
      </div>
    )
    await user.click(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalled()
  })
})

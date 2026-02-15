import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PeriodNavigator from '../PeriodNavigator'

describe('PeriodNavigator', () => {
  it('라벨을 표시한다', () => {
    render(<PeriodNavigator label="2026년 2월" onPrev={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('2026년 2월')).toBeInTheDocument()
  })

  it('이전 버튼 클릭 시 onPrev 호출', async () => {
    const onPrev = vi.fn()
    const user = userEvent.setup()
    render(<PeriodNavigator label="2026년 2월" onPrev={onPrev} onNext={vi.fn()} />)
    await user.click(screen.getByLabelText('이전 기간'))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('다음 버튼 클릭 시 onNext 호출', async () => {
    const onNext = vi.fn()
    const user = userEvent.setup()
    render(<PeriodNavigator label="2026년 2월" onPrev={vi.fn()} onNext={onNext} />)
    await user.click(screen.getByLabelText('다음 기간'))
    expect(onNext).toHaveBeenCalledOnce()
  })
})

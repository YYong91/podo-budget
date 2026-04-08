import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PeriodNavigator from '../PeriodNavigator'

describe('PeriodNavigator', () => {
  it('라벨을 표시한다', () => {
    render(<PeriodNavigator label="2026년 2월" onPrev={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('2026년 2월')).toBeInTheDocument()
  })

  it('onMonthSelect 없으면 라벨이 일반 텍스트로 렌더링된다', () => {
    render(<PeriodNavigator label="4월" onPrev={vi.fn()} onNext={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '4월' })).not.toBeInTheDocument()
    expect(screen.getByText('4월')).toBeInTheDocument()
  })

  it('onMonthSelect 있으면 라벨이 버튼으로 렌더링된다', () => {
    render(
      <PeriodNavigator
        label="4월" onPrev={vi.fn()} onNext={vi.fn()}
        currentYear={2026} currentMonth={3} onMonthSelect={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '4월 선택' })).toBeInTheDocument()
  })

  it('라벨 버튼 클릭 시 MonthPicker가 열린다', async () => {
    const user = userEvent.setup()
    render(
      <PeriodNavigator
        label="4월" onPrev={vi.fn()} onNext={vi.fn()}
        currentYear={2026} currentMonth={3} onMonthSelect={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: '4월 선택' }))
    expect(screen.getByText('2026')).toBeInTheDocument() // 팝업 내 연도
    expect(screen.getByRole('button', { name: '1월' })).toBeInTheDocument()
  })

  it('MonthPicker에서 월 선택 시 onMonthSelect 호출 후 닫힌다', async () => {
    const user = userEvent.setup()
    const onMonthSelect = vi.fn()
    render(
      <PeriodNavigator
        label="4월" onPrev={vi.fn()} onNext={vi.fn()}
        currentYear={2026} currentMonth={3} onMonthSelect={onMonthSelect}
      />
    )
    await user.click(screen.getByRole('button', { name: '4월 선택' }))
    await user.click(screen.getByRole('button', { name: '7월' }))
    expect(onMonthSelect).toHaveBeenCalledWith(2026, 6)
    expect(screen.queryByRole('button', { name: '1월' })).not.toBeInTheDocument()
  })

  it('팝업 열린 상태에서 Escape 키 입력 시 닫힌다', async () => {
    const user = userEvent.setup()
    render(
      <PeriodNavigator
        label="4월" onPrev={vi.fn()} onNext={vi.fn()}
        currentYear={2026} currentMonth={3} onMonthSelect={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: '4월 선택' }))
    expect(screen.getByRole('button', { name: '1월' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: '1월' })).not.toBeInTheDocument()
  })

  it('팝업 열린 상태에서 외부 클릭 시 닫힌다', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <div data-testid="outside">외부 영역</div>
        <PeriodNavigator
          label="4월" onPrev={vi.fn()} onNext={vi.fn()}
          currentYear={2026} currentMonth={3} onMonthSelect={vi.fn()}
        />
      </div>
    )
    await user.click(screen.getByRole('button', { name: '4월 선택' }))
    expect(screen.getByRole('button', { name: '1월' })).toBeInTheDocument()
    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByRole('button', { name: '1월' })).not.toBeInTheDocument()
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

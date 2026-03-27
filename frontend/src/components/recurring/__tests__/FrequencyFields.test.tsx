/**
 * @file FrequencyFields.test.tsx
 * @description 주기별 조건부 필드 컴포넌트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FrequencyFields from '../FrequencyFields'

const defaultProps = {
  frequency: 'monthly' as const,
  dayOfMonth: '25',
  dayOfWeek: '0',
  monthOfYear: '1',
  interval: '14',
  startDate: '2026-01-01',
  onChange: vi.fn(),
}

describe('FrequencyFields', () => {
  it('주기 선택 드롭다운을 표시한다', () => {
    render(<FrequencyFields {...defaultProps} />)
    expect(screen.getByLabelText('반복 주기')).toBeInTheDocument()
  })

  it('monthly일 때 반복일 필드를 표시한다', () => {
    render(<FrequencyFields {...defaultProps} frequency="monthly" />)
    expect(screen.getByLabelText('반복일')).toBeInTheDocument()
    expect(screen.queryByLabelText('요일')).not.toBeInTheDocument()
  })

  it('weekly일 때 요일 필드를 표시한다', () => {
    render(<FrequencyFields {...defaultProps} frequency="weekly" />)
    expect(screen.getByLabelText('요일')).toBeInTheDocument()
    expect(screen.queryByLabelText('반복일')).not.toBeInTheDocument()
  })

  it('yearly일 때 반복일과 반복 월 필드를 표시한다', () => {
    render(<FrequencyFields {...defaultProps} frequency="yearly" />)
    expect(screen.getByLabelText('반복일')).toBeInTheDocument()
    expect(screen.getByLabelText('반복 월')).toBeInTheDocument()
  })

  it('custom일 때 반복 주기 필드를 표시한다', () => {
    render(<FrequencyFields {...defaultProps} frequency="custom" />)
    expect(screen.getByLabelText('반복 주기 (일)')).toBeInTheDocument()
    expect(screen.queryByLabelText('반복일')).not.toBeInTheDocument()
  })

  it('시작일 필드를 항상 표시한다', () => {
    render(<FrequencyFields {...defaultProps} />)
    expect(screen.getByLabelText('시작일')).toBeInTheDocument()
  })

  it('주기 변경 시 onChange를 호출한다', async () => {
    const user = userEvent.setup()
    render(<FrequencyFields {...defaultProps} />)
    await user.selectOptions(screen.getByLabelText('반복 주기'), 'weekly')
    expect(defaultProps.onChange).toHaveBeenCalledWith('frequency', 'weekly')
  })

  it('반복일 값이 올바르게 표시된다', () => {
    render(<FrequencyFields {...defaultProps} dayOfMonth="15" />)
    expect(screen.getByLabelText('반복일')).toHaveValue(15)
  })

  it('반복일 변경 시 onChange를 호출한다', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FrequencyFields {...defaultProps} onChange={onChange} />)
    const dayInput = screen.getByLabelText('반복일')
    await user.clear(dayInput)
    await user.type(dayInput, '15')
    expect(onChange).toHaveBeenCalledWith('day_of_month', expect.any(String))
  })

  it('weekly에서 요일 변경 시 onChange를 호출한다', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FrequencyFields {...defaultProps} frequency="weekly" onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText('요일'), '2')
    expect(onChange).toHaveBeenCalledWith('day_of_week', '2')
  })

  it('yearly에서 반복 월 변경 시 onChange를 호출한다', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FrequencyFields {...defaultProps} frequency="yearly" onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText('반복 월'), '6')
    expect(onChange).toHaveBeenCalledWith('month_of_year', '6')
  })

  it('custom에서 반복 주기 변경 시 onChange를 호출한다', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FrequencyFields {...defaultProps} frequency="custom" onChange={onChange} />)
    const intervalInput = screen.getByLabelText('반복 주기 (일)')
    await user.clear(intervalInput)
    await user.type(intervalInput, '7')
    expect(onChange).toHaveBeenCalledWith('interval', expect.any(String))
  })

  it('시작일 변경 시 onChange를 호출한다', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FrequencyFields {...defaultProps} onChange={onChange} />)
    const dateInput = screen.getByLabelText('시작일')
    await user.clear(dateInput)
    await user.type(dateInput, '2026-06-01')
    expect(onChange).toHaveBeenCalledWith('start_date', expect.any(String))
  })
})

/**
 * @file MiniCalendar.test.tsx
 * @description 미니 캘린더 컴포넌트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MiniCalendar from '../MiniCalendar'

const daySummaries = new Map([
  ['2026-03-01', { expense: 50000, income: 0 }],
  ['2026-03-14', { expense: 8000, income: 3500000 }],
])

function renderCalendar(props: Partial<React.ComponentProps<typeof MiniCalendar>> = {}) {
  const defaultProps = {
    year: 2026,
    month: 2, // 0-indexed, 3월
    daySummaries,
    onDateClick: vi.fn(),
    today: '2026-03-14',
    ...props,
  }
  return { ...render(<MiniCalendar {...defaultProps} />), props: defaultProps }
}

describe('MiniCalendar', () => {
  it('요일 헤더를 표시한다', () => {
    renderCalendar()
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    weekdays.forEach((day) => {
      expect(screen.getByText(day)).toBeInTheDocument()
    })
  })

  it('현재 월의 날짜를 표시한다', () => {
    renderCalendar()
    // 3월은 1~31일
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('오늘 날짜에 강조 스타일을 적용한다', () => {
    renderCalendar()
    const todayEl = screen.getByText('14')
    // 오늘 날짜는 bg-grape-600 클래스가 적용됨
    expect(todayEl.className).toContain('bg-grape-600')
  })

  it('날짜 클릭 시 onDateClick을 호출한다', async () => {
    const user = userEvent.setup()
    const { props } = renderCalendar()
    await user.click(screen.getByText('14'))
    expect(props.onDateClick).toHaveBeenCalledWith('2026-03-14')
  })

  it('지출이 있는 날짜에 지출 금액을 표시한다', () => {
    renderCalendar()
    // daySummaries에 3월 1일 50000원 지출이 있음
    expect(screen.getByText(/-5만/)).toBeInTheDocument()
  })

  it('수입이 있는 날짜에 수입 금액을 표시한다', () => {
    renderCalendar()
    // daySummaries에 3월 14일 350만원 수입이 있음
    expect(screen.getByText(/\+350만/)).toBeInTheDocument()
  })
})

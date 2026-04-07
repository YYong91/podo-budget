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

  it('지출이 있는 날짜에 grape 도트가 표시된다', () => {
    renderCalendar()
    const cell = document.querySelector('[data-date="2026-03-01"]')
    const dots = cell?.querySelectorAll('[data-testid="dot"]')
    expect(dots?.length).toBe(1)
    expect(dots?.[0]?.className).toContain('bg-grape-400')
  })

  it('수입이 있는 날짜에 leaf 도트가 표시된다', () => {
    renderCalendar()
    const cell = document.querySelector('[data-date="2026-03-14"]')
    const dots = cell?.querySelectorAll('[data-testid="dot"]')
    // 3월 14일은 지출+수입 둘 다 있으므로 도트 2개, leaf 도트 확인
    const leafDots = Array.from(dots ?? []).filter((d) =>
      d.className.includes('bg-leaf-400'),
    )
    expect(leafDots.length).toBe(1)
  })

  it('weekOnly=true이면 1행만 렌더링한다', () => {
    renderCalendar({ weekOnly: true })
    const rows = document.querySelectorAll('[data-testid="calendar-week"]')
    expect(rows.length).toBe(1)
  })

  it('weekOnly=false이면 전체 주를 렌더링한다', () => {
    renderCalendar()
    const rows = document.querySelectorAll('[data-testid="calendar-week"]')
    expect(rows.length).toBeGreaterThan(1)
  })

  it('지출+수입 둘 다 있는 날에 도트 2개가 표시된다', () => {
    renderCalendar()
    const cell = document.querySelector('[data-date="2026-03-14"]')
    const dots = cell?.querySelectorAll('[data-testid="dot"]')
    expect(dots?.length).toBe(2)
  })

  it('거래 없는 날에는 도트가 없다', () => {
    renderCalendar()
    const cell = document.querySelector('[data-date="2026-03-02"]')
    const dots = cell?.querySelectorAll('[data-testid="dot"]')
    expect(dots?.length ?? 0).toBe(0)
  })
})

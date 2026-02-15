import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChangeIndicator from '../ChangeIndicator'

describe('ChangeIndicator', () => {
  it('많이 늘음 (+20% 이상) 표시', () => {
    render(<ChangeIndicator percentage={35.2} />)
    expect(screen.getByText('많이 늘음')).toBeInTheDocument()
    expect(screen.getByText('(+35.2%)')).toBeInTheDocument()
  })

  it('조금 늘음 (+5% ~ +20%) 표시', () => {
    render(<ChangeIndicator percentage={8.3} />)
    expect(screen.getByText('조금 늘음')).toBeInTheDocument()
  })

  it('보통 (-5% ~ +5%) 표시', () => {
    render(<ChangeIndicator percentage={2.1} />)
    expect(screen.getByText('보통')).toBeInTheDocument()
  })

  it('줄음 (-20% ~ -5%) 표시', () => {
    render(<ChangeIndicator percentage={-12.5} />)
    expect(screen.getByText('줄음')).toBeInTheDocument()
  })

  it('많이 줄음 (-20% 미만) 표시', () => {
    render(<ChangeIndicator percentage={-28.0} />)
    expect(screen.getByText('많이 줄음')).toBeInTheDocument()
  })

  it('null percentage일 때 비교 불가 표시', () => {
    render(<ChangeIndicator percentage={null} />)
    expect(screen.getByText('비교 불가')).toBeInTheDocument()
  })

  it('0% 일 때 보통 표시', () => {
    render(<ChangeIndicator percentage={0} />)
    expect(screen.getByText('보통')).toBeInTheDocument()
  })

  it('경계값 +5% 정확히 일 때 보통 표시', () => {
    render(<ChangeIndicator percentage={5.0} />)
    expect(screen.getByText('보통')).toBeInTheDocument()
  })

  it('compact 모드일 때 라벨 없이 아이콘+퍼센트만 표시', () => {
    const { container } = render(<ChangeIndicator percentage={15} compact />)
    expect(screen.queryByText('조금 늘음')).not.toBeInTheDocument()
    expect(screen.getByText('+15.0%')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="change-icon"]')).toBeInTheDocument()
  })
})

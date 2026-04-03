import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HeroSummary from '../HeroSummary'

describe('HeroSummary', () => {
  it('라벨과 금액을 표시한다', () => {
    render(<HeroSummary label="4월 지출" amount={1240000} />)
    expect(screen.getByText('4월 지출')).toBeInTheDocument()
    expect(screen.getByText('₩1,240,000')).toBeInTheDocument()
  })

  it('sublabel을 표시한다', () => {
    render(
      <HeroSummary label="4월 지출" amount={1240000} sublabel="수입 ₩3,200,000" />
    )
    expect(screen.getByText('수입 ₩3,200,000')).toBeInTheDocument()
  })

  it('금액에 text-display 클래스를 적용한다', () => {
    render(<HeroSummary label="순자산" amount={240000000} />)
    const amountEl = screen.getByText('₩240,000,000')
    expect(amountEl.className).toContain('text-display')
  })

  it('children이 있으면 렌더한다', () => {
    render(
      <HeroSummary label="예산" amount={500000}>
        <div data-testid="progress">62%</div>
      </HeroSummary>
    )
    expect(screen.getByTestId('progress')).toBeInTheDocument()
  })

  it('sublabel 없으면 sublabel 요소가 없다', () => {
    const { container } = render(<HeroSummary label="테스트" amount={0} />)
    // sublabel을 위한 text-xs 요소가 없어야 함
    expect(container.querySelector('.text-xs')).toBeNull()
  })
})

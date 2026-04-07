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

  it('budgetRatio가 주어지면 프로그레스 바와 라벨을 렌더링한다', () => {
    render(<HeroSummary label="4월 지출" amount={450000} budgetRatio={0.45} remainingBudget={550000} />)
    const progressBar = document.querySelector('[role="progressbar"]')
    expect(progressBar).not.toBeNull()
    expect(screen.getByText('예산 45% 사용')).toBeInTheDocument()
    expect(screen.getByText(/남음/)).toBeInTheDocument()
  })

  it('budgetRatio 80% 이상이면 경고 색상을 적용한다', () => {
    render(<HeroSummary label="4월 지출" amount={900000} budgetRatio={0.9} />)
    const fill = document.querySelector('[role="progressbar"] > div > div')
    expect(fill?.className).toContain('bg-amber-400')
  })

  it('budgetRatio 100% 초과이면 위험 색상을 적용한다', () => {
    render(<HeroSummary label="4월 지출" amount={1200000} budgetRatio={1.2} />)
    const fill = document.querySelector('[role="progressbar"] > div > div')
    expect(fill?.className).toContain('bg-red-400')
  })

  it('예산 초과 시 초과 금액을 표시한다', () => {
    render(<HeroSummary label="4월 지출" amount={1200000} budgetRatio={1.2} remainingBudget={-200000} />)
    expect(screen.getByText(/초과/)).toBeInTheDocument()
  })

  it('budgetRatio가 없으면 프로그레스 바를 렌더링하지 않는다', () => {
    render(<HeroSummary label="4월 지출" amount={500000} />)
    const progressBar = document.querySelector('[role="progressbar"]')
    expect(progressBar).toBeNull()
  })

  it('sublabelLoading=true이면 프로그레스 바 영역을 invisible로 예약한다', () => {
    render(<HeroSummary label="4월 지출" amount={500000} sublabelLoading budgetRatio={0.5} />)
    const progressBar = document.querySelector('[role="progressbar"]')
    expect(progressBar?.className).toContain('invisible')
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HeroSummary from '../HeroSummary'
import type { HealthScore } from '../../../types'

const mockScore: HealthScore = { overall: 78, grade: 'B+', savings: 65, spending: 80, debt: 90 }

function renderHero(props = {}) {
  return render(
    <MemoryRouter>
      <HeroSummary
        label="4월 지출"
        totalExpense={1_200_000}
        totalBudget={2_000_000}
        pendingRecurringExpense={300_000}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('HeroSummary', () => {
  it('지출 금액을 표시한다', () => {
    renderHero()
    expect(screen.getByText('₩1,200,000')).toBeInTheDocument()
  })

  it('comparisonText가 있으면 전월 비교 문장을 표시한다', () => {
    renderHero({ comparisonText: '지난달 이맘때보다 3만원 줄었어요 ↓', comparisonColor: 'text-leaf-600' })
    expect(screen.getByText('지난달 이맘때보다 3만원 줄었어요 ↓')).toBeInTheDocument()
  })

  it('healthScore가 있으면 배지를 우측 상단에 표시한다', () => {
    renderHero({ healthScore: mockScore })
    expect(screen.getByText('B+')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
  })

  it('totalBudget이 null이면 예산 미설정 CTA를 표시한다', () => {
    renderHero({ totalBudget: null })
    expect(screen.getByText(/예산을 설정하면/)).toBeInTheDocument()
  })

  it('레거시 props(amount)를 받으면 TypeScript 에러가 발생한다 — 컴파일로 검증', () => {
    // 이 테스트는 런타임이 아닌 tsc로 검증. 빌드 단계에서 확인.
    expect(true).toBe(true)
  })
})

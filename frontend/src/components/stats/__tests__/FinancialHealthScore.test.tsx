import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FinancialHealthScore from '../FinancialHealthScore'
import type { HealthScore } from '../../../types'

const mockScore: HealthScore = {
  overall: 78,
  grade: 'B+',
  savings: 65,
  spending: 80,
  debt: 90,
}

describe('FinancialHealthScore', () => {
  describe('full 모드 (기본)', () => {
    it('전체 카드 레이아웃을 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} />)
      expect(screen.getByText('가계 건강 점수')).toBeInTheDocument()
      expect(screen.getByText('78')).toBeInTheDocument()
      expect(screen.getByText('B+')).toBeInTheDocument()
    })

    it('세부 항목(저축, 지출, 부채)을 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} />)
      expect(screen.getByText('저축')).toBeInTheDocument()
      expect(screen.getByText('지출 관리')).toBeInTheDocument()
      expect(screen.getByText('부채')).toBeInTheDocument()
    })

    it('score가 null이면 null을 반환한다', () => {
      const { container } = render(<FinancialHealthScore score={null} />)
      expect(container.firstChild).toBeNull()
    })

    it('B등급이면 grape 색상을 사용한다', () => {
      const { container } = render(<FinancialHealthScore score={mockScore} />)
      expect(container.querySelector('.text-grape-600')).toBeInTheDocument()
    })

    it('C등급이면 amber 색상을 사용한다', () => {
      const cScore: HealthScore = { savings: 50, spending: 45, debt: 55, overall: 50, grade: 'C' }
      const { container } = render(<FinancialHealthScore score={cScore} />)
      expect(container.querySelector('.text-amber-600')).toBeInTheDocument()
    })

    it('D등급이면 red 색상을 사용한다', () => {
      const dScore: HealthScore = { savings: 30, spending: 25, debt: 35, overall: 30, grade: 'D' }
      const { container } = render(<FinancialHealthScore score={dScore} />)
      expect(container.querySelector('.text-red-600')).toBeInTheDocument()
    })

    it('낮은 세부 점수에 적절한 바 색상을 사용한다', () => {
      const lowScore: HealthScore = { savings: 35, spending: 55, debt: 75, overall: 55, grade: 'C' }
      const { container } = render(<FinancialHealthScore score={lowScore} />)
      // savings=35 → red, spending=55 → amber, debt=75 → grape
      const bars = container.querySelectorAll('.rounded-full.transition-all')
      expect(bars.length).toBe(3)
      expect(bars[0]).toHaveClass('bg-red-500')    // savings=35
      expect(bars[1]).toHaveClass('bg-amber-500')  // spending=55
      expect(bars[2]).toHaveClass('bg-grape-500')  // debt=75
    })
  })

  describe('badge 모드', () => {
    it('등급과 점수만 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      expect(screen.getByText('B+')).toBeInTheDocument()
      expect(screen.getByText('78')).toBeInTheDocument()
      // 전체 카드 요소 없음
      expect(screen.queryByText('가계 건강 점수')).not.toBeInTheDocument()
      expect(screen.queryByText('저축')).not.toBeInTheDocument()
    })

    it('배지 클릭 시 전체 점수 바텀시트가 열린다', async () => {
      const user = userEvent.setup()
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      await user.click(screen.getByRole('button'))
      expect(screen.getByText('가계 건강 점수')).toBeInTheDocument()
      expect(screen.getByText('저축')).toBeInTheDocument()
    })

    it('바텀시트에 X 닫기 버튼이 있다', async () => {
      const user = userEvent.setup()
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      await user.click(screen.getByRole('button'))
      expect(screen.getByLabelText('건강점수 닫기')).toBeInTheDocument()
    })

    it('바텀시트 X 닫기 버튼 클릭 시 닫힌다', async () => {
      const user = userEvent.setup()
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      await user.click(screen.getByRole('button'))
      await user.click(screen.getByLabelText('건강점수 닫기'))
      expect(screen.queryByText('가계 건강 점수')).not.toBeInTheDocument()
    })

    it('바텀시트 오버레이(배경) 클릭 시 닫힌다', async () => {
      const user = userEvent.setup()
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      await user.click(screen.getByRole('button'))
      expect(screen.getByText('가계 건강 점수')).toBeInTheDocument()
      // 배경 버튼은 aria-label="모달 닫기"로 접근
      await user.click(screen.getByRole('button', { name: '모달 닫기' }))
      expect(screen.queryByText('저축')).not.toBeInTheDocument()
    })

    it('score가 null이면 아무것도 표시하지 않는다', () => {
      const { container } = render(<FinancialHealthScore score={null} variant="badge" />)
      expect(container.firstChild).toBeNull()
    })
  })
})

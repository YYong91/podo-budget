import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FinancialHealthScore from '../FinancialHealthScore'
import type { FinancialScore } from '../../../types'

const mockScore: FinancialScore = {
  overall: 78,
  grade: 'B+',
  savingsRate: 65,
  budgetAdherence: 80,
  fixedExpenseRatio: 90,
  spendingStability: null,
  activeIndicators: 3,
  breakdown: {
    savingsRate: { score: 65, summary: '저축 30만원 / 수입 150만원 = 20.0%' },
    budgetAdherence: { score: 80, summary: '예산 200만원 중 150만원 사용 (75%)' },
    fixedExpenseRatio: { score: 90, summary: '고정비 40만원 / 수입 150만원 = 26.7%' },
    spendingStability: { score: null, summary: '', detail: '3개월 이상 기록되면 측정돼요' },
  },
}

describe('FinancialHealthScore', () => {
  describe('full 모드 (기본)', () => {
    it('전체 카드 레이아웃을 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} />)
      expect(screen.getByText('가계 건강 점수')).toBeInTheDocument()
      expect(screen.getByText('78')).toBeInTheDocument()
      expect(screen.getByText('B+')).toBeInTheDocument()
    })

    it('세부 항목(저축률, 예산 준수율, 고정비 비율, 소비 안정성)을 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} />)
      expect(screen.getByText('저축률')).toBeInTheDocument()
      expect(screen.getByText('예산 준수율')).toBeInTheDocument()
      expect(screen.getByText('고정비 비율')).toBeInTheDocument()
      expect(screen.getByText('소비 안정성')).toBeInTheDocument()
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
      const cScore: FinancialScore = {
        ...mockScore,
        overall: 50,
        grade: 'C',
      }
      const { container } = render(<FinancialHealthScore score={cScore} />)
      expect(container.querySelector('.text-amber-600')).toBeInTheDocument()
    })

    it('D등급이면 red 색상을 사용한다', () => {
      const dScore: FinancialScore = {
        ...mockScore,
        overall: 30,
        grade: 'D',
      }
      const { container } = render(<FinancialHealthScore score={dScore} />)
      expect(container.querySelector('.text-red-600')).toBeInTheDocument()
    })

    it('activeIndicators가 4 미만이면 안내 텍스트를 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} />)
      // mockScore.activeIndicators = 3
      expect(screen.getByText('4개 지표 중 3개 기반')).toBeInTheDocument()
    })

    it('null인 지표는 detail 텍스트를 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} />)
      expect(screen.getByText('3개월 이상 기록되면 측정돼요')).toBeInTheDocument()
    })
  })

  describe('badge 모드', () => {
    it('등급과 점수만 표시한다', () => {
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      expect(screen.getByText('B+')).toBeInTheDocument()
      expect(screen.getByText('78')).toBeInTheDocument()
      // 전체 카드 요소 없음
      expect(screen.queryByText('가계 건강 점수')).not.toBeInTheDocument()
      expect(screen.queryByText('저축률')).not.toBeInTheDocument()
    })

    it('배지 클릭 시 전체 점수 바텀시트가 열린다', async () => {
      const user = userEvent.setup()
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      await user.click(screen.getByRole('button'))
      expect(screen.getByText('가계 건강 점수')).toBeInTheDocument()
      // 저축률은 FullScoreCard와 지표별 분석 섹션에 각각 표시될 수 있음
      expect(screen.getAllByText('저축률').length).toBeGreaterThanOrEqual(1)
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
      expect(screen.queryByText('가계 건강 점수')).not.toBeInTheDocument()
    })

    it('ESC 키 누르면 바텀시트가 닫힌다', async () => {
      const user = userEvent.setup()
      render(<FinancialHealthScore score={mockScore} variant="badge" />)
      await user.click(screen.getByRole('button'))
      expect(screen.getByText('가계 건강 점수')).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.queryByText('가계 건강 점수')).not.toBeInTheDocument()
    })

    it('score가 null이면 아무것도 표시하지 않는다', () => {
      const { container } = render(<FinancialHealthScore score={null} variant="badge" />)
      expect(container.firstChild).toBeNull()
    })
  })
})

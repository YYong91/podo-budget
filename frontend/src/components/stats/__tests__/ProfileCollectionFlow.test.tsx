import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ProfileCollectionFlow from '../ProfileCollectionFlow'

// Step 2로 이동하는 공통 헬퍼
async function navigateToStep2(mockComplete = vi.fn().mockResolvedValue(undefined)) {
  render(<ProfileCollectionFlow onComplete={mockComplete} onAnalysisReady={vi.fn()} />)
  fireEvent.click(screen.getByText('맞벌이'))
  fireEvent.click(screen.getByText('전세'))
  fireEvent.click(screen.getByText('급여'))
  fireEvent.click(screen.getByText('30대'))
  fireEvent.click(screen.getByText('다음 →'))
  await screen.findByText('재무 목표 (선택)')
  return mockComplete
}

describe('ProfileCollectionFlow', () => {
  it('Step 1 필수 항목 미선택 시 다음 버튼 비활성화', () => {
    render(<ProfileCollectionFlow onComplete={vi.fn()} onAnalysisReady={vi.fn()} />)
    expect(screen.getByText('다음 →')).toBeDisabled()
  })

  it('Step 1 항목 모두 선택 시 다음 버튼 활성화', async () => {
    render(<ProfileCollectionFlow onComplete={vi.fn()} onAnalysisReady={vi.fn()} />)
    fireEvent.click(screen.getByText('맞벌이'))
    fireEvent.click(screen.getByText('전세'))
    fireEvent.click(screen.getByText('급여'))
    fireEvent.click(screen.getByText('30대'))
    await waitFor(() => expect(screen.getByText('다음 →')).not.toBeDisabled())
  })

  it('Step 1 "다음" 클릭 시 onComplete 호출', async () => {
    const mockComplete = vi.fn().mockResolvedValue(undefined)
    render(<ProfileCollectionFlow onComplete={mockComplete} onAnalysisReady={vi.fn()} />)
    fireEvent.click(screen.getByText('맞벌이'))
    fireEvent.click(screen.getByText('전세'))
    fireEvent.click(screen.getByText('급여'))
    fireEvent.click(screen.getByText('30대'))
    fireEvent.click(screen.getByText('다음 →'))
    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith({
      householdType: 'dual_income',
      housingType: 'jeonse',
      incomeTypes: ['salary'],
      ageRange: '30s',
    }))
  })

  describe('Step 2 목표 금액 입력', () => {
    it('재무 목표 선택 시 목표 금액 입력 필드가 나타난다', async () => {
      await navigateToStep2()
      fireEvent.click(screen.getByText('내집마련'))
      expect(screen.getByPlaceholderText('목표 금액')).toBeInTheDocument()
    })

    it('목표 금액 숫자 입력 시 콤마 포맷으로 표시된다', async () => {
      await navigateToStep2()
      fireEvent.click(screen.getByText('내집마련'))
      fireEvent.change(screen.getByPlaceholderText('목표 금액'), { target: { value: '5000000' } })
      expect(screen.getByDisplayValue('5,000,000')).toBeInTheDocument()
    })

    it('목표 금액 입력 영역에 원 단위 표시가 있다', async () => {
      await navigateToStep2()
      fireEvent.click(screen.getByText('내집마련'))
      expect(screen.getByText('원')).toBeInTheDocument()
    })

    it('비숫자 입력은 무시된다', async () => {
      await navigateToStep2()
      fireEvent.click(screen.getByText('내집마련'))
      fireEvent.change(screen.getByPlaceholderText('목표 금액'), { target: { value: 'abc123' } })
      expect(screen.getByDisplayValue('123')).toBeInTheDocument()
    })
  })

  describe('Step 2 날짜 선택 (연도/월 드롭다운)', () => {
    it('재무 목표 선택 시 연도 select가 렌더링된다', async () => {
      await navigateToStep2()
      fireEvent.click(screen.getByText('내집마련'))
      expect(screen.getByRole('combobox', { name: '목표 연도' })).toBeInTheDocument()
    })

    it('재무 목표 선택 시 월 select가 렌더링된다', async () => {
      await navigateToStep2()
      fireEvent.click(screen.getByText('내집마련'))
      expect(screen.getByRole('combobox', { name: '목표 월' })).toBeInTheDocument()
    })

    it('연도 select에 현재 연도부터 10년 후까지 옵션이 있다', async () => {
      await navigateToStep2()
      fireEvent.click(screen.getByText('내집마련'))
      const yearSelect = screen.getByRole('combobox', { name: '목표 연도' })
      const currentYear = new Date().getFullYear()
      expect(yearSelect).toHaveTextContent(String(currentYear))
      expect(yearSelect).toHaveTextContent(String(currentYear + 10))
    })

    it('월 select에 1월~12월 옵션이 있다', async () => {
      await navigateToStep2()
      fireEvent.click(screen.getByText('내집마련'))
      const monthSelect = screen.getByRole('combobox', { name: '목표 월' })
      expect(monthSelect).toHaveTextContent('1월')
      expect(monthSelect).toHaveTextContent('12월')
    })

    it('연도와 월 선택 시 YYYY-MM 형식으로 저장된다', async () => {
      const mockComplete = await navigateToStep2()
      mockComplete.mockClear()
      fireEvent.click(screen.getByText('내집마련'))
      fireEvent.change(screen.getByRole('combobox', { name: '목표 연도' }), { target: { value: '2027' } })
      fireEvent.change(screen.getByRole('combobox', { name: '목표 월' }), { target: { value: '03' } })
      fireEvent.click(screen.getByText('분석 시작 →'))
      await waitFor(() =>
        expect(mockComplete).toHaveBeenCalledWith(
          expect.objectContaining({ goalDeadline: '2027-03' }),
        ),
      )
    })

    it('월만 선택하고 연도 미선택 시 goalDeadline은 null로 저장된다', async () => {
      const mockComplete = await navigateToStep2()
      mockComplete.mockClear()
      fireEvent.click(screen.getByText('내집마련'))
      // 연도는 선택 안 하고 월만 선택
      fireEvent.change(screen.getByRole('combobox', { name: '목표 월' }), { target: { value: '03' } })
      fireEvent.click(screen.getByText('분석 시작 →'))
      await waitFor(() =>
        expect(mockComplete).toHaveBeenCalledWith(
          expect.objectContaining({ goalDeadline: null }),
        ),
      )
    })

    it('목표 금액이 정수로 저장된다', async () => {
      const mockComplete = await navigateToStep2()
      mockComplete.mockClear()
      fireEvent.click(screen.getByText('내집마련'))
      fireEvent.change(screen.getByPlaceholderText('목표 금액'), { target: { value: '5000000' } })
      fireEvent.click(screen.getByText('분석 시작 →'))
      await waitFor(() =>
        expect(mockComplete).toHaveBeenCalledWith(
          expect.objectContaining({ goalAmount: 5000000 }),
        ),
      )
    })
  })
})

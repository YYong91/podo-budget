import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ProfileCollectionFlow from '../ProfileCollectionFlow'

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
})

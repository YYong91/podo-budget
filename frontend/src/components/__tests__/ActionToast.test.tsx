import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ActionToast from '../ActionToast'
import type { ActionToastData } from '../ActionToast'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const successData: ActionToastData = {
  type: 'success',
  categoryEmoji: '🍚',
  itemName: '김치찌개',
  categoryName: '식비',
  totalAmount: 8000,
  count: 1,
  editPath: '/expenses/10',
}

function renderToast(data: ActionToastData, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <ActionToast data={data} onClose={onClose} />
    </MemoryRouter>
  )
}

describe('ActionToast', () => {
  it('성공 토스트에 카테고리 이모지, 항목명, 금액을 표시한다', () => {
    renderToast(successData)
    expect(screen.getByText('🍚')).toBeInTheDocument()
    expect(screen.getByText('김치찌개')).toBeInTheDocument()
    expect(screen.getByText(/8,000/)).toBeInTheDocument()
    expect(screen.getByText(/식비/)).toBeInTheDocument()
  })

  it('성공 토스트에 "수정 →" 버튼이 있고 클릭 시 상세 페이지로 이동한다', async () => {
    const user = userEvent.setup()
    renderToast(successData)
    const editBtn = screen.getByText(/수정/)
    await user.click(editBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/expenses/10')
  })

  it('다중 저장 시 "N건 저장" 형태로 표시한다', () => {
    renderToast({ ...successData, count: 2, totalAmount: 12500 })
    expect(screen.getByText(/2건 저장/)).toBeInTheDocument()
    expect(screen.getByText(/12,500/)).toBeInTheDocument()
  })

  it('파싱 에러 토스트를 표시한다', () => {
    renderToast({ type: 'parse_error' })
    expect(screen.getByText(/인식하지 못했어요/)).toBeInTheDocument()
  })

  it('서버 에러 토스트에 "다시 시도" 버튼이 있고 클릭 시 onRetry를 호출한다', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderToast({ type: 'server_error', originalText: '점심 8000원', onRetry })
    expect(screen.getByText(/실패했어요/)).toBeInTheDocument()
    await user.click(screen.getByText(/다시 시도/))
    expect(onRetry).toHaveBeenCalled()
  })

  it('3초 후 onClose가 호출된다', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    renderToast(successData, onClose)
    vi.advanceTimersByTime(3000)
    expect(onClose).toHaveBeenCalled()
    vi.useRealTimers()
  })
})

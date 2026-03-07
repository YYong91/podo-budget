import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import FloatingActionButton from '../FloatingActionButton'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderFAB() {
  return render(
    <MemoryRouter>
      <FloatingActionButton />
    </MemoryRouter>
  )
}

describe('FloatingActionButton', () => {
  it('FAB 버튼을 렌더링한다', () => {
    renderFAB()
    expect(screen.getByRole('button', { name: /지출\/수입 입력/i })).toBeInTheDocument()
  })

  it('클릭하면 팝오버 메뉴가 열린다', async () => {
    const user = userEvent.setup()
    renderFAB()
    await user.click(screen.getByRole('button', { name: /지출\/수입 입력/i }))
    expect(screen.getByText('지출 입력')).toBeInTheDocument()
    expect(screen.getByText('수입 입력')).toBeInTheDocument()
  })

  it('지출 입력 클릭 시 /expenses/new로 이동한다', async () => {
    const user = userEvent.setup()
    renderFAB()
    await user.click(screen.getByRole('button', { name: /지출\/수입 입력/i }))
    await user.click(screen.getByText('지출 입력'))
    expect(mockNavigate).toHaveBeenCalledWith('/expenses/new')
  })

  it('수입 입력 클릭 시 /income/new로 이동한다', async () => {
    const user = userEvent.setup()
    renderFAB()
    await user.click(screen.getByRole('button', { name: /지출\/수입 입력/i }))
    await user.click(screen.getByText('수입 입력'))
    expect(mockNavigate).toHaveBeenCalledWith('/income/new')
  })

  it('열린 상태에서 다시 클릭하면 닫힌다', async () => {
    const user = userEvent.setup()
    renderFAB()
    const fab = screen.getByRole('button', { name: /지출\/수입 입력/i })
    await user.click(fab)
    expect(screen.getByText('지출 입력')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /입력 메뉴 닫기/i }))
    expect(screen.queryByText('지출 입력')).not.toBeInTheDocument()
  })
})

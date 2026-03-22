/**
 * @file WelcomeCard.test.tsx
 * @description 온보딩 단계별 안내 카드 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import WelcomeCard from '../WelcomeCard'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

const defaultProps = {
  transactionCount: 0,
  isBotLinked: false,
  onDismiss: vi.fn(),
}

function renderCard(overrides = {}) {
  return render(
    <MemoryRouter>
      <WelcomeCard {...defaultProps} {...overrides} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WelcomeCard', () => {
  it('1단계: 거래 없으면 첫 거래 입력을 안내한다', () => {
    renderCard()
    expect(screen.getByText('첫 거래를 입력해보세요')).toBeInTheDocument()
    expect(screen.getByText('거래 입력하기')).toBeInTheDocument()
  })

  it('1단계: CTA 클릭 시 지출 입력 페이지로 이동한다', async () => {
    renderCard()
    await userEvent.click(screen.getByText('거래 입력하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/expenses/new')
  })

  it('2단계: 거래 1~2건이면 리포트 확인을 안내한다', () => {
    renderCard({ transactionCount: 1 })
    expect(screen.getByText('내 지출 리포트를 확인해보세요')).toBeInTheDocument()
    expect(screen.getByText('리포트 보기')).toBeInTheDocument()
  })

  it('2단계: CTA 클릭 시 리포트 페이지로 이동한다', async () => {
    renderCard({ transactionCount: 2 })
    await userEvent.click(screen.getByText('리포트 보기'))
    expect(mockNavigate).toHaveBeenCalledWith('/insights')
  })

  it('3단계: 거래 3건 이상 + 봇 미연동이면 봇 연동을 안내한다', () => {
    renderCard({ transactionCount: 3 })
    expect(screen.getByText('카카오톡에서도 입력할 수 있어요')).toBeInTheDocument()
    expect(screen.getByText('연동하기')).toBeInTheDocument()
  })

  it('3단계: CTA 클릭 시 설정 페이지로 이동한다', async () => {
    renderCard({ transactionCount: 5 })
    await userEvent.click(screen.getByText('연동하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/settings/my-account')
  })

  it('모든 단계 완료 시 렌더링하지 않는다', () => {
    const { container } = renderCard({ transactionCount: 5, isBotLinked: true })
    expect(container.innerHTML).toBe('')
  })

  it('닫기 버튼 클릭 시 onDismiss를 호출한다', async () => {
    const onDismiss = vi.fn()
    renderCard({ onDismiss })
    await userEvent.click(screen.getByLabelText('시작 가이드 닫기'))
    expect(onDismiss).toHaveBeenCalled()
  })
})

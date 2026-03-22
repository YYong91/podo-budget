/**
 * @file WelcomeCard.test.tsx
 * @description 온보딩 웰컴 카드 컴포넌트 테스트
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
  hasTransaction: false,
  hasBudget: false,
  isBotLinked: false,
  isPwaInstalled: false,
  canPromptPwa: false,
  isIos: false,
  onPromptPwa: vi.fn(),
  onIosGuide: vi.fn(),
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
  it('4개 체크리스트 항목을 렌더링한다', () => {
    renderCard()
    expect(screen.getByText('첫 거래 입력하기')).toBeInTheDocument()
    expect(screen.getByText('예산 설정하기')).toBeInTheDocument()
    expect(screen.getByText('봇 연동하기')).toBeInTheDocument()
    expect(screen.getByText('홈화면에 추가하기')).toBeInTheDocument()
  })

  it('진행률을 정확히 표시한다', () => {
    renderCard({ hasTransaction: true, hasBudget: true })
    expect(screen.getByText('2/4')).toBeInTheDocument()
  })

  it('완료 항목은 취소선 스타일을 적용한다', () => {
    renderCard({ hasTransaction: true })
    const item = screen.getByText('첫 거래 입력하기')
    expect(item).toHaveClass('line-through')
  })

  it('미완료 항목 클릭 시 해당 페이지로 이동한다', async () => {
    renderCard()
    await userEvent.click(screen.getByText('예산 설정하기'))
    expect(mockNavigate).toHaveBeenCalledWith('/budgets')
  })

  it('닫기 버튼 클릭 시 onDismiss를 호출한다', async () => {
    const onDismiss = vi.fn()
    renderCard({ onDismiss })
    await userEvent.click(screen.getByLabelText('시작 가이드 닫기'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('전부 완료 시 축하 메시지를 표시한다', () => {
    renderCard({
      hasTransaction: true,
      hasBudget: true,
      isBotLinked: true,
      isPwaInstalled: true,
    })
    expect(screen.getByText('모든 준비가 끝났어요!')).toBeInTheDocument()
  })

  it('PWA 프롬프트 가능 시 onPromptPwa를 호출한다', async () => {
    const onPromptPwa = vi.fn()
    renderCard({ canPromptPwa: true, onPromptPwa })
    await userEvent.click(screen.getByText('홈화면에 추가하기'))
    expect(onPromptPwa).toHaveBeenCalled()
  })

  it('iOS에서 PWA 항목 클릭 시 onIosGuide를 호출한다', async () => {
    const onIosGuide = vi.fn()
    renderCard({ isIos: true, onIosGuide })
    await userEvent.click(screen.getByText('홈화면에 추가하기'))
    expect(onIosGuide).toHaveBeenCalled()
  })
})

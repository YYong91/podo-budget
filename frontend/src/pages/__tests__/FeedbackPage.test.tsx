/**
 * @file FeedbackPage.test.tsx
 * @description 피드백 페이지 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FeedbackPage from '../FeedbackPage'

// react-hot-toast 모킹
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <FeedbackPage />
    </MemoryRouter>,
  )
}

describe('FeedbackPage', () => {
  it('피드백 폼을 렌더링한다', async () => {
    renderPage()
    expect(screen.getByText('피드백 보내기')).toBeInTheDocument()
    expect(screen.getByText('기능 요청')).toBeInTheDocument()
    expect(screen.getByText('버그 신고')).toBeInTheDocument()
  })

  it('제목과 내용 입력 필드를 렌더링한다', () => {
    renderPage()
    expect(screen.getByPlaceholderText('제목')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('자세한 내용을 적어주세요')).toBeInTheDocument()
  })

  it('보내기 버튼이 비활성화 상태로 시작한다', () => {
    renderPage()
    const submitBtn = screen.getByRole('button', { name: /보내기/ })
    expect(submitBtn).toBeDisabled()
  })

  it('제목과 내용을 입력하면 보내기 버튼이 활성화된다', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('제목'), '다크모드 추가 요청')
    await user.type(screen.getByPlaceholderText('자세한 내용을 적어주세요'), '다크모드를 추가해주세요')

    const submitBtn = screen.getByRole('button', { name: /보내기/ })
    expect(submitBtn).not.toBeDisabled()
  })

  it('버그 신고 타입을 선택할 수 있다', async () => {
    const user = userEvent.setup()
    renderPage()

    const bugBtn = screen.getByText('버그 신고')
    await user.click(bugBtn)
    // 버그 타입 버튼이 활성화 스타일을 가져야 함 (bg-red-600)
    expect(bugBtn.closest('button')!.className).toContain('bg-red-600')
  })

  it('제출 후 폼이 초기화된다', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('제목'), '테스트 제목')
    await user.type(screen.getByPlaceholderText('자세한 내용을 적어주세요'), '테스트 내용')

    const submitBtn = screen.getByRole('button', { name: /보내기/ })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('제목')).toHaveValue('')
    })
  })

  it('내 피드백 목록을 로드하여 표시한다', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('내 피드백')).toBeInTheDocument()
    })
    // 내 피드백 + 관리자 피드백 모두 같은 데이터를 표시하므로 여러 개 존재
    expect(screen.getAllByText('다크모드 추가').length).toBeGreaterThan(0)
  })

  it('뒤로가기 링크가 설정 페이지로 이동한다', () => {
    renderPage()
    const backLink = screen.getByRole('link', { name: '뒤로가기' })
    expect(backLink).toHaveAttribute('href', '/settings')
  })
})

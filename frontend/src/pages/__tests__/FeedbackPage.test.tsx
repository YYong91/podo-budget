/**
 * @file FeedbackPage.test.tsx
 * @description 피드백 페이지 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FeedbackPage from '../FeedbackPage'

// useToast 모킹 (react-hot-toast 대신 커스텀 훅 사용)
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

// AuthContext 모킹 — 일반 유저 기본값
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, is_admin: false } }),
}))

// feedbackApi 모킹 — jsdom XHR/undici 비호환 회피
vi.mock('../../api/feedback', () => {
  const feedbacks = [
    {
      id: 1,
      user_id: 1,
      type: 'feature' as const,
      title: '다크모드 추가',
      content: '다크모드를 추가해주세요',
      status: 'new' as const,
      source: 'web' as const,
      username: 'testuser',
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    },
  ]
  return {
    feedbackApi: {
      getMine: vi.fn().mockResolvedValue({ data: feedbacks }),
      getAll: vi.fn().mockResolvedValue({ data: feedbacks }),
      create: vi.fn().mockResolvedValue({ data: { id: 99 } }),
      updateStatus: vi.fn().mockResolvedValue({ data: {} }),
    },
  }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <FeedbackPage />
    </MemoryRouter>,
  )
}

describe('FeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    expect(screen.getAllByText('다크모드 추가').length).toBeGreaterThan(0)
  })

  it('뒤로가기 버튼이 존재한다', () => {
    renderPage()
    const backButton = screen.getByRole('button', { name: '뒤로가기' })
    expect(backButton).toBeInTheDocument()
  })

  it('getMine 에러 시 에러 상태를 표시한다', async () => {
    const { feedbackApi } = await import('../../api/feedback')
    vi.mocked(feedbackApi.getMine).mockRejectedValueOnce({ response: { status: 500 } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })
    expect(screen.getByText('다시 시도')).toBeInTheDocument()
  })
})

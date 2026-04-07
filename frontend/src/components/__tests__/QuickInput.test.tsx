import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import QuickInput from '../QuickInput'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(['categories'], [
    { id: 1, name: '식비', emoji: '🍚', type: 'expense' },
    { id: 2, name: '교통비', emoji: '🚌', type: 'expense' },
  ])
  return { queryClient }
}

function renderQuickInput(props?: Partial<React.ComponentProps<typeof QuickInput>>) {
  const { queryClient } = createWrapper()
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSaveSuccess: vi.fn(),
    onSaveError: vi.fn(),
    householdId: 1,
    ...props,
  }
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <QuickInput {...defaultProps} />
        </MemoryRouter>
      </QueryClientProvider>
    ),
    queryClient,
    props: defaultProps,
  }
}

describe('QuickInput', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('isOpen=true일 때 입력창을 렌더링한다', () => {
    renderQuickInput()
    expect(screen.getByPlaceholderText(/점심/)).toBeInTheDocument()
    expect(screen.getByLabelText('전송')).toBeInTheDocument()
    expect(screen.getByLabelText('입력 취소')).toBeInTheDocument()
  })

  it('isOpen=false일 때 CSS로 숨겨진다 (항상 마운트, opacity-0)', () => {
    // 모프 애니메이션을 위해 항상 마운트 — isOpen=false 시 opacity-0 + scale-95 클래스로 숨김
    const { container } = renderQuickInput({ isOpen: false })
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('opacity-0')
    expect(wrapper.className).toContain('scale-95')
  })

  it('취소 버튼 클릭 시 onClose를 호출한다', async () => {
    const user = userEvent.setup()
    const { props } = renderQuickInput()
    await user.click(screen.getByLabelText('입력 취소'))
    expect(props.onClose).toHaveBeenCalled()
  })

  it('텍스트 입력 후 전송하면 성공 토스트 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const { props } = renderQuickInput()
    const input = screen.getByPlaceholderText(/점심/)
    await user.type(input, '점심 김치찌개 8000원')
    await user.click(screen.getByLabelText('전송'))

    await waitFor(() => {
      expect(props.onSaveSuccess).toHaveBeenCalled()
    })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('전송 중 입력창이 비활성화된다', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/chat', async () => {
        await new Promise(r => setTimeout(r, 500))
        return HttpResponse.json({
          message: '저장 완료',
          expenses_created: [{ id: 10, amount: 8000, description: '김치찌개', category_id: 1 }],
          incomes_created: null,
          parsed_items: null,
          parsed_expenses: null,
          insights: null,
        })
      })
    )
    renderQuickInput()
    await user.type(screen.getByPlaceholderText(/점심/), '점심 8000원')
    await user.click(screen.getByLabelText('전송'))
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('파싱 실패(expenses+incomes 모두 빈 배열)시 onSaveError를 호출하고 입력창을 유지한다', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/chat', () =>
        HttpResponse.json({
          message: '인식 실패',
          expenses_created: [],
          incomes_created: [],
          parsed_items: null,
          parsed_expenses: null,
          insights: null,
        })
      )
    )
    const { props } = renderQuickInput()
    await user.type(screen.getByPlaceholderText(/점심/), '아무말')
    await user.click(screen.getByLabelText('전송'))
    await waitFor(() => {
      expect(props.onSaveError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'parse_error' })
      )
    })
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('서버 에러 시 onSaveError를 호출하고 입력창을 유지한다', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/chat', () => HttpResponse.error())
    )
    const { props } = renderQuickInput()
    await user.type(screen.getByPlaceholderText(/점심/), '점심 8000원')
    await user.click(screen.getByLabelText('전송'))
    await waitFor(() => {
      expect(props.onSaveError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'server_error' })
      )
    })
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('빈 텍스트로 전송하지 않는다', async () => {
    const user = userEvent.setup()
    const { props } = renderQuickInput()
    await user.click(screen.getByLabelText('전송'))
    expect(props.onSaveSuccess).not.toHaveBeenCalled()
  })

  it('Enter 키로 전송할 수 있다', async () => {
    const user = userEvent.setup()
    const { props } = renderQuickInput()
    const input = screen.getByPlaceholderText(/점심/)
    await user.type(input, '점심 8000원{enter}')
    await waitFor(() => {
      expect(props.onSaveSuccess).toHaveBeenCalled()
    })
  })

  it('ESC 키로 입력을 취소할 수 있다', async () => {
    const user = userEvent.setup()
    const { props } = renderQuickInput()
    await user.keyboard('{Escape}')
    expect(props.onClose).toHaveBeenCalled()
  })
})

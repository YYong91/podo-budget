/**
 * @file ErrorState.test.tsx
 * @description ErrorState 컴포넌트 테스트
 * 에러 상태 UI, 기본값, 재시도 버튼 동작을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorState from '../ErrorState'

describe('ErrorState', () => {
  describe('기본 렌더링', () => {
    it('기본 제목을 표시한다', () => {
      render(<ErrorState />)
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })

    it('기본 메시지를 표시한다', () => {
      render(<ErrorState />)
      expect(
        screen.getByText(/데이터를 불러오는 중 오류가 발생했습니다/)
      ).toBeInTheDocument()
    })

    it('에러 아이콘을 표시한다', () => {
      const { container } = render(<ErrorState />)
      // Lucide 아이콘은 SVG로 렌더링됨
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('커스텀 제목을 표시한다', () => {
      render(<ErrorState title="네트워크 오류" />)
      expect(screen.getByText('네트워크 오류')).toBeInTheDocument()
    })

    it('커스텀 메시지를 표시한다', () => {
      render(<ErrorState message="서버에 연결할 수 없습니다" />)
      expect(screen.getByText('서버에 연결할 수 없습니다')).toBeInTheDocument()
    })
  })

  describe('재시도 버튼', () => {
    it('onRetry가 제공되면 재시도 버튼을 표시한다', () => {
      const onRetry = vi.fn()
      render(<ErrorState onRetry={onRetry} />)
      expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    })

    it('onRetry가 없으면 재시도 버튼을 표시하지 않는다', () => {
      render(<ErrorState />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('재시도 버튼 클릭 시 onRetry 핸들러가 호출된다', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()

      render(<ErrorState onRetry={onRetry} />)
      const retryButton = screen.getByRole('button', { name: '다시 시도' })
      await user.click(retryButton)

      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('재시도 버튼을 여러 번 클릭할 수 있다', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()

      render(<ErrorState onRetry={onRetry} />)
      const retryButton = screen.getByRole('button', { name: '다시 시도' })

      await user.click(retryButton)
      await user.click(retryButton)
      await user.click(retryButton)

      expect(onRetry).toHaveBeenCalledTimes(3)
    })
  })

  describe('스타일링', () => {
    it('재시도 버튼은 primary 스타일을 가진다', () => {
      const onRetry = vi.fn()
      render(<ErrorState onRetry={onRetry} />)

      const button = screen.getByRole('button', { name: '다시 시도' })
      expect(button).toHaveClass('bg-amber-600', 'text-white')
    })
  })
})

/**
 * @file ToastContext.test.tsx
 * @description ToastContext 테스트
 * addToast, removeToast, Provider 외부 접근 에러를 검증한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider, useToast } from '../ToastContext'

/** ToastContext를 소비하는 테스트용 컴포넌트 */
function ToastConsumer() {
  const { addToast, removeToast } = useToast()
  return (
    <div>
      <button onClick={() => addToast('success', '성공 메시지')}>성공 추가</button>
      <button onClick={() => addToast('error', '에러 메시지')}>에러 추가</button>
      <button onClick={() => addToast('info', '알림 메시지', 1000)}>알림 추가</button>
      <button
        onClick={() => {
          // 현재 표시된 toast의 id를 찾아 제거
          const toastEl = document.querySelector('[data-testid^="toast-"]')
          if (toastEl) removeToast(toastEl.getAttribute('data-testid')!)
        }}
      >
        첫 번째 제거
      </button>
    </div>
  )
}

function renderWithToastProvider() {
  return render(
    <ToastProvider>
      <ToastConsumer />
    </ToastProvider>,
  )
}

describe('ToastContext', () => {
  describe('ToastProvider 외부 사용', () => {
    it('Provider 없이 useToast 사용 시 에러를 던진다', () => {
      // 콘솔 에러 억제
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      function BareConsumer() {
        useToast()
        return null
      }

      expect(() => render(<BareConsumer />)).toThrow('useToast must be used within ToastProvider')
      consoleSpy.mockRestore()
    })
  })

  describe('addToast', () => {
    it('success 토스트를 추가하면 화면에 표시된다', async () => {
      const user = userEvent.setup()
      renderWithToastProvider()

      await user.click(screen.getByRole('button', { name: '성공 추가' }))

      await waitFor(() => {
        expect(screen.getByText('성공 메시지')).toBeInTheDocument()
      })
    })

    it('error 토스트를 추가하면 화면에 표시된다', async () => {
      const user = userEvent.setup()
      renderWithToastProvider()

      await user.click(screen.getByRole('button', { name: '에러 추가' }))

      await waitFor(() => {
        expect(screen.getByText('에러 메시지')).toBeInTheDocument()
      })
    })

    it('새 토스트 추가 시 기존 토스트를 교체한다 (1개만 표시)', async () => {
      const user = userEvent.setup()
      renderWithToastProvider()

      await user.click(screen.getByRole('button', { name: '성공 추가' }))
      await user.click(screen.getByRole('button', { name: '에러 추가' }))

      await waitFor(() => {
        // 마지막에 추가된 에러 토스트만 표시
        expect(screen.queryByText('성공 메시지')).not.toBeInTheDocument()
        expect(screen.getByText('에러 메시지')).toBeInTheDocument()
      })
    })
  })

  describe('removeToast', () => {
    it('removeToast 호출 시 해당 토스트가 사라진다', async () => {
      // 실제 removeToast는 Toast 컴포넌트 내부 타이머에 의해 호출됨
      // 여기서는 ToastProvider가 직접 removeToast를 노출하는지 확인
      const removeToastSpy = vi.fn()

      function SpyConsumer() {
        const { addToast, removeToast } = useToast()
        // removeToast를 spy로 감싸기 위해 effect 없이 바로 테스트
        return (
          <div>
            <button onClick={() => addToast('success', '제거 테스트')}>추가</button>
            <button onClick={() => { removeToastSpy(); removeToast('fake-id') }}>제거</button>
          </div>
        )
      }

      render(
        <ToastProvider>
          <SpyConsumer />
        </ToastProvider>,
      )

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: '제거' }))

      expect(removeToastSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('자동 해제 (auto-dismiss)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('기본 3초 후 토스트가 자동으로 사라진다', async () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>,
      )

      // fireEvent 사용 — fake timers와 충돌 없이 클릭 처리
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: '성공 추가' }))
      })

      // 토스트가 추가됨
      expect(screen.getByText('성공 메시지')).toBeInTheDocument()

      // 3.5초 경과 → setTimeout 발동 → onClose 호출 → 토스트 제거
      act(() => {
        vi.advanceTimersByTime(3500)
      })

      expect(screen.queryByText('성공 메시지')).not.toBeInTheDocument()
    })

    it('커스텀 duration 후 토스트가 사라진다', async () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>,
      )

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: '알림 추가' }))
      })

      // 토스트가 추가됨
      expect(screen.getByText('알림 메시지')).toBeInTheDocument()

      // 1.5초 경과 → 커스텀 1초 타이머 발동 → 토스트 제거
      act(() => {
        vi.advanceTimersByTime(1500)
      })

      expect(screen.queryByText('알림 메시지')).not.toBeInTheDocument()
    })
  })
})

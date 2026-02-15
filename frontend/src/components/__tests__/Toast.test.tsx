/**
 * @file Toast.test.tsx
 * @description Toast 컴포넌트 테스트
 * 토스트 타입별 스타일, 자동 닫기, 수동 닫기 동작을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Toast from '../Toast'

describe('Toast', () => {
  const defaultProps = {
    id: 'test-toast-1',
    message: '테스트 메시지',
    onClose: vi.fn(),
  }

  describe('성공 토스트', () => {
    it('성공 토스트를 올바른 스타일로 렌더링한다', () => {
      render(<Toast {...defaultProps} type="success" />)

      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveClass('bg-green-50')
      expect(alert).toHaveClass('border-green-200')
      expect(alert).toHaveClass('text-green-800')
    })

    it('메시지를 표시한다', () => {
      render(<Toast {...defaultProps} type="success" />)
      expect(screen.getByText('테스트 메시지')).toBeInTheDocument()
    })
  })

  describe('에러 토스트', () => {
    it('에러 토스트를 올바른 스타일로 렌더링한다', () => {
      render(<Toast {...defaultProps} type="error" />)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-red-50')
      expect(alert).toHaveClass('border-red-200')
      expect(alert).toHaveClass('text-red-800')
    })
  })

  describe('경고 토스트', () => {
    it('경고 토스트를 올바른 스타일로 렌더링한다', () => {
      render(<Toast {...defaultProps} type="warning" />)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-yellow-50')
      expect(alert).toHaveClass('border-yellow-200')
      expect(alert).toHaveClass('text-yellow-800')
    })
  })

  describe('정보 토스트', () => {
    it('정보 토스트를 올바른 스타일로 렌더링한다', () => {
      render(<Toast {...defaultProps} type="info" />)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass('bg-blue-50')
      expect(alert).toHaveClass('border-blue-200')
      expect(alert).toHaveClass('text-blue-800')
    })
  })

  describe('자동 닫기', () => {
    it('지정된 시간 후 onClose가 호출된다', () => {
      vi.useFakeTimers()
      const onClose = vi.fn()

      render(<Toast {...defaultProps} type="success" duration={2000} onClose={onClose} />)

      // 2초 전에는 호출되지 않음
      vi.advanceTimersByTime(1999)
      expect(onClose).not.toHaveBeenCalled()

      // 2초 후 호출됨
      vi.advanceTimersByTime(1)
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledWith('test-toast-1')

      vi.useRealTimers()
    })

    it('기본 duration은 3000ms이다', () => {
      vi.useFakeTimers()
      const onClose = vi.fn()

      render(<Toast {...defaultProps} type="success" onClose={onClose} />)

      vi.advanceTimersByTime(2999)
      expect(onClose).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(onClose).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })

  describe('닫기 버튼', () => {
    it('닫기 버튼이 표시된다', () => {
      render(<Toast {...defaultProps} type="success" />)

      const closeButton = screen.getByRole('button', { name: '닫기' })
      expect(closeButton).toBeInTheDocument()
    })

    it('닫기 버튼 클릭 시 onClose가 호출된다', () => {
      vi.useFakeTimers()
      const onClose = vi.fn()

      render(<Toast {...defaultProps} type="error" onClose={onClose} />)

      const closeButton = screen.getByRole('button', { name: '닫기' })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledWith('test-toast-1')

      vi.useRealTimers()
    })
  })
})

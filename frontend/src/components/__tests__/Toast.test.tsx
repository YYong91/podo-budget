/**
 * @file Toast.test.tsx
 * @description Toast 컴포넌트 테스트
 * pill shape 디자인, 타입별 아이콘 색상, 자동 닫기 동작을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Toast from '../Toast'

describe('Toast', () => {
  const defaultProps = {
    id: 'test-toast-1',
    message: '테스트 메시지',
    onClose: vi.fn(),
  }

  describe('토스트 렌더링', () => {
    it('성공 토스트를 렌더링한다', () => {
      render(<Toast {...defaultProps} type="success" />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('테스트 메시지')).toBeInTheDocument()
    })

    it('에러 토스트를 렌더링한다', () => {
      render(<Toast {...defaultProps} type="error" />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('테스트 메시지')).toBeInTheDocument()
    })

    it('경고 토스트를 렌더링한다', () => {
      render(<Toast {...defaultProps} type="warning" />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('테스트 메시지')).toBeInTheDocument()
    })

    it('정보 토스트를 렌더링한다', () => {
      render(<Toast {...defaultProps} type="info" />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('테스트 메시지')).toBeInTheDocument()
    })
  })

  describe('pill shape 디자인', () => {
    it('rounded-full 클래스가 적용된다', () => {
      render(<Toast {...defaultProps} type="success" />)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain('rounded-full')
    })

    it('다크 포도색 배경이 적용된다', () => {
      render(<Toast {...defaultProps} type="success" />)
      const alert = screen.getByRole('alert')
      expect(alert.className).toContain('bg-[#1a1625]')
    })

    it('메시지가 truncate로 1줄 강제된다', () => {
      render(<Toast {...defaultProps} type="success" />)
      const message = screen.getByText('테스트 메시지')
      expect(message.className).toContain('truncate')
    })
  })

  describe('타입별 아이콘 색상', () => {
    it('성공 토스트는 leaf-400 아이콘 색상을 가진다', () => {
      render(<Toast {...defaultProps} type="success" />)
      const alert = screen.getByRole('alert')
      const iconSpan = alert.querySelector('span')
      expect(iconSpan?.className).toContain('text-leaf-400')
    })

    it('에러 토스트는 red-400 아이콘 색상을 가진다', () => {
      render(<Toast {...defaultProps} type="error" />)
      const alert = screen.getByRole('alert')
      const iconSpan = alert.querySelector('span')
      expect(iconSpan?.className).toContain('text-red-400')
    })

    it('경고 토스트는 amber-400 아이콘 색상을 가진다', () => {
      render(<Toast {...defaultProps} type="warning" />)
      const alert = screen.getByRole('alert')
      const iconSpan = alert.querySelector('span')
      expect(iconSpan?.className).toContain('text-amber-400')
    })

    it('정보 토스트는 grape-300 아이콘 색상을 가진다', () => {
      render(<Toast {...defaultProps} type="info" />)
      const alert = screen.getByRole('alert')
      const iconSpan = alert.querySelector('span')
      expect(iconSpan?.className).toContain('text-grape-300')
    })
  })

  describe('자동 닫기', () => {
    it('지정된 시간 후 onClose가 호출된다', () => {
      vi.useFakeTimers()
      const onClose = vi.fn()

      render(<Toast {...defaultProps} type="success" duration={2000} onClose={onClose} />)

      vi.advanceTimersByTime(1999)
      expect(onClose).not.toHaveBeenCalled()

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
})

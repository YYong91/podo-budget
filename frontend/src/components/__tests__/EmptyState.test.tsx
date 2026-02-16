/**
 * @file EmptyState.test.tsx
 * @description EmptyState 컴포넌트 테스트
 * 빈 상태 UI, 아이콘, 액션 버튼 동작을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmptyState from '../EmptyState'

describe('EmptyState', () => {
  describe('기본 렌더링', () => {
    it('제목을 표시한다', () => {
      render(<EmptyState title="데이터가 없습니다" />)
      expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument()
    })

    it('기본 아이콘을 표시한다', () => {
      const { container } = render(<EmptyState title="테스트" />)
      // Lucide 아이콘은 SVG로 렌더링됨
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('커스텀 아이콘을 표시한다', () => {
      render(<EmptyState icon={<span>🎉</span>} title="테스트" />)
      expect(screen.getByText('🎉')).toBeInTheDocument()
    })

    it('설명을 표시한다', () => {
      render(<EmptyState title="제목" description="이것은 설명입니다" />)
      expect(screen.getByText('이것은 설명입니다')).toBeInTheDocument()
    })

    it('설명이 없으면 표시하지 않는다', () => {
      render(<EmptyState title="제목" />)
      const description = screen.queryByText(/설명/)
      expect(description).not.toBeInTheDocument()
    })
  })

  describe('액션 버튼', () => {
    it('주요 액션 버튼을 표시한다', () => {
      const action = {
        label: '추가하기',
        onClick: vi.fn(),
      }
      render(<EmptyState title="테스트" action={action} />)
      expect(screen.getByRole('button', { name: '추가하기' })).toBeInTheDocument()
    })

    it('주요 액션 버튼 클릭 시 핸들러가 호출된다', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      const action = {
        label: '추가하기',
        onClick,
      }

      render(<EmptyState title="테스트" action={action} />)
      const button = screen.getByRole('button', { name: '추가하기' })
      await user.click(button)

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('보조 액션 버튼을 표시한다', () => {
      const secondaryAction = {
        label: '취소',
        onClick: vi.fn(),
      }
      render(<EmptyState title="테스트" secondaryAction={secondaryAction} />)
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
    })

    it('보조 액션 버튼 클릭 시 핸들러가 호출된다', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      const secondaryAction = {
        label: '취소',
        onClick,
      }

      render(<EmptyState title="테스트" secondaryAction={secondaryAction} />)
      const button = screen.getByRole('button', { name: '취소' })
      await user.click(button)

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('주요 액션과 보조 액션을 동시에 표시한다', () => {
      const action = { label: '추가', onClick: vi.fn() }
      const secondaryAction = { label: '취소', onClick: vi.fn() }

      render(<EmptyState title="테스트" action={action} secondaryAction={secondaryAction} />)

      expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
    })

    it('액션이 없으면 버튼을 표시하지 않는다', () => {
      render(<EmptyState title="테스트" />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('스타일링', () => {
    it('주요 액션 버튼은 primary 스타일을 가진다', () => {
      const action = { label: '추가', onClick: vi.fn() }
      render(<EmptyState title="테스트" action={action} />)

      const button = screen.getByRole('button', { name: '추가' })
      expect(button).toHaveClass('bg-grape-600')
    })

    it('보조 액션 버튼은 secondary 스타일을 가진다', () => {
      const secondaryAction = { label: '취소', onClick: vi.fn() }
      render(<EmptyState title="테스트" secondaryAction={secondaryAction} />)

      const button = screen.getByRole('button', { name: '취소' })
      expect(button).toHaveClass('bg-white', 'border-stone-300')
    })
  })
})

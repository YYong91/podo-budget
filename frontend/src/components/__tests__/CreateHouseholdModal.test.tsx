/**
 * @file CreateHouseholdModal.test.tsx
 * @description CreateHouseholdModal 컴포넌트 테스트
 * 모달 렌더링, 폼 입력, 제출, 닫기 동작을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateHouseholdModal from '../CreateHouseholdModal'

describe('CreateHouseholdModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }

  describe('렌더링', () => {
    it('모달이 열리면 폼 필드를 표시한다', () => {
      render(<CreateHouseholdModal {...defaultProps} />)

      expect(screen.getByText('새 가구 만들기')).toBeInTheDocument()
      expect(screen.getByLabelText(/가구 이름/)).toBeInTheDocument()
      expect(screen.getByLabelText(/설명/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '생성' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
    })

    it('isOpen이 false이면 렌더링하지 않는다', () => {
      render(<CreateHouseholdModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByText('새 가구 만들기')).not.toBeInTheDocument()
    })

    it('로딩 중일 때 "생성 중..." 텍스트를 표시한다', () => {
      render(<CreateHouseholdModal {...defaultProps} isLoading={true} />)

      expect(screen.getByRole('button', { name: '생성 중...' })).toBeInTheDocument()
    })
  })

  describe('폼 제출', () => {
    it('폼 데이터를 입력하고 제출하면 onSubmit이 호출된다', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue(undefined)

      render(<CreateHouseholdModal {...defaultProps} onSubmit={onSubmit} />)

      await user.type(screen.getByLabelText(/가구 이름/), '우리 가족')
      await user.type(screen.getByLabelText(/설명/), '가족 가계부')
      await user.click(screen.getByRole('button', { name: '생성' }))

      expect(onSubmit).toHaveBeenCalledWith({
        name: '우리 가족',
        description: '가족 가계부',
      })
    })

    it('이름이 공백만 있으면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue(undefined)

      render(<CreateHouseholdModal {...defaultProps} onSubmit={onSubmit} />)

      // 공백만 입력하면 trim() 후 빈 값이므로 유효성 검증에 실패한다
      await user.type(screen.getByLabelText(/가구 이름/), '   ')
      await user.click(screen.getByRole('button', { name: '생성' }))

      expect(screen.getByText('가구 이름을 입력해주세요')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('onSubmit이 실패하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockRejectedValue(new Error('서버 오류'))

      render(<CreateHouseholdModal {...defaultProps} onSubmit={onSubmit} />)

      await user.type(screen.getByLabelText(/가구 이름/), '테스트 가구')
      await user.click(screen.getByRole('button', { name: '생성' }))

      expect(await screen.findByText('가구 생성에 실패했습니다')).toBeInTheDocument()
    })
  })

  describe('모달 닫기', () => {
    it('취소 버튼 클릭 시 onClose가 호출된다', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      render(<CreateHouseholdModal {...defaultProps} onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: '취소' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('로딩 중에는 취소 버튼으로 닫을 수 없다', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      render(<CreateHouseholdModal {...defaultProps} onClose={onClose} isLoading={true} />)

      await user.click(screen.getByRole('button', { name: '취소' }))

      expect(onClose).not.toHaveBeenCalled()
    })
  })
})

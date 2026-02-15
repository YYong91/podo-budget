/**
 * @file InviteMemberModal.test.tsx
 * @description InviteMemberModal 컴포넌트 테스트
 * 이메일/역할 입력, 유효성 검증, 제출, 닫기 동작을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InviteMemberModal from '../InviteMemberModal'

describe('InviteMemberModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }

  describe('렌더링', () => {
    it('모달이 열리면 이메일 입력과 역할 선택을 표시한다', () => {
      render(<InviteMemberModal {...defaultProps} />)

      expect(screen.getByText('멤버 초대')).toBeInTheDocument()
      expect(screen.getByLabelText(/이메일/)).toBeInTheDocument()
      expect(screen.getByLabelText('역할')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '초대' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
    })

    it('isOpen이 false이면 렌더링하지 않는다', () => {
      render(<InviteMemberModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByText('멤버 초대')).not.toBeInTheDocument()
    })

    it('역할 선택에 멤버와 관리자 옵션이 있다', () => {
      render(<InviteMemberModal {...defaultProps} />)

      const select = screen.getByLabelText('역할')
      expect(select).toBeInTheDocument()

      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(2)
      expect(options[0]).toHaveTextContent('멤버')
      expect(options[1]).toHaveTextContent('관리자')
    })

    it('로딩 중일 때 "초대 중..." 텍스트를 표시한다', () => {
      render(<InviteMemberModal {...defaultProps} isLoading={true} />)

      expect(screen.getByRole('button', { name: '초대 중...' })).toBeInTheDocument()
    })
  })

  describe('폼 제출', () => {
    it('이메일과 역할을 입력하고 제출하면 onSubmit이 호출된다', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue(undefined)

      render(<InviteMemberModal {...defaultProps} onSubmit={onSubmit} />)

      await user.type(screen.getByLabelText(/이메일/), 'test@example.com')
      await user.click(screen.getByRole('button', { name: '초대' }))

      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        role: 'member',
      })
    })

    it('관리자 역할로 초대할 수 있다', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockResolvedValue(undefined)

      render(<InviteMemberModal {...defaultProps} onSubmit={onSubmit} />)

      await user.type(screen.getByLabelText(/이메일/), 'admin@example.com')
      await user.selectOptions(screen.getByLabelText('역할'), 'admin')
      await user.click(screen.getByRole('button', { name: '초대' }))

      expect(onSubmit).toHaveBeenCalledWith({
        email: 'admin@example.com',
        role: 'admin',
      })
    })

    it('이메일이 비어있으면 에러 메시지를 표시한다', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)

      render(<InviteMemberModal {...defaultProps} onSubmit={onSubmit} />)

      // required 속성이 있는 빈 email 필드에서는 button click이 폼 제출을 막으므로
      // fireEvent.submit으로 직접 폼을 제출하여 handleSubmit 유효성 검증을 테스트한다
      const form = screen.getByLabelText(/이메일/).closest('form')!
      fireEvent.submit(form)

      expect(screen.getByText('이메일을 입력해주세요')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('잘못된 이메일 형식이면 에러 메시지를 표시한다', () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)

      render(<InviteMemberModal {...defaultProps} onSubmit={onSubmit} />)

      // fireEvent로 직접 값을 변경하여 jsdom의 type="email" 제약을 우회
      const emailInput = screen.getByLabelText(/이메일/) as HTMLInputElement
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

      // fireEvent.submit으로 폼을 직접 제출
      const form = emailInput.closest('form')!
      fireEvent.submit(form)

      expect(screen.getByText('올바른 이메일 형식을 입력해주세요')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('onSubmit이 실패하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockRejectedValue(new Error('서버 오류'))

      render(<InviteMemberModal {...defaultProps} onSubmit={onSubmit} />)

      await user.type(screen.getByLabelText(/이메일/), 'test@example.com')
      await user.click(screen.getByRole('button', { name: '초대' }))

      expect(await screen.findByText('멤버 초대에 실패했습니다')).toBeInTheDocument()
    })
  })

  describe('모달 닫기', () => {
    it('취소 버튼 클릭 시 onClose가 호출된다', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      render(<InviteMemberModal {...defaultProps} onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: '취소' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('로딩 중에는 취소 버튼으로 닫을 수 없다', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      render(<InviteMemberModal {...defaultProps} onClose={onClose} isLoading={true} />)

      await user.click(screen.getByRole('button', { name: '취소' }))

      expect(onClose).not.toHaveBeenCalled()
    })
  })
})

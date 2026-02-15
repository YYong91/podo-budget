/**
 * @file ForgotPasswordPage.test.tsx
 * @description 비밀번호 찾기 페이지 테스트
 * 이메일 입력, 유효성 검증, 발송 성공/실패를 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import ForgotPasswordPage from '../ForgotPasswordPage'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

function renderForgotPasswordPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  )
}

describe('ForgotPasswordPage', () => {
  describe('기본 렌더링', () => {
    it('비밀번호 찾기 제목을 표시한다', () => {
      renderForgotPasswordPage()
      expect(screen.getByText('비밀번호 찾기')).toBeInTheDocument()
    })

    it('HomeNRich 로고를 표시한다', () => {
      renderForgotPasswordPage()
      expect(screen.getByText('HomeNRich')).toBeInTheDocument()
    })

    it('이메일 입력 필드를 표시한다', () => {
      renderForgotPasswordPage()
      expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    })

    it('재설정 링크 보내기 버튼을 표시한다', () => {
      renderForgotPasswordPage()
      expect(screen.getByRole('button', { name: '재설정 링크 보내기' })).toBeInTheDocument()
    })

    it('로그인으로 돌아가기 링크를 표시한다', () => {
      renderForgotPasswordPage()
      const link = screen.getByRole('link', { name: /로그인으로 돌아가기/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/login')
    })
  })

  describe('유효성 검증', () => {
    it('이메일을 입력하지 않고 제출하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      renderForgotPasswordPage()

      await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }))

      expect(screen.getByText('이메일을 입력해주세요')).toBeInTheDocument()
    })
  })

  describe('발송 성공', () => {
    it('이메일 발송 성공 시 확인 화면을 표시한다', async () => {
      const user = userEvent.setup()

      server.use(
        http.post('/api/auth/forgot-password', () => {
          return HttpResponse.json({ message: 'ok' })
        })
      )

      renderForgotPasswordPage()

      const emailInput = screen.getByLabelText('이메일')
      await user.type(emailInput, 'test@test.com')
      await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }))

      await waitFor(() => {
        expect(screen.getByText('이메일을 확인하세요')).toBeInTheDocument()
      })

      expect(
        screen.getByText(/등록된 이메일이라면 비밀번호 재설정 링크가 발송됩니다/)
      ).toBeInTheDocument()
    })

    it('발송 완료 후 로그인으로 돌아가기 링크를 표시한다', async () => {
      const user = userEvent.setup()

      server.use(
        http.post('/api/auth/forgot-password', () => {
          return HttpResponse.json({ message: 'ok' })
        })
      )

      renderForgotPasswordPage()

      const emailInput = screen.getByLabelText('이메일')
      await user.type(emailInput, 'test@test.com')
      await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }))

      await waitFor(() => {
        expect(screen.getByText('이메일을 확인하세요')).toBeInTheDocument()
      })

      const link = screen.getByRole('link', { name: /로그인으로 돌아가기/i })
      expect(link).toHaveAttribute('href', '/login')
    })
  })

  describe('발송 실패', () => {
    it('API 에러 발생 시 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()

      server.use(
        http.post('/api/auth/forgot-password', () => {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        })
      )

      renderForgotPasswordPage()

      const emailInput = screen.getByLabelText('이메일')
      await user.type(emailInput, 'test@test.com')
      await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }))

      await waitFor(() => {
        expect(
          screen.getByText('요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        ).toBeInTheDocument()
      })
    })
  })

  describe('로딩 상태', () => {
    it('발송 중에는 버튼에 "발송 중..." 텍스트를 표시한다', async () => {
      const user = userEvent.setup()

      // 응답을 지연시켜서 로딩 상태를 확인
      server.use(
        http.post('/api/auth/forgot-password', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json({ message: 'ok' })
        })
      )

      renderForgotPasswordPage()

      const emailInput = screen.getByLabelText('이메일')
      await user.type(emailInput, 'test@test.com')
      await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }))

      // 로딩 중에는 버튼이 비활성화됨
      await waitFor(() => {
        expect(screen.getByText('발송 중...')).toBeInTheDocument()
      })
    })
  })
})

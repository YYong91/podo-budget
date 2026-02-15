/**
 * @file ResetPasswordPage.test.tsx
 * @description 비밀번호 재설정 페이지 테스트
 * 비밀번호 입력, 유효성 검증, 재설정 성공/실패를 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import ResetPasswordPage from '../ResetPasswordPage'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

/**
 * 토큰 파라미터가 있는 상태로 렌더링
 */
function renderWithToken(token?: string) {
  const path = token ? `/reset-password?token=${token}` : '/reset-password'
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<div>로그인 페이지</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ResetPasswordPage', () => {
  describe('기본 렌더링', () => {
    it('비밀번호 재설정 제목을 표시한다', () => {
      renderWithToken('test-reset-token')
      expect(screen.getByText('비밀번호 재설정')).toBeInTheDocument()
    })

    it('HomeNRich 로고를 표시한다', () => {
      renderWithToken('test-reset-token')
      expect(screen.getByText('HomeNRich')).toBeInTheDocument()
    })

    it('새 비밀번호 입력 필드를 표시한다', () => {
      renderWithToken('test-reset-token')
      expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument()
    })

    it('비밀번호 확인 입력 필드를 표시한다', () => {
      renderWithToken('test-reset-token')
      expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument()
    })

    it('비밀번호 변경하기 버튼을 표시한다', () => {
      renderWithToken('test-reset-token')
      expect(screen.getByRole('button', { name: '비밀번호 변경하기' })).toBeInTheDocument()
    })

    it('로그인으로 돌아가기 링크를 표시한다', () => {
      renderWithToken('test-reset-token')
      const link = screen.getByRole('link', { name: /로그인으로 돌아가기/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/login')
    })
  })

  describe('유효성 검증', () => {
    it('8자 미만 비밀번호를 입력하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      renderWithToken('test-reset-token')

      const passwordInput = screen.getByLabelText('새 비밀번호')
      const confirmInput = screen.getByLabelText('비밀번호 확인')

      await user.type(passwordInput, 'short')
      await user.type(confirmInput, 'short')
      await user.click(screen.getByRole('button', { name: '비밀번호 변경하기' }))

      expect(screen.getByText('비밀번호는 8자 이상이어야 합니다')).toBeInTheDocument()
    })

    it('비밀번호가 일치하지 않으면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      renderWithToken('test-reset-token')

      const passwordInput = screen.getByLabelText('새 비밀번호')
      const confirmInput = screen.getByLabelText('비밀번호 확인')

      await user.type(passwordInput, 'password123')
      await user.type(confirmInput, 'password456')
      await user.click(screen.getByRole('button', { name: '비밀번호 변경하기' }))

      expect(screen.getByText('비밀번호가 일치하지 않습니다')).toBeInTheDocument()
    })

    it('토큰이 없으면 유효하지 않은 링크 에러를 표시한다', async () => {
      const user = userEvent.setup()
      renderWithToken() // 토큰 없이 렌더링

      const passwordInput = screen.getByLabelText('새 비밀번호')
      const confirmInput = screen.getByLabelText('비밀번호 확인')

      await user.type(passwordInput, 'password123')
      await user.type(confirmInput, 'password123')
      await user.click(screen.getByRole('button', { name: '비밀번호 변경하기' }))

      expect(screen.getByText('유효하지 않은 링크입니다')).toBeInTheDocument()
    })
  })

  describe('재설정 성공', () => {
    it('비밀번호 변경 성공 시 완료 화면을 표시한다', async () => {
      const user = userEvent.setup()

      server.use(
        http.post('/api/auth/reset-password', () => {
          return HttpResponse.json({ message: 'ok' })
        })
      )

      renderWithToken('test-reset-token')

      const passwordInput = screen.getByLabelText('새 비밀번호')
      const confirmInput = screen.getByLabelText('비밀번호 확인')

      await user.type(passwordInput, 'newpassword123')
      await user.type(confirmInput, 'newpassword123')
      await user.click(screen.getByRole('button', { name: '비밀번호 변경하기' }))

      await waitFor(() => {
        expect(screen.getByText('비밀번호가 변경되었습니다')).toBeInTheDocument()
      })

      expect(screen.getByText('새 비밀번호로 로그인해주세요.')).toBeInTheDocument()
    })

    it('변경 완료 후 로그인하기 링크를 표시한다', async () => {
      const user = userEvent.setup()

      server.use(
        http.post('/api/auth/reset-password', () => {
          return HttpResponse.json({ message: 'ok' })
        })
      )

      renderWithToken('test-reset-token')

      const passwordInput = screen.getByLabelText('새 비밀번호')
      const confirmInput = screen.getByLabelText('비밀번호 확인')

      await user.type(passwordInput, 'newpassword123')
      await user.type(confirmInput, 'newpassword123')
      await user.click(screen.getByRole('button', { name: '비밀번호 변경하기' }))

      await waitFor(() => {
        expect(screen.getByText('비밀번호가 변경되었습니다')).toBeInTheDocument()
      })

      const loginLink = screen.getByRole('link', { name: '로그인하기' })
      expect(loginLink).toHaveAttribute('href', '/login')
    })
  })

  describe('재설정 실패', () => {
    it('API 에러 발생 시 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()

      server.use(
        http.post('/api/auth/reset-password', () => {
          return HttpResponse.json({ detail: 'Invalid token' }, { status: 400 })
        })
      )

      renderWithToken('expired-token')

      const passwordInput = screen.getByLabelText('새 비밀번호')
      const confirmInput = screen.getByLabelText('비밀번호 확인')

      await user.type(passwordInput, 'newpassword123')
      await user.type(confirmInput, 'newpassword123')
      await user.click(screen.getByRole('button', { name: '비밀번호 변경하기' }))

      await waitFor(() => {
        expect(
          screen.getByText('토큰이 만료되었거나 유효하지 않습니다. 비밀번호 찾기를 다시 시도해주세요.')
        ).toBeInTheDocument()
      })
    })
  })

  describe('로딩 상태', () => {
    it('변경 중에는 "변경 중..." 텍스트를 표시한다', async () => {
      const user = userEvent.setup()

      server.use(
        http.post('/api/auth/reset-password', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return HttpResponse.json({ message: 'ok' })
        })
      )

      renderWithToken('test-reset-token')

      const passwordInput = screen.getByLabelText('새 비밀번호')
      const confirmInput = screen.getByLabelText('비밀번호 확인')

      await user.type(passwordInput, 'newpassword123')
      await user.type(confirmInput, 'newpassword123')
      await user.click(screen.getByRole('button', { name: '비밀번호 변경하기' }))

      await waitFor(() => {
        expect(screen.getByText('변경 중...')).toBeInTheDocument()
      })
    })
  })
})

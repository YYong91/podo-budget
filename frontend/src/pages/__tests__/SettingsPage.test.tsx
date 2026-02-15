/**
 * @file SettingsPage.test.tsx
 * @description 설정 페이지 테스트
 * 사용자 정보 표시, 계정 삭제, 로그아웃 기능을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import SettingsPage from '../SettingsPage'

// useAuth 모킹
const mockLogout = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@test.com',
      is_active: true,
      created_at: '2024-01-15T00:00:00Z',
    },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
  }),
}))

// useToast 모킹
const mockAddToast = vi.fn()
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast, removeToast: vi.fn() }),
}))

// auth API 모킹
vi.mock('../../api/auth', () => ({
  default: {
    deleteAccount: vi.fn().mockResolvedValue({}),
  },
}))

function renderSettingsPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('기본 렌더링', () => {
    it('페이지 제목 "설정"을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
    })

    it('계정 정보 섹션 제목을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('계정 정보')).toBeInTheDocument()
    })
  })

  describe('사용자 정보 표시', () => {
    it('사용자명을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('사용자명')).toBeInTheDocument()
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    it('이메일을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('이메일')).toBeInTheDocument()
      expect(screen.getByText('test@test.com')).toBeInTheDocument()
    })

    it('가입일을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText('가입일')).toBeInTheDocument()
      expect(screen.getByText('2024.01.15')).toBeInTheDocument()
    })
  })

  describe('계정 삭제 섹션', () => {
    it('계정 삭제 섹션 제목을 표시한다', () => {
      renderSettingsPage()
      // "계정 삭제" 텍스트는 h2와 button에 모두 존재하므로 heading role로 검색
      const headings = screen.getAllByText('계정 삭제')
      expect(headings.length).toBeGreaterThanOrEqual(1)
      // h2 heading이 존재하는지 확인
      const h2 = headings.find((el) => el.tagName === 'H2')
      expect(h2).toBeInTheDocument()
    })

    it('주의사항을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByText(/계정을 삭제하면 모든 데이터/)).toBeInTheDocument()
    })

    it('계정 삭제 버튼을 표시한다', () => {
      renderSettingsPage()
      expect(screen.getByRole('button', { name: '계정 삭제' })).toBeInTheDocument()
    })

    it('계정 삭제 버튼 클릭 시 확인 모달을 표시한다', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      await user.click(screen.getByRole('button', { name: '계정 삭제' }))

      expect(screen.getByText('정말 계정을 삭제하시겠습니까?')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('사용자명 입력')).toBeInTheDocument()
    })

    it('모달에서 취소 버튼을 클릭하면 모달이 닫힌다', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      await user.click(screen.getByRole('button', { name: '계정 삭제' }))
      expect(screen.getByText('정말 계정을 삭제하시겠습니까?')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '취소' }))
      expect(screen.queryByText('정말 계정을 삭제하시겠습니까?')).not.toBeInTheDocument()
    })

    it('사용자명이 일치하지 않으면 삭제 버튼이 비활성화된다', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      await user.click(screen.getByRole('button', { name: '계정 삭제' }))

      const input = screen.getByPlaceholderText('사용자명 입력')
      await user.type(input, 'wrongname')

      // 모달 내부의 삭제 버튼을 찾음
      const deleteButton = screen.getByRole('button', { name: '삭제' })
      expect(deleteButton).toBeDisabled()
    })

    it('사용자명이 일치하면 삭제 버튼이 활성화된다', async () => {
      const user = userEvent.setup()
      renderSettingsPage()

      await user.click(screen.getByRole('button', { name: '계정 삭제' }))

      const input = screen.getByPlaceholderText('사용자명 입력')
      await user.type(input, 'testuser')

      const deleteButton = screen.getByRole('button', { name: '삭제' })
      expect(deleteButton).not.toBeDisabled()
    })
  })
})

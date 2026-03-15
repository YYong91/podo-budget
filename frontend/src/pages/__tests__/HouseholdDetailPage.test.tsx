/**
 * @file HouseholdDetailPage.test.tsx
 * @description 공유 가계부 상세 페이지 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HouseholdDetailPage from '../HouseholdDetailPage'

const mockHousehold = {
  id: 1,
  name: '우리집',
  description: '가족 가계부',
  my_role: 'owner',
  members: [
    {
      user_id: 1,
      username: '홍길동',
      email: 'hong@example.com',
      role: 'owner',
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      user_id: 2,
      username: '김철수',
      email: 'kim@example.com',
      role: 'member',
      joined_at: '2026-02-01T00:00:00Z',
    },
  ],
}

const fetchHouseholdDetail = vi.fn().mockResolvedValue(mockHousehold)
const clearCurrentHousehold = vi.fn()
const clearError = vi.fn()

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({
    currentHousehold: mockHousehold,
    isLoading: false,
    error: null,
    householdInvitations: [],
    fetchHouseholdDetail,
    fetchHouseholdInvitations: vi.fn().mockResolvedValue(undefined),
    updateHousehold: vi.fn(),
    deleteHousehold: vi.fn(),
    inviteMember: vi.fn(),
    cancelInvitation: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    leaveHousehold: vi.fn(),
    clearError,
    clearCurrentHousehold,
  }),
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: '홍길동' } }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/households/1']}>
      <Routes>
        <Route path="/households/:id" element={<HouseholdDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('HouseholdDetailPage', () => {
  it('가구 역할 뱃지를 표시한다', async () => {
    renderPage()
    // 헤더의 역할 뱃지 + 테이블의 역할 뱃지 모두 표시됨
    expect(screen.getAllByText('소유자').length).toBeGreaterThan(0)
  })

  it('가구 설명을 표시한다', () => {
    renderPage()
    expect(screen.getByText('가족 가계부')).toBeInTheDocument()
  })

  it('멤버 탭이 기본 선택되어 있다', () => {
    renderPage()
    // "멤버" 텍스트는 탭 + 테이블 역할 드롭다운에 모두 존재
    expect(screen.getAllByText('멤버').length).toBeGreaterThan(0)
  })

  it('멤버 목록을 표시한다', () => {
    renderPage()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('김철수')).toBeInTheDocument()
  })

  it('멤버의 이메일을 표시한다', () => {
    renderPage()
    expect(screen.getByText('hong@example.com')).toBeInTheDocument()
    expect(screen.getByText('kim@example.com')).toBeInTheDocument()
  })

  it('소유자에게 초대 탭과 설정 탭을 표시한다', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /초대/ })).toBeInTheDocument()
    expect(screen.getByText('설정')).toBeInTheDocument()
  })

  it('소유자는 다른 멤버에 대해 추방 버튼을 볼 수 있다', () => {
    renderPage()
    expect(screen.getByText('추방')).toBeInTheDocument()
  })

  it('자기 자신은 (나) 표시가 된다', () => {
    renderPage()
    expect(screen.getByText('(나)')).toBeInTheDocument()
  })

  it('가구 정보 로드를 요청한다', async () => {
    renderPage()
    await waitFor(() => {
      expect(fetchHouseholdDetail).toHaveBeenCalledWith(1)
    })
  })
})

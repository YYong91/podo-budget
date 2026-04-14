/**
 * @file AppearanceSection.test.tsx
 * @description AppearanceSection 컴포넌트 테스트 — 테마 선택 UI 검증
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../../../contexts/ThemeContext'
import SettingsPage from '../../../pages/SettingsPage'

vi.mock('../../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: number }) => unknown) =>
    selector({ activeHouseholdId: 1 }),
}))

vi.mock('../../../utils/supabase', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@test.com',
      is_active: true,
      created_at: '2024-01-15T00:00:00Z',
      is_telegram_linked: false,
    },
    isAuthenticated: true,
    loading: false,
    logout: vi.fn(),
  }),
}))

// IntersectionObserver mock
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
} as unknown as typeof globalThis.IntersectionObserver

function renderAppearance() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/settings/appearance']}>
          <Routes>
            <Route path="/settings/:section" element={<SettingsPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('AppearanceSection 컴포넌트', () => {
  it('화면 모드 옵션 3개를 표시한다', () => {
    renderAppearance()
    expect(screen.getByText('시스템 설정')).toBeInTheDocument()
    expect(screen.getByText('라이트 모드')).toBeInTheDocument()
    expect(screen.getByText('다크 모드')).toBeInTheDocument()
  })

  it('옵션 설명을 표시한다', () => {
    renderAppearance()
    expect(screen.getByText('기기 설정에 따라 자동 전환')).toBeInTheDocument()
    expect(screen.getByText('밝은 화면')).toBeInTheDocument()
    expect(screen.getByText('어두운 화면')).toBeInTheDocument()
  })

  it('라이트 모드 버튼 클릭이 동작한다', async () => {
    const user = userEvent.setup()
    renderAppearance()
    await user.click(screen.getByText('라이트 모드'))
    // 선택됨 표시 — 에러 없이 동작
    expect(screen.getByText('라이트 모드')).toBeInTheDocument()
  })
})

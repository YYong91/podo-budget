/**
 * @file ChangelogSection.test.tsx
 * @description ChangelogSection 컴포넌트 테스트 — changelog 타임라인 렌더링 검증
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '../../../contexts/ThemeContext'
import SettingsPage from '../../../pages/SettingsPage'
import { changelogs } from '../../../data/changelogs'

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

function renderChangelog() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/settings/changelog']}>
        <Routes>
          <Route path="/settings/:section" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('ChangelogSection 컴포넌트', () => {
  it('changelog 항목의 버전과 제목을 표시한다', () => {
    renderChangelog()
    changelogs.forEach((log) => {
      expect(screen.getByText(`v${log.version}`)).toBeInTheDocument()
      expect(screen.getByText(log.title)).toBeInTheDocument()
    })
  })

  it('태그(신규/개선/수정)를 표시한다', () => {
    renderChangelog()
    const firstTag = changelogs[0].items[0].tag
    expect(screen.getAllByText(firstTag).length).toBeGreaterThan(0)
  })

  it('날짜를 표시한다', () => {
    renderChangelog()
    changelogs.forEach((log) => {
      expect(screen.getByText(log.date)).toBeInTheDocument()
    })
  })
})

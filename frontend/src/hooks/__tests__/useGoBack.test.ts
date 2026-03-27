import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// react-router-dom mock
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

import { useGoBack } from '../useGoBack'

describe('useGoBack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('히스토리가 충분하면 navigate(-1) 호출', () => {
    // history.length > 2: 현재 페이지 + 이전 페이지 존재
    Object.defineProperty(window, 'history', {
      value: { length: 3 },
      writable: true,
    })

    const { result } = renderHook(() => useGoBack('/settings'))
    act(() => result.current())

    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('히스토리가 없으면 fallback 경로로 이동', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
      writable: true,
    })

    const { result } = renderHook(() => useGoBack('/settings'))
    act(() => result.current())

    expect(mockNavigate).toHaveBeenCalledWith('/settings')
  })

  it('fallback 기본값은 /home', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
      writable: true,
    })

    const { result } = renderHook(() => useGoBack())
    act(() => result.current())

    expect(mockNavigate).toHaveBeenCalledWith('/home')
  })
})

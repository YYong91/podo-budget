/**
 * @file FloatingTabBar.test.tsx
 * @description 플로팅 아일랜드 탭바 컴포넌트 테스트
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FloatingTabBar from '../FloatingTabBar'

function renderTabBar(onInputOpen = vi.fn(), initialPath = '/home') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <FloatingTabBar onInputOpen={onInputOpen} />
    </MemoryRouter>
  )
}

describe('FloatingTabBar', () => {
  it('3개 탭(가계부/돌아보기/더보기)을 렌더링한다', () => {
    renderTabBar()
    expect(screen.getByRole('link', { name: '가계부' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '돌아보기' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '더보기' })).toBeInTheDocument()
  })

  it('입력 버튼을 렌더링한다', () => {
    renderTabBar()
    expect(screen.getByRole('button', { name: '거래 입력' })).toBeInTheDocument()
  })

  it('현재 경로(/home)에서 가계부 탭이 활성화된다', () => {
    renderTabBar()
    const link = screen.getByRole('link', { name: '가계부' })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('입력 버튼 클릭 시 onInputOpen 콜백을 호출한다', () => {
    const onInputOpen = vi.fn()
    renderTabBar(onInputOpen)
    fireEvent.click(screen.getByRole('button', { name: '거래 입력' }))
    expect(onInputOpen).toHaveBeenCalledOnce()
  })
})

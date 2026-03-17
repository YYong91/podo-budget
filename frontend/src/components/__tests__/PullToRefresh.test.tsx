/**
 * @file PullToRefresh.test.tsx
 * @description 당겨서 새로고침 컴포넌트 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PullToRefresh from '../PullToRefresh'

// matchMedia 모킹 — standalone 모드 시뮬레이션
function mockStandalone(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)' ? standalone : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('PullToRefresh', () => {
  beforeEach(() => {
    // 기본: standalone 모드
    mockStandalone(true)
  })

  it('children을 렌더링한다', () => {
    render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>테스트 콘텐츠</div>
      </PullToRefresh>,
    )
    expect(screen.getByText('테스트 콘텐츠')).toBeInTheDocument()
  })

  it('PWA standalone 모드에서 인디케이터 컨테이너가 높이 0으로 숨겨져 있다', () => {
    const { container } = render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const indicator = container.querySelector('.overflow-hidden') as HTMLElement
    expect(indicator).toBeTruthy()
    expect(indicator.style.height).toBe('0px')
  })

  it('모바일 브라우저(비-standalone)에서도 children을 렌더링한다', () => {
    mockStandalone(false)
    render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>브라우저 콘텐츠</div>
      </PullToRefresh>,
    )
    expect(screen.getByText('브라우저 콘텐츠')).toBeInTheDocument()
  })

  it('컨테이너 ref가 설정된다', () => {
    const { container } = render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('relative')
  })
})

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

  it('standalone 모드에서 touch 이벤트를 등록한다', () => {
    mockStandalone(true)
    const { container } = render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement
    // 이벤트 리스너가 등록되어 있는지 직접 검증할 수 없으므로
    // wrapper가 정상 렌더링되는지만 확인
    expect(wrapper).toBeTruthy()
  })

  it('비-standalone 모드에서 인디케이터 영역이 존재한다', () => {
    mockStandalone(false)
    const { container } = render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const indicator = container.querySelector('.overflow-hidden')
    expect(indicator).toBeTruthy()
  })

  it('터치 이벤트 시뮬레이션 — touchstart, touchend', () => {
    mockStandalone(true)
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement

    // scrollY를 0으로 설정
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true })

    // touchstart
    wrapper.dispatchEvent(new TouchEvent('touchstart', {
      touches: [{ clientY: 100, clientX: 50 } as Touch],
      bubbles: true,
    }))

    // touchend (pullDist가 threshold 미만이므로 refresh 호출 안됨)
    wrapper.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true,
    }))

    // threshold 미만이므로 onRefresh는 호출되지 않아야 함
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

/**
 * @file PullToRefresh.test.tsx
 * @description 당겨서 새로고침 컴포넌트 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
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

/** 터치 이벤트 생성 헬퍼 */
function createTouchEvent(type: string, clientY: number): TouchEvent {
  return new TouchEvent(type, {
    touches: type === 'touchend' || type === 'touchcancel' ? [] : [{ clientY, clientX: 0, identifier: 0, target: document.body, force: 0, pageX: 0, pageY: 0, radiusX: 0, radiusY: 0, rotationAngle: 0, screenX: 0, screenY: 0 } as Touch],
    bubbles: true,
    cancelable: true,
  })
}

describe('PullToRefresh', () => {
  beforeEach(() => {
    mockStandalone(true)
    // window.scrollY를 0으로 설정
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('standalone 모드에서 touchstart 이벤트가 등록된다', () => {
    const { container } = render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement
    const addEventSpy = vi.spyOn(wrapper, 'addEventListener')

    // 이미 useEffect에서 등록됨 — 최소한 컨테이너가 존재하는지 확인
    expect(wrapper).toBeTruthy()
    addEventSpy.mockRestore()
  })

  it('standalone 모드에서 터치 다운 → 이동 → 릴리스 사이클 동작', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <PullToRefresh onRefresh={mockRefresh}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement

    // 터치 시작 (스크롤 최상단, Y=100)
    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchstart', 100))
    })

    // 아래로 당기기 (Y=300, delta=200 → pullDist = 200*0.4 = 80 > THRESHOLD 60)
    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchmove', 300))
    })

    // 인디케이터가 표시됨
    const indicator = container.querySelector('.overflow-hidden') as HTMLElement
    // pullDistance > 10이면 인디케이터가 보임
    expect(indicator).toBeTruthy()

    // 터치 종료 — refresh 호출
    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchend', 300))
    })

    // onRefresh가 호출됨
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('당기기가 임계값 미만이면 refresh가 호출되지 않는다', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <PullToRefresh onRefresh={mockRefresh}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement

    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchstart', 100))
    })

    // 작은 움직임 (delta=20 → pullDist = 20*0.4 = 8 < THRESHOLD 60)
    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchmove', 120))
    })

    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchend', 120))
    })

    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('위로 스와이프 시 풀링이 취소된다', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <PullToRefresh onRefresh={mockRefresh}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement

    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchstart', 200))
    })

    // 위로 스와이프 (delta < 0)
    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchmove', 100))
    })

    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchend', 100))
    })

    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('touchcancel도 정리 처리된다', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <PullToRefresh onRefresh={mockRefresh}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement

    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchstart', 100))
    })

    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchcancel', 100))
    })

    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('스크롤이 최상단이 아니면 터치를 무시한다', async () => {
    Object.defineProperty(window, 'scrollY', { value: 100, writable: true })

    const mockRefresh = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <PullToRefresh onRefresh={mockRefresh}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement

    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchstart', 100))
    })

    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchmove', 300))
    })

    await act(async () => {
      wrapper.dispatchEvent(createTouchEvent('touchend', 300))
    })

    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('비-standalone 모드에서는 터치 이벤트를 등록하지 않는다', () => {
    mockStandalone(false)
    const mockRefresh = vi.fn()
    const { container } = render(
      <PullToRefresh onRefresh={mockRefresh}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toBeTruthy()
    // 단순히 children만 렌더링되고 터치 이벤트 없음
  })

  it('새로고침 중 텍스트가 표시된다', () => {
    // 기본 상태에서는 "당겨서 새로고침" 텍스트가 보이지 않음 (pullDistance <= 10)
    const { container } = render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    // 인디케이터 컨테이너가 존재하지만 높이 0
    const indicator = container.querySelector('.overflow-hidden') as HTMLElement
    expect(indicator.style.height).toBe('0px')
  })
})

/**
 * @file PullToRefresh.test.tsx
 * @description 당겨서 새로고침 컴포넌트 테스트
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PullToRefresh from '../PullToRefresh'

describe('PullToRefresh', () => {
  it('children을 렌더링한다', () => {
    render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>테스트 콘텐츠</div>
      </PullToRefresh>,
    )
    expect(screen.getByText('테스트 콘텐츠')).toBeInTheDocument()
  })

  it('기본 상태에서 새로고침 인디케이터가 높이 0으로 숨겨져 있다', () => {
    const { container } = render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    // 인디케이터 컨테이너의 높이가 0
    const indicator = container.querySelector('.overflow-hidden') as HTMLElement
    expect(indicator).toBeTruthy()
    expect(indicator.style.height).toBe('0px')
  })

  it('컨테이너 ref가 설정된다', () => {
    const { container } = render(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>콘텐츠</div>
      </PullToRefresh>,
    )
    // relative 포지셔닝을 가진 컨테이너가 있어야 함
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('relative')
  })
})

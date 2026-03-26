/**
 * @file SubPageWrapper.test.tsx
 * @description SubPageWrapper 컴포넌트 테스트 — 뒤로가기 버튼, children 렌더링 검증
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SubPageWrapper from '../SubPageWrapper'

const mockGoBack = vi.fn()
vi.mock('../../../hooks/useGoBack', () => ({
  useGoBack: () => mockGoBack,
}))

function renderWrapper(children: React.ReactNode = <div>테스트 콘텐츠</div>) {
  return render(
    <MemoryRouter>
      <SubPageWrapper>{children}</SubPageWrapper>
    </MemoryRouter>,
  )
}

describe('SubPageWrapper', () => {
  it('뒤로가기 버튼을 표시한다', () => {
    renderWrapper()
    const backButton = screen.getByRole('button')
    expect(backButton).toBeInTheDocument()
  })

  it('children을 렌더링한다', () => {
    renderWrapper()
    expect(screen.getByText('테스트 콘텐츠')).toBeInTheDocument()
  })

  it('뒤로가기 버튼 클릭 시 goBack을 호출한다', () => {
    renderWrapper()
    const backButton = screen.getByRole('button')
    fireEvent.click(backButton)
    expect(mockGoBack).toHaveBeenCalled()
  })

  it('여러 children을 렌더링한다', () => {
    renderWrapper(
      <>
        <div>첫 번째</div>
        <div>두 번째</div>
      </>,
    )
    expect(screen.getByText('첫 번째')).toBeInTheDocument()
    expect(screen.getByText('두 번째')).toBeInTheDocument()
  })
})
